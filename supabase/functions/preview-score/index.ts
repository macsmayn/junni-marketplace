import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toFinancials, toDealTerms } from "../score-deal/scoreDealIntegration.ts";
import { runScoreEngine, DealContext } from "../score-deal/scoreEngine.ts";
import { makeSupabaseLoader, TempThresholdOverride, TempTierOverride } from "../score-deal/supabaseLoader.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auth0-token",
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
    let secretKey: string;
    try { secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? '{}')['default'] ?? ''; }
    catch { secretKey = ''; }
    if (!secretKey) {
      console.error("[preview-score] SUPABASE_SECRET_KEYS missing or 'default' entry not found");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;

    const supabase = createClient(SUPABASE_URL, secretKey);

    // ── Caller verification via Auth0 /userinfo ────────────────────────────────
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
      console.error("[preview-score] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const { sub: callerSub } = await userInfoRes.json();
    if (!callerSub) {
      console.error("[preview-score] /userinfo missing sub claim");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End caller verification ────────────────────────────────────────────────

    // ── User lookup ────────────────────────────────────────────────────────────
    const { data: callerUser } = await supabase
      .from("users")
      .select("id, role, active_org_id")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (!callerUser) {
      console.error("[preview-score] No users row for sub:", callerSub);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (callerUser.role !== "admin" && !callerUser.active_org_id) {
      return new Response(JSON.stringify({ error: "Account not provisioned. Please log out and log back in." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End user lookup ────────────────────────────────────────────────────────

    // ── Parse request body ─────────────────────────────────────────────────────
    const body = await req.json();
    const { deal_id, threshold_overrides, tier_overrides } = body;

    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End parse ──────────────────────────────────────────────────────────────

    // ── Deal ownership check ───────────────────────────────────────────────────
    if (callerUser.role !== "admin") {
      const { data: ownerCheck } = await supabase
        .from("deals")
        .select("id")
        .eq("id", deal_id)
        .eq("org_id", callerUser.active_org_id)
        .maybeSingle();
      if (!ownerCheck) {
        console.error("[preview-score] Org ownership check failed — deal_id:", deal_id, "org_id:", callerUser.active_org_id);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }
    // ── End ownership check ────────────────────────────────────────────────────

    // ── Load deal row ──────────────────────────────────────────────────────────
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("industry, amount_requested, term_months, interest_rate, existing_debt_service, org_id")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End deal row ───────────────────────────────────────────────────────────

    // ── Load confirmed financials ──────────────────────────────────────────────
    const { data: confirmedFinancials } = await supabase
      .from("extracted_financials")
      .select("*")
      .eq("deal_id", deal_id)
      .eq("borrower_confirmed", true)
      .order("fiscal_year", { ascending: false });

    if (!confirmedFinancials || confirmedFinancials.length === 0) {
      console.log("[preview-score] No confirmed financials for deal:", deal_id);
      return new Response(
        JSON.stringify({
          available: false,
          reason: "No confirmed financial statements — the deterministic engine requires borrower-confirmed financials to run.",
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    // ── End confirmed financials ───────────────────────────────────────────────

    // ── Build temporary override maps from the request body ────────────────────
    // These are applied OVER database overrides inside the loader.
    // A temporary entry wins over whatever the database stores for the same metric_id.
    const tempThresholdOverrides = new Map<string, TempThresholdOverride>();
    if (Array.isArray(threshold_overrides)) {
      for (const o of threshold_overrides) {
        if (!o.metric_id) continue;
        tempThresholdOverrides.set(o.metric_id, {
          strong:   o.strong   ?? null,
          adequate: o.adequate ?? null,
          weak:     o.weak     ?? null,
        });
      }
    }

    const tempTierOverrides = new Map<string, TempTierOverride>();
    if (Array.isArray(tier_overrides)) {
      for (const o of tier_overrides) {
        if (!o.metric_id) continue;
        tempTierOverrides.set(o.metric_id, {
          tier:    o.tier    ?? null,
          enabled: typeof o.enabled === "boolean" ? o.enabled : true,
        });
      }
    }
    // ── End override maps ──────────────────────────────────────────────────────

    // ── Run the deterministic engine ───────────────────────────────────────────
    // We call runScoreEngine directly (not runDeterministicScore) so we can supply
    // a custom loader that carries the temporary overrides on top of DB overrides.
    // runDeterministicScore builds its own internal loader and has no path for temp overrides.
    const primary = confirmedFinancials[0];
    const prior   = confirmedFinancials[1] ?? null;

    const orgId = deal.org_id ?? callerUser.active_org_id ?? null;

    const ctx: DealContext = {
      deal_id,
      industry_id: deal.industry ?? "",
      financials:  toFinancials(primary, prior),
      terms:       toDealTerms(deal, primary),
    };

    const loader = makeSupabaseLoader(supabase, {
      lenderId: null,
      orgId,
      tempThresholdOverrides: tempThresholdOverrides.size > 0 ? tempThresholdOverrides : undefined,
      tempTierOverrides:      tempTierOverrides.size      > 0 ? tempTierOverrides      : undefined,
    });

    const engineResult = await runScoreEngine(ctx, loader);
    // ── End engine run ─────────────────────────────────────────────────────────

    console.log(
      `[preview-score] deal=${deal_id} score=${engineResult.score.overall_score} ` +
      `(${engineResult.score.risk_label}) coverage=${engineResult.score.coverage_pct}% ` +
      `temp_threshold_overrides=${tempThresholdOverrides.size} temp_tier_overrides=${tempTierOverrides.size}`
    );

    // ── Return result — NOTHING WRITTEN ───────────────────────────────────────
    return new Response(
      JSON.stringify({
        available:              true,
        overall_score:          engineResult.score.overall_score,
        risk_label:             engineResult.score.risk_label,
        coverage_pct:           engineResult.score.coverage_pct,
        critical_floor_applied: engineResult.score.critical_floor_applied,
        capped_reason:          engineResult.score.capped_reason,
        metrics: engineResult.metrics.map((m) => ({
          metric_id:        m.metric_id,
          name:             m.name,
          tier:             m.tier,
          value:            m.value,
          grade:            m.grade,
          status:           m.status,
          counted:          m.counted,
          compute_detail:   m.compute_detail,
          grade_reason:     m.grade_reason,
          bands: {
            strong:           m.bands.strong,
            adequate:         m.bands.adequate,
            weak:             m.bands.weak,
            band_is_override: m.bands.band_is_override,
          },
          tier_is_override: m.tier_is_override,
        })),
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
    // ── End return ─────────────────────────────────────────────────────────────

  } catch (err: any) {
    console.error("[preview-score] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
