// ============================================================================
// Junni — Component Resolver (named-function library)
// Computes each metric's value from a deal's financials + deal terms.
// The DERIVE formulas here ARE the engine's real computation logic.
// Edge-case guards prevent misleading grades (negative EBITDA/equity, zero denom).
//
// Ported from the tested Python prototype (normal + edge cases verified).
// ============================================================================

// Financials shape — mirrors extracted_financials columns (+ a few derivable extras).
// All fields optional; resolver handles missing inputs gracefully.
export interface Financials {
  revenue?: number | null;
  revenue_prior?: number | null;
  cogs?: number | null;
  gross_profit?: number | null;
  operating_expenses?: number | null;
  ebit?: number | null;
  ebitda?: number | null;
  depreciation_amortization?: number | null;
  net_income?: number | null;
  total_assets?: number | null;
  current_assets?: number | null;
  total_liabilities?: number | null;
  current_liabilities?: number | null;
  total_debt?: number | null;
  equity?: number | null;
  interest_expense?: number | null;
  inventory?: number | null;
  cash?: number | null;
  cfo?: number | null;     // cash flow from operations
  capex?: number | null;
  accounts_receivable?: number | null;  // A/R balance (DSO, CCC)
  accounts_payable?: number | null;     // A/P balance (DPO, CCC)
}

export interface DealTerms {
  annual_principal?: number | null;
  amount_requested?: number | null;
  term_months?: number | null;
}

export type ResolveStatus =
  | "computed"
  | "needs_input"               // missing a required figure
  | "needs_review"              // degenerate math (guard tripped) — never grade this
  | "needs_document_or_input";  // no computation registered (industry-specific/qualitative)

export interface ResolveResult {
  value: number | null;
  status: ResolveStatus;
  detail: string;
}

// ---------- primitives ----------
function safeDiv(
  n: number | null | undefined,
  d: number | null | undefined,
  guardNegativeDenom = true
): { value: number | null; issue: string | null } {
  if (n === null || n === undefined || d === null || d === undefined)
    return { value: null, issue: "missing_input" };
  if (d === 0) return { value: null, issue: "zero_denominator" };
  if (guardNegativeDenom && d < 0) return { value: null, issue: "negative_denominator" };
  return { value: n / d, issue: null };
}

function num(x: number | null | undefined): number | null {
  return x === null || x === undefined || Number.isNaN(x) ? null : x;
}

function deriveEbit(f: Financials): number | null {
  if (num(f.ebit) !== null) return f.ebit as number;
  const r = num(f.revenue), c = num(f.cogs), o = num(f.operating_expenses);
  if (r !== null && c !== null && o !== null) return r - c - o;
  return null;
}
function deriveEbitda(f: Financials): number | null {
  if (num(f.ebitda) !== null) return f.ebitda as number;
  const ebit = deriveEbit(f);
  const da = num(f.depreciation_amortization);
  if (ebit !== null && da !== null) return ebit + da;
  return null;
}
function deriveNetDebt(f: Financials): number | null {
  const td = num(f.total_debt);
  if (td === null) return null;
  const cash = num(f.cash);
  return cash === null ? td : td - cash;
}
function deriveGrossProfit(f: Financials): number | null {
  if (num(f.gross_profit) !== null) return f.gross_profit as number;
  const r = num(f.revenue), c = num(f.cogs);
  if (r !== null && c !== null) return r - c;
  return null;
}

// ---------- ratio helper ----------
function ratio(
  n: number | null,
  d: number | null,
  detail: string,
  pct = false,
  guardNeg = true
): ResolveResult {
  const { value, issue } = safeDiv(n, d, guardNeg);
  if (issue === "missing_input") return { value: null, status: "needs_input", detail };
  if (issue === "zero_denominator" || issue === "negative_denominator")
    return { value: null, status: "needs_review", detail: `${detail} [${issue}]` };
  return { value: pct ? (value as number) * 100 : (value as number), status: "computed", detail };
}

// ---------- computation functions ----------
type Fn = (f: Financials, d: DealTerms) => ResolveResult;

const fNetDebtEbitda: Fn = (f) => {
  const e = deriveEbitda(f);
  if (e !== null && e <= 0)
    return { value: null, status: "needs_review", detail: "EBITDA <= 0 (leverage not meaningful)" };
  return ratio(deriveNetDebt(f), e, "NetDebt / EBITDA");
};
const fTotalDebtEbitda: Fn = (f) => {
  const e = deriveEbitda(f);
  if (e !== null && e <= 0) return { value: null, status: "needs_review", detail: "EBITDA <= 0" };
  return ratio(num(f.total_debt), e, "TotalDebt / EBITDA");
};
const fDebtEquity: Fn = (f) => {
  const eq = num(f.equity);
  if (eq !== null && eq <= 0)
    return { value: null, status: "needs_review", detail: "equity <= 0 (negative book equity)" };
  return ratio(num(f.total_debt), eq, "Debt / Equity");
};
const fDebtAssets: Fn = (f) => ratio(num(f.total_debt), num(f.total_assets), "Debt / TotalAssets", true);

const fInterestCoverage: Fn = (f) => {
  const ie = num(f.interest_expense);
  if (ie !== null && ie <= 0)
    return { value: null, status: "needs_review", detail: "interest <= 0 (coverage n/a)" };
  const ebit = deriveEbit(f);
  if (ebit !== null && ebit <= 0)
    return { value: null, status: "needs_review", detail: "EBIT <= 0 (coverage not meaningful)" };
  return ratio(ebit, ie, "EBIT / Interest");
};
const fDscr: Fn = (f, d) => {
  const e = deriveEbitda(f);
  const interest = num(f.interest_expense);
  const principal = num(d?.annual_principal);
  if (e !== null && e <= 0)
    return { value: null, status: "needs_review", detail: "EBITDA <= 0 (coverage not meaningful)" };
  if (e === null || interest === null || principal === null)
    return { value: null, status: "needs_input", detail: "requires EBITDA, interest, principal (deal terms)" };
  return ratio(e, interest + principal, "EBITDA / DebtService");
};

const fCurrentRatio: Fn = (f) =>
  ratio(num(f.current_assets), num(f.current_liabilities), "CurrentAssets / CurrentLiab");
const fQuickRatio: Fn = (f) => {
  const ca = num(f.current_assets), inv = num(f.inventory), cl = num(f.current_liabilities);
  if (ca === null || inv === null || cl === null)
    return { value: null, status: "needs_input", detail: "requires CA, inventory, CL" };
  return ratio(ca - inv, cl, "(CA-Inv) / CL");
};
const fWorkingCapital: Fn = (f) => {
  const ca = num(f.current_assets), cl = num(f.current_liabilities);
  if (ca === null || cl === null)
    return { value: null, status: "needs_input", detail: "requires CA & CL" };
  return { value: ca - cl, status: "computed", detail: "CA - CL" };
};
const fWorkingCapitalPctRevenue: Fn = (f) => {
  const ca = num(f.current_assets), cl = num(f.current_liabilities), rev = num(f.revenue);
  if (ca === null || cl === null || rev === null)
    return { value: null, status: "needs_input", detail: "requires CA, CL, revenue" };
  if (rev === 0) return { value: null, status: "needs_review", detail: "revenue = 0" };
  return { value: ((ca - cl) / rev) * 100, status: "computed", detail: "(CA - CL) / Revenue %" };
};
const fGmroi: Fn = (f) => ratio(deriveGrossProfit(f), num(f.inventory), "GrossProfit / Inventory");

const fEbitdaMargin: Fn = (f) => ratio(deriveEbitda(f), num(f.revenue), "EBITDA / Revenue", true, false);
const fGrossMargin: Fn = (f) => ratio(deriveGrossProfit(f), num(f.revenue), "GrossProfit / Revenue", true, false);
const fNetMargin: Fn = (f) => ratio(num(f.net_income), num(f.revenue), "NetIncome / Revenue", true, false);
const fOperatingMargin: Fn = (f) => ratio(deriveEbit(f), num(f.revenue), "EBIT / Revenue", true, false);
const fRoa: Fn = (f) => ratio(num(f.net_income), num(f.total_assets), "NetIncome / Assets", true);
const fRoe: Fn = (f) => {
  const eq = num(f.equity);
  if (eq !== null && eq <= 0) return { value: null, status: "needs_review", detail: "equity <= 0" };
  return ratio(num(f.net_income), eq, "NetIncome / Equity", true);
};

const fFcfMargin: Fn = (f) => {
  const cfo = num(f.cfo), capex = num(f.capex), rev = num(f.revenue);
  if (cfo === null || capex === null || rev === null)
    return { value: null, status: "needs_input", detail: "requires CFO, capex, revenue" };
  return ratio(cfo - capex, rev, "(CFO-Capex) / Revenue", true, false);
};
const fRevenueGrowth: Fn = (f) => {
  const cur = num(f.revenue), prior = num(f.revenue_prior);
  if (cur === null || prior === null)
    return { value: null, status: "needs_input", detail: "requires 2 periods of revenue" };
  return ratio(cur - prior, prior ? Math.abs(prior) : null, "RevGrowth", true, false);
};


// ---------- extraction-depth additions (inventory / cashflow / working-capital) ----------
const fInventoryTurnover: Fn = (f) => {
  const cogs = num(f.cogs), inv = num(f.inventory);
  if (cogs === null || inv === null)
    return { value: null, status: "needs_input", detail: "requires COGS & inventory" };
  return ratio(cogs, inv, "COGS / Inventory");
};
const fDIO: Fn = (f) => {
  const cogs = num(f.cogs), inv = num(f.inventory);
  if (cogs === null || inv === null)
    return { value: null, status: "needs_input", detail: "requires COGS & inventory" };
  if (cogs === 0) return { value: null, status: "needs_review", detail: "COGS = 0" };
  return { value: (inv / cogs) * 365, status: "computed", detail: "Inventory / COGS * 365 (days)" };
};
const fDSO: Fn = (f) => {
  const rev = num(f.revenue), ar = num(f.accounts_receivable);
  if (rev === null || ar === null)
    return { value: null, status: "needs_input", detail: "requires revenue & A/R" };
  if (rev === 0) return { value: null, status: "needs_review", detail: "revenue = 0" };
  return { value: (ar / rev) * 365, status: "computed", detail: "A/R / Revenue * 365 (days)" };
};
const fDPO: Fn = (f) => {
  const cogs = num(f.cogs), ap = num(f.accounts_payable);
  if (cogs === null || ap === null)
    return { value: null, status: "needs_input", detail: "requires COGS & A/P" };
  if (cogs === 0) return { value: null, status: "needs_review", detail: "COGS = 0" };
  return { value: (ap / cogs) * 365, status: "computed", detail: "A/P / COGS * 365 (days)" };
};
const fCapexIntensity: Fn = (f) => {
  const capex = num(f.capex), rev = num(f.revenue);
  if (capex === null || rev === null)
    return { value: null, status: "needs_input", detail: "requires capex & revenue" };
  return ratio(capex, rev, "Capex / Revenue", true, false);
};
const fEbitdaLessCapexMargin: Fn = (f) => {
  const e = deriveEbitda(f), capex = num(f.capex), rev = num(f.revenue);
  if (e === null || capex === null || rev === null)
    return { value: null, status: "needs_input", detail: "requires EBITDA, capex, revenue" };
  return ratio(e - capex, rev, "(EBITDA-Capex) / Revenue", true, false);
};
const fCashConversionCycle: Fn = (f) => {
  const cogs = num(f.cogs), rev = num(f.revenue);
  const inv = num(f.inventory), ar = num(f.accounts_receivable), ap = num(f.accounts_payable);
  if (cogs === null || rev === null || inv === null || ar === null || ap === null)
    return { value: null, status: "needs_input", detail: "requires COGS, revenue, inventory, A/R, A/P" };
  if (cogs === 0 || rev === 0) return { value: null, status: "needs_review", detail: "zero COGS or revenue" };
  const dio = (inv / cogs) * 365, dso = (ar / rev) * 365, dpo = (ap / cogs) * 365;
  return { value: dio + dso - dpo, status: "computed", detail: "DIO + DSO - DPO (days)" };
};
const fFcfYield: Fn = (f) => {
  // Free Cash Flow (FCF) / FCF Yield → compute FCF margin as the gradable proxy
  const cfo = num(f.cfo), capex = num(f.capex), rev = num(f.revenue);
  if (cfo === null || capex === null || rev === null)
    return { value: null, status: "needs_input", detail: "requires CFO, capex, revenue" };
  return ratio(cfo - capex, rev, "(CFO-Capex) / Revenue", true, false);
};
const fOcfDebt: Fn = (f) => {
  const cfo = num(f.cfo), td = num(f.total_debt);
  if (cfo === null || td === null)
    return { value: null, status: "needs_input", detail: "requires CFO & total debt" };
  if (td <= 0) return { value: null, status: "needs_review", detail: "no debt (ratio n/a)" };
  return { value: (cfo / td) * 100, status: "computed", detail: "CFO / TotalDebt %" };
};

// ---------- registry: normalized-name fragment -> function ----------
const REGISTRY: Array<[string, Fn]> = [
  ["net debt / ebitda", fNetDebtEbitda],
  ["gross leverage", fTotalDebtEbitda],
  ["total debt / ebitda", fTotalDebtEbitda],
  ["debt / equity", fDebtEquity],
  ["debt-to-asset", fDebtAssets],
  ["total debt / total assets", fDebtAssets],
  ["debt / total assets", fDebtAssets],
  ["interest coverage", fInterestCoverage],
  ["dscr", fDscr],
  ["debt service coverage", fDscr],
  ["current ratio", fCurrentRatio],
  ["quick ratio", fQuickRatio],
  ["working capital as % of revenue", fWorkingCapitalPctRevenue],
  ["working capital ratio", fCurrentRatio],
  ["working capital / current ratio", fCurrentRatio],
  ["working capital", fWorkingCapitalPctRevenue],
  ["gross margin return on inventory", fGmroi],
  ["gmroi", fGmroi],
  ["ebitda margin", fEbitdaMargin],
  ["gross profit margin", fGrossMargin],
  ["gross margin", fGrossMargin],
  ["net profit margin", fNetMargin],
  ["net margin", fNetMargin],
  ["operating margin", fOperatingMargin],
  ["operating profit margin", fOperatingMargin],
  ["return on assets", fRoa],
  ["return on equity", fRoe],
  ["operating cash flow / total debt", fOcfDebt],
  ["free cash flow (fcf) margin", fFcfYield],
  ["free cash flow margin", fFcfMargin],
  ["fcf margin", fFcfYield],
  ["revenue growth", fRevenueGrowth],
  // extraction-depth additions:
  ["inventory turnover", fInventoryTurnover],
  ["inventory days / turnover", fInventoryTurnover],
  ["days inventory outstanding", fDIO],
  ["days sales outstanding", fDSO],
  ["accounts receivable turnover / dso", fDSO],
  ["receivables turnover / dso", fDSO],
  ["dso (receivables days)", fDSO],
  ["accounts payable days", fDPO],
  ["dpo (payables days)", fDPO],
  ["capital expenditure (capex) intensity", fCapexIntensity],
  ["capex intensity", fCapexIntensity],
  ["ebitda − capex margin", fEbitdaLessCapexMargin],
  ["ebitda - capex margin", fEbitdaLessCapexMargin],
  ["cash conversion cycle", fCashConversionCycle],
  ["free cash flow (fcf) / fcf yield", fFcfYield],
  ["fcf yield", fFcfYield],
];

/**
 * Resolve a metric to its computed value (or a needs_* status).
 * Picks the longest matching registry key (most specific).
 */
export function resolveMetric(
  metricName: string,
  fin: Financials,
  deal: DealTerms
): ResolveResult {
  const n = metricName.toLowerCase();
  const matches = REGISTRY.filter(([k]) => n.includes(k));
  if (matches.length === 0) {
    return {
      value: null,
      status: "needs_document_or_input",
      detail: "no computation registered (industry-specific or qualitative)",
    };
  }
  matches.sort((a, b) => b[0].length - a[0].length); // most specific first
  return matches[0][1](fin, deal);
}
