// Exports all credit-analysis data for the caller's organization as a JSON blob.
// Only org owners and credit_admins may call this endpoint.
// The response includes a Content-Disposition header so the browser treats it
// as a file download. API keys, Stripe secrets, and auth tokens are never included.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-auth0-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;
    let secretKey: string;
    try { secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"] ?? ""; }
    catch { secretKey = ""; }
    if (!secretKey) {
      console.error("[export-org-data] SUPABASE_SECRET_KEYS missing or 'default' entry not found");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, secretKey);

    // ── Caller authentication via Auth0 /userinfo ─────────────────────────────
    const auth0Token = req.headers.get("X-Auth0-Token");
    if (!auth0Token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfoRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${auth0Token}` },
    });
    if (!userInfoRes.ok) {
      console.error("[export-org-data] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const { sub: callerSub } = await userInfoRes.json();

    const { data: callerUser } = await supabase
      .from("users")
      .select("id, role, active_org_id")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (!callerUser) {
      console.error("[export-org-data] No users row for sub:", callerSub);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!callerUser.active_org_id) {
      return new Response(JSON.stringify({ error: "Account not provisioned" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const orgId: string = callerUser.active_org_id;

    // ── Org-role authorization: owner or credit_admin only ────────────────────
    if (callerUser.role !== "admin") {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("org_role")
        .eq("org_id", orgId)
        .eq("user_id", callerUser.id)
        .maybeSingle();

      const allowedRoles = ["owner", "credit_admin"];
      if (!membership || !allowedRoles.includes(membership.org_role)) {
        console.error("[export-org-data] Insufficient role — user_id:", callerUser.id, "org_id:", orgId, "role:", membership?.org_role);
        return new Response(JSON.stringify({ error: "Only organization owners and credit admins may export data." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }
    // ── End authorization ─────────────────────────────────────────────────────

    // ── Helper: fetch all rows from a table filtered to this org ─────────────
    async function fetchByOrgId(table: string, select = "*") {
      try {
        const { data, error } = await supabase.from(table).select(select).eq("org_id", orgId);
        if (error) { console.error(`[export-org-data] ${table}:`, error.message); return []; }
        return data ?? [];
      } catch (e: any) {
        console.error(`[export-org-data] ${table} unexpected:`, e.message);
        return [];
      }
    }

    // ── Helper: fetch all rows from a deal-child table by deal IDs ────────────
    async function fetchByDealIds(table: string, dealIds: string[]) {
      if (dealIds.length === 0) return [];
      try {
        const { data, error } = await supabase.from(table).select("*").in("deal_id", dealIds);
        if (error) { console.error(`[export-org-data] ${table} (by deal_id):`, error.message); return []; }
        return data ?? [];
      } catch (e: any) {
        console.error(`[export-org-data] ${table} (by deal_id) unexpected:`, e.message);
        return [];
      }
    }

    // ── Helper: fetch all rows from a score-child table by score IDs ──────────
    async function fetchByScoreIds(table: string, column: string, scoreIds: string[]) {
      if (scoreIds.length === 0) return [];
      try {
        const { data, error } = await supabase.from(table).select("*").in(column, scoreIds);
        if (error) { console.error(`[export-org-data] ${table} (by score_id):`, error.message); return []; }
        return data ?? [];
      } catch (e: any) {
        console.error(`[export-org-data] ${table} (by score_id) unexpected:`, e.message);
        return [];
      }
    }

    // ── Org-level data ────────────────────────────────────────────────────────
    const [
      organization,
      members,
      orgInvites,
      lenderMetricOverrides,
      lenderThresholdOverrides,
      metricOverrideLog,
      thresholdOverrideLog,
      billingCustomers,
    ] = await Promise.all([
      (async () => {
        try {
          const { data } = await supabase
            .from("organizations")
            .select("id, name, created_at")
            .eq("id", orgId)
            .maybeSingle();
          return data ?? null;
        } catch { return null; }
      })(),
      (async () => {
        // Include member name/email for usability; exclude auth0_id
        try {
          const { data } = await supabase
            .from("organization_members")
            .select("id, org_role, joined_at, users(id, full_name, email, language)")
            .eq("org_id", orgId);
          return data ?? [];
        } catch { return []; }
      })(),
      fetchByOrgId("org_invites"),
      fetchByOrgId("lender_metric_overrides"),
      fetchByOrgId("lender_threshold_overrides"),
      fetchByOrgId("metric_override_log"),
      fetchByOrgId("threshold_override_log"),
      // billing_customers: only stripe_customer_id — no Stripe secret keys
      fetchByOrgId("billing_customers", "id, org_id, stripe_customer_id, created_at"),
    ]);

    // ── Deal-level data ───────────────────────────────────────────────────────
    const deals = await fetchByOrgId("deals");
    const dealIds: string[] = (deals as any[]).map((d: any) => d.id).filter(Boolean);

    const [
      documents,
      extractedFinancials,
      creditScores,
      creditScoresHistory,
      creditQuestions,
      creditAnswers,
      creditFlags,
      computedMetrics,
      collateralAssets,
      collateralAssetsHistory,
      capitalizationItems,
      capitalizationItemsHistory,
      sourcesUsesEntries,
      sourcesUsesEntriesHistory,
      capTableEntries,
      financialAnnotations,
    ] = await Promise.all([
      fetchByDealIds("documents", dealIds),
      fetchByDealIds("extracted_financials", dealIds),
      fetchByDealIds("credit_scores", dealIds),
      fetchByDealIds("credit_scores_history", dealIds),
      fetchByDealIds("credit_questions", dealIds),
      fetchByDealIds("credit_answers", dealIds),
      fetchByDealIds("credit_flags", dealIds),
      fetchByDealIds("computed_metrics", dealIds),
      fetchByDealIds("collateral_assets", dealIds),
      fetchByDealIds("collateral_assets_history", dealIds),
      fetchByDealIds("capitalization_items", dealIds),
      fetchByDealIds("capitalization_items_history", dealIds),
      fetchByDealIds("sources_uses_entries", dealIds),
      fetchByDealIds("sources_uses_entries_history", dealIds),
      fetchByDealIds("cap_table_entries", dealIds),
      fetchByDealIds("financial_annotations", dealIds),
    ]);

    // score_metric_results and _history are keyed by credit_score_id
    const scoreIds: string[] = (creditScores as any[]).map((s: any) => s.id).filter(Boolean);
    const [scoreMetricResults, scoreMetricResultsHistory] = await Promise.all([
      fetchByScoreIds("score_metric_results", "credit_score_id", scoreIds),
      fetchByScoreIds("score_metric_results_history", "credit_score_id", scoreIds),
    ]);

    const exportedAt = new Date().toISOString();
    console.log(
      `[export-org-data] org ${orgId}: ${dealIds.length} deals, ` +
      `${(creditScores as any[]).length} scores, ` +
      `${(lenderThresholdOverrides as any[]).length} threshold overrides — ` +
      `exported by user ${callerUser.id} at ${exportedAt}`
    );

    const payload = {
      exported_at: exportedAt,
      org_id: orgId,
      // Org-level
      organization,
      members,
      org_invites: orgInvites,
      lender_metric_overrides: lenderMetricOverrides,
      lender_threshold_overrides: lenderThresholdOverrides,
      metric_override_log: metricOverrideLog,
      threshold_override_log: thresholdOverrideLog,
      billing_customers: billingCustomers,
      // Deal-level
      deals,
      documents,
      extracted_financials: extractedFinancials,
      credit_scores: creditScores,
      credit_scores_history: creditScoresHistory,
      score_metric_results: scoreMetricResults,
      score_metric_results_history: scoreMetricResultsHistory,
      credit_questions: creditQuestions,
      credit_answers: creditAnswers,
      credit_flags: creditFlags,
      computed_metrics: computedMetrics,
      collateral_assets: collateralAssets,
      collateral_assets_history: collateralAssetsHistory,
      capitalization_items: capitalizationItems,
      capitalization_items_history: capitalizationItemsHistory,
      sources_uses_entries: sourcesUsesEntries,
      sources_uses_entries_history: sourcesUsesEntriesHistory,
      cap_table_entries: capTableEntries,
      financial_annotations: financialAnnotations,
    };

    const filename = `junni-export-${orgId.slice(0, 8)}-${exportedAt.slice(0, 10)}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    console.error("[export-org-data] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
