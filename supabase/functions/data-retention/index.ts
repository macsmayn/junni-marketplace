// REPORT-ONLY MODE — deletion is NOT yet enabled in this version.
// This function computes what WOULD be deleted and returns a structured JSON
// report. It writes nothing to the database, sends no emails, and deletes
// nothing. Actual deletion will be enabled in a subsequent version after the
// report has been reviewed and verified against live data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-auth0-token, x-data-retention-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Authentication note ────────────────────────────────────────────────────────
// This function has no browser UI. It is called by a scheduler (no Auth0 token
// available) and also manually by an admin for testing (Auth0 token available).
// Two caller types are therefore accepted:
//
//   1. Scheduler / service call: provides the DATA_RETENTION_SECRET env var
//      value in the X-Data-Retention-Secret header. No Auth0 token needed.
//
//   2. Admin manual call from a browser session: provides an Auth0 ID token
//      in X-Auth0-Token, verified via Auth0 /userinfo. The caller's
//      users.role must be "admin".
//
// The Auth0-then-DB pattern matches every other function in this project.
// The pre-shared secret path exists only because schedulers have no browser
// session and therefore no Auth0 token.
// ──────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    let secretKey: string;
    try {
      secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")[
        "default"
      ] ?? "";
    } catch {
      secretKey = "";
    }
    if (!secretKey) {
      console.error(
        "[data-retention] SUPABASE_SECRET_KEYS missing or 'default' entry not found"
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;
    const DATA_RETENTION_SECRET = Deno.env.get("DATA_RETENTION_SECRET") ?? "";

    const supabase = createClient(SUPABASE_URL, secretKey);

    // ── Authenticate caller ─────────────────────────────────────────────────────
    const secretHeader = req.headers.get("X-Data-Retention-Secret");
    const auth0Token = req.headers.get("X-Auth0-Token");
    let callerLabel = "";

    if (secretHeader) {
      if (!DATA_RETENTION_SECRET || secretHeader !== DATA_RETENTION_SECRET) {
        console.error("[data-retention] Invalid X-Data-Retention-Secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      callerLabel = "scheduler";
    } else if (auth0Token) {
      const userInfoRes = await fetch(
        `https://${AUTH0_DOMAIN}/userinfo`,
        { headers: { Authorization: `Bearer ${auth0Token}` } }
      );
      if (!userInfoRes.ok) {
        console.error(
          "[data-retention] /userinfo rejected token — status:",
          userInfoRes.status
        );
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const userInfo = await userInfoRes.json();
      const callerSub: string = userInfo.sub ?? "";
      if (!callerSub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const { data: callerUser, error: callerErr } = await supabase
        .from("users")
        .select("id, role")
        .eq("auth0_id", callerSub)
        .maybeSingle();
      if (callerErr || !callerUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (callerUser.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Forbidden: admin role required" }),
          {
            status: 403,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }
      callerLabel = `admin:${callerUser.id}`;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End authentication ──────────────────────────────────────────────────────

    const now = new Date();

    // ── Step 1: Identify eligible organizations ─────────────────────────────────
    // An org is eligible for the retention lifecycle only if:
    //   a) It has at least one subscription with status = 'canceled'
    //   b) It has NO subscription in an active status (trialing, active, past_due)
    //
    // The subscription end date is MAX(current_period_end) among canceled rows.
    // An org that canceled and later resubscribed has an active row and is
    // excluded — it must never be flagged for deletion.

    const { data: allSubs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("org_id, status, current_period_end");

    if (subsErr) {
      console.error("[data-retention] subscriptions fetch failed:", subsErr);
      return new Response(
        JSON.stringify({ error: "Internal error fetching subscriptions" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    type OrgSubState = { hasActive: boolean; latestCanceledEnd: Date | null };
    const orgSubMap = new Map<string, OrgSubState>();

    for (const row of allSubs ?? []) {
      const orgId: string = row.org_id;
      const isActive = ["trialing", "active", "past_due"].includes(row.status);
      const isCanceled = row.status === "canceled";

      if (!orgSubMap.has(orgId)) {
        orgSubMap.set(orgId, { hasActive: false, latestCanceledEnd: null });
      }
      const entry = orgSubMap.get(orgId)!;

      if (isActive) {
        entry.hasActive = true;
      }
      if (isCanceled && row.current_period_end) {
        const endDate = new Date(row.current_period_end);
        if (!entry.latestCanceledEnd || endDate > entry.latestCanceledEnd) {
          entry.latestCanceledEnd = endDate;
        }
      }
    }

    type EligibleOrg = { orgId: string; endDate: Date; daysElapsed: number };
    const eligibleOrgs: EligibleOrg[] = [];

    for (const [orgId, entry] of orgSubMap.entries()) {
      if (!entry.hasActive && entry.latestCanceledEnd) {
        const daysElapsed =
          (now.getTime() - entry.latestCanceledEnd.getTime()) / DAY_MS;
        eligibleOrgs.push({
          orgId,
          endDate: entry.latestCanceledEnd,
          daysElapsed,
        });
      }
    }

    // Early return if nothing to process
    if (eligibleOrgs.length === 0) {
      const report = {
        run_at: now.toISOString(),
        caller: callerLabel,
        mode: "report_only",
        deletion_not_enabled: true,
        summary: {
          eligible_orgs: 0,
          needs_30d_warning: 0,
          needs_14d_warning: 0,
          due_for_deletion: 0,
          no_action: 0,
        },
        due_for_deletion: [],
        needs_warning: [],
        no_action: [],
      };
      console.log("[data-retention] Report:", JSON.stringify(report, null, 2));
      return new Response(JSON.stringify(report, null, 2), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Step 2: Fetch org names and existing retention log entries ──────────────
    const eligibleOrgIds = eligibleOrgs.map((e) => e.orgId);

    const [
      { data: orgRows, error: orgErr },
      { data: logRows, error: logErr },
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name")
        .in("id", eligibleOrgIds),
      supabase
        .from("data_retention_log")
        .select(
          "org_id, warning_30d_sent_at, warning_14d_sent_at, deleted_at"
        )
        .in("org_id", eligibleOrgIds),
    ]);

    if (orgErr) {
      console.error(
        "[data-retention] organizations fetch failed:",
        orgErr
      );
      return new Response(
        JSON.stringify({ error: "Internal error fetching organizations" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    if (logErr) {
      console.error(
        "[data-retention] data_retention_log fetch failed:",
        logErr
      );
      return new Response(
        JSON.stringify({ error: "Internal error fetching retention log" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const orgNameMap = new Map<string, string>();
    for (const o of orgRows ?? []) orgNameMap.set(o.id, o.name);

    // data_retention_log may have multiple rows per org (one per event).
    // Collapse to the union of all flags per org.
    type LogState = {
      warning_30d_sent_at: string | null;
      warning_14d_sent_at: string | null;
      deleted_at: string | null;
    };
    const logMap = new Map<string, LogState>();
    for (const l of logRows ?? []) {
      const existing = logMap.get(l.org_id) ?? {
        warning_30d_sent_at: null,
        warning_14d_sent_at: null,
        deleted_at: null,
      };
      logMap.set(l.org_id, {
        warning_30d_sent_at:
          existing.warning_30d_sent_at ?? l.warning_30d_sent_at,
        warning_14d_sent_at:
          existing.warning_14d_sent_at ?? l.warning_14d_sent_at,
        deleted_at: existing.deleted_at ?? l.deleted_at,
      });
    }

    // ── Step 3: Categorize each eligible org ────────────────────────────────────
    // Thresholds (days after subscription end):
    //   60 days → send 30-day warning (30 days before deletion at day 90)
    //   76 days → send 14-day warning
    //   90 days → delete
    //
    // Skip a warning category if the log shows it was already sent.
    // Skip all categories if the log shows the org was already deleted.

    type OrgCategory =
      | "due_for_deletion"
      | "needs_14d_warning"
      | "needs_30d_warning"
      | "no_action";

    type CategorizedOrg = EligibleOrg & {
      orgName: string;
      scheduledDeletionAt: Date;
      category: OrgCategory;
      warning30dAlreadySent: boolean;
      warning14dAlreadySent: boolean;
      alreadyDeleted: boolean;
    };

    const categorized: CategorizedOrg[] = [];

    for (const { orgId, endDate, daysElapsed } of eligibleOrgs) {
      const log = logMap.get(orgId) ?? {
        warning_30d_sent_at: null,
        warning_14d_sent_at: null,
        deleted_at: null,
      };
      const scheduledDeletionAt = new Date(endDate.getTime() + 90 * DAY_MS);
      const warning30dAlreadySent = !!log.warning_30d_sent_at;
      const warning14dAlreadySent = !!log.warning_14d_sent_at;
      const alreadyDeleted = !!log.deleted_at;

      let category: OrgCategory;
      if (alreadyDeleted) {
        // Already processed — treated as no_action regardless of days elapsed
        category = "no_action";
      } else if (daysElapsed >= 90) {
        category = "due_for_deletion";
      } else if (daysElapsed >= 76 && !warning14dAlreadySent) {
        category = "needs_14d_warning";
      } else if (daysElapsed >= 60 && !warning30dAlreadySent) {
        category = "needs_30d_warning";
      } else {
        category = "no_action";
      }

      categorized.push({
        orgId,
        orgName: orgNameMap.get(orgId) ?? "(unknown)",
        endDate,
        daysElapsed,
        scheduledDeletionAt,
        category,
        warning30dAlreadySent,
        warning14dAlreadySent,
        alreadyDeleted,
      });
    }

    const deletionCandidates = categorized.filter(
      (e) => e.category === "due_for_deletion"
    );
    const warningCandidates = categorized.filter(
      (e) =>
        e.category === "needs_30d_warning" ||
        e.category === "needs_14d_warning"
    );
    const noActionOrgs = categorized.filter((e) => e.category === "no_action");

    // ── Step 4: Full inventory for deletion candidates ──────────────────────────
    // Count rows in every affected table. Two helpers:
    //   countByOrgId  — tables with a direct org_id column
    //   countViaDeals — tables with deal_id that links through deals.org_id
    //
    // We fetch deal IDs first then pass as an array to .in(), since PostgREST
    // does not support subquery expressions in the JS client.

    async function countByOrgId(
      table: string,
      orgId: string
    ): Promise<number> {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) {
        console.error(
          `[data-retention] count ${table} for org ${orgId}:`,
          error
        );
        return -1;
      }
      return count ?? 0;
    }

    async function countViaDeals(
      table: string,
      dealIds: string[]
    ): Promise<number> {
      if (dealIds.length === 0) return 0;
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .in("deal_id", dealIds);
      if (error) {
        console.error(`[data-retention] count ${table}:`, error);
        return -1;
      }
      return count ?? 0;
    }

    interface UserRef {
      id: string;
      email: string | null;
    }
    interface UserToKeepRef extends UserRef {
      otherOrgCount: number;
    }

    interface DeletionInventory {
      orgId: string;
      orgName: string;
      endDate: string;
      daysElapsed: number;
      scheduledDeletionAt: string;
      warning30dAlreadySent: boolean;
      warning14dAlreadySent: boolean;
      counts: Record<string, number>;
      usersToDelete: UserRef[];
      usersToKeep: UserToKeepRef[];
    }

    const deletionInventories: DeletionInventory[] = [];

    for (const org of deletionCandidates) {
      // Fetch this org's deal IDs first — used for all deal-child counts
      const { data: dealRows, error: dealIdErr } = await supabase
        .from("deals")
        .select("id")
        .eq("org_id", org.orgId);

      if (dealIdErr) {
        console.error(
          `[data-retention] deals fetch for org ${org.orgId}:`,
          dealIdErr
        );
      }

      const dealIds: string[] = (dealRows ?? []).map((d: any) => d.id);
      const dealCount = dealIds.length;

      // Count all deal-child tables in parallel
      const [
        documentsCount,
        extractedFinancialsCount,
        creditScoresCount,
        creditScoresHistoryCount,
        scoreMetricResultsCount,
        scoreMetricResultsHistoryCount,
        creditQuestionsCount,
        creditAnswersCount,
        creditFlagsCount,
        computedMetricsCount,
        collateralAssetsCount,
        collateralAssetsHistoryCount,
        capitalizationItemsCount,
        capitalizationItemsHistoryCount,
        sourcesUsesEntriesCount,
        sourcesUsesEntriesHistoryCount,
        capTableEntriesCount,
        financialAnnotationsCount,
      ] = await Promise.all([
        countViaDeals("documents", dealIds),
        countViaDeals("extracted_financials", dealIds),
        countViaDeals("credit_scores", dealIds),
        countViaDeals("credit_scores_history", dealIds),
        countViaDeals("score_metric_results", dealIds),
        countViaDeals("score_metric_results_history", dealIds),
        countViaDeals("credit_questions", dealIds),
        countViaDeals("credit_answers", dealIds),
        countViaDeals("credit_flags", dealIds),
        countViaDeals("computed_metrics", dealIds),
        countViaDeals("collateral_assets", dealIds),
        countViaDeals("collateral_assets_history", dealIds),
        countViaDeals("capitalization_items", dealIds),
        countViaDeals("capitalization_items_history", dealIds),
        countViaDeals("sources_uses_entries", dealIds),
        countViaDeals("sources_uses_entries_history", dealIds),
        countViaDeals("cap_table_entries", dealIds),
        countViaDeals("financial_annotations", dealIds),
      ]);

      // Count direct org tables in parallel
      const [
        orgMembersCount,
        orgInvitesCount,
        lenderMetricOverridesCount,
        lenderThresholdOverridesCount,
        metricOverrideLogCount,
        thresholdOverrideLogCount,
        billingCustomersCount,
        subscriptionsCount,
      ] = await Promise.all([
        countByOrgId("organization_members", org.orgId),
        countByOrgId("org_invites", org.orgId),
        countByOrgId("lender_metric_overrides", org.orgId),
        countByOrgId("lender_threshold_overrides", org.orgId),
        countByOrgId("metric_override_log", org.orgId),
        countByOrgId("threshold_override_log", org.orgId),
        countByOrgId("billing_customers", org.orgId),
        countByOrgId("subscriptions", org.orgId),
      ]);

      // Storage file count equals documents count: each documents row has one
      // storage_path in the "documents" storage bucket at <deal_id>/<timestamp>_<name>.
      // The storage objects are not auto-deleted by DB cascades and must be
      // explicitly removed by path before or after the DB deletion.
      const storageFilesCount = documentsCount;

      // ── Classify member users: delete vs. keep ──────────────────────────────
      // A user is deleted only if this is their last remaining org membership.
      // A user in another org keeps their account; only their membership in this
      // org (and associated notifications) are removed.

      const { data: memberRows, error: membersErr } = await supabase
        .from("organization_members")
        .select("user_id, users(id, email)")
        .eq("org_id", org.orgId);

      if (membersErr) {
        console.error(
          `[data-retention] org members fetch for org ${org.orgId}:`,
          membersErr
        );
      }

      const usersToDelete: UserRef[] = [];
      const usersToKeep: UserToKeepRef[] = [];

      for (const m of memberRows ?? []) {
        const user = m.users as { id: string; email: string | null } | null;
        if (!user) continue;

        const { count: otherOrgCount, error: otherErr } = await supabase
          .from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("org_id", org.orgId);

        if (otherErr) {
          console.error(
            `[data-retention] other-org count for user ${user.id}:`,
            otherErr
          );
        }

        if ((otherOrgCount ?? 0) === 0) {
          usersToDelete.push({ id: user.id, email: user.email });
        } else {
          usersToKeep.push({
            id: user.id,
            email: user.email,
            otherOrgCount: otherOrgCount ?? 0,
          });
        }
      }

      deletionInventories.push({
        orgId: org.orgId,
        orgName: org.orgName,
        endDate: org.endDate.toISOString(),
        daysElapsed: Math.floor(org.daysElapsed),
        scheduledDeletionAt: org.scheduledDeletionAt.toISOString(),
        warning30dAlreadySent: org.warning30dAlreadySent,
        warning14dAlreadySent: org.warning14dAlreadySent,
        counts: {
          organization: 1,
          deals: dealCount,
          documents: documentsCount,
          storage_files: storageFilesCount,
          extracted_financials: extractedFinancialsCount,
          credit_scores: creditScoresCount,
          credit_scores_history: creditScoresHistoryCount,
          score_metric_results: scoreMetricResultsCount,
          score_metric_results_history: scoreMetricResultsHistoryCount,
          credit_questions: creditQuestionsCount,
          credit_answers: creditAnswersCount,
          credit_flags: creditFlagsCount,
          computed_metrics: computedMetricsCount,
          collateral_assets: collateralAssetsCount,
          collateral_assets_history: collateralAssetsHistoryCount,
          capitalization_items: capitalizationItemsCount,
          capitalization_items_history: capitalizationItemsHistoryCount,
          sources_uses_entries: sourcesUsesEntriesCount,
          sources_uses_entries_history: sourcesUsesEntriesHistoryCount,
          cap_table_entries: capTableEntriesCount,
          financial_annotations: financialAnnotationsCount,
          organization_members: orgMembersCount,
          org_invites: orgInvitesCount,
          lender_metric_overrides: lenderMetricOverridesCount,
          lender_threshold_overrides: lenderThresholdOverridesCount,
          metric_override_log: metricOverrideLogCount,
          threshold_override_log: thresholdOverrideLogCount,
          billing_customers: billingCustomersCount,
          subscriptions: subscriptionsCount,
        },
        usersToDelete,
        usersToKeep,
      });
    }

    // ── Step 5: Build and return the report ─────────────────────────────────────
    const report = {
      run_at: now.toISOString(),
      caller: callerLabel,
      mode: "report_only",
      deletion_not_enabled: true,
      summary: {
        eligible_orgs: categorized.length,
        needs_30d_warning: categorized.filter(
          (e) => e.category === "needs_30d_warning"
        ).length,
        needs_14d_warning: categorized.filter(
          (e) => e.category === "needs_14d_warning"
        ).length,
        due_for_deletion: deletionCandidates.length,
        no_action: noActionOrgs.length,
      },
      due_for_deletion: deletionInventories,
      needs_warning: warningCandidates.map((org) => ({
        orgId: org.orgId,
        orgName: org.orgName,
        endDate: org.endDate.toISOString(),
        daysElapsed: Math.floor(org.daysElapsed),
        scheduledDeletionAt: org.scheduledDeletionAt.toISOString(),
        category: org.category,
        warning30dAlreadySent: org.warning30dAlreadySent,
        warning14dAlreadySent: org.warning14dAlreadySent,
      })),
      no_action: noActionOrgs.map((org) => ({
        orgId: org.orgId,
        orgName: org.orgName,
        endDate: org.endDate.toISOString(),
        daysElapsed: Math.floor(org.daysElapsed),
        scheduledDeletionAt: org.scheduledDeletionAt.toISOString(),
        alreadyDeleted: org.alreadyDeleted,
      })),
    };

    console.log("[data-retention] Report:", JSON.stringify(report, null, 2));

    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[data-retention] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
