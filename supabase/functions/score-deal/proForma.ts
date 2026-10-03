// Single source for financial figures shown beside the pro-forma capitalization:
// the latest confirmed extracted_financials year. deals.* snapshots are fallbacks only.

export interface LatestFin {
  fiscal_year: number;
  revenue?: number | string | null;
  ebitda?: number | string | null;
  net_income?: number | string | null;
  equity?: number | string | null;
  total_debt?: number | string | null;
  cash?: number | string | null;
  borrower_confirmed?: boolean | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function fetchLatestConfirmedFinancials(supabase: any, dealId: string): Promise<LatestFin | null> {
  const { data } = await supabase
    .from("extracted_financials")
    .select("fiscal_year,revenue,ebitda,net_income,equity,total_debt,cash,borrower_confirmed")
    .eq("deal_id", dealId)
    .eq("borrower_confirmed", true)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LatestFin | null) ?? null;
}

// For callers that already hold the confirmed rows (e.g. memo export).
export function pickLatestConfirmed(rows: Array<Record<string, any>> | null | undefined): LatestFin | null {
  const confirmed = (rows ?? []).filter(r => r && r.borrower_confirmed !== false && r.fiscal_year != null);
  if (!confirmed.length) return null;
  return confirmed.reduce((a, b) => (Number(b.fiscal_year) > Number(a.fiscal_year) ? b : a)) as LatestFin;
}

const REFI_RE = /refinanc|\brefi\b|pay[\s-]?off|repay|rembours/i;
export const isRefinancingLabel = (label: string | null | undefined): boolean => REFI_RE.test(label ?? "");

export const DEBT_CATS = ["Senior Debt", "Subordinated Debt", "Shareholder Loans"];
export const EXISTING_CAT = "Existing Debt";
const EQUITY_LABEL_KEY = "newAnalysis.defaultEquityLabel";

export interface ProFormaRow {
  category: string;
  label: string;
  labelKey: string | null;
  amount: number;
  isDebt: boolean;
  isExisting: boolean;
  existingSource?: "analyst" | "statements";
  rate?: number | null;
}

export interface ProForma {
  fiscalYear: number | null;
  ebitda: number | null;
  revenue: number | null;
  equity: number | null;
  cash: number | null;
  rows: ProFormaRow[];
  totalDebt: number;
  seniorDebt: number;
  totalEquity: number;
  totalCap: number;
  existing: {
    amount: number;
    gross: number;
    refinanced: number;
    source: "analyst" | "statements" | "none";
    statementDebt: number | null;
    mismatch: boolean;
  };
}

export function buildProForma(args: {
  deal: { ebitda?: any; annual_revenue?: any; existing_debt?: any } | null | undefined;
  latest: LatestFin | null;
  capItems: Array<{ category: string; label: string; label_key?: string | null; amount: any; amount_auto?: boolean | null; rate?: number | null }> | null | undefined;
  suEntries?: Array<{ side: string; label: string; amount: any }> | null;
}): ProForma {
  const { deal, latest } = args;
  const fiscalYear = latest ? Number(latest.fiscal_year) : null;
  const ebitda = latest ? num(latest.ebitda) : num(deal?.ebitda);
  const revenue = latest ? num(latest.revenue) : num(deal?.annual_revenue);
  const equity = latest ? num(latest.equity) : null;
  const cash = latest ? num(latest.cash) : null;

  const rows: ProFormaRow[] = (args.capItems ?? []).map(r => {
    const auto = !!r.amount_auto && r.label_key === EQUITY_LABEL_KEY && equity !== null;
    return {
      category: r.category,
      label: r.label,
      labelKey: r.label_key ?? null,
      amount: auto ? (equity as number) : Number(r.amount),
      isDebt: DEBT_CATS.includes(r.category),
      isExisting: false,
      rate: r.rate ?? null,
    };
  });

  const analystDebt = num(deal?.existing_debt);
  const statementDebt = latest ? num(latest.total_debt) : null;
  let source: "analyst" | "statements" | "none" = "none";
  let gross = 0;
  if (analystDebt !== null) { source = "analyst"; gross = analystDebt; }
  else if (statementDebt !== null) { source = "statements"; gross = statementDebt; }

  const refinanced = (args.suEntries ?? [])
    .filter(e => e.side === "use" && isRefinancingLabel(e.label))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const existingAmt = Math.max(0, gross - refinanced);

  const mismatch = source === "analyst" && statementDebt !== null &&
    (statementDebt === 0 ? analystDebt! > 0 : Math.abs(analystDebt! - statementDebt) / Math.abs(statementDebt) > 0.10);

  if (source !== "none" && gross > 0) {
    rows.unshift({
      category: EXISTING_CAT, label: "", labelKey: null, amount: existingAmt,
      isDebt: true, isExisting: true, existingSource: source,
    });
  }

  const totalDebt = rows.filter(r => r.isDebt).reduce((s, r) => s + r.amount, 0);
  const seniorDebt = rows.filter(r => r.category === "Senior Debt").reduce((s, r) => s + r.amount, 0);
  const totalEquity = rows.filter(r => !r.isDebt).reduce((s, r) => s + r.amount, 0);

  return {
    fiscalYear, ebitda, revenue, equity, cash, rows,
    totalDebt, seniorDebt, totalEquity, totalCap: totalDebt + totalEquity,
    existing: { amount: existingAmt, gross, refinanced, source, statementDebt, mismatch },
  };
}
