// ============================================================================
// Junni — score-deal integration helper
// The bridge between the existing score-deal Edge Function and the transparent
// scoring engine. Drop this into supabase/functions/score-deal/ alongside the
// engine modules, then call runDeterministicScore() from index.ts.
//
// What it does:
//   1. Maps the deal's confirmed extracted_financials rows (primary + prior)
//      into the engine's Financials shape.
//   2. Builds DealTerms from the deal row (for DSCR etc.).
//   3. Runs the engine against the NEW versioned framework tables
//      (metrics + metric_threshold_bands), via the Supabase loader.
//   4. Returns the deterministic ScoreResult + per-metric rationale.
//
// The caller (index.ts) then:
//   - writes engineResult.score.overall_score to credit_scores + deals.ai_score
//     (replacing the LLM's number — the score becomes code)
//   - keeps the LLM for summary / strengths / risks only
//   - persists per-metric rationale for the explainability bubbles
// ============================================================================

import { runScoreEngine, DealContext, EngineResult } from "./scoreEngine.ts";
import { makeSupabaseLoader } from "./supabaseLoader.ts";
import { Financials, DealTerms } from "./metricResolver.ts";

// Shape of a confirmed extracted_financials row (the columns index.ts upserts).
export interface ExtractedFinancialsRow {
  fiscal_year: number;
  revenue: number | null;
  cogs: number | null;
  gross_profit: number | null;
  operating_expenses: number | null;
  ebitda: number | null;
  net_income: number | null;
  total_assets: number | null;
  current_assets: number | null;
  total_liabilities: number | null;
  current_liabilities: number | null;
  total_debt: number | null;
  equity: number | null;
  interest_expense: number | null;
  debt_detail: Record<string, any> | null;
  cash: number | null;
  inventory: number | null;
  capex: number | null;
  cfo: number | null;
  accounts_receivable: number | null;
  accounts_payable: number | null;
  depreciation_amortization: number | null;
}

// Shape of the deal row fields we use for terms.
export interface DealRowForTerms {
  industry: string | null;
  amount_requested: number | null;
  term_months: number | null;
  interest_rate: number | null;          // percentage number, e.g. 6.5
  existing_debt_service: number | null;
}

/**
 * Map primary (+ optional prior) extracted_financials rows to engine Financials.
 * Maps all extracted_financials columns to the engine's Financials shape.
 * Any column still null in the DB → metric honestly resolves to needs_input.
 * revenue_prior comes from the prior row.
 */
export function toFinancials(
  primary: ExtractedFinancialsRow,
  prior: ExtractedFinancialsRow | null
): Financials {
  return {
    revenue: primary.revenue,
    revenue_prior: prior?.revenue ?? null,
    cogs: primary.cogs,
    gross_profit: primary.gross_profit,
    operating_expenses: primary.operating_expenses,
    ebitda: primary.ebitda,
    net_income: primary.net_income,
    total_assets: primary.total_assets,
    current_assets: primary.current_assets,
    total_liabilities: primary.total_liabilities,
    current_liabilities: primary.current_liabilities,
    total_debt: primary.total_debt,
    equity: primary.equity,
    interest_expense: primary.interest_expense,
    // now extracted — passed through so inventory/cashflow/working-capital metrics compute:
    cash: primary.cash,
    inventory: primary.inventory,
    cfo: primary.cfo,
    capex: primary.capex,
    accounts_receivable: primary.accounts_receivable,
    accounts_payable: primary.accounts_payable,
    depreciation_amortization: primary.depreciation_amortization,
    ebit: null, // resolver derives EBIT from revenue - cogs - opex
  };
}

/**
 * Build DealTerms for coverage metrics (DSCR). annual_principal mirrors the
 * tiered logic already in index.ts Phase 2c: confirmed current-portion of LTD
 * (from debt_detail) → borrower-reported existing_debt_service → interest-only.
 * Plus the new facility's annual debt service from the requested amount.
 */
export function toDealTerms(
  deal: DealRowForTerms,
  primary: ExtractedFinancialsRow
): DealTerms {
  // existing debt service (annual principal portion the engine's DSCR adds to interest)
  let existingPrincipal = 0;
  const dd = primary.debt_detail;
  if (dd && typeof dd === "object") {
    const cp = (dd.current_portion ?? dd.current_portion_ltd ?? 0) as number;
    if (typeof cp === "number" && isFinite(cp) && cp > 0) existingPrincipal = cp;
  }
  if (existingPrincipal === 0 && typeof deal.existing_debt_service === "number" && deal.existing_debt_service > 0) {
    // borrower-reported total service includes interest; principal portion approximated as the
    // service minus interest (floored at 0) so we don't double-count interest in DSCR.
    const approxPrincipal = deal.existing_debt_service - (primary.interest_expense ?? 0);
    existingPrincipal = approxPrincipal > 0 ? approxPrincipal : 0;
  }

  // new facility annual debt service (amortizing) from amount_requested
  let newFacilityPrincipal = 0;
  if (deal.amount_requested && deal.amount_requested > 0) {
    const annualRatePct = deal.interest_rate ?? 0;
    const rMonthly = (annualRatePct / 100) / 12;
    const n = deal.term_months ?? 60;
    const annualService = rMonthly === 0
      ? (deal.amount_requested / n) * 12
      : (deal.amount_requested * rMonthly / (1 - Math.pow(1 + rMonthly, -n))) * 12;
    // new facility contributes its full annual debt service (principal + interest),
    // since its interest is not in historical interest_expense
    newFacilityPrincipal = annualService;
  }

  return {
    annual_principal: existingPrincipal + newFacilityPrincipal || null,
    amount_requested: deal.amount_requested ?? null,
    term_months: deal.term_months ?? null,
  };
}

/**
 * Run the full deterministic score for a deal.
 * Returns null if there are no confirmed financials (caller then leaves the
 * existing behavior untouched — no score regression).
 */
export async function runDeterministicScore(
  supabase: any,
  deal_id: string,
  deal: DealRowForTerms,
  confirmedFinancials: ExtractedFinancialsRow[],
  opts: { lenderId?: string | null; versionId?: string } = {}
): Promise<EngineResult | null> {
  if (!confirmedFinancials || confirmedFinancials.length === 0) return null;

  const primary = confirmedFinancials[0];
  const prior = confirmedFinancials[1] ?? null;

  const ctx: DealContext = {
    deal_id,
    industry_id: deal.industry ?? "",     // maps to industry_key in the loader
    financials: toFinancials(primary, prior),
    terms: toDealTerms(deal, primary),
  };

  const loader = makeSupabaseLoader(supabase, {
    lenderId: opts.lenderId ?? null,      // null = canonical defaults (no lender policy yet)
    versionId: opts.versionId,            // omit → loader resolves the active version
  });

  return await runScoreEngine(ctx, loader);
}

/**
 * Persist the engine result. Writes:
 *   - the deterministic number to credit_scores + deals.ai_score (UI reads these)
 *   - per-metric rationale to score_metric_results (explainability bubbles)
 * The LLM narrative (summary/strengths/risks) is written separately by index.ts.
 */
export async function persistEngineResult(
  supabase: any,
  deal_id: string,
  engine: EngineResult,
  llmNarrative: { summary?: string; strengths?: string[]; risks?: string[]; metrics?: any } = {}
): Promise<void> {
  // 1) headline score → credit_scores (engine owns the number; LLM owns the prose)
  const { error: csErr } = await supabase.from("credit_scores").upsert(
    {
      deal_id,
      overall_score: engine.score.overall_score,
      risk_label: engine.score.risk_label,
      summary: llmNarrative.summary ?? null,
      strengths: llmNarrative.strengths ?? null,
      risks: llmNarrative.risks ?? null,
      metrics: llmNarrative.metrics ?? null,
      coverage_pct: engine.score.coverage_pct,
      critical_floor_applied: engine.score.critical_floor_applied,
      capped_reason: engine.score.capped_reason ?? null,
      score_source: "engine",
      model_used: "junni-engine-v1",
    },
    { onConflict: "deal_id" }
  );
  if (csErr) console.error("[score-deal] credit_scores upsert (engine) error:", csErr);

  // 2) deals.ai_score → what the marketplace listing reads
  const { error: dErr } = await supabase
    .from("deals")
    .update({ ai_score: engine.score.overall_score })
    .eq("id", deal_id);
  if (dErr) console.error("[score-deal] deals.ai_score update (engine) error:", dErr);

  // 3) per-metric rationale → score_metric_results (drives the explain bubbles)
  for (const m of engine.metrics) {
    const { error: smErr } = await supabase.from("score_metric_results").upsert(
      {
        deal_id,
        metric_id: m.metric_id,
        metric_name: m.name,
        tier: m.tier,
        value: m.value,
        grade: m.grade,
        status: m.status,
        counted: m.counted,
        compute_detail: m.compute_detail,
        grade_reason: m.grade_reason,
        strong_band: m.bands.strong,
        adequate_band: m.bands.adequate,
        weak_band: m.bands.weak,
      },
      { onConflict: "deal_id,metric_id" }
    );
    if (smErr) console.error(`[score-deal] score_metric_results upsert error (${m.name}):`, smErr);
  }
}
