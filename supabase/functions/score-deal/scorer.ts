// ============================================================================
// Junni — Weighted Scorer
// Graded metrics -> points -> tier-weighted -> Critical floor -> score + label.
// Only computed+graded metrics count; needs_input/needs_review/qualitative are
// excluded from the score and surfaced as coverage gaps (missing data lowers
// COVERAGE, not score). Stores full per-metric rationale (the explainability moat).
//
// Ported from the tested Python prototype (4 behavior cases verified).
// ============================================================================

export interface ScoringConfig {
  weight_critical: number;
  weight_important: number;
  weight_supplementary: number;
  weight_optional: number;
  points_strong: number;
  points_adequate: number;
  points_weak: number;
  critical_floor_enabled: boolean;
  critical_weak_caps_score_at: number;
  label_bands: Array<{ min: number; label: string }>;
}

// Defaults mirror the scoring_config row loaded for framework v1.0.
export const DEFAULT_CONFIG: ScoringConfig = {
  weight_critical: 3.0,
  weight_important: 2.0,
  weight_supplementary: 1.0,
  weight_optional: 0.5,
  points_strong: 100,
  points_adequate: 60,
  points_weak: 20,
  critical_floor_enabled: true,
  critical_weak_caps_score_at: 49,
  label_bands: [
    { min: 80, label: "Strong" },
    { min: 60, label: "Adequate" },
    { min: 0, label: "Weak" },
  ],
};

export type MetricTier = "Critical" | "Important" | "Supplementary" | "Optional";
export type MetricGrade = "Strong" | "Adequate" | "Weak" | "Qualitative" | string;

export interface GradedMetric {
  name: string;
  tier: MetricTier;
  grade?: MetricGrade | null;
  status: string; // "computed" | "needs_input" | "needs_review" | "needs_document_or_input" | ...
}

export interface ScoreRow {
  name: string;
  tier: MetricTier;
  grade: string;
  counted: boolean;
  points?: number;
  weight?: number;
  contribution?: number;
  reason?: string;
}

export interface ScoreResult {
  overall_score: number | null;
  risk_label: string;
  critical_floor_applied: boolean;
  coverage_pct: number;
  metrics_scored: number;
  metrics_total: number;
  counts: Record<string, number>;
  rows: ScoreRow[];
}

function tierWeight(tier: MetricTier, cfg: ScoringConfig): number {
  switch (tier) {
    case "Critical": return cfg.weight_critical;
    case "Important": return cfg.weight_important;
    case "Supplementary": return cfg.weight_supplementary;
    case "Optional": return cfg.weight_optional;
    default: return cfg.weight_important;
  }
}

function gradePoints(grade: string, cfg: ScoringConfig): number | null {
  switch (grade) {
    case "Strong": return cfg.points_strong;
    case "Adequate": return cfg.points_adequate;
    case "Weak": return cfg.points_weak;
    default: return null;
  }
}

function labelFor(score: number, cfg: ScoringConfig): string {
  for (const band of cfg.label_bands) {
    if (score >= band.min) return band.label;
  }
  return "Weak";
}

export function scoreDeal(
  graded: GradedMetric[],
  cfg: ScoringConfig = DEFAULT_CONFIG
): ScoreResult {
  const rows: ScoreRow[] = [];
  let totalWeighted = 0;
  let totalWeight = 0;
  let criticalWeakHit = false;
  const counts: Record<string, number> = {
    scored: 0, needs_input: 0, needs_review: 0, qualitative: 0, other: 0,
  };

  for (const m of graded) {
    const isScorable =
      m.status === "computed" &&
      (m.grade === "Strong" || m.grade === "Adequate" || m.grade === "Weak");

    if (isScorable) {
      const pts = gradePoints(m.grade as string, cfg) as number;
      const w = tierWeight(m.tier, cfg);
      const contribution = pts * w;
      totalWeighted += contribution;
      totalWeight += w;
      counts.scored++;
      if (m.tier === "Critical" && m.grade === "Weak") criticalWeakHit = true;
      rows.push({
        name: m.name, tier: m.tier, grade: m.grade as string,
        points: pts, weight: w, contribution, counted: true,
      });
    } else {
      if (m.status === "needs_input") counts.needs_input++;
      else if (m.status === "needs_review") counts.needs_review++;
      else if (m.grade === "Qualitative" || m.status === "needs_document_or_input") counts.qualitative++;
      else counts.other++;
      rows.push({
        name: m.name, tier: m.tier, grade: (m.grade || m.status) as string,
        counted: false, reason: m.status,
      });
    }
  }

  if (totalWeight === 0) {
    return {
      overall_score: null, risk_label: "Insufficient data",
      critical_floor_applied: false, coverage_pct: 0,
      metrics_scored: 0, metrics_total: graded.length, counts, rows,
    };
  }

  let rawScore = totalWeighted / totalWeight;
  let capped = false;
  if (cfg.critical_floor_enabled && criticalWeakHit && rawScore > cfg.critical_weak_caps_score_at) {
    rawScore = cfg.critical_weak_caps_score_at;
    capped = true;
  }

  const totalConsidered =
    counts.scored + counts.needs_input + counts.needs_review + counts.qualitative + counts.other;
  const coverage = totalConsidered ? Math.round((100 * counts.scored) / totalConsidered) : 0;

  return {
    overall_score: Math.round(rawScore * 10) / 10,
    risk_label: labelFor(rawScore, cfg),
    critical_floor_applied: capped,
    coverage_pct: coverage,
    metrics_scored: counts.scored,
    metrics_total: totalConsidered,
    counts,
    rows,
  };
}
