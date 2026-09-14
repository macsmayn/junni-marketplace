// This function manages the data retention lifecycle for organizations whose
// subscriptions have ended. It supports three modes via the `mode` body parameter:
//
//   "report"  (default) — computes what would be affected and returns a structured
//                         JSON report. Writes nothing, sends no emails, deletes nothing.
//
//   "warn"    — sends due warning emails (30-day and 14-day) to organization owners
//               and records them in data_retention_log. Performs no deletions.
//
//   "execute" — sends due warnings AND performs deletions for organizations 90+ days
//               past their subscription end date, in a safe sequence that handles
//               storage files, RESTRICT FK constraints, and cascades explicitly.
//
// Retention schedule (days after subscription end):
//   Day 60: 30-day warning email sent to org owner
//   Day 76: 14-day warning email sent to org owner
//   Day 90: organization data permanently deleted
//
// Authentication: X-Data-Retention-Secret header (scheduler) OR
//                 X-Auth0-Token + admin DB role (manual admin call).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-auth0-token, x-data-retention-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(date: Date, lang: "en" | "fr"): string {
  const MONTHS_EN = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const MONTHS_FR = [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre",
  ];
  const d = date.getUTCDate();
  const m = lang === "fr" ? MONTHS_FR[date.getUTCMonth()] : MONTHS_EN[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return lang === "fr" ? `${d} ${m} ${y}` : `${m} ${d}, ${y}`;
}

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

    const supabase = createClient(SUPABASE_URL, secretKey);

    // ── Authenticate caller ─────────────────────────────────────────────────────
    // Two caller types are accepted:
    //   1. Scheduler: X-Data-Retention-Secret header matching DATA_RETENTION_SECRET env var.
    //   2. Admin manual call: X-Auth0-Token verified via Auth0 /userinfo; users.role = "admin".
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

    // ── Parse body → mode ───────────────────────────────────────────────────────
    let bodyJson: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text.trim()) bodyJson = JSON.parse(text);
    } catch {
      // empty or non-JSON body → default mode
    }
    const rawMode =
      typeof bodyJson.mode === "string" ? bodyJson.mode.trim() : "report";
    const mode: "report" | "warn" | "execute" =
      rawMode === "warn"
        ? "warn"
        : rawMode === "execute"
        ? "execute"
        : "report";
    // ── End parse body ──────────────────────────────────────────────────────────

    const now = new Date();
    const nowIso = now.toISOString();

    // ── Helper: count rows by org_id ────────────────────────────────────────────
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

    // ── Helper: count rows via deal_id (two-step, PostgREST JS limitation) ──────
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

    // ── Helper: upsert data_retention_log row ───────────────────────────────────
    async function writeRetentionLog(
      orgId: string,
      fields: Record<string, unknown>
    ): Promise<void> {
      const { data: existing } = await supabase
        .from("data_retention_log")
        .select("org_id")
        .eq("org_id", orgId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("data_retention_log")
          .update(fields)
          .eq("org_id", orgId);
        if (error) {
          console.error(`[data-retention] log update for org ${orgId}:`, error);
        }
      } else {
        const { error } = await supabase
          .from("data_retention_log")
          .insert({ org_id: orgId, ...fields });
        if (error) {
          console.error(`[data-retention] log insert for org ${orgId}:`, error);
        }
      }
    }

    // ── Helper: send warning email via Resend ───────────────────────────────────
    async function sendWarningEmail(params: {
      ownerEmail: string;
      lang: "en" | "fr";
      orgName: string;
      endDate: Date;
      deletionDate: Date;
      type: "30d" | "14d";
    }): Promise<{ sent: boolean; error?: string }> {
      if (!RESEND_API_KEY) {
        console.error("[data-retention] sendWarningEmail: RESEND_API_KEY not configured");
        return { sent: false, error: "RESEND_API_KEY not configured" };
      }
      const { ownerEmail, lang, orgName, endDate, deletionDate, type } = params;
      const endDateStr = formatDate(endDate, lang);
      const deletionDateStr = formatDate(deletionDate, lang);

      let subject: string;
      let html: string;

      if (lang === "fr") {
        if (type === "30d") {
          subject = `Important : Les données de ${orgName} sur Junni seront supprimées le ${deletionDateStr}`;
          html =
            `<p>Bonjour,</p>` +
            `<p>L'abonnement Junni de <strong>${orgName}</strong> a pris fin le ${endDateStr}.</p>` +
            `<p>Conformément à notre politique de conservation des données, les données de votre organisation seront <strong>définitivement et irrévocablement supprimées le ${deletionDateStr}</strong> — dans 30 jours.</p>` +
            `<p>D'ici là, vous pouvez nous écrire à <a href="mailto:support@junni.ca">support@junni.ca</a> pour demander une exportation de vos données ou discuter de la réactivation de votre abonnement.</p>` +
            `<p>L'équipe Junni<br>Junni Technologies Inc.</p>`;
        } else {
          subject = `Rappel : Les données de ${orgName} sur Junni seront supprimées le ${deletionDateStr}`;
          html =
            `<p>Bonjour,</p>` +
            `<p>Rappel : l'abonnement Junni de <strong>${orgName}</strong> a pris fin le ${endDateStr} et les données de votre organisation seront <strong>définitivement supprimées le ${deletionDateStr}</strong> — dans 14 jours.</p>` +
            `<p>Pour demander une exportation ou réactiver votre abonnement, contactez-nous à <a href="mailto:support@junni.ca">support@junni.ca</a> avant cette date.</p>` +
            `<p>L'équipe Junni<br>Junni Technologies Inc.</p>`;
        }
      } else {
        if (type === "30d") {
          subject = `Important: ${orgName}'s Junni data will be deleted on ${deletionDateStr}`;
          html =
            `<p>Hi,</p>` +
            `<p>The Junni subscription for <strong>${orgName}</strong> ended on ${endDateStr}.</p>` +
            `<p>Under our data retention policy, your organization's data will be <strong>permanently and irreversibly deleted on ${deletionDateStr}</strong> — 30 days from now.</p>` +
            `<p>Before that date, you can write to us at <a href="mailto:support@junni.ca">support@junni.ca</a> to request a data export or to discuss reactivating your subscription.</p>` +
            `<p>The Junni team<br>Junni Technologies Inc.</p>`;
        } else {
          subject = `Reminder: ${orgName}'s Junni data will be deleted on ${deletionDateStr}`;
          html =
            `<p>Hi,</p>` +
            `<p>This is a reminder that the Junni subscription for <strong>${orgName}</strong> ended on ${endDateStr}, and your organization's data is scheduled for <strong>permanent deletion on ${deletionDateStr}</strong> — in 14 days.</p>` +
            `<p>To request a data export or to reactivate your subscription, contact us at <a href="mailto:support@junni.ca">support@junni.ca</a> before that date.</p>` +
            `<p>The Junni team<br>Junni Technologies Inc.</p>`;
        }
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Junni <notifications@junni.ca>",
            to: [ownerEmail],
            subject,
            html,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error(
            `[data-retention] email to ${ownerEmail} failed (${res.status}):`,
            errBody
          );
          return { sent: false, error: `Resend ${res.status}` };
        }
        console.log(
          `[data-retention] ${type} warning email sent to ${ownerEmail} for org "${orgName}"`
        );
        return { sent: true };
      } catch (err: any) {
        console.error(
          `[data-retention] email to ${ownerEmail} threw:`,
          err.message
        );
        return { sent: false, error: err.message };
      }
    }

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
        run_at: nowIso,
        caller: callerLabel,
        mode,
        summary: {
          eligible_orgs: 0,
          needs_30d_warning: 0,
          needs_14d_warning: 0,
          due_for_deletion: 0,
          no_action: 0,
          ...(mode !== "report" ? { warnings_sent: 0, warnings_failed: 0 } : {}),
          ...(mode === "execute" ? { deletions_performed: 0, deletions_failed: 0 } : {}),
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
      console.error("[data-retention] organizations fetch failed:", orgErr);
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

      const storageFilesCount = documentsCount;

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

    // ── Step 5: Process warning emails (mode: warn | execute) ───────────────────
    interface WarningResult {
      orgId: string;
      orgName: string;
      warningType: "30d" | "14d";
      ownerEmail: string | null;
      sent: boolean;
      error?: string;
    }
    const warningResults: WarningResult[] = [];

    if (mode === "warn" || mode === "execute") {
      for (const org of warningCandidates) {
        const warningType: "30d" | "14d" =
          org.category === "needs_14d_warning" ? "14d" : "30d";

        const { data: ownerMembership, error: ownerErr } = await supabase
          .from("organization_members")
          .select("user_id, users(email, language)")
          .eq("org_id", org.orgId)
          .eq("org_role", "owner")
          .maybeSingle();

        if (ownerErr) {
          console.error(
            `[data-retention] owner lookup for org ${org.orgId}:`,
            ownerErr
          );
        }

        const ownerUser = ownerMembership?.users as {
          email: string | null;
          language: string | null;
        } | null;
        const ownerEmail = ownerUser?.email ?? null;
        const lang: "en" | "fr" =
          ownerUser?.language === "fr" ? "fr" : "en";

        if (!ownerEmail) {
          const errMsg = "No owner email found";
          console.error(`[data-retention] org ${org.orgId}: ${errMsg}`);
          warningResults.push({
            orgId: org.orgId,
            orgName: org.orgName,
            warningType,
            ownerEmail: null,
            sent: false,
            error: errMsg,
          });
          continue;
        }

        const result = await sendWarningEmail({
          ownerEmail,
          lang,
          orgName: org.orgName,
          endDate: org.endDate,
          deletionDate: org.scheduledDeletionAt,
          type: warningType,
        });

        warningResults.push({
          orgId: org.orgId,
          orgName: org.orgName,
          warningType,
          ownerEmail,
          sent: result.sent,
          ...(result.error ? { error: result.error } : {}),
        });

        if (result.sent) {
          const logFields: Record<string, unknown> = {
            org_name: org.orgName,
            subscription_ended_at: org.endDate.toISOString(),
            scheduled_deletion_at: org.scheduledDeletionAt.toISOString(),
          };
          if (warningType === "30d") {
            logFields.warning_30d_sent_at = nowIso;
          } else {
            logFields.warning_14d_sent_at = nowIso;
          }
          await writeRetentionLog(org.orgId, logFields);
        }
      }
    }

    // ── Step 6: Perform deletions (mode: execute only) ──────────────────────────
    interface DeletionResult {
      orgId: string;
      orgName: string;
      success: boolean;
      countsDeleted?: Record<string, number>;
      error?: string;
    }
    const deletionResults: DeletionResult[] = [];

    if (mode === "execute") {
      for (const inventory of deletionInventories) {
        const orgId = inventory.orgId;
        const orgName = inventory.orgName;
        try {
          // a. Collect storage_path values from documents for this org's deals
          let storagePaths: string[] = [];
          if (inventory.counts.deals > 0) {
            const { data: dealRows2, error: dealErr2 } = await supabase
              .from("deals")
              .select("id")
              .eq("org_id", orgId);
            if (dealErr2) {
              throw new Error(`Failed to re-fetch deals: ${dealErr2.message}`);
            }
            const dealIds2 = (dealRows2 ?? []).map((d: any) => d.id as string);
            if (dealIds2.length > 0) {
              const { data: docRows, error: docErr } = await supabase
                .from("documents")
                .select("storage_path")
                .in("deal_id", dealIds2);
              if (docErr) {
                throw new Error(
                  `Failed to fetch document storage paths: ${docErr.message}`
                );
              }
              storagePaths = (docRows ?? [])
                .map((d: any) => d.storage_path as string | null)
                .filter(
                  (p): p is string => typeof p === "string" && p.length > 0
                );
            }
          }

          // b. Delete storage files — abort this org on failure to avoid orphaned files
          if (storagePaths.length > 0) {
            const { error: storageErr } = await supabase.storage
              .from("documents")
              .remove(storagePaths);
            if (storageErr) {
              console.error(
                `[data-retention] storage deletion failed for org ${orgId}:`,
                storageErr
              );
              await writeRetentionLog(orgId, {
                org_name: orgName,
                subscription_ended_at: inventory.endDate,
                scheduled_deletion_at: inventory.scheduledDeletionAt,
                error: `Storage deletion failed: ${storageErr.message}`,
              });
              deletionResults.push({
                orgId,
                orgName,
                success: false,
                error: `Storage deletion failed: ${storageErr.message}`,
              });
              continue;
            }
            console.log(
              `[data-retention] deleted ${storagePaths.length} storage files for org ${orgId}`
            );
          }

          // c. Delete subscriptions (RESTRICT FK on organizations)
          const { error: subDelErr } = await supabase
            .from("subscriptions")
            .delete()
            .eq("org_id", orgId);
          if (subDelErr) {
            throw new Error(`subscriptions delete: ${subDelErr.message}`);
          }

          // d. Delete deals (cascades to all deal-child tables)
          const { error: dealDelErr } = await supabase
            .from("deals")
            .delete()
            .eq("org_id", orgId);
          if (dealDelErr) {
            throw new Error(`deals delete: ${dealDelErr.message}`);
          }

          // e. Delete billing_customers (RESTRICT FK on organizations)
          const { error: billingDelErr } = await supabase
            .from("billing_customers")
            .delete()
            .eq("org_id", orgId);
          if (billingDelErr) {
            throw new Error(`billing_customers delete: ${billingDelErr.message}`);
          }

          // f. Delete users whose only org is this one.
          //    Remove their membership first in case the FK is not CASCADE.
          //    Deleting the users row cascades to notifications and lender_profiles.
          for (const user of inventory.usersToDelete) {
            const { error: memDelErr } = await supabase
              .from("organization_members")
              .delete()
              .eq("user_id", user.id)
              .eq("org_id", orgId);
            if (memDelErr) {
              console.error(
                `[data-retention] membership delete for user-to-delete ${user.id}:`,
                memDelErr
              );
            }
            const { error: userDelErr } = await supabase
              .from("users")
              .delete()
              .eq("id", user.id);
            if (userDelErr) {
              throw new Error(`user delete ${user.id}: ${userDelErr.message}`);
            }
          }

          // g. For users in other orgs: update active_org_id if it points here,
          //    then remove only their membership in this org.
          for (const user of inventory.usersToKeep) {
            const { data: userRow } = await supabase
              .from("users")
              .select("active_org_id")
              .eq("id", user.id)
              .maybeSingle();

            if (userRow?.active_org_id === orgId) {
              const { data: otherMemberships } = await supabase
                .from("organization_members")
                .select("org_id")
                .eq("user_id", user.id)
                .neq("org_id", orgId)
                .limit(1);
              const newOrgId: string | null =
                otherMemberships?.[0]?.org_id ?? null;
              const { error: activeOrgErr } = await supabase
                .from("users")
                .update({ active_org_id: newOrgId })
                .eq("id", user.id);
              if (activeOrgErr) {
                console.error(
                  `[data-retention] active_org_id update for user ${user.id}:`,
                  activeOrgErr
                );
              }
            }

            const { error: keepMemDelErr } = await supabase
              .from("organization_members")
              .delete()
              .eq("user_id", user.id)
              .eq("org_id", orgId);
            if (keepMemDelErr) {
              console.error(
                `[data-retention] membership delete for user-to-keep ${user.id}:`,
                keepMemDelErr
              );
            }
          }

          // h. Delete the organization row (cascades to remaining org-direct tables)
          const { error: orgDelErr } = await supabase
            .from("organizations")
            .delete()
            .eq("id", orgId);
          if (orgDelErr) {
            throw new Error(`organizations delete: ${orgDelErr.message}`);
          }

          console.log(
            `[data-retention] org ${orgId} ("${orgName}") deleted successfully`
          );

          // i. Record deletion in data_retention_log
          await writeRetentionLog(orgId, {
            org_name: orgName,
            subscription_ended_at: inventory.endDate,
            scheduled_deletion_at: inventory.scheduledDeletionAt,
            deleted_at: nowIso,
            deletion_summary: JSON.stringify(inventory.counts),
          });

          deletionResults.push({
            orgId,
            orgName,
            success: true,
            countsDeleted: inventory.counts,
          });
        } catch (err: any) {
          console.error(
            `[data-retention] deletion failed for org ${orgId}:`,
            err.message
          );
          await writeRetentionLog(orgId, {
            org_name: orgName,
            subscription_ended_at: inventory.endDate,
            scheduled_deletion_at: inventory.scheduledDeletionAt,
            error: err.message,
          });
          deletionResults.push({
            orgId,
            orgName,
            success: false,
            error: err.message,
          });
        }
      }
    }

    // ── Step 7: Build and return the response ───────────────────────────────────
    const warningsSent = warningResults.filter((w) => w.sent).length;
    const warningsFailed = warningResults.filter((w) => !w.sent).length;
    const deletionsPerformed = deletionResults.filter((d) => d.success).length;
    const deletionsFailed = deletionResults.filter((d) => !d.success).length;

    const summary: Record<string, number> = {
      eligible_orgs: categorized.length,
      needs_30d_warning: categorized.filter(
        (e) => e.category === "needs_30d_warning"
      ).length,
      needs_14d_warning: categorized.filter(
        (e) => e.category === "needs_14d_warning"
      ).length,
      due_for_deletion: deletionCandidates.length,
      no_action: noActionOrgs.length,
    };
    if (mode !== "report") {
      summary.warnings_sent = warningsSent;
      summary.warnings_failed = warningsFailed;
    }
    if (mode === "execute") {
      summary.deletions_performed = deletionsPerformed;
      summary.deletions_failed = deletionsFailed;
    }

    const report = {
      run_at: nowIso,
      caller: callerLabel,
      mode,
      summary,
      due_for_deletion: deletionInventories.map((inv) => ({
        orgId: inv.orgId,
        orgName: inv.orgName,
        endDate: inv.endDate,
        daysElapsed: inv.daysElapsed,
        scheduledDeletionAt: inv.scheduledDeletionAt,
        warning30dAlreadySent: inv.warning30dAlreadySent,
        warning14dAlreadySent: inv.warning14dAlreadySent,
        counts: inv.counts,
        usersToDelete: inv.usersToDelete,
        usersToKeep: inv.usersToKeep,
        ...(mode === "execute"
          ? {
              deletion_result:
                deletionResults.find((d) => d.orgId === inv.orgId) ?? null,
            }
          : {}),
      })),
      needs_warning: warningCandidates.map((org) => ({
        orgId: org.orgId,
        orgName: org.orgName,
        endDate: org.endDate.toISOString(),
        daysElapsed: Math.floor(org.daysElapsed),
        scheduledDeletionAt: org.scheduledDeletionAt.toISOString(),
        category: org.category,
        warning30dAlreadySent: org.warning30dAlreadySent,
        warning14dAlreadySent: org.warning14dAlreadySent,
        ...(mode !== "report"
          ? {
              warning_result:
                warningResults.find((w) => w.orgId === org.orgId) ?? null,
            }
          : {}),
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
