const RISK_KEYS: Record<string, string> = {
  strong:   "risk.strong",
  adequate: "risk.adequate",
  weak:     "risk.weak",
};

export function tRiskLabel(
  label: string | null,
  t: (key: string) => string,
): string {
  if (!label) return "—";
  const key = RISK_KEYS[label.toLowerCase()];
  return key ? t(key) : label;
}
