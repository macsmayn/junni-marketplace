import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { deal_id } = await req.json();
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
        "title, industry, amount_requested, term_months, interest_rate, annual_revenue, ebitda, years_in_business, province, ai_summary"
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
      console.log(`[score-deal] ${financialDocs.length} financial statement document(s) found — beginning extraction.`);

      for (const doc of financialDocs) {
        try {
          // a. PDFs only for now
          if (!doc.file_type?.includes("pdf")) {
            console.log(`[score-deal] Skipped "${doc.file_name}" (non-PDF, Excel support coming)`);
            continue;
          }

          // b. Download from Supabase Storage
          const { data: blob, error: downloadError } = await supabase.storage
            .from("documents")
            .download(doc.storage_path);

          if (downloadError || !blob) {
            console.error(`[score-deal] Download failed for "${doc.file_name}":`, downloadError);
            continue;
          }

          // c. Convert blob to base64
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64Data = btoa(binary);

          // d & e. Call Claude with PDF document block + extraction prompt
          const extractionPrompt = `You are a financial analyst extracting structured data from financial statements for SME credit analysis.

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
      "debt_detail": <object with current_portion, long_term, rates, maturities if disclosed — or null>,
      "notes_summary": "<material disclosures from notes: debt covenants, maturities, contingencies, related-party transactions, leases, guarantees>",
      "extraction_confidence": "<high | medium | low>",
      "raw_notes": "<anything flagged as unclear or ambiguous>"
    }
  ]
}

All monetary values must be plain numbers (not strings), scaled to FULL actual dollar amounts. Use null for any field not present in the document.`;

          const extractionRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-opus-4-8",
              max_tokens: 4000,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "document",
                      source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: base64Data,
                      },
                    },
                    {
                      type: "text",
                      text: extractionPrompt,
                    },
                  ],
                },
              ],
            }),
          });

          if (!extractionRes.ok) {
            const errText = await extractionRes.text();
            console.error(`[score-deal] Anthropic extraction error for "${doc.file_name}":`, errText);
            continue;
          }

          const extractionData = await extractionRes.json();
          const rawExtractionText: string = extractionData.content[0].text;

          // f. Strip markdown fences, parse JSON
          const cleanedExtraction = rawExtractionText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/i, "")
            .trim();

          let extracted: { statements: any[] };
          try {
            extracted = JSON.parse(cleanedExtraction);
          } catch (_parseErr) {
            console.error(`[score-deal] JSON parse failed for "${doc.file_name}". Raw:`, rawExtractionText.slice(0, 300));
            continue;
          }

          // Upsert each fiscal year — later document wins on conflict
          for (const stmt of extracted.statements ?? []) {
            if (!stmt.fiscal_year) continue;
            const { error: upsertErr } = await supabase.from("extracted_financials").upsert(
              {
                deal_id,
                source_document_id: doc.id,
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
        } catch (docErr) {
          console.error(`[score-deal] Unhandled error processing "${doc.file_name}":`, docErr);
        }
      }

      console.log(`[score-deal] Phase 2a complete — ${totalYearsExtracted} fiscal year(s) extracted.`);

      if (totalYearsExtracted > 0) {
        const { error: statusErr } = await supabase
          .from("deals")
          .update({ financials_status: "extracted" })
          .eq("id", deal_id);
        if (statusErr) {
          console.error("[score-deal] Failed to update financials_status:", statusErr);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────
    // Phase 1 scoring continues unchanged below
    // ─────────────────────────────────────────────────────────────

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
- Use of Funds: ${deal.ai_summary ?? "Not specified"}

DERIVED RATIOS (calculate where possible from data above):
- EBITDA Margin: ${deal.annual_revenue && deal.ebitda ? ((deal.ebitda / deal.annual_revenue) * 100).toFixed(1) + "%" : "N/A"}
- Debt / EBITDA: ${deal.ebitda && deal.amount_requested ? (deal.amount_requested / deal.ebitda).toFixed(2) + "x" : "N/A"}
- Estimated DSCR: ${deal.ebitda && deal.amount_requested && deal.term_months ? (deal.ebitda / (deal.amount_requested / (deal.term_months / 12))).toFixed(2) + "x" : "N/A"}

Return ONLY valid JSON — no markdown fences, no preamble, no commentary. The JSON must have exactly this shape:

{
  "overall_score": <integer 0-100>,
  "risk_label": "<one of: Very Low | Low | Moderate | Elevated | High>",
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
  }
}

Scoring guidance: overall_score of 80+ = Very Low risk, 65-79 = Low, 50-64 = Moderate, 35-49 = Elevated, below 35 = High. Each metric score is 0-100 where 100 is best.`;

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
        max_tokens: 2000,
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

    // Upsert into credit_scores
    const { error: upsertError } = await supabase.from("credit_scores").upsert(
      {
        deal_id,
        overall_score: scoring.overall_score,
        risk_label: scoring.risk_label,
        summary: scoring.summary,
        strengths: scoring.strengths,
        risks: scoring.risks,
        metrics: scoring.metrics,
        model_used: "claude-opus-4-8",
      },
      { onConflict: "deal_id" }
    );

    if (upsertError) {
      console.error("[score-deal] credit_scores upsert error:", upsertError);
    }

    // Update deals: write AI score + summary back to the deal row
    const { error: dealUpdateError } = await supabase
      .from("deals")
      .update({
        ai_score: scoring.overall_score,
        ai_summary: scoring.summary,
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
