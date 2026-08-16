const RISK_KEYS: Record<string, string> = {
  strong:    "risk.strong",
  adequate:  "risk.adequate",
  weak:      "risk.weak",
  "very low": "risk.veryLow",
  low:       "risk.low",
  moderate:  "risk.moderate",
  high:      "risk.high",
};

export function tRiskLabel(
  label: string | null,
  t: (key: string) => string,
): string {
  if (!label) return "—";
  const key = RISK_KEYS[label.toLowerCase()];
  return key ? t(key) : label;
}
