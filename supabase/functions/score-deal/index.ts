import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { runDeterministicScore, persistEngineResult } from "./scoreDealIntegration.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const { deal_id, extract_only } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the deal
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(
        "title, industry, amount_requested, term_months, interest_rate, annual_revenue, ebitda, years_in_business, province, ai_summary, financials_status, existing_debt, existing_debt_service, use_of_funds"
      )
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 2a: Financial statement document extraction
    // ─────────────────────────────────────────────────────────────
    const { data: financialDocs } = await supabase
      .from("documents")
      .select("id, file_name, file_type, storage_path, doc_category")
      .eq("deal_id", deal_id)
      .in("doc_category", ["Financial Statement", "Tax Return / T2"])
      .order("created_at", { ascending: true });

    let totalYearsExtracted = 0;

    if (!financialDocs || financialDocs.length === 0) {
      console.log(`[score-deal] No financial statements — using structured data.`);
    } else {
      console.log(`[score-deal] ${financialDocs.length} financial statement document(s) found — beginning Phase 2a extraction.`);

      // Extraction prompt — used by both consolidated and per-document fallback paths
      const extractionPrompt = `You are a financial analyst extracting structured data from financial statements for SME credit analysis.

You may be receiving one or more financial statement documents for the SAME company (for example, a separate income statement, balance sheet, and cash flow statement, possibly across multiple fiscal years). If multiple documents are provided, consolidate them into ONE set of figures per fiscal year: combine income-statement figures (revenue, COGS, EBITDA, net income), balance-sheet figures (assets, liabilities, debt, equity), and cash-flow figures for the same fiscal year into a single entry for that year. Extract EVERY fiscal year that appears across ALL the documents, not just the most recent two. If a figure for a year appears in one document but not another, use the value where it appears.

Read this ENTIRE document including ALL notes to the financial statements. Do not stop at the primary statements — the notes contain critical information about debt terms, maturities, covenants, contingencies, and off-balance-sheet items.

This document likely contains TWO fiscal years (current and comparative prior year). Extract BOTH as separate entries in the statements array.

CRITICAL — UNIT SCALE AND CURRENCY:
Financial statements almost always declare a unit scale in the header or column headings, such as "Expressed in thousands", "in millions", "$000s", or "(in thousands of Canadian dollars)". You MUST find this declaration and convert every monetary figure to its ACTUAL full dollar value before returning it.
- If the statement says "in thousands" and shows revenue of 7,060 → return 7060000
- If the statement says "in millions" and shows revenue of 7,060 → return 7060000000
- If no scale is declared, assume the numbers are already in actual dollars (do not scale).
Every monetary value in your JSON output must be the FULL actual dollar amount, never the abbreviated printed figure.

Also detect the reporting CURRENCY (e.g. USD, CAD, EUR). Add a "currency" field to each statement entry with the 3-letter currency code. Do NOT convert between currencies — just report the figures in their original currency and label which currency it is.

CALCULATED METRICS — compute these when not explicitly stated:
Some figures are rarely printed as line items and must be CALCULATED from the components on the statements. Always compute them when the inputs are available:
- EBITDA: Calculate using the OPERATING INCOME method, NOT net income. Start from "Operating Income" or "Income/Loss from Operations" (this is EBIT — it already excludes interest, taxes, and non-operating items like investment gains/losses, foreign exchange, and equity method investments). Then add back Depreciation and Amortization (found in the cash flow statement under operating activities, or in the notes). Formula: EBITDA = Income/Loss from Operations + Depreciation + Amortization. Do NOT start from net income, and do NOT include non-operating items such as unrealized investment gains/losses, interest income, or foreign exchange effects. If the income statement does not separately show "Income from Operations", derive it as Gross Profit minus Total Operating Expenses. Preserve the correct sign — if operations are at a loss, EBITDA may be negative. Only return null if the necessary components genuinely cannot be found.
- Gross Profit = Revenue - Cost of Goods Sold (COGS), if not stated directly.
- Total Debt = sum of all interest-bearing debt (current portion of long-term debt + long-term debt + bank loans + notes payable). Exclude trade payables and accruals.
When you calculate rather than read a value, note this briefly in raw_notes (e.g. "EBITDA calculated as operating income + D&A").
Do NOT apply EBITDA add-backs or normalizations — use the standard formula only. Adjustments are handled separately.

WORKING CAPITAL AND CASH FLOW FIELDS — read these from the balance sheet and cash flow statement:
- cash: "Cash and cash equivalents" from the balance sheet. Exclude short-term investments unless the statement combines them into one line (then use the combined line and note it in raw_notes).
- inventory: Inventory/inventories from the balance sheet (net). If the balance sheet contains NO inventory line item anywhere — typical for software, services, and financial companies — return 0, not null: the company holds no inventory, which is a known zero, not missing data. Return null ONLY when an inventory line exists but its amount cannot be read reliably.
- accounts_receivable: Trade/accounts receivable (net of allowance). If only a combined "receivables" line exists, use it.
- accounts_payable: Trade/accounts payable. Canadian statements often show one combined line "Accounts payable and accrued liabilities" — if that is all that exists, use the combined figure and note "AP includes accruals" in raw_notes.
- capex: "Purchase of property, plant and equipment" (and intangibles/development costs if shown) from INVESTING activities on the cash flow statement. Return as a POSITIVE number even though the statement shows it as an outflow.
- cfo: "Cash provided by (used in) operating activities" — the operating activities subtotal from the cash flow statement. PRESERVE THE SIGN (negative if operations consumed cash).
- depreciation_amortization: D&A add-back from operating activities on the cash flow statement, or from the notes. Combine depreciation + amortization into one figure.
If no cash flow statement is provided, set capex, cfo, and depreciation_amortization to null — do not estimate them.

Return ONLY valid JSON with no markdown fences or commentary. Use this exact shape:

{
  "statements": [
    {
      "fiscal_year": <integer year e.g. 2024>,
      "fiscal_year_end": "<YYYY-MM-DD or null>",
      "currency": "<3-letter currency code e.g. CAD, USD, EUR — or null if not determinable>",
      "statement_type": "<audited | review engagement | notice to reader | internal | unknown>",
      "preparing_firm": "<accounting firm name or null>",
      "revenue": <number or null>,
      "cogs": <number or null>,
      "gross_profit": <number or null>,
      "operating_expenses": <number or null>,
      "ebitda": <number or null>,
      "net_income": <number or null>,
      "total_assets": <number or null>,
      "current_assets": <number or null>,
      "total_liabilities": <number or null>,
      "current_liabilities": <number or null>,
      "total_debt": <number or null>,
      "equity": <number or null>,
      "interest_expense": <number or null>,
      "cash": <number or null>,
      "inventory": <number or null>,
      "accounts_receivable": <number or null>,
      "accounts_payable": <number or null>,
      "capex": <number or null>,
      "cfo": <number or null>,
      "depreciation_amortization": <number or null>,
      "debt_detail": <object with current_portion, long_term, rates, maturities if disclosed — or null>,
      "notes_summary": "<material disclosures from notes: debt covenants, maturities, contingencies, related-party transactions, leases, guarantees>",
      "extraction_confidence": "<high | medium | low>",
      "raw_notes": "<anything flagged as unclear or ambiguous>"
    }
  ]
}

All monetary values must be plain numbers (not strings), scaled to FULL actual dollar amounts. Use null for any field not present in the document.`;

      // Shared upsert helper — used by both consolidated and per-document paths
      const upsertStatements = async (statements: any[], sourceDocId: string | null) => {
        for (const stmt of statements) {
          if (!stmt.fiscal_year) continue;
          const { error: upsertErr } = await supabase.from("extracted_financials").upsert(
            {
              deal_id,
              source_document_id: sourceDocId,
              fiscal_year: stmt.fiscal_year,
              fiscal_year_end: stmt.fiscal_year_end ?? null,
              currency: stmt.currency ?? null,
              statement_type: stmt.statement_type ?? null,
              preparing_firm: stmt.preparing_firm ?? null,
              revenue: stmt.revenue ?? null,
              cogs: stmt.cogs ?? null,
              gross_profit: stmt.gross_profit ?? null,
              operating_expenses: stmt.operating_expenses ?? null,
              ebitda: stmt.ebitda ?? null,
              net_income: stmt.net_income ?? null,
              total_assets: stmt.total_assets ?? null,
              current_assets: stmt.current_assets ?? null,
              total_liabilities: stmt.total_liabilities ?? null,
              current_liabilities: stmt.current_liabilities ?? null,
              total_debt: stmt.total_debt ?? null,
              equity: stmt.equity ?? null,
              interest_expense: stmt.interest_expense ?? null,
              cash: stmt.cash ?? null,
              inventory: stmt.inventory ?? null,
              accounts_receivable: stmt.accounts_receivable ?? null,
              accounts_payable: stmt.accounts_payable ?? null,
              capex: stmt.capex ?? null,
              cfo: stmt.cfo ?? null,
              depreciation_amortization: stmt.depreciation_amortization ?? null,
              debt_detail: stmt.debt_detail ?? null,
              notes_summary: stmt.notes_summary ?? null,
              extraction_confidence: stmt.extraction_confidence ?? null,
              raw_notes: stmt.raw_notes ?? null,
            },
            { onConflict: "deal_id,fiscal_year" }
          );
          if (upsertErr) {
            console.error(`[score-deal] extracted_financials upsert error (FY${stmt.fiscal_year}):`, upsertErr);
          } else {
            totalYearsExtracted++;
          }
        }
      };

      // Shared Claude call + parse helper
      const callExtractionApi = async (messages: any[], label: string): Promise<any[]> => {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 8000, messages }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[score-deal] Anthropic extraction error (${label}):`, errText);
          return [];
        }
        const data = await res.json();
        const raw: string = data.content[0].text;
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          return parsed.statements ?? [];
        } catch (_e) {
          console.error(`[score-deal] JSON parse failed (${label}). Raw:`, raw.slice(0, 300));
          return [];
        }
      };

      // STEP 1 — Download and prepare all documents into memory
      const preparedDocs: { docId: string; fileName: string; isPDF: boolean; content: string; size: number }[] = [];
      let totalPayloadSize = 0;

      for (const doc of financialDocs) {
        try {
          const isPDF =
            doc.file_type?.includes("pdf") ||
            doc.file_name?.toLowerCase().endsWith(".pdf");
          const isExcel =
            doc.file_type?.includes("xlsx") ||
            doc.file_type?.includes("xls") ||
            doc.file_type?.includes("spreadsheetml") ||
            doc.file_type?.includes("ms-excel") ||
            doc.file_name?.toLowerCase().endsWith(".xlsx") ||
            doc.file_name?.toLowerCase().endsWith(".xls");

          if (!isPDF && !isExcel) {
            console.log(`[score-deal] Skipped "${doc.file_name}" (unsupported type: ${doc.file_type})`);
            continue;
          }

          const { data: blob, error: downloadError } = await supabase.storage
            .from("documents")
            .download(doc.storage_path);
          if (downloadError || !blob) {
            console.error(`[score-deal] Download failed for "${doc.file_name}":`, downloadError);
            continue;
          }

          const arrayBuffer = await blob.arrayBuffer();

          if (isPDF) {
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < uint8Array.byteLength; i++) binary += String.fromCharCode(uint8Array[i]);
            const base64Data = btoa(binary);
            preparedDocs.push({ docId: doc.id, fileName: doc.file_name, isPDF: true, content: base64Data, size: base64Data.length });
            totalPayloadSize += base64Data.length;
          } else {
            // Excel: parse with SheetJS
            try {
              const uint8Array = new Uint8Array(arrayBuffer);
              const workbook = XLSX.read(uint8Array, { type: "array" });
              const sheetTexts: string[] = [];
              for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                if (csv.trim()) sheetTexts.push(`=== SHEET: ${sheetName} ===\n${csv}`);
              }
              if (sheetTexts.length === 0) {
                console.log(`[score-deal] Excel "${doc.file_name}" contained no readable sheet data — skipped.`);
                continue;
              }
              const combinedText = `=== DOCUMENT: ${doc.file_name} ===\n` + sheetTexts.join("\n\n");
              preparedDocs.push({ docId: doc.id, fileName: doc.file_name, isPDF: false, content: combinedText, size: combinedText.length });
              totalPayloadSize += combinedText.length;
              console.log(`[score-deal] Excel parsed ${workbook.SheetNames.length} sheet(s) from "${doc.file_name}".`);
            } catch (xlsErr) {
              console.error(`[score-deal] Excel parse failed for "${doc.file_name}":`, xlsErr);
            }
          }
        } catch (docErr) {
          console.error(`[score-deal] Error preparing "${doc.file_name}":`, docErr);
        }
      }

      if (preparedDocs.length === 0) {
        console.log(`[score-deal] No documents could be prepared — skipping extraction.`);

      } else if (totalPayloadSize > 3_500_000) {
        // TOKEN-LIMIT FALLBACK — process each document separately
        console.log(`[score-deal] Consolidated extraction skipped (payload too large — ${totalPayloadSize} chars) — falling back to per-document extraction.`);

        for (const doc of preparedDocs) {
          try {
            const messages = doc.isPDF
              ? [{ role: "user", content: [
                  { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.content } },
                  { type: "text", text: extractionPrompt },
                ] }]
              : [{ role: "user", content: [
                  { type: "text", text: extractionPrompt + "\n\nSPREADSHEET CONTENTS:\n" + doc.content },
                ] }];
            const statements = await callExtractionApi(messages, doc.fileName);
            await upsertStatements(statements, doc.docId);
          } catch (err) {
            console.error(`[score-deal] Per-document extraction error for "${doc.fileName}":`, err);
          }
        }

      } else {
        // CONSOLIDATED PATH — all documents in one Claude call
        console.log(`[score-deal] Sending ${preparedDocs.length} document(s) in one consolidated extraction call (${totalPayloadSize} chars).`);

        const contentBlocks: any[] = [];
        for (const doc of preparedDocs) {
          if (doc.isPDF) {
            contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.content } });
          } else {
            contentBlocks.push({ type: "text", text: doc.content });
          }
        }
        contentBlocks.push({ type: "text", text: extractionPrompt });

        try {
          const statements = await callExtractionApi(
            [{ role: "user", content: contentBlocks }],
            `consolidated (${preparedDocs.length} docs)`
          );
          const firstDocId = preparedDocs[0]?.docId ?? null;
          await upsertStatements(statements, firstDocId);
        } catch (consolidatedErr) {
          console.error(`[score-deal] Consolidated extraction error:`, consolidatedErr);
        }
      }

      console.log(`[score-deal] Phase 2a complete — ${totalYearsExtracted} fiscal year(s) extracted.`);

      if (totalYearsExtracted > 0 && deal.financials_status !== "confirmed") {
        const { error: statusErr } = await supabase
          .from("deals")
          .update({ financials_status: "extracted" })
          .eq("id", deal_id);
        if (statusErr) {
          console.error("[score-deal] Failed to update financials_status:", statusErr);
        }
      }
    }

    if (extract_only) {
      return new Response(
        JSON.stringify({ extract_only: true, years_extracted: totalYearsExtracted }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Supplementary context for the scoring prompt
    const [{ data: suEntries }, { data: capItemsRows }, { data: collateralRows }] = await Promise.all([
      supabase.from("sources_uses_entries").select("side, label, amount").eq("deal_id", deal_id).order("sort_order"),
      supabase.from("capitalization_items").select("category, label, amount, rate").eq("deal_id", deal_id).order("sort_order"),
      supabase.from("collateral_assets").select("asset_type, market_value, advance_rate, lending_value").eq("deal_id", deal_id),
    ]);

    let collateralLine = "";
    if (collateralRows && collateralRows.length > 0) {
      const totalLending = collateralRows.reduce((s: number, r: any) => s + (Number(r.lending_value) || 0), 0);
      const totalDebt = (Number(deal.existing_debt) || 0) + Number(deal.amount_requested);
      const coverage = totalDebt > 0 ? (totalLending / totalDebt).toFixed(2) : "N/A";
      collateralLine = `\n- Collateral offered: ${collateralRows.length} asset(s), lending value $${Math.round(totalLending).toLocaleString()} against total debt $${Math.round(totalDebt).toLocaleString()} — coverage ${coverage}x.`;
    }

    let sourcesUsesLine = "";
    if (suEntries && suEntries.length > 0) {
      const uses = (suEntries as any[]).filter((e: any) => e.side === "use");
      const sources = (suEntries as any[]).filter((e: any) => e.side === "source");
      const totalUses = uses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const totalSources = sources.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const top3Uses = uses.slice(0, 3).map((e: any) => `${e.label} $${Math.round(Number(e.amount)).toLocaleString()}`).join("; ");
      const srcList = sources.map((e: any) => `${e.label} $${Math.round(Number(e.amount)).toLocaleString()}`).join("; ");
      const gap = Math.abs(totalUses - totalSources);
      const balanceWarn = gap > 0 ? ` — WARNING: sources and uses do not balance (gap $${Math.round(gap).toLocaleString()})` : "";
      sourcesUsesLine = `\n- Sources & Uses: uses total $${Math.round(totalUses).toLocaleString()} (${top3Uses}); sources total $${Math.round(totalSources).toLocaleString()} (${srcList})${balanceWarn}.`;
    }

    let capLine = "";
    if (capItemsRows && capItemsRows.length > 0) {
      const DEBT_CATS = ["Senior Debt", "Subordinated Debt", "Shareholder Loans"];
      const debtRows = (capItemsRows as any[]).filter((r: any) => DEBT_CATS.includes(r.category));
      const equityRows = (capItemsRows as any[]).filter((r: any) => !DEBT_CATS.includes(r.category));
      const totalDebt = debtRows.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalEquity = equityRows.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalCap = totalDebt + totalEquity;
      const ebitdaVal = Number(deal.ebitda);
      const debtEbitda = ebitdaVal > 0 ? `${(totalDebt / ebitdaVal).toFixed(2)}x` : "n/m";
      const debtPct = totalCap > 0 ? `${(totalDebt / totalCap * 100).toFixed(1)}%` : "0%";
      const stack = (capItemsRows as any[]).map((r: any) => `${r.category} $${Math.round(Number(r.amount)).toLocaleString()}${r.rate ? ` @${r.rate}%` : ""}`).join(", ");
      capLine = `\n- Pro-forma capitalization: total debt $${Math.round(totalDebt).toLocaleString()} across ${debtRows.length} tranche(s) (${debtEbitda} EBITDA, ${debtPct} of total cap), equity $${Math.round(totalEquity).toLocaleString()}. Stack: [${stack}]`;
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 2c PART 1: Compute financial ratios, benchmark against
    // industry thresholds, store in computed_metrics.
    //
    // Ratios (10): debt_to_ebitda, debt_to_equity, interest_coverage,
    //   current_ratio, gross_margin, ebitda_margin, net_margin,
    //   revenue_growth, ebitda_growth, global_dscr
    //
    // NOTE: deal.interest_rate is stored as a PERCENTAGE number
    //   (e.g. 6.50 means 6.5%). Divide by 100 before computing
    //   the monthly decimal rate for debt service calculations.
    // ─────────────────────────────────────────────────────────────

    // ratioSummary and computedRatiosBlock are populated inside the Phase 2c else
    // branch and consumed by the scoring prompt below — must be declared here for scope.
    const ratioSummary: { label: string; value: number; unit: string; status: string | null }[] = [];
    let computedRatiosBlock = "";

    // STEP 1 — Check for confirmed financials
    const { data: confirmedFinancials } = await supabase
      .from("extracted_financials")
      .select("*")
      .eq("deal_id", deal_id)
      .eq("borrower_confirmed", true)
      .order("fiscal_year", { ascending: false });

    if (deal.financials_status !== "confirmed" || !confirmedFinancials || confirmedFinancials.length === 0) {
      console.log("[score-deal] Phase 2c: No confirmed financials — skipping ratio computation.");
    } else {
      // STEP 2 — Compute ratios
      const primary = confirmedFinancials[0];
      const prior = confirmedFinancials[1] ?? null;

      const r2 = (v: number): number => Math.round(v * 100) / 100;
      const safeDiv = (n: number | null, d: number | null): number | null => {
        if (n == null || d == null || d === 0) return null;
        return r2(n / d);
      };

      const ebitdaPositive = primary.ebitda != null && primary.ebitda > 0;
      const debt_to_ebitda    = ebitdaPositive ? safeDiv(primary.total_debt, primary.ebitda) : null;
      const debt_to_equity    = safeDiv(primary.total_debt, primary.equity);
      const interest_coverage = ebitdaPositive ? safeDiv(primary.ebitda, primary.interest_expense) : null;
      const current_ratio     = safeDiv(primary.current_assets, primary.current_liabilities);

      const gross_margin = (primary.gross_profit != null && primary.revenue != null && primary.revenue !== 0)
        ? r2(primary.gross_profit / primary.revenue * 100) : null;
      const ebitda_margin = (primary.ebitda != null && primary.revenue != null && primary.revenue !== 0)
        ? r2(primary.ebitda / primary.revenue * 100) : null;
      const net_margin = (primary.net_income != null && primary.revenue != null && primary.revenue !== 0)
        ? r2(primary.net_income / primary.revenue * 100) : null;

      const revenue_growth = (prior != null && prior.revenue != null && prior.revenue > 0 && primary.revenue != null)
        ? r2((primary.revenue - prior.revenue) / prior.revenue * 100) : null;
      const ebitda_growth = (prior != null && prior.ebitda != null && prior.ebitda > 0 && primary.ebitda != null)
        ? r2((primary.ebitda - prior.ebitda) / prior.ebitda * 100) : null;

      // global_dscr — EBITDA / (existing annual debt service + new facility annual debt service)
      let global_dscr: number | null = null;
      let dscrNote = "";
      if (deal.amount_requested != null && ebitdaPositive) {
        const interestExp = primary.interest_expense ?? 0;
        let currentPortion = 0;
        if (primary.debt_detail && typeof primary.debt_detail === "object") {
          const dd = primary.debt_detail as Record<string, any>;
          const cp = dd.current_portion ?? dd.current_portion_ltd ?? 0;
          currentPortion = (typeof cp === "number" && isFinite(cp)) ? cp : 0;
        }
        let existing_debt_service: number;
        if (currentPortion > 0) {
          // Tier 1: confirmed statement data — highest trust
          existing_debt_service = interestExp + currentPortion;
        } else if (typeof deal.existing_debt_service === "number" && deal.existing_debt_service > 0) {
          // Tier 2: borrower-reported total annual debt service
          existing_debt_service = deal.existing_debt_service;
          dscrNote = "existing debt service from borrower-reported figure";
        } else {
          // Tier 3: interest only — principal unavailable
          existing_debt_service = interestExp;
          if (primary.total_debt != null && primary.total_debt > 0) {
            dscrNote = "principal portion of existing debt unavailable";
          }
        }

        // interest_rate is a percentage number (e.g. 6.50 = 6.5%) — divide by 100
        const annualRatePct = deal.interest_rate ?? 0;
        const r_monthly = (annualRatePct / 100) / 12;
        const n = deal.term_months ?? 60;
        const new_facility_debt_service = r_monthly === 0
          ? (deal.amount_requested / n) * 12
          : (deal.amount_requested * r_monthly / (1 - Math.pow(1 + r_monthly, -n))) * 12;

        const total_annual_debt_service = existing_debt_service + new_facility_debt_service;
        global_dscr = total_annual_debt_service > 0 ? r2(primary.ebitda / total_annual_debt_service) : null;
      }

      // STEP 3 — Benchmarking helpers
      const parseBand = (bandText: string | null): ((v: number) => boolean) | null => {
        if (!bandText) return null;
        // Normalize: en-dash → hyphen, strip whitespace, strip unit chars (x, %, bps, $)
        const s = bandText
          .replace(/–/g, "-")
          .replace(/\s/g, "")
          .replace(/[x%]/gi, "")
          .replace(/bps/gi, "")
          .replace(/\$/g, "");
        if (s.startsWith("≥")) { const n = parseFloat(s.slice(1)); if (!isNaN(n)) return (v) => v >= n; }
        if (s.startsWith(">=")) { const n = parseFloat(s.slice(2)); if (!isNaN(n)) return (v) => v >= n; }
        if (s.startsWith("≤")) { const n = parseFloat(s.slice(1)); if (!isNaN(n)) return (v) => v <= n; }
        if (s.startsWith("<=")) { const n = parseFloat(s.slice(2)); if (!isNaN(n)) return (v) => v <= n; }
        if (s.startsWith(">")) { const n = parseFloat(s.slice(1)); if (!isNaN(n)) return (v) => v > n; }
        if (s.startsWith("<")) { const n = parseFloat(s.slice(1)); if (!isNaN(n)) return (v) => v < n; }
        const rangeMatch = s.match(/^([\d.]+)-([\d.]+)$/);
        if (rangeMatch) {
          const lo = parseFloat(rangeMatch[1]), hi = parseFloat(rangeMatch[2]);
          if (!isNaN(lo) && !isNaN(hi)) return (v) => v >= lo && v <= hi;
        }
        return null;
      };

      const NEGATIVE_GUARD_METRICS = new Set(["debt_to_ebitda", "interest_coverage", "global_dscr", "debt_to_equity"]);
      const benchmarkStatus = (value: number, row: any, metric_key: string): "strong" | "adequate" | "weak" | null => {
        if (value < 0 && NEGATIVE_GUARD_METRICS.has(metric_key)) return null;
        const strongFn = parseBand(row.strong);
        if (strongFn && strongFn(value)) return "strong";
        const adequateFn = parseBand(row.adequate);
        if (adequateFn && adequateFn(value)) return "adequate";
        const weakFn = parseBand(row.weak);
        if (weakFn && weakFn(value)) return "weak";
        return null;
      };

      // Fetch thresholds for this deal's industry
      const { data: thresholds } = await supabase
        .from("metric_thresholds")
        .select("metric_name, strong, adequate, weak, importance_tier")
        .eq("industry_key", deal.industry ?? "");

      const thresholdsByName: Record<string, any> = {};
      for (const t of (thresholds ?? [])) thresholdsByName[t.metric_name] = t;

      const METRIC_NAME_MAP: Record<string, string[]> = {
        debt_to_ebitda:    ["Net Debt / EBITDA", "Debt / EBITDA"],
        global_dscr:       ["DSCR", "DSCR (Project Finance)", "DSCR / MADS Coverage", "DSCR (Revenue / GO Bonds)"],
        interest_coverage: ["Interest Coverage Ratio"],
        current_ratio:     ["Current Ratio", "Working Capital / Current Ratio"],
        gross_margin:      ["Gross Margin", "Gross Profit Margin"],
        ebitda_margin:     ["EBITDA Margin"],
        net_margin:        ["Net Profit Margin", "Net Margin"],
        debt_to_equity:    ["Debt / Equity"],
        revenue_growth:    ["Revenue Growth Rate", "Revenue Growth / Stability", "Revenue Growth"],
        ebitda_growth:     ["EBITDA Growth"],
      };

      const METRIC_META: Record<string, { label: string; unit: string }> = {
        debt_to_ebitda:    { label: "Debt / EBITDA",     unit: "x" },
        debt_to_equity:    { label: "Debt / Equity",     unit: "x" },
        interest_coverage: { label: "Interest Coverage", unit: "x" },
        current_ratio:     { label: "Current Ratio",     unit: "x" },
        gross_margin:      { label: "Gross Margin",      unit: "%" },
        ebitda_margin:     { label: "EBITDA Margin",     unit: "%" },
        net_margin:        { label: "Net Margin",        unit: "%" },
        revenue_growth:    { label: "Revenue Growth",    unit: "%" },
        ebitda_growth:     { label: "EBITDA Growth",     unit: "%" },
        global_dscr:       { label: "DSCR (Global)",    unit: "x" },
      };

      const ratioValues: Record<string, number | null> = {
        debt_to_ebitda, debt_to_equity, interest_coverage, current_ratio,
        gross_margin, ebitda_margin, net_margin, revenue_growth, ebitda_growth, global_dscr,
      };

      // STEP 4 — Upsert into computed_metrics
      let storedCount = 0;
      let benchmarkedCount = 0;

      for (const [metric_key, value] of Object.entries(ratioValues)) {
        if (value == null) continue;
        const meta = METRIC_META[metric_key];
        const candidates = METRIC_NAME_MAP[metric_key] ?? [];
        const threshRow = candidates.map((n) => thresholdsByName[n]).find(Boolean) ?? null;
        const status = threshRow ? benchmarkStatus(value, threshRow, metric_key) : null;
        const tier = threshRow?.importance_tier ?? null;
        const fyForRatio = primary.fiscal_year;

        ratioSummary.push({ label: meta.label, value, unit: meta.unit, status });

        try {
          const { error: upsertErr } = await supabase.from("computed_metrics").upsert(
            {
              deal_id,
              fiscal_year: fyForRatio,
              metric_key,
              metric_label: meta.label,
              value,
              unit: meta.unit,
              industry_tier: tier,
              benchmark_status: status,
              computable_from: "financials",
            },
            { onConflict: "deal_id,fiscal_year,metric_key" }
          );
          if (upsertErr) {
            console.error(`[score-deal] computed_metrics upsert error (${metric_key}):`, upsertErr);
          } else {
            storedCount++;
            if (status) benchmarkedCount++;
          }
        } catch (metricErr) {
          console.error(`[score-deal] Unhandled error storing metric ${metric_key}:`, metricErr);
        }
      }

      if (ratioSummary.length > 0) {
        computedRatiosBlock =
          `COMPUTED FINANCIAL RATIOS (from borrower-confirmed financial statements — fiscal year ${primary.fiscal_year}):\n` +
          ratioSummary
            .map(r => {
              const tag = r.status ? ` (${r.status} for industry)` : "";
              return `- ${r.label}: ${r.value}${r.unit}${tag}`;
            })
            .join("\n");
      }

      if (dscrNote) console.log(`[score-deal] Phase 2c DSCR note: ${dscrNote}`);
      console.log(`[score-deal] Phase 2c computed ${storedCount} ratios, ${benchmarkedCount} benchmarked.`);

      // ─────────────────────────────────────────────────────────────
      // PHASE 2d: Rule-based anomaly detection (requires >= 2 confirmed years)
      // ─────────────────────────────────────────────────────────────
      if (prior !== null) {
        const pctChange = (from: number | null, to: number | null): number | null => {
          if (from == null || to == null || from === 0) return null;
          return ((to - from) / Math.abs(from)) * 100;
        };
        const fmt = (n: number | null) => n != null ? `$${Number(n).toLocaleString()}` : "N/A";

        let flagsDetected = 0;

        const upsertFlag = async (flag: {
          flag_key: string;
          severity: "high" | "medium";
          metric_label: string;
          value_from: number | null;
          value_to: number | null;
          change_pct: number | null;
          detail: string;
        }) => {
          try {
            const { error } = await supabase.from("credit_flags").upsert(
              {
                deal_id,
                flag_key: flag.flag_key,
                flag_category: "quantitative",
                severity: flag.severity,
                fiscal_year_from: prior.fiscal_year,
                fiscal_year_to: primary.fiscal_year,
                metric_label: flag.metric_label,
                value_from: flag.value_from,
                value_to: flag.value_to,
                change_pct: flag.change_pct,
                detail: flag.detail,
                detection_source: "rule",
                status: "open",
              },
              { onConflict: "deal_id,flag_key,fiscal_year_to" }
            );
            if (error) console.error(`[score-deal] credit_flags upsert error (${flag.flag_key}):`, error);
            else flagsDetected++;
          } catch (flagErr) {
            console.error(`[score-deal] Unhandled flag upsert error (${flag.flag_key}):`, flagErr);
          }
        };

        // FLAG 1 — revenue_swing (>= 15% either direction)
        const revChange = pctChange(prior.revenue, primary.revenue);
        if (revChange !== null && Math.abs(revChange) >= 15) {
          const absRev = Math.abs(revChange);
          await upsertFlag({
            flag_key: "revenue_swing",
            severity: absRev >= 30 ? "high" : "medium",
            metric_label: "Revenue",
            value_from: prior.revenue,
            value_to: primary.revenue,
            change_pct: r2(revChange),
            detail: `Revenue changed ${r2(revChange)}% year-over-year (FY${prior.fiscal_year} ${fmt(prior.revenue)} → FY${primary.fiscal_year} ${fmt(primary.revenue)}).`,
          });
        }

        // FLAG 2 — ebitda_swing (>= 20% either direction; both values must be positive)
        if (prior.ebitda != null && prior.ebitda > 0 && primary.ebitda != null && primary.ebitda > 0) {
          const ebitdaChange = pctChange(prior.ebitda, primary.ebitda);
          if (ebitdaChange !== null && Math.abs(ebitdaChange) >= 20) {
            const absEbitda = Math.abs(ebitdaChange);
            await upsertFlag({
              flag_key: "ebitda_swing",
              severity: absEbitda >= 40 ? "high" : "medium",
              metric_label: "EBITDA",
              value_from: prior.ebitda,
              value_to: primary.ebitda,
              change_pct: r2(ebitdaChange),
              detail: `EBITDA changed ${r2(ebitdaChange)}% year-over-year (FY${prior.fiscal_year} ${fmt(prior.ebitda)} → FY${primary.fiscal_year} ${fmt(primary.ebitda)}).`,
            });
          }
        }

        // FLAG 3 — debt_increase (>= 30% increase only)
        const debtChange = pctChange(prior.total_debt, primary.total_debt);
        if (debtChange !== null && debtChange >= 30) {
          await upsertFlag({
            flag_key: "debt_increase",
            severity: debtChange >= 60 ? "high" : "medium",
            metric_label: "Total Debt",
            value_from: prior.total_debt,
            value_to: primary.total_debt,
            change_pct: r2(debtChange),
            detail: `Total debt increased ${r2(debtChange)}% year-over-year (FY${prior.fiscal_year} ${fmt(prior.total_debt)} → FY${primary.fiscal_year} ${fmt(primary.total_debt)}).`,
          });
        }

        // FLAG 4 — leverage_shift (>= 1.0 turn either direction; both EBITDA values must be positive)
        if (
          prior.ebitda != null && prior.ebitda > 0 &&
          primary.ebitda != null && primary.ebitda > 0 &&
          prior.total_debt != null && primary.total_debt != null
        ) {
          const priorLev = r2(prior.total_debt / prior.ebitda);
          const primaryLev = r2(primary.total_debt / primary.ebitda);
          const shift = r2(Math.abs(primaryLev - priorLev));
          if (shift >= 1.0) {
            const direction = primaryLev > priorLev ? "increase of" : "decrease of";
            await upsertFlag({
              flag_key: "leverage_shift",
              severity: shift >= 2.0 ? "high" : "medium",
              metric_label: "Debt / EBITDA",
              value_from: priorLev,
              value_to: primaryLev,
              change_pct: null,
              detail: `Leverage shifted from ${priorLev}x to ${primaryLev}x (${direction} ${shift}x turn, FY${prior.fiscal_year} → FY${primary.fiscal_year}).`,
            });
          }
        }

        console.log(`[score-deal] Phase 2d detected ${flagsDetected} rule-based flag(s).`);

        // ── Phase 2d Part 2 — Templated question generation from rule flags
        const { data: ruleFlags } = await supabase
          .from("credit_flags")
          .select("flag_key, severity, value_from, value_to, change_pct, fiscal_year_from, fiscal_year_to")
          .eq("deal_id", deal_id)
          .eq("status", "open")
          .eq("detection_source", "rule")
          .eq("fiscal_year_to", primary.fiscal_year);

        let questionsGenerated = 0;

        for (const flag of ruleFlags ?? []) {
          try {
            // Skip if a pending_review or approved question already exists for this metric
            const { data: existing } = await supabase
              .from("credit_questions")
              .select("id")
              .eq("deal_id", deal_id)
              .eq("related_metric", flag.flag_key)
              .in("status", ["pending_review", "approved"])
              .limit(1);

            if (existing && existing.length > 0) continue;

            const from = flag.fiscal_year_from;
            const to = flag.fiscal_year_to;
            const vFrom = flag.value_from != null ? `$${Number(flag.value_from).toLocaleString()}` : "N/A";
            const vTo   = flag.value_to   != null ? `$${Number(flag.value_to).toLocaleString()}`   : "N/A";
            const absPct = flag.change_pct != null ? Math.abs(flag.change_pct) : null;
            const isIncrease = flag.change_pct != null
              ? flag.change_pct > 0
              : (flag.value_to ?? 0) > (flag.value_from ?? 0);

            let questionText = "";

            if (flag.flag_key === "revenue_swing") {
              questionText = isIncrease
                ? `Your revenue grew ${flag.change_pct}% from FY${from} to FY${to} (from ${vFrom} to ${vTo}). What specifically drove this growth — new customers, pricing, new products, or acquisitions? Is it organic and recurring, or partly one-time? How sustainable is this trajectory?`
                : `Your revenue declined ${absPct}% from FY${from} to FY${to} (from ${vFrom} to ${vTo}). What caused the decline — lost customers, pricing pressure, a discontinued line, or market conditions? What have you done to stabilize or reverse it?`;
            } else if (flag.flag_key === "ebitda_swing") {
              questionText = isIncrease
                ? `Your EBITDA improved ${flag.change_pct}% from FY${from} to FY${to}. Was this driven by revenue growth, margin improvement, cost reductions, or one-time items? Are these gains structural and repeatable?`
                : `Your EBITDA fell ${absPct}% from FY${from} to FY${to}. What drove the compression — input costs, pricing, one-time expenses, or volume? What is being done to restore profitability?`;
            } else if (flag.flag_key === "debt_increase") {
              questionText = `Your total debt increased ${flag.change_pct}% from FY${from} to FY${to} (from ${vFrom} to ${vTo}). What was the purpose of the additional borrowing, what are the terms and maturities, and how does it affect your ability to service the requested facility?`;
            } else if (flag.flag_key === "leverage_shift") {
              const levFrom = flag.value_from != null ? `${flag.value_from}x` : "N/A";
              const levTo   = flag.value_to   != null ? `${flag.value_to}x`   : "N/A";
              const levUp   = (flag.value_to ?? 0) > (flag.value_from ?? 0);
              questionText = levUp
                ? `Your leverage rose from ${levFrom} to ${levTo} Debt/EBITDA between FY${from} and FY${to}. What drove the increase, and what is your plan to manage debt service at this higher level?`
                : `Your leverage improved from ${levFrom} to ${levTo} Debt/EBITDA between FY${from} and FY${to}. What enabled the deleveraging — debt repayment, EBITDA growth, asset sales, or equity injection? Is it sustainable?`;
            }

            if (!questionText) continue;

            const { error: qErr } = await supabase.from("credit_questions").insert({
              deal_id,
              question_type: "metric_anomaly",
              source: "rule",
              related_metric: flag.flag_key,
              question_text: questionText,
              priority: flag.severity,
              status: "pending_review",
              ai_reviewed: false,
            });

            if (qErr) {
              console.error(`[score-deal] credit_questions insert error (${flag.flag_key}):`, qErr);
            } else {
              questionsGenerated++;
            }
          } catch (qGenErr) {
            console.error(`[score-deal] Question generation error (${flag.flag_key}):`, qGenErr);
          }
        }

        console.log(`[score-deal] Phase 2d Part 2 generated ${questionsGenerated} question(s) for review.`);
      }

      // ── Phase 2d Job B — AI qualitative notes analysis
      const hasNotes = confirmedFinancials.some(row =>
        (row.notes_summary && String(row.notes_summary).trim()) ||
        (row.debt_detail && typeof row.debt_detail === "object" && Object.keys(row.debt_detail).length > 0) ||
        (row.raw_notes && String(row.raw_notes).trim())
      );

      if (!hasNotes) {
        console.log("[score-deal] Phase 2d Job B skipped (no notes to analyze).");
      } else {
        try {
          // Build financial context across all confirmed years
          let financialContext = "";
          for (const row of confirmedFinancials) {
            const fmtN = (n: number | null) => n != null ? `$${Number(n).toLocaleString()}` : "N/A";
            financialContext += `\n--- FY${row.fiscal_year} ---\n`;
            financialContext += `Revenue: ${fmtN(row.revenue)}  EBITDA: ${fmtN(row.ebitda)}  Net Income: ${fmtN(row.net_income)}\n`;
            financialContext += `Total Assets: ${fmtN(row.total_assets)}  Total Debt: ${fmtN(row.total_debt)}  Equity: ${fmtN(row.equity)}\n`;
            if (row.notes_summary) financialContext += `Notes Summary: ${row.notes_summary}\n`;
            if (row.debt_detail && typeof row.debt_detail === "object") {
              financialContext += `Debt Detail: ${JSON.stringify(row.debt_detail)}\n`;
            }
            if (row.raw_notes) financialContext += `Extraction Flags / Raw Notes: ${row.raw_notes}\n`;
          }

          const jobBPrompt =
`You are a skeptical senior credit analyst reviewing the notes to a borrower's financial statements before approving a loan. Your job is to identify GENUINELY MATERIAL issues that a careful lender would want the borrower to explain — and to generate a specific question for each.

CRITICAL RULES:
1. GROUNDING: Every question MUST be grounded in a specific item actually present in the documents provided. Reference the specific note, figure, or disclosure that prompted it. Do NOT ask generic questions. Do NOT invent concerns that are not supported by the documents.
2. MATERIALITY: Only ask about things that genuinely affect credit risk — things that would change how a lender views repayment ability, leverage, or risk. Ignore immaterial or boilerplate disclosures.
3. IT IS CORRECT TO RETURN FEW OR ZERO QUESTIONS. If the notes contain nothing materially concerning, return an empty list. Do NOT manufacture questions to fill space. A clean set of notes should produce few or no questions. Quality over quantity, always.
4. MAXIMUM 20 questions, but only ask as many as there are genuinely material issues. Most deals will have between 0 and 8. Going to 20 is rare and only justified when there are truly that many distinct material issues.

Look specifically for (only if actually present in the documents):
- Litigation, lawsuits, legal contingencies, or claims
- Going-concern language or doubt about the entity's ability to continue
- Debt maturities falling within or near the requested loan term (compare maturity dates to the loan term of ${deal.term_months} months) — a large maturity coming due soon is a refinancing risk
- Covenant breaches, waivers, or tight covenant headroom
- Related-party transactions or loans to/from owners
- Off-balance-sheet obligations, guarantees, or contingent liabilities
- Unusual, non-recurring, or one-time items affecting earnings
- Significant subsequent events (after the statement date)
- Customer/supplier concentration disclosed in notes
- Changes in accounting policy or restatements
- Pledged/encumbered assets affecting collateral availability
- Optimistic forward projections or assumptions that warrant scrutiny

For each genuine issue, write a specific, detail-oriented question in the same probing style a senior analyst would use — reference the specific item, and ask about cause, magnitude, and mitigation.

Return ONLY valid JSON, no markdown, with this shape:
{
  "questions": [
    {
      "category": "<litigation | going_concern | debt_maturity | covenant | related_party | off_balance_sheet | non_recurring | subsequent_event | concentration | accounting_change | encumbered_assets | projection | other>",
      "materiality": "<high | medium | low>",
      "grounded_in": "<the specific note/figure/disclosure this question is based on — quote or closely reference it>",
      "question": "<the question to ask the borrower>"
    }
  ]
}
If there are no material issues, return { "questions": [] }.

DEAL CONTEXT:
- Amount Requested: $${Number(deal.amount_requested ?? 0).toLocaleString()} CAD
- Loan Term: ${deal.term_months ?? "N/A"} months

FINANCIAL STATEMENTS AND NOTES:${financialContext}`;

          const jobBRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-opus-4-8",
              max_tokens: 4000,
              messages: [{ role: "user", content: jobBPrompt }],
            }),
          });

          if (!jobBRes.ok) {
            const errText = await jobBRes.text();
            console.error("[score-deal] Phase 2d Job B API error:", errText);
          } else {
            const jobBData = await jobBRes.json();
            const rawJobB: string = jobBData.content[0].text;
            const cleanedJobB = rawJobB
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```\s*$/i, "")
              .trim();

            let parsedJobB: { questions: any[] } = { questions: [] };
            try {
              parsedJobB = JSON.parse(cleanedJobB);
            } catch (_e) {
              console.error("[score-deal] Phase 2d Job B JSON parse error. Raw:", rawJobB.slice(0, 300));
            }

            let jobBCount = 0;
            const aiQuestions = (parsedJobB.questions ?? []).slice(0, 20);

            for (const q of aiQuestions) {
              try {
                // Duplicate guard: skip if an AI question for this category already exists
                const { data: existing } = await supabase
                  .from("credit_questions")
                  .select("id")
                  .eq("deal_id", deal_id)
                  .eq("related_metric", q.category)
                  .eq("source", "ai")
                  .in("status", ["pending_review", "approved"])
                  .limit(1);

                if (existing && existing.length > 0) continue;

                const priority = q.materiality === "high" ? "high" : q.materiality === "low" ? "low" : "medium";

                const { error: qErr } = await supabase.from("credit_questions").insert({
                  deal_id,
                  question_type: "qualitative_notes",
                  source: "ai",
                  related_metric: q.category,
                  question_text: q.question,
                  priority,
                  status: "pending_review",
                  ai_reviewed: false,
                  input_fields: { grounded_in: q.grounded_in ?? null },
                });

                if (qErr) {
                  console.error(`[score-deal] Phase 2d Job B insert error (${q.category}):`, qErr);
                } else {
                  jobBCount++;
                }
              } catch (qBErr) {
                console.error(`[score-deal] Phase 2d Job B question error (${q.category}):`, qBErr);
              }
            }

            console.log(`[score-deal] Phase 2d Job B generated ${jobBCount} qualitative question(s) for review.`);
          }
        } catch (jobBErr) {
          console.error("[score-deal] Phase 2d Job B unhandled error:", jobBErr);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 2c-ENGINE: Deterministic transparent score (the rubric)
    // Runs the code engine against the versioned framework tables.
    // The engine — not the LLM — produces the overall score.
    // ─────────────────────────────────────────────────────────────
    let engineResult = null;
    try {
      engineResult = await runDeterministicScore(
        supabase,
        deal_id,
        {
          industry: deal.industry,
          amount_requested: deal.amount_requested,
          term_months: deal.term_months,
          interest_rate: deal.interest_rate,
          existing_debt_service: deal.existing_debt_service,
        },
        confirmedFinancials ?? [],
        { lenderId: null }   // null = canonical defaults; wire lender policy later
      );
      if (engineResult) {
        console.log(`[score-deal] Engine score: ${engineResult.score.overall_score} ` +
          `(${engineResult.score.risk_label}), coverage ${engineResult.score.coverage_pct}%, ` +
          `floor ${engineResult.score.critical_floor_applied ? "applied" : "no"}.`);
      } else {
        console.log("[score-deal] Engine skipped — no confirmed financials.");
      }
    } catch (engineErr) {
      console.error("[score-deal] Engine error (falling back to LLM score):", engineErr);
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 1 scoring continues unchanged below
    // ─────────────────────────────────────────────────────────────

    // Build self-reported leverage estimate for Phase 1 (no confirmed financials)
    let selfReportedEstimate = "";
    if (!computedRatiosBlock) {
      const hasEbitda = typeof deal.ebitda === "number" && deal.ebitda > 0;
      const hasExistingDebt = typeof deal.existing_debt === "number" && deal.existing_debt > 0;
      const lines: string[] = [];

      if (deal.annual_revenue && deal.ebitda) {
        lines.push(`- EBITDA Margin: ${((deal.ebitda / deal.annual_revenue) * 100).toFixed(1)}%`);
      }

      if (hasEbitda && hasExistingDebt) {
        const totalLeverage = (deal.existing_debt + deal.amount_requested) / deal.ebitda;
        lines.push(
          `- ROUGH LEVERAGE ESTIMATE (self-reported, unverified — no confirmed statements): total debt including requested facility ≈ ${totalLeverage.toFixed(2)}x self-reported EBITDA. (existing debt $${Number(deal.existing_debt).toLocaleString()} + requested $${Number(deal.amount_requested).toLocaleString()}) ÷ EBITDA $${Number(deal.ebitda).toLocaleString()}.`
        );
      } else if (hasEbitda) {
        const newBorrowingRatio = deal.amount_requested / deal.ebitda;
        lines.push(
          `- ROUGH SIZING (self-reported, unverified): requested facility ≈ ${newBorrowingRatio.toFixed(2)}x self-reported EBITDA in NEW borrowing. Existing debt not provided, so total leverage cannot be assessed.`
        );
      }

      const noDscrInstruction =
        `\nIMPORTANT: No confirmed financial statements exist for this deal. Do NOT calculate, estimate, or cite any DSCR, debt-service-coverage ratio, or interest-coverage ratio — a reliable coverage ratio cannot be computed from self-reported summary figures, and presenting one would imply false precision. Use the ROUGH LEVERAGE ESTIMATE provided above as your debt-capacity anchor, and otherwise assess the borrower's ability to service debt qualitatively. You may reference the leverage estimate and EBITDA margin, but do not invent coverage ratios.`;

      if (lines.length > 0) {
        selfReportedEstimate =
          `The figures below are self-reported and unverified (no confirmed financial statements). Treat them as rough sizing signals only, not as verified ratios.\n` +
          lines.join("\n") +
          noDscrInstruction;
      } else {
        selfReportedEstimate = noDscrInstruction.trimStart();
      }
    }

    // Fetch answered credit questions for answer-incorporation into scoring
    const { data: answeredQData } = await supabase
      .from('credit_questions')
      .select('id, question_text, answer, related_metric, source')
      .eq('deal_id', deal_id)
      .eq('status', 'approved')
      .not('answer', 'is', null);
    const answeredQuestions = (answeredQData ?? []).filter((q: any) => q.answer && String(q.answer).trim());

    let qnaBlock = "";
    if (answeredQuestions.length > 0) {
      qnaBlock =
        `\nBORROWER ANSWERS TO CREDIT QUESTIONS:\n` +
        `The borrower was asked the following questions about anomalies and concerns in their financials, and provided these answers. Assess EACH answer as a skeptical credit analyst: does the answer adequately RESOLVE the concern, or NOT?\n\n` +
        `An answer only resolves a concern if it is specific, plausible, and consistent with the financial data. Vague, evasive, or unverifiable answers do NOT resolve the concern. An answer that reveals additional risk should be treated as NOT resolved and noted.\n\n` +
        `A genuinely resolved concern may modestly improve the assessment. Unresolved concerns should NOT improve it, and answers that reveal new risk may worsen it. Be conservative — do not reward hand-waving.\n\n` +
        answeredQuestions.map((q: any, i: number) =>
          `Q${i + 1} [question_id: ${q.id}${q.related_metric ? `, metric: ${q.related_metric}` : ""}]:\n` +
          `Question: ${q.question_text}\n` +
          `Borrower's Answer: ${q.answer}`
        ).join("\n\n");
      console.log(`[score-deal] Incorporating ${answeredQuestions.length} answered question(s) into scoring prompt.`);
    }

    // Build the credit scoring prompt
    const prompt = `You are a senior SME credit analyst at a Canadian debt marketplace. Score the following deal using the structured financial data provided.

DEAL DETAILS:
- Company / Title: ${deal.title ?? "N/A"}
- Industry: ${deal.industry ?? "N/A"}
- Province: ${deal.province ?? "N/A"}
- Years in Business: ${deal.years_in_business ?? "N/A"}
- Amount Requested: $${Number(deal.amount_requested ?? 0).toLocaleString()} CAD
- Loan Term: ${deal.term_months ?? "N/A"} months
- Target Interest Rate: ${deal.interest_rate ?? "N/A"}%
- Annual Revenue: $${Number(deal.annual_revenue ?? 0).toLocaleString()} CAD
- EBITDA: $${Number(deal.ebitda ?? 0).toLocaleString()} CAD
- Use of Funds: ${deal.use_of_funds?.trim() ? deal.use_of_funds : "Not specified by the applicant."}${collateralLine}${sourcesUsesLine}${capLine}

${selfReportedEstimate ? selfReportedEstimate + "\n\n" : ""}${computedRatiosBlock ? `When computed ratios are present below, base your financial assessment primarily on them — they are calculated directly from the borrower's confirmed financial statements and are more reliable than self-reported summary figures. Weight each ratio according to what matters most for this borrower's industry.\n\n${computedRatiosBlock}\n\n` : ""}${qnaBlock ? qnaBlock + "\n\n" : ""}Return ONLY valid JSON — no markdown fences, no preamble, no commentary. The JSON must have exactly this shape:

{
  "summary": "<4-6 sentence credit assessment covering the borrower's financial health, debt capacity, and overall creditworthiness>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>", "<strength 5>"],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>", "<risk 4>", "<risk 5>"],
  "metrics": {
    "leverage": <integer 0-100>,
    "profitability": <integer 0-100>,
    "debt_service_coverage": <integer 0-100>,
    "business_stability": <integer 0-100>,
    "industry_risk": <integer 0-100>,
    "deal_structure": <integer 0-100>,
    "revenue_quality": <integer 0-100>,
    "repayment_capacity": <integer 0-100>
  }${answeredQuestions.length > 0 ? `,
  "answer_assessments": [ { "question_id": "<the question_id value from the Q&A block above>", "resolved": true|false, "assessment": "<one or two sentence skeptical reasoning>" } ]` : ""}
}

Each metric score is 0-100 where 100 is best.`;

    // Call Claude
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[score-deal] Anthropic API error:", errText);
      return new Response(JSON.stringify({ error: "Anthropic API error", detail: errText }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const anthropicData = await anthropicRes.json();
    const rawText: string = anthropicData.content[0].text;

    // Strip markdown fences if present
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let scoring: any;
    try {
      scoring = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[score-deal] JSON parse failed. Raw text:", rawText);
      return new Response(
        JSON.stringify({ error: "Failed to parse Claude response", raw: rawText }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Write answer_assessments back to credit_questions rows
    if (answeredQuestions.length > 0 && Array.isArray(scoring.answer_assessments)) {
      for (const assessment of scoring.answer_assessments) {
        if (!assessment.question_id) continue;
        const label = assessment.resolved
          ? `Resolved — ${assessment.assessment}`
          : `Not resolved — ${assessment.assessment}`;
        try {
          const { error: aaErr } = await supabase
            .from('credit_questions')
            .update({ answer_assessment: label })
            .eq('id', assessment.question_id);
          if (aaErr) console.error(`[score-deal] answer_assessment write-back error (${assessment.question_id}):`, aaErr);
        } catch (aErr) {
          console.error(`[score-deal] answer_assessment write-back unhandled error (${assessment.question_id}):`, aErr);
        }
      }
      console.log(`[score-deal] Wrote ${scoring.answer_assessments.length} answer assessment(s) back to credit_questions.`);
    }

    // Engine owns the number when it ran; LLM owns the narrative.
    const finalScore = engineResult ? engineResult.score.overall_score : scoring.overall_score;
    const finalRisk  = engineResult ? engineResult.score.risk_label     : scoring.risk_label;

    if (engineResult) {
      // Engine path: persist deterministic score + per-metric rationale,
      // with the LLM narrative attached.
      await persistEngineResult(supabase, deal_id, engineResult, {
        summary: scoring.summary,
        strengths: scoring.strengths,
        risks: scoring.risks,
        metrics: scoring.metrics,
      });
    } else {
      // Fallback path (no confirmed financials): keep existing LLM-only behavior.
      const { error: upsertError } = await supabase.from("credit_scores").upsert(
        {
          deal_id,
          overall_score: scoring.overall_score,
          risk_label: scoring.risk_label,
          summary: scoring.summary,
          strengths: scoring.strengths,
          risks: scoring.risks,
          metrics: scoring.metrics,
          score_source: "llm",
          model_used: "claude-opus-4-8",
        },
        { onConflict: "deal_id" }
      );
      if (upsertError) console.error("[score-deal] credit_scores upsert error:", upsertError);
    }

    // Update deals: write AI score + summary back to the deal row
    const { error: dealUpdateError } = await supabase
      .from("deals")
      .update({
        ai_score: finalScore,        // engine number when available
        ai_summary: scoring.summary, // summary stays LLM
      })
      .eq("id", deal_id);

    if (dealUpdateError) {
      console.error("[score-deal] deals update (score/summary) error:", dealUpdateError);
    }

    // Update deals: mark the deal as active so it goes live on the marketplace
    const { error: statusError } = await supabase
      .from("deals")
      .update({ status: "active" })
      .eq("id", deal_id);

    if (statusError) {
      console.error("[score-deal] deals update (status) error:", statusError);
    }

    return new Response(
      JSON.stringify({
        deal_id,
        ...scoring,
        overall_score: finalScore,   // engine number wins
        risk_label: finalRisk,
        engine: engineResult ? {
          coverage_pct: engineResult.score.coverage_pct,
          critical_floor_applied: engineResult.score.critical_floor_applied,
          metrics_scored: engineResult.score.metrics_scored,
        } : null,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[score-deal] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
