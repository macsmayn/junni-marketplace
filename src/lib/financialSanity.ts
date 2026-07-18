export interface Issue {
  code: string;
  message: string;
}

export interface SanityResult {
  blocks: Issue[];
  warns: Issue[];
}

export interface FYValues {
  revenue: number | null;
  cogs: number | null;
  gross_profit: number | null;
  ebitda: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  equity: number | null;
}

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-CA");
}

export function checkFinancials(fy: FYValues, amountRequested: number | null): SanityResult {
  const blocks: Issue[] = [];
  const warns: Issue[] = [];
  const { revenue, cogs, gross_profit, ebitda, total_assets, total_liabilities, equity } = fy;

  // Layer 1 — plausibility vs loan (BLOCKING)
  if (revenue !== null && revenue > 0 && amountRequested !== null && amountRequested > 0) {
    if (revenue < amountRequested) {
      blocks.push({
        code: "revenue_below_loan",
        message: `Revenue (${fmt(revenue)}) is less than the requested loan (${fmt(amountRequested)}). Verify the figures and units — this is implausible for most lending.`,
      });
    }
    if (amountRequested / revenue > 10) {
      blocks.push({
        code: "loan_exceeds_10x_revenue",
        message: "Requested loan is more than 10× revenue — verify units and figures.",
      });
    }
  }
  if (revenue !== null && revenue > 0 && revenue < 50_000) {
    blocks.push({
      code: "revenue_implausibly_small",
      message: `Revenue (${fmt(revenue)}) is unusually small — the statement may be in thousands, or the figure is an error.`,
    });
  }

  // Layer 2 — internal consistency (WARNING)
  if (revenue !== null && cogs !== null && gross_profit !== null && Math.abs(revenue) > 0) {
    const expected = revenue - cogs;
    if (Math.abs(gross_profit - expected) > 0.02 * Math.abs(revenue)) {
      warns.push({
        code: "gross_profit_mismatch",
        message: `Gross profit (${fmt(gross_profit)}) doesn't match revenue − COGS (${fmt(expected)}). Some figures may be scaled differently.`,
      });
    }
  }

  if (total_assets !== null && total_liabilities !== null && equity !== null && Math.abs(total_assets) > 0) {
    const balanceSum = total_liabilities + equity;
    if (Math.abs(total_assets - balanceSum) > 0.02 * Math.abs(total_assets)) {
      warns.push({
        code: "balance_sheet_mismatch",
        message: `Assets (${fmt(total_assets)}) ≠ Liabilities + Equity (${fmt(balanceSum)}). Check the extracted values.`,
      });
    }
  }

  if (revenue !== null && revenue > 0 && ebitda !== null) {
    const margin = ebitda / revenue;
    if (margin > 0.95 || margin < -0.50) {
      warns.push({
        code: "ebitda_margin_implausible",
        message: `EBITDA margin (${(margin * 100).toFixed(1)}%) is outside the normal range — verify figures.`,
      });
    }
  }

  if (revenue !== null && revenue > 0 && gross_profit !== null) {
    const gm = gross_profit / revenue;
    if (gm > 1 || gm < 0) {
      warns.push({
        code: "gross_margin_impossible",
        message: `Gross margin (${(gm * 100).toFixed(1)}%) is impossible — a figure may be mis-scaled.`,
      });
    }
  }

  return { blocks, warns };
}
