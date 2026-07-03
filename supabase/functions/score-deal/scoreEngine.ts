// ============================================================================
// Junni — Score Engine Orchestrator
// Ties the three transparent-scoring modules together against the framework
// tables, producing an explainable credit score for a deal.
//
//   resolveMetric()  → value + status        (metricResolver.ts)
//   gradeValue()     → grade + reason         (bandParser.ts)
//   scoreDeal()      → overall score + label  (scorer.ts)
//
// Flow:
//   1. Load the deal's industry.
//   2. Pull that industry's metrics + threshold bands + tiers from the
//      framework tables (the canonical, lender-overridable defaults).
//   3. Resolve each metric from the deal's financials + terms.
//   4. Grade each computed value against its bands.
//   5. Score the graded set (tier-weighted, Critical floor, coverage).
//   6. Return the full result WITH per-metric rationale (the explainability moat).
//
// This module is pure orchestration + data access. It contains NO opaque LLM
// scoring — the number comes entirely from the code rubric. The LLM keeps
// notes/flags/narrative elsewhere, never the score.
// ============================================================================

import { resolveMetric, Financials, DealTerms } from "./metricResolver.ts";
import { gradeValue } from "./bandParser.ts";
import {
  scoreDeal,
  GradedMetric,
  MetricTier,
  ScoreResult,
  ScoringConfig,
  DEFAULT_CONFIG,
} from "./scorer.ts";

// ---------------------------------------------------------------------------
// Minimal data-access contract.
// Implemented with a Supabase client in index.ts, but defined as an interface
// here so this module is testable in isolation (pass a fake loader).
// ---------------------------------------------------------------------------

/** One metric row as stored in the framework tables, with its bands resolved. */
export interface FrameworkMetric {
  metric_id: string;
  name: string;
  importance_tier: MetricTier;     // canonical tier (lender override applied upstream if present)
  strong_band: string | null;
  adequate_band: string | null;
  weak_band: string | null;
  enabled?: boolean;               // false if a lender disabled this metric
}

/** What the engine needs to score a deal — supplied by the caller. */
export interface DealContext {
  deal_id: string;
  industry_id: string;
  financials: Financials;
  terms: DealTerms;
}

/** Data loader the orchestrator depends on (Supabase-backed in production). */
export interface FrameworkLoader {
  /** Return all metrics (with bands + tiers) for an industry, lender overrides already applied. */
  getMetricsForIndustry(industry_id: string): Promise<FrameworkMetric[]>;
}

// ---------------------------------------------------------------------------
// Per-metric engine output — carries the full rationale for explainability.
// ---------------------------------------------------------------------------
export interface EngineMetricResult {
  metric_id: string;
  name: string;
  tier: MetricTier;
  value: number | null;
  grade: string;                 // Strong/Adequate/Weak/Qualitative/NeedsInput/Unparseable
  status: string;                // computed/needs_input/needs_review/needs_document_or_input
  counted: boolean;              // did it contribute to the score?
  compute_detail: string;        // how the value was derived ("NetDebt / EBITDA")
  grade_reason: string;          // why this grade ("1.8 satisfies Strong band \"< 2.5x\"")
  bands: { strong: string | null; adequate: string | null; weak: string | null };
}

export interface EngineResult {
  deal_id: string;
  industry_id: string;
  score: ScoreResult;            // overall_score, risk_label, coverage_pct, critical_floor, ...
  metrics: EngineMetricResult[]; // per-metric detail with full rationale
  generated_at: string;          // ISO timestamp
}

// ---------------------------------------------------------------------------
// Core orchestration.
// ---------------------------------------------------------------------------

/**
 * Score one deal end-to-end against its industry's framework metrics.
 * Pure: all data access goes through `loader`; all scoring through the modules.
 */
export async function runScoreEngine(
  ctx: DealContext,
  loader: FrameworkLoader,
  cfg: ScoringConfig = DEFAULT_CONFIG
): Promise<EngineResult> {
  const metrics = await loader.getMetricsForIndustry(ctx.industry_id);

  const perMetric: EngineMetricResult[] = [];
  const graded: GradedMetric[] = [];

  for (const m of metrics) {
    // A lender may have disabled this metric — excluded from score AND coverage.
    if (m.enabled === false) continue;

    // 1) Resolve the value from financials + deal terms.
    const resolved = resolveMetric(m.name, ctx.financials, ctx.terms);

    // 2) Grade it against the bands (only if we have a value and real bands).
    let grade = "NeedsInput";
    let gradeReason = resolved.detail;

    if (resolved.status === "computed" && resolved.value !== null) {
      const g = gradeValue(
        resolved.value,
        m.strong_band ?? "",
        m.adequate_band ?? "",
        m.weak_band ?? ""
      );
      grade = g.grade;
      gradeReason = g.reason;
    } else {
      // not computed → grade stays a non-scoring status; keep the resolver's reason
      grade = mapStatusToGrade(resolved.status);
    }

    // 3) Build the row the scorer consumes.
    //    The scorer only counts status === "computed" with a S/A/W grade,
    //    so we pass the resolver status through, but downgrade to needs_review
    //    if the bands couldn't be parsed (don't silently count an Unparseable).
    const statusForScorer = deriveScorerStatus(resolved.status, grade);

    graded.push({
      name: m.name,
      tier: m.importance_tier,
      grade: grade as GradedMetric["grade"],
      status: statusForScorer,
    });

    perMetric.push({
      metric_id: m.metric_id,
      name: m.name,
      tier: m.importance_tier,
      value: resolved.value,
      grade,
      status: statusForScorer,
      counted: statusForScorer === "computed" && ["Strong", "Adequate", "Weak"].includes(grade),
      compute_detail: resolved.detail,
      grade_reason: gradeReason,
      bands: { strong: m.strong_band, adequate: m.adequate_band, weak: m.weak_band },
    });
  }

  // 4) Score the graded set.
  const score = scoreDeal(graded, cfg);

  // Stitch the scorer's counted/points back onto the per-metric detail so the
  // stored result has everything the UI needs to explain the number.
  const byName = new Map(score.rows.map((r) => [r.name, r]));
  for (const pm of perMetric) {
    const row = byName.get(pm.name);
    if (row) pm.counted = row.counted;
  }

  return {
    deal_id: ctx.deal_id,
    industry_id: ctx.industry_id,
    score,
    metrics: perMetric,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Map a non-computed resolver status to a band-parser-style grade label. */
function mapStatusToGrade(status: string): string {
  switch (status) {
    case "needs_input": return "NeedsInput";
    case "needs_review": return "NeedsReview";
    case "needs_document_or_input": return "Qualitative";
    default: return "NeedsInput";
  }
}

/**
 * Decide what status the scorer should see.
 * - computed + a real S/A/W grade  → "computed" (it counts)
 * - computed but Qualitative/Unparseable bands → "needs_review" (don't count, flag it)
 * - anything else → pass the resolver status through (lowers coverage, not score)
 */
function deriveScorerStatus(resolveStatus: string, grade: string): string {
  if (resolveStatus === "computed") {
    if (grade === "Strong" || grade === "Adequate" || grade === "Weak") return "computed";
    if (grade === "Qualitative") return "needs_document_or_input";
    return "needs_review"; // Unparseable / NeedsInput on a computed value → review
  }
  return resolveStatus; // needs_input / needs_review / needs_document_or_input
}
