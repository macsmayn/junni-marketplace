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
    // PHASE 2 STUB: Check for uploaded financial statement documents
    // ─────────────────────────────────────────────────────────────
    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select("id, file_name, file_type, storage_path")
      .eq("deal_id", deal_id);

    const docCount = docs?.length ?? 0;
    console.log(`[score-deal] deal_id=${deal_id} — ${docCount} document(s) found`);

    // PHASE 2: if statements exist, download and extract line items here for full ratio analysis
    // For now, always proceed with the Phase 1 structured-data path regardless of doc count.
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
