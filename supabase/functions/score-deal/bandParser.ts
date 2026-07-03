// ============================================================================
// Junni — Band Parser (deterministic metric grading)
// Grades a computed value against Strong / Adequate / Weak band strings.
// No LLM — pure parsed thresholds. This is the core of transparent scoring.
//
// Ported from the tested Python prototype (10/10 functional tests passed).
// ============================================================================

export type Grade =
  | "Strong"
  | "Adequate"
  | "Weak"
  | "Qualitative"   // bands are non-numeric → needs analyst assessment
  | "NeedsInput"    // value couldn't be computed
  | "Unparseable";  // bands present but couldn't be matched (should be rare; log it)

export interface GradeResult {
  grade: Grade;
  reason: string;
}

type Parsed =
  | { kind: "qualitative"; text: string }
  | { kind: "op"; op: "<" | ">" | "<=" | ">="; threshold: number; isPct: boolean }
  | { kind: "range"; lo: number; hi: number; isPct: boolean }
  | { kind: "bare"; value: number; isPct: boolean }
  | null;

/** Parse a single band string ("< 2.5x", "1.05x – 1.50x", "> 70%", "Above peer") */
export function parseBandValue(bandText: string | null | undefined): Parsed {
  if (!bandText || typeof bandText !== "string") return null;
  const t = bandText.trim();

  // Qualitative if there is no digit at all
  if (!/\d/.test(t)) return { kind: "qualitative", text: t };

  const isPct = t.includes("%");

  // Normalize: unicode operators/dashes, then strip annotations + unit suffixes that
  // would otherwise break range detection ("30%-50%", "2.5x - 4.0x", "<70% (55-65% AI-native)").
  const s = t
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[–—]/g, "-")
    .replace(/\([^)]*\)/g, "")                       // drop parenthetical annotations
    .replace(/%/g, "")                                // % already captured in isPct
    .replace(/\b(days|months|day|mo|yrs?|years?|pts|bps)\b/gi, "") // unit words
    .replace(/(\d)\s*x\b/gi, "$1")                   // strip "x" multiplier suffix ("2.5x" -> "2.5")
    .trim();

  const nums = (s.match(/-?\d+\.?\d*/g) || []).map(Number);
  if (nums.length === 0) return { kind: "qualitative", text: t };

  // Range FIRST: two numbers separated by a dash that follows a digit (so a leading
  // negative like "-5" is not misread as a range). Handles "30-50", "2.5 - 4.0", "1.05-1.50".
  const rangeMatch = s.match(/(-?\d+\.?\d*)\s*(?<=\d)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch && nums.length >= 2) {
    return {
      kind: "range",
      lo: parseFloat(rangeMatch[1]),
      hi: parseFloat(rangeMatch[2]),
      isPct,
    };
  }

  // Single operator: "< 2.5x", "> 70%", ">= 1.5x", "<= 30 days"
  const opMatch = s.match(/(<=|>=|<|>)\s*(-?\d+\.?\d*)/);
  if (opMatch) {
    return {
      kind: "op",
      op: opMatch[1] as "<" | ">" | "<=" | ">=",
      threshold: parseFloat(opMatch[2]),
      isPct,
    };
  }

  // Bare number, no operator — ambiguous; return for context-dependent handling
  return { kind: "bare", value: nums[0], isPct };
}

function satisfies(parsed: Parsed, v: number): boolean {
  if (!parsed) return false;
  if (parsed.kind === "op") {
    switch (parsed.op) {
      case "<":  return v < parsed.threshold;
      case ">":  return v > parsed.threshold;
      case "<=": return v <= parsed.threshold;
      case ">=": return v >= parsed.threshold;
    }
  }
  if (parsed.kind === "range") {
    return v >= parsed.lo && v <= parsed.hi;
  }
  return false;
}

/**
 * Grade a computed numeric value against the three band strings.
 * Mirrors the tested Python prototype exactly.
 */
export function gradeValue(
  value: number | null | undefined,
  strongBand: string,
  adequateBand: string,
  weakBand: string
): GradeResult {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { grade: "NeedsInput", reason: "metric value could not be computed" };
  }

  const ps = parseBandValue(strongBand);
  const pa = parseBandValue(adequateBand);
  const pw = parseBandValue(weakBand);

  // If any band is qualitative → the metric needs analyst assessment
  if ([ps, pa, pw].some((p) => p && p.kind === "qualitative")) {
    return {
      grade: "Qualitative",
      reason: `qualitative bands require analyst assessment (e.g. "${strongBand}")`,
    };
  }

  // Priority match: Strong → Adequate → Weak
  if (satisfies(ps, value)) {
    return { grade: "Strong", reason: `${value} satisfies Strong band "${strongBand}"` };
  }
  if (satisfies(pa, value)) {
    return { grade: "Adequate", reason: `${value} satisfies Adequate band "${adequateBand}"` };
  }
  if (satisfies(pw, value)) {
    return { grade: "Weak", reason: `${value} satisfies Weak band "${weakBand}"` };
  }

  // Strong & Weak are open-ended ops and value fell in the gap → Adequate
  if (ps && pw && ps.kind === "op" && pw.kind === "op") {
    return {
      grade: "Adequate",
      reason: `${value} falls between Strong and Weak thresholds → Adequate`,
    };
  }

  return {
    grade: "Unparseable",
    reason: `could not match ${value} to bands (S:"${strongBand}" A:"${adequateBand}" W:"${weakBand}")`,
  };
}
