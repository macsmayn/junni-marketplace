// Exports all credit-analysis data for the caller's organization as a JSON blob.
// Only org owners and credit_admins may call this endpoint.
// The response includes a Content-Disposition header so the browser treats it
// as a file download. Secrets (API keys, Stripe tokens, Auth0 IDs) are never included.

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

    // ── Fetch all org data ────────────────────────────────────────────────────
    // Each table is fetched independently; a per-table try/catch ensures one
    // missing table or permission error does not abort the whole export.

    async function fetchTable(table: string, column: string, value: string) {
      try {
        const { data, error } = await supabase.from(table).select("*").eq(column, value);
        if (error) { console.error(`[export-org-data] ${table}:`, error.message); return []; }
        return data ?? [];
      } catch (e: any) {
        console.error(`[export-org-data] ${table} unexpected:`, e.message);
        return [];
      }
    }

    async function fetchByIds(table: string, column: string, ids: string[]) {
      if (ids.length === 0) return [];
      try {
        const { data, error } = await supabase.from(table).select("*").in(column, ids);
        if (error) { console.error(`[export-org-data] ${table} (by ids):`, error.message); return []; }
        return data ?? [];
      } catch (e: any) {
        console.error(`[export-org-data] ${table} (by ids) unexpected:`, e.message);
        return [];
      }
    }

    const [organization, members, deals] = await Promise.all([
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
        try {
          const { data } = await supabase
            .from("organization_members")
            .select("id, org_role, joined_at, users(id, full_name, email, language)")
            .eq("org_id", orgId);
          return data ?? [];
        } catch { return []; }
      })(),
      fetchTable("deals", "org_id", orgId),
    ]);

    const dealIds: string[] = (deals as any[]).map((d: any) => d.id).filter(Boolean);

    const [dealDocuments, extractedFinancials, creditScores] = await Promise.all([
      fetchByIds("deal_documents", "deal_id", dealIds),
      fetchByIds("extracted_financials", "deal_id", dealIds),
      fetchByIds("credit_scores", "deal_id", dealIds),
    ]);

    const scoreIds: string[] = (creditScores as any[]).map((s: any) => s.id).filter(Boolean);
    const scoreMetricResults = await fetchByIds("score_metric_results", "credit_score_id", scoreIds);

    const diligenceQuestions = await fetchByIds("diligence_questions", "deal_id", dealIds);

    const [collateralAssets, suSources, suUses, capItems] = await Promise.all([
      fetchByIds("collateral_assets", "deal_id", dealIds),
      fetchByIds("sources_uses_sources", "deal_id", dealIds),
      fetchByIds("sources_uses_uses", "deal_id", dealIds),
      fetchByIds("capitalization_items", "deal_id", dealIds),
    ]);

    const exportedAt = new Date().toISOString();
    console.log(`[export-org-data] org ${orgId}: ${dealIds.length} deals, ${(creditScores as any[]).length} scores — exported by user ${callerUser.id} at ${exportedAt}`);

    const payload = {
      exported_at: exportedAt,
      org_id: orgId,
      organization,
      members,
      deals,
      deal_documents: dealDocuments,
      extracted_financials: extractedFinancials,
      credit_scores: creditScores,
      score_metric_results: scoreMetricResults,
      diligence_questions: diligenceQuestions,
      collateral_assets: collateralAssets,
      sources_uses_sources: suSources,
      sources_uses_uses: suUses,
      capitalization_items: capItems,
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
