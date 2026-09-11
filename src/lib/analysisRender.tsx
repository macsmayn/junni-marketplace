import React from "react";
import { tRiskLabel } from "./riskLabel";

export const NAVY = "#1B2B4B";
export const GOLD = "#D4940A";
export const CREAM = "#FAF8F4";
export const GREEN = "#059669";
export const RED = "#DC2626";
export const MUTED = "#7A7060";

export const TIER_ORDER = ["Critical", "Important", "Supplementary", "Optional"];

export function gradeChip(grade: string, t: (k: string) => string) {
  const color = grade === "Strong" ? GREEN : grade === "Adequate" ? GOLD : RED;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      background: color + "1A", color, border: `1px solid ${color}40`,
    }}>{tRiskLabel(grade, t)}</span>
  );
}

export function riskChip(label: string, t: (k: string) => string) {
  const color = label === "Strong" || label === "Very Low" ? GREEN
    : label === "Adequate" || label === "Low" ? GOLD
    : label === "Moderate" ? "#D97706"
    : RED;
  return (
    <span style={{
      display: "inline-block", padding: "4px 14px", borderRadius: 99,
      fontSize: 13, fontWeight: 700, background: color + "1A", color,
      border: `1px solid ${color}40`,
    }}>{tRiskLabel(label, t)}</span>
  );
}

export function humanizeNotScoredReason(
  detail: string | null,
  reason: string | null,
  t: (k: string) => string,
): string {
  const raw = detail ?? reason ?? "";
  if (!raw) return "—";
  if (
    raw.includes("=DOC") || raw.includes("=EXT") ||
    raw.includes("primary_resolution=DOC") || raw.includes("primary_resolution=EXT")
  ) {
    return t("analysis.reasonNeedsDocument");
  }
  if (raw.toLowerCase().includes("no computation registered")) {
    return t("analysis.reasonNoFormula");
  }
  return raw;
}

export function statusLabelKey(status: string): { key: string; color: string } {
  if (status === "needs_document_or_input" || status === "needs_input")
    return { key: "analysis.statusNeedsData", color: GOLD };
  if (status === "needs_review")
    return { key: "analysis.statusNeedsReview", color: RED };
  return { key: "analysis.statusQualitative", color: MUTED };
}

export function DefContent({ def, lang }: { def: any; lang: "en" | "fr" }) {
  const fr = lang === "fr";
  const tDef = (enVal: string | null, frVal: string | null) => (fr && frVal) ? frVal : enVal;
  const higher = fr ? "↑ Plus élevé :" : "↑ Higher:";
  const lower  = fr ? "↓ Plus bas :"  : "↓ Lower:";
  return (
    <>
      {tDef(def.what_it_is, def.what_it_is_fr) && (
        <div style={{ color: NAVY, fontWeight: 500, marginBottom: 4 }}>
          {tDef(def.what_it_is, def.what_it_is_fr)}
        </div>
      )}
      {tDef(def.what_it_measures, def.what_it_measures_fr) && (
        <div style={{ marginBottom: 4 }}>{tDef(def.what_it_measures, def.what_it_measures_fr)}</div>
      )}
      {(tDef(def.high_value_means, def.high_value_means_fr) || tDef(def.low_value_means, def.low_value_means_fr)) && (
        <div style={{ marginBottom: 4 }}>
          {tDef(def.high_value_means, def.high_value_means_fr) && (
            <div>{higher} {tDef(def.high_value_means, def.high_value_means_fr)}</div>
          )}
          {tDef(def.low_value_means, def.low_value_means_fr) && (
            <div>{lower} {tDef(def.low_value_means, def.low_value_means_fr)}</div>
          )}
        </div>
      )}
      {tDef(def.why_it_matters, def.why_it_matters_fr) && (
        <div style={{ fontStyle: "italic", marginBottom: 6 }}>
          {tDef(def.why_it_matters, def.why_it_matters_fr)}
        </div>
      )}
      {tDef(def.formula_plain, def.formula_plain_fr) && (
        <code style={{
          fontSize: 11, background: "#EDE9E1", padding: "2px 7px",
          borderRadius: 4, fontFamily: "monospace", color: NAVY,
        }}>
          {tDef(def.formula_plain, def.formula_plain_fr)}
        </code>
      )}
    </>
  );
}
