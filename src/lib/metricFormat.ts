// Shared metric value formatter — used by DealAnalysis.tsx and memoExport.ts.
// Keeps display logic in one place so web page and PDF/Word can never drift.
//
// DB values for percentage metrics (margin, growth, ROA …) are stored in
// percentage-point form (e.g. 11.728 means 11.7%) because the scoring engine
// multiplies by 100 before writing to score_metric_results.value. Do NOT
// multiply by 100 again here.
export function fmtValue(
  v: number | null | undefined,
  name: string,
  strongBand?: string | null,
  lang?: string,
): string {
  if (v == null) return '—';

  // Band-string dispatch: read units from the threshold band first.
  // This is the most reliable signal and takes priority over name-matching.
  if (strongBand) {
    const b = strongBand.toLowerCase();
    if (b.includes('%'))   return `${v.toFixed(1)}%`;
    if (b.includes('x'))   return `${v.toFixed(2)}x`;
    if (b.includes('day') || b.includes('jour')) return `${v.toFixed(1)} ${lang === 'fr' ? 'jours' : 'days'}`;
    if (b.includes('month') || b.includes('mois')) return `${v.toFixed(1)} ${lang === 'fr' ? 'mois' : 'months'}`;
    if (b.includes('year') || b.includes('an'))    return `${v.toFixed(1)} ${lang === 'fr' ? 'ans' : 'years'}`;
  }

  // Name-based fallback.
  const n = name.toLowerCase();
  const isRatio = n.includes('ratio') || n.includes('coverage') || n.includes('dscr') ||
    n.includes('leverage') || n.includes('debt /') || n.includes('/ ebitda') || n.includes('/ debt') ||
    n.includes('ltv') || n.includes('ltr') || n.includes('multiple');
  const isPct = n.includes('margin') || n.includes('growth') || n.includes('return on') ||
    n.includes('roa') || n.includes('roe') || n.includes('intensity') || n.includes('yield');
  const isDays = n.includes('days') || n.includes('dso') || n.includes('dpo') || n.includes('dio') ||
    n.includes('ccc') || n.includes('cycle');
  const isMonths = n.includes('payback') || n.includes('duration');
  const isYears  = n.includes('walt') || n.includes('lease term') || n.includes('reserve life') ||
    n.includes('mine life') || n.includes('amortization');

  if (isDays)   return `${v.toFixed(1)} ${lang === 'fr' ? 'jours'  : 'days'}`;
  if (isMonths) return `${v.toFixed(1)} ${lang === 'fr' ? 'mois'   : 'months'}`;
  if (isYears)  return `${v.toFixed(1)} ${lang === 'fr' ? 'ans'    : 'years'}`;
  if (isPct)    return `${v.toFixed(1)}%`;
  if (isRatio)  return `${v.toFixed(2)}x`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}
