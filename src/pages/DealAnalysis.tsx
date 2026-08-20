import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";
import { tRiskLabel } from "../lib/riskLabel";
import { translateBandUnits } from "../lib/bandUnits";
import { fmtValue } from "../lib/metricFormat";

const NAVY = "#1B2B4B";
const GOLD = "#D4940A";
const CREAM = "#FAF8F4";
const GREEN = "#059669";
const RED = "#DC2626";
const MUTED = "#7A7060";

const TIER_ORDER = ["Critical", "Important", "Supplementary", "Optional"];


function gradeChip(grade: string, t: (k: string) => string) {
  const color = grade === "Strong" ? GREEN : grade === "Adequate" ? GOLD : RED;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      background: color + "1A", color, border: `1px solid ${color}40`,
    }}>{tRiskLabel(grade, t)}</span>
  );
}

function riskChip(label: string, t: (k: string) => string) {
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

function humanizeNotScoredReason(detail: string | null, reason: string | null, t: (k: string) => string): string {
  const raw = detail ?? reason ?? "";
  if (!raw) return "—";
  if (raw.includes("=DOC") || raw.includes("=EXT") || raw.includes("primary_resolution=DOC") || raw.includes("primary_resolution=EXT")) {
    return t("analysis.reasonNeedsDocument");
  }
  if (raw.toLowerCase().includes("no computation registered")) {
    return t("analysis.reasonNoFormula");
  }
  return raw;
}

function statusLabelKey(status: string): { key: string; color: string } {
  if (status === "needs_document_or_input" || status === "needs_input") return { key: "analysis.statusNeedsData", color: GOLD };
  if (status === "needs_review") return { key: "analysis.statusNeedsReview", color: RED };
  return { key: "analysis.statusQualitative", color: MUTED };
}

interface MetricRow {
  id: string;
  metric_name: string;
  tier: string;
  value: number | null;
  grade: string;
  status: string;
  counted: boolean;
  compute_detail: string | null;
  grade_reason: string | null;
  strong_band: string | null;
  adequate_band: string | null;
  weak_band: string | null;
}

function DefContent({ def, lang }: { def: any; lang: "en" | "fr" }) {
  const fr = lang === "fr";
  const tDef = (enVal: string | null, frVal: string | null) => (fr && frVal) ? frVal : enVal;
  const higher = fr ? "↑ Plus élevé :" : "↑ Higher:";
  const lower  = fr ? "↓ Plus bas :"  : "↓ Lower:";
  const whatItIs       = tDef(def.what_it_is,       def.what_it_is_fr);
  const whatItMeasures = tDef(def.what_it_measures,  def.what_it_measures_fr);
  const highMeans      = tDef(def.high_value_means,  def.high_value_means_fr);
  const lowMeans       = tDef(def.low_value_means,   def.low_value_means_fr);
  const why            = tDef(def.why_it_matters,    def.why_it_matters_fr);
  const formula        = tDef(def.formula_plain,     def.formula_plain_fr);
  return (
    <>
      {whatItIs && (
        <div style={{ color: NAVY, fontWeight: 500, marginBottom: 4 }}>{whatItIs}</div>
      )}
      {whatItMeasures && (
        <div style={{ marginBottom: 4 }}>{whatItMeasures}</div>
      )}
      {(highMeans || lowMeans) && (
        <div style={{ marginBottom: 4 }}>
          {highMeans && <div>{higher} {highMeans}</div>}
          {lowMeans  && <div>{lower} {lowMeans}</div>}
        </div>
      )}
      {why && (
        <div style={{ fontStyle: "italic", marginBottom: 6 }}>{why}</div>
      )}
      {formula && (
        <code style={{ fontSize: 11, background: "#EDE9E1", padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", color: NAVY }}>{formula}</code>
      )}
    </>
  );
}

export default function DealAnalysis() {
  const { dealId } = useParams<{ dealId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: auth0Loading, user } = useAuth0();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [deal, setDeal] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [score, setScore] = useState<any>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [notScoredOpen, setNotScoredOpen] = useState(false);
  const [definitions, setDefinitions] = useState<Record<string, any>>({});
  const [definitionBubble, setDefinitionBubble] = useState<string | null>(null);
  const [bubbleRect, setBubbleRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { lang, t } = useLanguage();
  const locale = lang === "fr" ? "fr-CA" : "en-US";
  const dateLocale = lang === "fr" ? "fr-CA" : "en-CA";
  const fmtAmt = (n: number) =>
    locale === "fr-CA"
      ? `${n.toLocaleString("fr-CA")} $`
      : `$${n.toLocaleString("en-US")}`;

  const [sourcesUses, setSourcesUses] = useState<any[]>([]);
  const [capItems, setCapItems] = useState<any[]>([]);
  const [collateral, setCollateral] = useState<any[]>([]);
  const [confirmedCash, setConfirmedCash] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionPriority, setNewQuestionPriority] = useState("medium");
  const [addingSaving, setAddingSaving] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoGenerating, setMemoGenerating] = useState<'pdf' | 'docx' | null>(null);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [memoIncludeQ, setMemoIncludeQ] = useState(false);
  const [memoQFilter, setMemoQFilter] = useState<'answered' | 'all'>('answered');
  const memoRef = useRef<HTMLDivElement>(null);
  const [benchmarks, setBenchmarks] = useState<{
    naicsMap: string[] | null;
    base:   { sector: any; segment: any } | null;
    stress: { sector: any; segment: any } | null;
    totalN: number;
    noMapping: boolean;
    csbfp?: { defaultRate: number; lossRate: number; totalLoans: number; totalLoanValue: number; totalClaimValue: number; reliable: boolean } | null;
  } | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!definitionBubble || isMobile) return;
    const close = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setDefinitionBubble(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [definitionBubble, isMobile]);

  useEffect(() => {
    if (!memoOpen) return;
    const close = (e: MouseEvent) => {
      if (memoRef.current && !memoRef.current.contains(e.target as Node)) {
        setMemoOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [memoOpen]);

  useEffect(() => {
    if (!dealId) return;
    (async () => {
      setLoading(true);
      const [{ data: d }, { data: s, error: sErr }, { data: m }, { data: cu }, { data: su }, { data: ci }, { data: coll }, { data: finMR }, { data: qsData }] = await Promise.all([
        supabase.from("deals").select("title,industry,city,province,years_in_business,amount_requested,term_months,interest_rate,borrower_id,use_of_funds,existing_debt,ebitda,revolver_limit,revolver_drawn,enterprise_value,executive_summary,executive_summary_fr").eq("id", dealId).single(),
        supabase.from("credit_scores").select("overall_score,risk_label,summary,strengths,risks,coverage_pct,critical_floor_applied,capped_reason,score_source,summary_fr,strengths_fr,risks_fr").eq("deal_id", dealId).maybeSingle(),
        supabase.from("score_metric_results").select("*").eq("deal_id", dealId).order("tier").order("metric_name"),
        supabase.from("users").select("id,role").eq("auth0_id", user?.sub ?? "").maybeSingle(),
        supabase.from("sources_uses_entries").select("side,label,amount,sort_order").eq("deal_id", dealId).order("sort_order"),
        supabase.from("capitalization_items").select("category,label,amount,rate,notes,sort_order").eq("deal_id", dealId).order("sort_order"),
        supabase.from("collateral_assets").select("asset_type,description,market_value,advance_rate,lending_value").eq("deal_id", dealId),
        supabase.from("extracted_financials").select("cash").eq("deal_id", dealId).eq("borrower_confirmed", true).order("fiscal_year", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("credit_questions").select("*").eq("deal_id", dealId).order("created_at"),
      ]);
      if (sErr) console.error("credit_scores fetch:", sErr);
      setDeal(d);
      setCurrentUser(cu ?? null);
      setScore(s);
      setSourcesUses(su ?? []);
      setCapItems(ci ?? []);
      setCollateral(coll ?? []);
      setConfirmedCash(finMR?.cash ?? null);
      const loadedQs = qsData ?? [];
      setQuestions(loadedQs);
      const initAnswers: Record<string, string> = {};
      for (const q of loadedQs) { if (q.answer) initAnswers[q.id] = q.answer; }
      setQuestionAnswers(initAnswers);
      setQuestionsLoading(false);
      const metricRows = (m as MetricRow[]) ?? [];
      setMetrics(metricRows);

      const names = [...new Set(metricRows.map(r => r.metric_name))];
      if (names.length > 0) {
        const { data: defs } = await supabase
          .from("metric_definitions")
          .select("metric_name,metric_name_fr,what_it_is,what_it_measures,high_value_means,low_value_means,why_it_matters,formula_plain,what_it_is_fr,what_it_measures_fr,high_value_means_fr,low_value_means_fr,why_it_matters_fr,formula_plain_fr")
          .in("metric_name", names);
        const defMap: Record<string, any> = {};
        for (const def of defs ?? []) defMap[def.metric_name] = def;
        setDefinitions(defMap);
      }

      setLoading(false);
    })();
  }, [dealId, user?.sub]);

  // ── Benchmark helpers ──
  function sbaBand(amount: number): string {
    if (amount <   100_000) return '<100K';
    if (amount <   250_000) return '100K-250K';
    if (amount <   500_000) return '250K-500K';
    if (amount < 1_000_000) return '500K-1M';
    if (amount < 2_000_000) return '1M-2M';
    if (amount < 5_000_000) return '2M-5M';
    return '5M+';
  }
  function sbaTermBand(months: number): string {
    if (months <=  60) return '<=60';
    if (months <= 120) return '61-120';
    if (months <= 240) return '121-240';
    return '>240';
  }
  function aggregateBenchmarkRows(rows: any[]) {
    if (!rows || rows.length === 0) return null;
    const nLoans = rows.reduce((s: number, r: any) => s + (r.n_loans || 0), 0);
    const nCO    = rows.reduce((s: number, r: any) => s + (r.n_chargeoff || 0), 0);
    const lgdAvg = rows.reduce((s: number, r: any) => s + (r.lgd || 0), 0) / rows.length;
    const avgSize = rows.reduce((s: number, r: any) => s + (r.avg_loan_size || 0), 0) / rows.length;
    return { n_loans: nLoans, n_chargeoff: nCO, default_rate: nLoans > 0 ? nCO / nLoans : 0, lgd: lgdAvg, avg_loan_size: avgSize };
  }

  useEffect(() => {
    if (!deal?.industry) return;
    setBenchmarkLoading(true);
    setBenchmarkError(null);
    (async () => {
      try {
        const [{ data: naicsMapRow, error: naicsErr }, { data: csbfpMapRow }] = await Promise.all([
          supabase.from('industry_naics_map').select('naics2_codes').eq('industry_key', deal.industry).maybeSingle(),
          supabase.from('industry_csbfp_map').select('csbfp_sectors').eq('industry_key', deal.industry).maybeSingle(),
        ]);
        if (naicsErr) throw naicsErr;

        const codes        = (naicsMapRow?.naics2_codes ?? []) as string[];
        const csbfpSectors = (csbfpMapRow?.csbfp_sectors ?? []) as string[];
        const dealSB = sbaBand(deal.amount_requested ?? 0);
        const dealTB = sbaTermBand(deal.term_months ?? 0);

        const [{ data: sbaRows, error: sbaErr }, { data: csbfpRows }] = await Promise.all([
          codes.length
            ? supabase.from('sba_benchmarks')
                .select('scenario,naics2,size_band,term_band,n_loans,n_chargeoff,default_rate,avg_loan_size,lgd')
                .in('naics2', codes).eq('reliable', true)
            : Promise.resolve({ data: null, error: null }),
          csbfpSectors.length
            ? supabase.from('csbfp_benchmarks')
                .select('n_loans,loan_value,n_claims,claim_value,reliable')
                .in('sector', csbfpSectors)
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (sbaErr) throw sbaErr;

        const all = (sbaRows ?? []) as any[];
        const pick = (scenario: string, sb: string | null, tb: string | null) =>
          sb === null
            ? all.filter((r: any) => r.scenario === scenario && r.size_band === null && r.term_band === null)
            : all.filter((r: any) => r.scenario === scenario && r.size_band === sb && r.term_band === tb);
        const baseSectorRows   = pick('base',   null,   null);
        const baseSegRows      = pick('base',   dealSB, dealTB);
        const stressSectorRows = pick('stress', null,   null);
        const stressSegRows    = pick('stress', dealSB, dealTB);
        const totalBase   = aggregateBenchmarkRows(baseSectorRows)?.n_loans ?? 0;
        const totalStress = aggregateBenchmarkRows(stressSectorRows)?.n_loans ?? 0;

        let csbfp: { defaultRate: number; lossRate: number; totalLoans: number; totalLoanValue: number; totalClaimValue: number; reliable: boolean } | null = null;
        if (csbfpRows && csbfpRows.length > 0) {
          const totalLoans      = csbfpRows.reduce((s: number, r: any) => s + (r.n_loans ?? 0), 0);
          const totalClaims     = csbfpRows.reduce((s: number, r: any) => s + (r.n_claims ?? 0), 0);
          const totalLoanValue  = csbfpRows.reduce((s: number, r: any) => s + (r.loan_value ?? 0), 0);
          const totalClaimValue = csbfpRows.reduce((s: number, r: any) => s + (r.claim_value ?? 0), 0);
          csbfp = {
            defaultRate:     totalLoans > 0     ? totalClaims     / totalLoans     : 0,
            lossRate:        totalLoanValue > 0 ? totalClaimValue / totalLoanValue : 0,
            totalLoans,
            totalLoanValue,
            totalClaimValue,
            reliable: csbfpRows.every((r: any) => r.reliable),
          };
        }

        setBenchmarks({
          naicsMap: codes.length ? codes : null,
          base:     { sector: aggregateBenchmarkRows(baseSectorRows),   segment: aggregateBenchmarkRows(baseSegRows)   },
          stress:   { sector: aggregateBenchmarkRows(stressSectorRows), segment: aggregateBenchmarkRows(stressSegRows) },
          totalN:   totalBase + totalStress,
          noMapping: codes.length === 0,
          csbfp,
        });
      } catch {
        setBenchmarkError("analysis.benchmarkError");
      } finally {
        setBenchmarkLoading(false);
      }
    })();
  }, [deal?.industry, deal?.amount_requested, deal?.term_months]);

  if (auth0Loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      {t("common.loading")}
    </div>
  );
  if (!isAuthenticated) { setLocation("/login"); return null; }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY }}>
      {t("analysis.loadingAnalysis")}
    </div>
  );

  if (!deal) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: RED }}>
      {t("analysis.dealNotFound")}
    </div>
  );

  if (currentUser && currentUser.role !== "admin" && deal.borrower_id && deal.borrower_id !== currentUser.id) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
        <div style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: 22, color: NAVY, marginBottom: 8 }}>{t("analysis.notAuthorized")}</div>
        <div style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>{t("analysis.noAccess")}</div>
        <button
          onClick={() => setLocation("/lender-dashboard")}
          style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          {t("analysis.backToDashboard")}
        </button>
      </div>
    </div>
  );

  const scored = metrics.filter(m => m.counted);
  const notScored = metrics.filter(m => !m.counted);
  const byTier = TIER_ORDER.map(tier => ({ tier, rows: scored.filter(m => m.tier === tier) })).filter(g => g.rows.length > 0);

  // French DB content with English fallback
  const displayExecSummary = (lang === "fr" && deal.executive_summary_fr?.trim())
    ? deal.executive_summary_fr
    : deal.executive_summary;
  const displaySummary = score
    ? ((lang === "fr" && score.summary_fr) ? score.summary_fr : score.summary)
    : null;
  const displayStrengths = score
    ? ((lang === "fr" && score.strengths_fr?.length) ? score.strengths_fr : score.strengths)
    : null;
  const displayRisks = score
    ? ((lang === "fr" && score.risks_fr?.length) ? score.risks_fr : score.risks)
    : null;

  // Display-only: returns the French metric name when available, English otherwise.
  // Internal lookups (definitions[row.metric_name], sort order, etc.) always use the English key.
  const mName = (englishName: string) =>
    (lang === "fr" && definitions[englishName]?.metric_name_fr) || englishName;

  const tierLabel = (tier: string) => {
    const map: Record<string, string> = {
      Critical:     t("analysis.tierCritical"),
      Important:    t("analysis.tierImportant"),
      Supplementary: t("analysis.tierSupplementary"),
      Optional:     t("analysis.tierOptional"),
    };
    return map[tier] ?? tier;
  };

  const openBubble = (metricName: string, rect: DOMRect) => {
    if (definitionBubble === metricName) {
      setDefinitionBubble(null);
    } else {
      setDefinitionBubble(metricName);
      setBubbleRect(rect);
    }
  };

  const handleQuestionStatusChange = async (id: string, newStatus: string) => {
    setSavingStatus(id);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
    await supabase.from("credit_questions").update({ status: newStatus }).eq("id", id);
    setSavingStatus(null);
  };

  const handleAnswerSave = async (id: string) => {
    const text = questionAnswers[id] ?? "";
    setSavingAnswer(id);
    const now = new Date().toISOString();
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, answer: text, status: "answered", answered_at: now } : q));
    await supabase.from("credit_questions").update({ answer: text, answered_at: now, status: "answered" }).eq("id", id);
    setSavingAnswer(null);
  };

  const handleMemoDownload = async (format: 'pdf' | 'docx') => {
    if (!deal) return;
    setMemoGenerating(format);
    setMemoError(null);
    try {
      const { downloadPDF, downloadDocx } = await import('../lib/memoExport');
      const filteredQ = memoIncludeQ
        ? (memoQFilter === 'answered' ? questions.filter((q: any) => q.answer?.trim()) : questions)
        : [];
      const metricsWithFr = metrics.map((m: any) => ({
        ...m,
        metric_name_fr: definitions[m.metric_name]?.metric_name_fr ?? null,
      }));
      const memoData = { deal, score, metrics: metricsWithFr, confirmedCash, suEntries: sourcesUses, capItems, collateral, benchmarks, lang };
      if (format === 'pdf') await downloadPDF(memoData, filteredQ, t);
      else await downloadDocx(memoData, filteredQ, t);
      setMemoOpen(false);
    } catch (err) {
      console.error('[memo export]', err);
      setMemoError(err instanceof Error ? err.message : 'Export failed — check the console for details.');
    } finally {
      setMemoGenerating(null);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim() || !dealId) return;
    setAddingSaving(true);
    const { data: inserted } = await supabase.from("credit_questions").insert({
      deal_id: dealId,
      question_text: newQuestionText.trim(),
      priority: newQuestionPriority,
      source: "user",
      question_type: "user_added",
      status: "open",
    }).select().single();
    if (inserted) setQuestions(prev => [...prev, inserted]);
    setNewQuestionText("");
    setNewQuestionPriority("medium");
    setAddingQuestion(false);
    setAddingSaving(false);
  };

  const scoreConfidenceLabel = (pct: number) => {
    if (pct >= 60) return t("analysis.scoreConfidenceHigh");
    if (pct >= 30) return t("analysis.scoreConfidenceModerate");
    if (pct >= 20) return t("analysis.scoreConfidenceLow");
    return t("analysis.scoreConfidenceIndicative");
  };

  const priorityLabel = (p: string) =>
    p === "high" ? t("analysis.priorityHigh") : p === "medium" ? t("analysis.priorityMedium") : t("analysis.priorityLow");

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* ── Nav bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E2D9", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => window.history.back()} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>
          {t("analysis.back")}
        </button>
        <span style={{ color: "#E8E2D9" }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{t("analysis.pageTitle")}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {deal && (
            <div ref={memoRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMemoOpen(o => !o)}
                style={{
                  padding: "4px 12px", borderRadius: 8, border: `1px solid ${NAVY}`,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  background: memoOpen ? NAVY : "transparent",
                  color: memoOpen ? "#fff" : NAVY,
                  letterSpacing: "0.03em",
                }}
              >
                {t("analysis.downloadMemo")}
              </button>
              {memoOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff",
                  border: "1px solid #E8E2D9", borderRadius: 10, padding: "14px 16px",
                  minWidth: 220, boxShadow: "0 4px 18px rgba(0,0,0,0.10)", zIndex: 200,
                }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginBottom: 8 }}>
                    <input type="checkbox" checked={memoIncludeQ} onChange={e => setMemoIncludeQ(e.target.checked)} />
                    {t("analysis.includeDiligenceQ")}
                  </label>
                  {memoIncludeQ && (
                    <div style={{ paddingLeft: 20, marginBottom: 10 }}>
                      {(["answered", "all"] as const).map(opt => (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", marginBottom: 4 }}>
                          <input type="radio" name="memoQFilter" value={opt} checked={memoQFilter === opt} onChange={() => setMemoQFilter(opt)} />
                          {opt === "answered" ? t("analysis.memoAnsweredOnly") : t("analysis.memoAllQuestions")}
                        </label>
                      ))}
                    </div>
                  )}
                  {memoError && (
                    <div style={{ fontSize: 11, color: "#B71C1C", background: "#FFF5F5", border: "1px solid #FFCDD2", borderRadius: 6, padding: "6px 8px", marginBottom: 8, wordBreak: "break-word" }}>
                      {memoError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleMemoDownload("pdf")}
                      disabled={!!memoGenerating}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: NAVY, color: "#fff", fontSize: 11, fontWeight: 700, cursor: memoGenerating ? "wait" : "pointer", fontFamily: "Inter, sans-serif" }}
                    >
                      {memoGenerating === "pdf" ? t("analysis.generating") : t("analysis.exportPDF")}
                    </button>
                    <button
                      onClick={() => handleMemoDownload("docx")}
                      disabled={!!memoGenerating}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, fontSize: 11, fontWeight: 700, cursor: memoGenerating ? "wait" : "pointer", fontFamily: "Inter, sans-serif" }}
                    >
                      {memoGenerating === "docx" ? t("analysis.generating") : t("analysis.exportWord")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <LanguageToggle />
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "40px 24px 80px" }}>

        {/* ── 1. Header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 24 : 30, color: NAVY, margin: 0, lineHeight: 1.15 }}>
            {deal.title ?? t("analysis.untitled")}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 10, fontSize: 13, color: MUTED }}>
            <span>{deal.industry ?? "—"}</span>
            <span>·</span>
            <span>{fmtAmt(Number(deal.amount_requested ?? 0))} {t("analysis.requested")}</span>
            <span>·</span>
            <span>{deal.term_months ?? "—"} {t("analysis.monthsWord")} @ {deal.interest_rate ?? "—"}%</span>
          </div>
        </div>

        {/* ── 2. Score card ── */}
        {score ? (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginBottom: 28, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 16 : 32 }}>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 56 : 72, color: NAVY, lineHeight: 1 }}>
                {score.overall_score ?? "—"}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("analysis.outOf100")}</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {score.risk_label && riskChip(score.risk_label, t)}
                {score.score_source === "engine" && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: GOLD, border: `1px solid ${GOLD}50`, borderRadius: 99, padding: "2px 8px", letterSpacing: "0.05em" }}>
                    {t("analysis.deterministicEngine")}
                  </span>
                )}
                {score.critical_floor_applied && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: RED, borderRadius: 99, padding: "2px 9px", letterSpacing: "0.04em" }}>{
                    score.capped_reason === "severe_critical"
                      ? t("analysis.capSevereCritical")
                      : score.capped_reason === "multiple_weak_criticals"
                      ? t("analysis.capMultipleWeak")
                      : t("analysis.criticalFloor")
                  }</span>
                )}
              </div>
              {metrics.length > 0 && (
                <div style={{ fontSize: 13, color: MUTED }}>
                  {t("analysis.basedOn")}{" "}
                  <strong style={{ color: NAVY }}>{scored.length}</strong>{" "}{t("analysis.ofWord")}{" "}
                  <strong style={{ color: NAVY }}>{metrics.length}</strong> {t("analysis.metricsWord")}{" "}
                  {score.coverage_pct != null && (
                    <span style={{ color: MUTED }}>({score.coverage_pct}% {t("analysis.coveragePct")})</span>
                  )}
                </div>
              )}
              {score.coverage_pct != null && (
                <div>
                  <span style={{
                    display: "inline-block", fontSize: 10, fontWeight: 700, color: "#fff", borderRadius: 99, padding: "2px 9px", letterSpacing: "0.04em",
                    background: score.coverage_pct >= 60 ? "#059669" : score.coverage_pct >= 30 ? "#D4940A" : score.coverage_pct >= 20 ? "#EA580C" : "#7A7060",
                  }}>
                    {scoreConfidenceLabel(score.coverage_pct)}
                  </span>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                    {t("analysis.confidenceNote")}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: "24px", marginBottom: 28, color: MUTED, fontSize: 13 }}>
            {t("analysis.noScore")}
          </div>
        )}

        {/* ── 2b. Executive Summary ── */}
        {displayExecSummary?.trim() && (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 16px" }}>
              {t("analysis.executiveSummary")}
            </h2>
            {(displayExecSummary.includes("\n\n")
              ? displayExecSummary.split("\n\n")
              : displayExecSummary.split("\n")
            ).filter((p: string) => p.trim()).map((p: string, i: number) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "#222222", margin: 0, marginBottom: 12 }}>{p.trim()}</p>
            ))}
          </div>
        )}

        {/* ── 3. Metric table (counted = true) ── */}
        {byTier.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 4px" }}>
              {t("analysis.scoredMetrics")}
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED }}>{t("analysis.scoredMetricsSub")}</p>
            {byTier.map(({ tier, rows }) => (
              <div key={tier} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 6, paddingLeft: 2 }}>
                  {tierLabel(tier)}
                </div>
                <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 12, overflow: "hidden" }}>
                  {rows.map((row, i) => {
                    const isExpanded = expandedRow === row.metric_name;
                    const isLast = i === rows.length - 1;
                    const hasDef = !!definitions[row.metric_name];
                    return (
                      <div key={row.metric_name} style={{ borderBottom: isLast ? "none" : "1px solid #F0EDE8" }}>
                        <div
                          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto auto" : "2fr 1fr 1fr auto", alignItems: "center", gap: isMobile ? 8 : 16, padding: isMobile ? "12px 14px" : "13px 18px", cursor: "pointer" }}
                          onClick={() => setExpandedRow(isExpanded ? null : row.metric_name)}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{mName(row.metric_name)}</span>
                          <span style={{ fontSize: 13, color: MUTED, textAlign: "right" }}>{fmtValue(row.value, row.metric_name, row.strong_band, lang)}</span>
                          <span>{gradeChip(row.grade, t)}</span>
                          <span
                            style={{ fontSize: 14, color: hasDef ? GOLD : "#C8C0B0", userSelect: "none", cursor: hasDef ? "pointer" : "default", lineHeight: 1 }}
                            title={hasDef ? t("analysis.whatIsMetric") : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasDef) return;
                              openBubble(row.metric_name, (e.currentTarget as HTMLElement).getBoundingClientRect());
                            }}
                          >ⓘ</span>
                        </div>

                        {!isMobile && !isExpanded && (row.strong_band || row.adequate_band || row.weak_band) && (
                          <div style={{ display: "flex", gap: 20, padding: "0 18px 10px", fontSize: 11, color: MUTED }}>
                            <span>{t("analysis.bandStrong")}: {translateBandUnits(row.strong_band, lang) ?? "—"}</span>
                            <span>{t("analysis.bandAdequate")}: {translateBandUnits(row.adequate_band, lang) ?? "—"}</span>
                            <span>{t("analysis.bandWeak")}: {translateBandUnits(row.weak_band, lang) ?? "—"}</span>
                          </div>
                        )}

                        {isExpanded && (
                          <div style={{ padding: isMobile ? "0 14px 14px" : "0 18px 16px", borderTop: "1px solid #F0EDE8", background: CREAM }}>
                            <div style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.7 }}>
                              {row.compute_detail && <div><strong>{t("analysis.formulaLabel")}</strong> {row.compute_detail}</div>}
                              {row.grade_reason && <div style={{ marginTop: 4 }}><strong>{t("analysis.gradeReasonLabel")}</strong> {row.grade_reason}</div>}
                              {(row.strong_band || row.adequate_band || row.weak_band) && (
                                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                                  {row.strong_band && <span style={{ color: GREEN }}>{t("analysis.bandStrong")}: {translateBandUnits(row.strong_band, lang)}</span>}
                                  {row.adequate_band && <span style={{ color: GOLD }}>{t("analysis.bandAdequate")}: {translateBandUnits(row.adequate_band, lang)}</span>}
                                  {row.weak_band && <span style={{ color: RED }}>{t("analysis.bandWeak")}: {translateBandUnits(row.weak_band, lang)}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 4. Not scored (collapsible) ── */}
        {notScored.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <button
              onClick={() => setNotScoredOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", marginBottom: 10 }}
            >
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY }}>
                {t("analysis.notScoredSection")} ({notScored.length})
              </span>
              <span style={{ fontSize: 13, color: MUTED, transform: notScoredOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
            </button>
            {notScoredOpen && (
              <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 12, overflow: "hidden" }}>
                {notScored.map((row, i) => {
                  const sl = statusLabelKey(row.status);
                  return (
                    <div key={row.metric_name} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 2fr", gap: isMobile ? 2 : 16, padding: isMobile ? "10px 14px" : "11px 18px", borderBottom: i < notScored.length - 1 ? "1px solid #F0EDE8" : "none", alignItems: "start" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{mName(row.metric_name)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sl.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t(sl.key)}</span>
                      <span style={{ fontSize: 12, color: MUTED }}>{humanizeNotScoredReason(row.compute_detail, row.grade_reason, t)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 5. Narrative ── */}
        {score && (displaySummary || displayStrengths?.length || displayRisks?.length) && (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px" }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 14px" }}>
              {t("analysis.analystNarrative")}
            </h2>
            {displaySummary && (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 20px" }}>{displaySummary}</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 20 : 32 }}>
              {displayStrengths?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: GREEN, marginBottom: 10 }}>{t("analysis.strengths")}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {displayStrengths.map((s: string, i: number) => (
                      <li key={i} style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayRisks?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: RED, marginBottom: 10 }}>{t("analysis.risks")}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {displayRisks.map((r: string, i: number) => (
                      <li key={i} style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 6. Diligence Questions ── */}
        {(() => {
          const Q_PRI: Record<string, number> = { high: 0, medium: 1, low: 2 };
          const sortedQs = [...questions].sort((a, b) => {
            const d = (Q_PRI[a.priority] ?? 1) - (Q_PRI[b.priority] ?? 1);
            if (d !== 0) return d;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          const outstanding = sortedQs.filter(q => q.status === "open" || q.status === "asked");
          const resolved = sortedQs.filter(q => q.status === "answered" || q.status === "dismissed");
          const openCount = outstanding.length;

          const priBadge = (priority: string) => {
            const cfg = priority === "high"
              ? { color: RED,  bg: "rgba(220,38,38,0.08)",   label: t("analysis.priorityHigh") }
              : priority === "medium"
              ? { color: GOLD, bg: "rgba(212,148,10,0.08)",  label: t("analysis.priorityMedium") }
              : { color: MUTED,bg: "rgba(122,112,96,0.08)",  label: t("analysis.priorityLow") };
            return (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 99, background: cfg.bg, color: cfg.color, textTransform: "uppercase" as const }}>
                {cfg.label}
              </span>
            );
          };

          const srcChip = (source: string) => {
            const cfg = source === "ai"
              ? { label: t("analysis.sourceAI"),   color: NAVY, bg: "rgba(27,43,75,0.07)" }
              : source === "user"
              ? { label: t("analysis.sourceUser"), color: GOLD, bg: "rgba(212,148,10,0.10)" }
              : { label: t("analysis.sourceRule"), color: MUTED,bg: "rgba(122,112,96,0.07)" };
            return (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
            );
          };

          const fmtMetric = (s: string) => s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

          const STATUS_OPTS = [
            { value: "open",      label: t("analysis.statusOpen") },
            { value: "asked",     label: t("analysis.statusAsked") },
            { value: "answered",  label: t("analysis.statusAnswered") },
            { value: "dismissed", label: t("analysis.statusDismissed") },
          ];

          const renderCard = (q: any) => {
            const draft = questionAnswers[q.id] ?? (q.answer ?? "");
            const savingA = savingAnswer === q.id;
            const savingS = savingStatus === q.id;
            const qText = (lang === "fr" && q.question_text_fr) ? q.question_text_fr : q.question_text;
            return (
              <div key={q.id} style={{ border: "1px solid #E8E2D9", borderRadius: 10, padding: isMobile ? "14px" : "18px", background: "#fff" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
                  {priBadge(q.priority)}
                  {srcChip(q.source)}
                  {q.related_metric && (
                    <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", padding: "2px 6px", background: "rgba(27,43,75,0.04)", borderRadius: 4 }}>
                      {fmtMetric(q.related_metric)}
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 14, color: NAVY, lineHeight: 1.6, fontWeight: 500 }}>{qText}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: MUTED, marginRight: 2 }}>{t("analysis.statusLabel")}</span>
                  {STATUS_OPTS.map(opt => {
                    const active = q.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        disabled={savingS}
                        onClick={() => !active && handleQuestionStatusChange(q.id, opt.value)}
                        style={{
                          padding: "3px 10px", borderRadius: 99, border: "1px solid",
                          fontSize: 11, fontWeight: active ? 700 : 500,
                          fontFamily: "Inter, sans-serif", cursor: active || savingS ? "default" : "pointer",
                          background: active ? NAVY : "transparent",
                          color: active ? "#fff" : MUTED,
                          borderColor: active ? NAVY : "#D8D2C8",
                          opacity: savingS ? 0.6 : 1,
                        }}
                      >{opt.label}</button>
                    );
                  })}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>{t("analysis.answerLabel")}</div>
                  <textarea
                    value={draft}
                    placeholder={t("analysis.answerPlaceholder")}
                    onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    style={{
                      width: "100%", minHeight: 72, padding: "8px 10px",
                      border: "1px solid #E8E2D9", borderRadius: 6,
                      fontFamily: "Inter, sans-serif", fontSize: 13, color: NAVY,
                      resize: "vertical", outline: "none", boxSizing: "border-box",
                      lineHeight: 1.55, background: draft ? "#fff" : CREAM,
                    }}
                  />
                  {q.answered_at && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                      {t("analysis.answeredOn")} {new Date(q.answered_at).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                  <button
                    disabled={savingA || !draft.trim()}
                    onClick={() => handleAnswerSave(q.id)}
                    style={{
                      marginTop: 8, padding: "6px 14px", borderRadius: 6,
                      border: "none", background: NAVY, color: "#fff",
                      fontSize: 12, fontWeight: 600,
                      cursor: savingA || !draft.trim() ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                      opacity: savingA || !draft.trim() ? 0.5 : 1,
                    }}
                  >{savingA ? t("analysis.savingEllipsis") : t("analysis.saveAnswer")}</button>
                </div>
              </div>
            );
          };

          const dqHeading = (() => {
            const base = t("analysis.diligenceQuestions");
            if (openCount > 0) return `${base} (${openCount} ${t("analysis.dilQOpenSuffix")})`;
            if (questions.length > 0) return `${base} (${t("analysis.dilQAllResolved")})`;
            return base;
          })();

          return (
            <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
              <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 20px" }}>
                {dqHeading}
              </h2>

              {questionsLoading ? (
                <div style={{ color: MUTED, fontSize: 13, padding: "8px 0" }}>{t("analysis.dilQLoading")}</div>
              ) : questions.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 13, padding: "8px 0 16px" }}>{t("analysis.dilQNone")}</div>
              ) : (
                <>
                  {outstanding.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {outstanding.map(renderCard)}
                    </div>
                  ) : (
                    <div style={{ color: MUTED, fontSize: 13, padding: "4px 0 8px" }}>{t("analysis.dilQAllResolvedMsg")}</div>
                  )}
                  {resolved.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <button
                        onClick={() => setShowResolved(v => !v)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif" }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>
                          {showResolved ? `▲ ${t("analysis.hideResolved")}` : `▼ ${t("analysis.showResolved")}`} ({resolved.length})
                        </span>
                      </button>
                      {showResolved && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                          {resolved.map(renderCard)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div style={{ marginTop: questions.length === 0 ? 0 : 20, paddingTop: questions.length === 0 ? 0 : 16, borderTop: questions.length === 0 ? "none" : "1px solid #E8E2D9" }}>
                {!addingQuestion ? (
                  <button
                    onClick={() => setAddingQuestion(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "none", border: "1px dashed #C8C0B0",
                      borderRadius: 8, padding: "8px 14px",
                      fontSize: 12, fontWeight: 600, color: MUTED,
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                    }}
                  >{t("analysis.addQuestion")}</button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{t("analysis.newQuestion")}</div>
                    <textarea
                      value={newQuestionText}
                      autoFocus
                      placeholder={t("analysis.newQuestionPlaceholder")}
                      onChange={e => setNewQuestionText(e.target.value)}
                      style={{
                        width: "100%", minHeight: 80, padding: "8px 10px",
                        border: `1px solid ${NAVY}`, borderRadius: 6,
                        fontFamily: "Inter, sans-serif", fontSize: 13, color: NAVY,
                        resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.55,
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{t("analysis.priority")}</span>
                        {(["high", "medium", "low"] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setNewQuestionPriority(p)}
                            style={{
                              padding: "2px 10px", borderRadius: 99, border: "1px solid",
                              fontSize: 11, fontWeight: newQuestionPriority === p ? 700 : 400,
                              fontFamily: "Inter, sans-serif", cursor: "pointer",
                              background: newQuestionPriority === p ? NAVY : "transparent",
                              color: newQuestionPriority === p ? "#fff" : MUTED,
                              borderColor: newQuestionPriority === p ? NAVY : "#D8D2C8",
                            }}
                          >{priorityLabel(p)}</button>
                        ))}
                      </div>
                      <button
                        disabled={!newQuestionText.trim() || addingSaving}
                        onClick={handleAddQuestion}
                        style={{
                          padding: "6px 14px", borderRadius: 6, border: "none",
                          background: NAVY, color: "#fff", fontSize: 12, fontWeight: 600,
                          cursor: !newQuestionText.trim() || addingSaving ? "not-allowed" : "pointer",
                          fontFamily: "Inter, sans-serif",
                          opacity: !newQuestionText.trim() || addingSaving ? 0.5 : 1,
                        }}
                      >{addingSaving ? t("analysis.savingEllipsis") : t("analysis.add")}</button>
                      <button
                        onClick={() => { setAddingQuestion(false); setNewQuestionText(""); setNewQuestionPriority("medium"); }}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #E8E2D9", background: "transparent", color: MUTED, fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                      >{t("common.cancel")}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── 7. Historical Benchmark ── */}
        {(() => {
          const cardStyle: React.CSSProperties = {
            background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16,
            padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24,
          };
          const hd: React.CSSProperties = {
            fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18,
            color: NAVY, margin: "0 0 20px",
          };
          const subHd: React.CSSProperties = {
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase" as const, color: NAVY, marginBottom: 14,
          };
          const thStyle: React.CSSProperties = {
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase" as const, color: MUTED,
            padding: "0 0 8px", textAlign: "center" as const,
            borderBottom: "1px solid #E8E2D9",
          };
          const tdLabel: React.CSSProperties = {
            fontSize: 13, color: NAVY, fontWeight: 500,
            paddingRight: 16, paddingTop: 12, paddingBottom: 12,
            borderBottom: "1px solid #F3EFE8", verticalAlign: "middle" as const,
          };
          const tdCell: React.CSSProperties = {
            textAlign: "center" as const, paddingTop: 12, paddingBottom: 12,
            borderBottom: "1px solid #F3EFE8", verticalAlign: "middle" as const,
          };
          const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
          const fmtN   = (n: number) => `${t("analysis.ofWord")} ${n.toLocaleString(locale)} ${t("analysis.loansWord")}`;

          if (benchmarkLoading) {
            return (
              <div style={cardStyle}>
                <h2 style={hd}>{t("analysis.historicalBenchmark")}</h2>
                <div style={{ color: MUTED, fontSize: 13, paddingTop: 8 }}>{t("analysis.benchmarkLoading")}</div>
              </div>
            );
          }
          if (benchmarkError) {
            return (
              <div style={cardStyle}>
                <h2 style={hd}>{t("analysis.historicalBenchmark")}</h2>
                <div style={{ color: RED, fontSize: 13, paddingTop: 8 }}>{t(benchmarkError)}</div>
              </div>
            );
          }
          if (!benchmarks) return null;

          const { base, stress, totalN, csbfp } = benchmarks;
          const hasSba     = !benchmarks.noMapping && !!(base?.sector && stress?.sector);
          const hasCsbfp   = !!csbfp;
          const hasSegment = hasSba && !!(base?.segment && stress?.segment);

          if (!hasCsbfp && !hasSba) {
            return (
              <div style={cardStyle}>
                <h2 style={hd}>{t("analysis.historicalBenchmark")}</h2>
                <div style={{ color: MUTED, fontSize: 13 }}>{t("analysis.noMapping")}</div>
              </div>
            );
          }

          const dealSB        = sbaBand(deal.amount_requested ?? 0);
          const dealTB        = sbaTermBand(deal.term_months ?? 0);
          const industryLabel = (deal.industry ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const baseLGD       = hasSba ? (base!.sector!.lgd * 100).toFixed(0) : '0';
          const stressLGD     = hasSba ? (stress!.sector!.lgd * 100).toFixed(0) : '0';

          return (
            <div style={cardStyle}>
              <h2 style={hd}>{t("analysis.historicalBenchmark")}</h2>

              {/* ── Canada sub-section ── */}
              {hasCsbfp && (() => {
                const fmtDollars = (v: number) => {
                  const d = v * 1000;
                  if (locale === "fr-CA") {
                    if (d >= 1e9) return `${(d / 1e9).toFixed(2).replace(".", ",")} G$`;
                    if (d >= 1e6) return `${(d / 1e6).toFixed(1).replace(".", ",")} M$`;
                    return `${Math.round(d).toLocaleString("fr-CA")} $`;
                  }
                  if (d >= 1e9) return `$${(d / 1e9).toFixed(2)}B`;
                  if (d >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
                  return `$${Math.round(d).toLocaleString()}`;
                };
                const rows: { label: string; rate: number; denom: string }[] = [
                  { label: t("analysis.benchRowDefaulted"), rate: csbfp!.defaultRate, denom: fmtN(csbfp!.totalLoans) },
                  { label: t("analysis.benchRowLossRate"),  rate: csbfp!.lossRate,   denom: `${t("analysis.ofWord")} ${fmtDollars(csbfp!.totalLoanValue)} ${t("analysis.lentWord")}` },
                ];
                return (
                  <>
                    <div style={subHd}>{t("analysis.canadaProgram")}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>
                      {t("analysis.sectorPrefix")}{industryLabel}{t("analysis.sectorSuffix")}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, textAlign: "left" as const }}>{t("analysis.benchColMetric")}</th>
                            <th style={{ ...thStyle, minWidth: 160 }}>
                              <span style={{ color: NAVY, fontWeight: 700 }}>{t("analysis.benchColCumulative")}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ label, rate, denom }, i) => (
                            <tr key={label}>
                              <td style={{ ...tdLabel, ...(i === rows.length - 1 ? { borderBottom: "none" } : {}) }}>
                                {label}
                              </td>
                              <td style={{ ...tdCell, ...(i === rows.length - 1 ? { borderBottom: "none" } : {}) }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{fmtPct(rate)}</div>
                                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{denom}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!csbfp!.reliable && (
                      <div style={{ fontSize: 11, color: MUTED, fontStyle: "italic", marginTop: 8 }}>
                        {t("analysis.benchSmallSample")}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: MUTED, marginTop: !csbfp!.reliable ? 4 : 8 }}>
                      {t("analysis.benchCumHistory")}
                    </div>
                  </>
                );
              })()}

              {/* ── Separator note ── */}
              {hasCsbfp && hasSba && (
                <div style={{
                  margin: "20px 0 16px", fontSize: 11, color: MUTED, lineHeight: 1.6,
                  borderTop: "1px solid #E8E2D9", borderBottom: "1px solid #E8E2D9",
                  padding: "12px 0",
                }}>
                  {t("analysis.benchSeparatorNote")}
                </div>
              )}

              {/* ── US sub-section ── */}
              {hasSba && (
                <>
                  <div style={subHd}>{t("analysis.usProgram")}</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, textAlign: "left" as const }}>{t("analysis.benchColSegment")}</th>
                          <th style={{ ...thStyle, minWidth: 130 }}>
                            <span style={{ color: NAVY, fontWeight: 700 }}>{t("analysis.benchRowDefaulted")}</span>
                            <div style={{ fontWeight: 400, fontSize: 10, color: MUTED, textTransform: "none" as const, letterSpacing: 0 }}>{t("analysis.benchNormalCycle")}</div>
                          </th>
                          <th style={{ ...thStyle, minWidth: 130 }}>
                            <span style={{ color: RED, fontWeight: 700 }}>{t("analysis.benchRowDefaulted")}</span>
                            <div style={{ fontWeight: 400, fontSize: 10, color: MUTED, textTransform: "none" as const, letterSpacing: 0 }}>{t("analysis.benchDownturn")}</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={tdLabel}><span style={{ fontWeight: 600 }}>{t("analysis.sectorPrefix")}{industryLabel}{t("analysis.sectorSuffix")}</span></td>
                          <td style={tdCell}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{fmtPct(base!.sector!.default_rate)}</div>
                            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{fmtN(base!.sector!.n_loans)}</div>
                          </td>
                          <td style={tdCell}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: RED }}>{fmtPct(stress!.sector!.default_rate)}</div>
                            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{fmtN(stress!.sector!.n_loans)}</div>
                          </td>
                        </tr>
                        {hasSegment ? (
                          <tr>
                            <td style={{ ...tdLabel, borderBottom: "none" }}>
                              <span style={{ fontWeight: 500 }}>{dealSB} · {dealTB} {t("analysis.monthsWord")}</span>
                              <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{t("analysis.benchSimilarLoans")}</div>
                            </td>
                            <td style={{ ...tdCell, borderBottom: "none" }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{fmtPct(base!.segment!.default_rate)}</div>
                              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{fmtN(base!.segment!.n_loans)}</div>
                            </td>
                            <td style={{ ...tdCell, borderBottom: "none" }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: RED }}>{fmtPct(stress!.segment!.default_rate)}</div>
                              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{fmtN(stress!.segment!.n_loans)}</div>
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={3} style={{ ...tdLabel, borderBottom: "none", color: MUTED, fontWeight: 400, fontSize: 12, fontStyle: "italic" }}>
                              {t("analysis.benchTooFew")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Interpretive line */}
                  {(() => {
                    if (!hasSegment) return null;
                    const sectorDR = base!.sector!.default_rate;
                    if (!sectorDR) return null;
                    const ratio = base!.segment!.default_rate / sectorDR;
                    if (ratio >= 1.3) return (
                      <div style={{ marginTop: 14, fontSize: 12, color: NAVY, lineHeight: 1.6, borderLeft: `3px solid ${GOLD}`, paddingLeft: 12 }}>
                        {t("analysis.benchDefaultedPre")} <strong>{t("analysis.benchDefaultedMoreStrong")}</strong> {t("analysis.benchDefaultedMorePost")}
                      </div>
                    );
                    if (ratio <= 0.75) return (
                      <div style={{ marginTop: 14, fontSize: 12, color: NAVY, lineHeight: 1.6, borderLeft: `3px solid ${GOLD}`, paddingLeft: 12 }}>
                        {t("analysis.benchDefaultedPre")} <strong>{t("analysis.benchDefaultedLessStrong")}</strong> {t("analysis.benchDefaultedLessPost")}
                      </div>
                    );
                    return null;
                  })()}

                  {/* LGD */}
                  <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 4 }}>{t("analysis.lgdTitle")}</div>
                  <div style={{ fontSize: 12, color: NAVY, lineHeight: 1.6 }}>
                    {t("analysis.lgdPre")} <strong>~{baseLGD} {t("analysis.lgdNormalBold")}</strong> {t("analysis.lgdBetween")} <strong style={{ color: RED }}>~{stressLGD} cents</strong> {t("analysis.lgdPost")}
                  </div>

                  {/* Caveat */}
                  <div style={{ marginTop: 12, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                    {t("analysis.benchCaveatPre")} {totalN!.toLocaleString(locale)} {t("analysis.benchCaveatPost")}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Sources & Uses ── */}
        {sourcesUses.length > 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase", letterSpacing: "0.08em", color: NAVY, marginBottom: 16 }}>{t("analysis.sourcesUses")}</div>
            {(() => {
              const uses = sourcesUses.filter((e: any) => e.side === "use");
              const sources = sourcesUses.filter((e: any) => e.side === "source");
              const totalUses = uses.reduce((s: number, e: any) => s + Number(e.amount), 0);
              const totalSources = sources.reduce((s: number, e: any) => s + Number(e.amount), 0);
              const gap = Math.abs(totalUses - totalSources);
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, marginBottom: 10 }}>{t("analysis.uses")}</div>
                      {uses.map((e: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < uses.length - 1 ? "1px solid #E8E2D9" : "none", fontSize: 13 }}>
                          <span style={{ color: NAVY }}>{e.label}</span>
                          <span style={{ color: NAVY, fontWeight: 500 }}>{fmtAmt(Number(e.amount))}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, fontSize: 13, fontWeight: 700, color: NAVY, borderTop: "2px solid #E8E2D9" }}>
                        <span>{t("analysis.totalUses")}</span><span>{fmtAmt(totalUses)}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, marginBottom: 10 }}>{t("analysis.sources")}</div>
                      {sources.map((e: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < sources.length - 1 ? "1px solid #E8E2D9" : "none", fontSize: 13 }}>
                          <span style={{ color: NAVY }}>{e.label}</span>
                          <span style={{ color: NAVY, fontWeight: 500 }}>{fmtAmt(Number(e.amount))}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, fontSize: 13, fontWeight: 700, color: NAVY, borderTop: "2px solid #E8E2D9" }}>
                        <span>{t("analysis.totalSources")}</span><span>{fmtAmt(totalSources)}</span>
                      </div>
                    </div>
                  </div>
                  {gap > 0 && totalUses + totalSources > 0 && (
                    <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: RED }}>{t("analysis.outOfBalance")} {fmtAmt(gap)}</div>
                  )}
                </>
              );
            })()}
          </div>
        ) : deal?.use_of_funds ? (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase", letterSpacing: "0.08em", color: NAVY, marginBottom: 10 }}>{t("analysis.useOfFunds")}</div>
            <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: 0 }}>{deal.use_of_funds}</p>
          </div>
        ) : null}

        {/* ── Capitalization ── */}
        {capItems.length > 0 && (() => {
          const DEBT_CATS = ["Senior Debt", "Subordinated Debt", "Shareholder Loans"];
          const CAT_ORDER: Record<string, number> = { "Senior Debt": 0, "Subordinated Debt": 1, "Shareholder Loans": 2, "Preferred Equity": 3, "Common Equity": 4, "Other": 5 };
          const sorted = [...capItems].sort((a: any, b: any) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99));
          const totalCap = capItems.reduce((s: number, r: any) => s + Number(r.amount), 0);
          const totalDebt = capItems.filter((r: any) => DEBT_CATS.includes(r.category)).reduce((s: number, r: any) => s + Number(r.amount), 0);
          const seniorDebt = capItems.filter((r: any) => r.category === "Senior Debt").reduce((s: number, r: any) => s + Number(r.amount), 0);
          const totalEquity = totalCap - totalDebt;
          const ebitdaVal = Number(deal?.ebitda);
          const hasEbitda = ebitdaVal > 0;
          const cashVal = Number(confirmedCash) || 0;
          const netDebt = totalDebt - cashVal;
          const rl = deal?.revolver_limit != null ? Number(deal.revolver_limit) : null;
          const rd = deal?.revolver_drawn != null ? Number(deal.revolver_drawn) : null;
          const hasRevolver = rl !== null;
          const availLiquidity = cashVal + (hasRevolver ? (rl! - (rd ?? 0)) : 0);
          const evProvided = deal?.enterprise_value != null ? Number(deal.enterprise_value) : null;
          const evProxy = totalCap - cashVal;
          let cumDebt = 0;
          const capHeaders = [t("analysis.capColInstrument"), t("analysis.capColCategory"), t("analysis.capColAmount"), t("analysis.capColPctCap"), ...(hasEbitda ? [t("analysis.capColXEbitda")] : [])];
          return (
            <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase", letterSpacing: "0.08em", color: NAVY, marginBottom: 4 }}>{t("analysis.capitalization")}</div>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED }}>{t("analysis.capProFormaNote")}</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E8E2D9" }}>
                      {capHeaders.map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row: any, i: number) => {
                      const amt = Number(row.amount);
                      const pctCap = totalCap > 0 ? `${(amt / totalCap * 100).toFixed(1)}%` : "—";
                      let xEbitda = "";
                      if (hasEbitda && DEBT_CATS.includes(row.category)) { cumDebt += amt; xEbitda = `${(cumDebt / ebitdaVal).toFixed(2)}x`; }
                      return (
                        <tr key={i} style={{ borderBottom: i < sorted.length - 1 ? "1px solid #E8E2D9" : "none" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 500, color: NAVY }}>{row.label}</td>
                          <td style={{ padding: "8px 10px", color: MUTED }}>{row.category}</td>
                          <td style={{ padding: "8px 10px", color: NAVY }}>{fmtAmt(amt)}</td>
                          <td style={{ padding: "8px 10px", color: MUTED }}>{pctCap}</td>
                          {hasEbitda && <td style={{ padding: "8px 10px", color: xEbitda ? NAVY : MUTED }}>{xEbitda || "—"}</td>}
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid #E8E2D9", background: "#FAFAF9" }}>
                      <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 600, color: MUTED, fontSize: 12 }}>{t("analysis.capTotalDebt")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>{fmtAmt(totalDebt)}</td>
                      <td style={{ padding: "8px 10px", color: MUTED }}>{totalCap > 0 ? `${(totalDebt / totalCap * 100).toFixed(1)}%` : "—"}</td>
                      {hasEbitda && <td style={{ padding: "8px 10px", fontWeight: 600, color: NAVY }}>{totalDebt > 0 ? `${(totalDebt / ebitdaVal).toFixed(2)}x` : "—"}</td>}
                    </tr>
                    <tr style={{ background: "#FAFAF9" }}>
                      <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 600, color: MUTED, fontSize: 12 }}>{t("analysis.capTotalEquity")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>{fmtAmt(totalEquity)}</td>
                      <td style={{ padding: "8px 10px", color: MUTED }}>{totalCap > 0 ? `${(totalEquity / totalCap * 100).toFixed(1)}%` : "—"}</td>
                      {hasEbitda && <td></td>}
                    </tr>
                    <tr style={{ borderTop: "2px solid #E8E2D9" }}>
                      <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>{t("analysis.capTotalCap")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>{fmtAmt(totalCap)}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>100%</td>
                      {hasEbitda && <td></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, borderTop: "1px solid #E8E2D9", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: t("analysis.capSeniorDebtEbitda"), value: hasEbitda && seniorDebt > 0 ? `${(seniorDebt / ebitdaVal).toFixed(2)}x` : "n/m" },
                  { label: t("analysis.capTotalDebtEbitda"), value: hasEbitda ? `${(totalDebt / ebitdaVal).toFixed(2)}x` : "n/m" },
                  { label: t("analysis.capNetDebtEbitda"), value: hasEbitda ? `${(netDebt / ebitdaVal).toFixed(2)}x` : "n/m" },
                  ...(hasRevolver ? [{ label: t("analysis.capRevolverLimit"), value: fmtAmt(rl!) }] : []),
                  { label: hasRevolver ? t("analysis.capAvailLiquidity") : t("analysis.capAvailLiquidityCashOnly"), value: fmtAmt(availLiquidity) },
                  (() => {
                    if (evProvided !== null) return { label: t("analysis.capEVProvided"), value: fmtAmt(evProvided) };
                    if (totalEquity > 0 && evProxy > 0) return { label: t("analysis.capEVProxy"), value: fmtAmt(evProxy) };
                    return { label: t("analysis.capEVProxy"), value: "n/m", hint: t("analysis.capEVHint") };
                  })(),
                  { label: t("analysis.capDebtToCap"), value: totalCap > 0 ? `${(totalDebt / totalCap * 100).toFixed(1)}%` : "—" },
                ].map(({ label, value, hint }: { label: string; value: string; hint?: string }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "baseline" }}>
                    <span style={{ color: MUTED }}>{label}{hint ? <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 11 }}>{hint}</span> : null}</span>
                    <span style={{ fontWeight: 600, color: NAVY }}>{value}</span>
                  </div>
                ))}
                {totalEquity === 0 && (
                  <div style={{ fontSize: 11, color: MUTED, opacity: 0.7, marginTop: 2 }}>{t("analysis.capNoEquity")}</div>
                )}
                {!hasEbitda && <div style={{ fontSize: 11, color: MUTED, opacity: 0.7, marginTop: 2 }}>{t("analysis.capNoEbitda")}</div>}
                {hasEbitda && <div style={{ fontSize: 11, color: MUTED, opacity: 0.7 }}>EBITDA {fmtAmt(ebitdaVal)}{cashVal > 0 ? ` · ${t("analysis.cashWord")} ${fmtAmt(cashVal)}` : ""}</div>}
              </div>
            </div>
          );
        })()}

        {/* ── Collateral & Asset Coverage ── */}
        {collateral.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24, marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase", letterSpacing: "0.08em", color: NAVY, marginBottom: 14 }}>{t("analysis.collateralTitle")}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E8E2D9" }}>
                    {[t("analysis.collColAsset"), t("analysis.collColDescription"), t("analysis.collColMarketValue"), t("analysis.collColAdvance"), t("analysis.collColLendingValue")].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {collateral.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: i < collateral.length - 1 ? "1px solid #E8E2D9" : "none" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 500, color: NAVY }}>{row.asset_type}</td>
                      <td style={{ padding: "8px 10px", color: MUTED, fontSize: 12 }}>{row.description || "—"}</td>
                      <td style={{ padding: "8px 10px", color: NAVY }}>{fmtAmt(Number(row.market_value || 0))}</td>
                      <td style={{ padding: "8px 10px", color: MUTED }}>{row.advance_rate}%</td>
                      <td style={{ padding: "8px 10px", fontWeight: 500, color: NAVY }}>{fmtAmt(Number(row.lending_value || 0))}</td>
                    </tr>
                  ))}
                  {(() => {
                    const sumMarket = collateral.reduce((s: number, r: any) => s + (Number(r.market_value) || 0), 0);
                    const sumLending = collateral.reduce((s: number, r: any) => s + (Number(r.lending_value) || 0), 0);
                    const existing = Number(deal?.existing_debt) || 0;
                    const requested = Number(deal?.amount_requested) || 0;
                    const totalDebt = existing + requested;
                    const coverage = totalDebt > 0 ? sumLending / totalDebt : null;
                    return (
                      <>
                        <tr style={{ borderTop: "2px solid #E8E2D9" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 600, color: MUTED, fontSize: 12 }}>{t("analysis.collTotal")}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>{fmtAmt(sumMarket)}</td>
                          <td></td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: NAVY }}>{fmtAmt(sumLending)}</td>
                        </tr>
                        {coverage !== null && (
                          <tr>
                            <td colSpan={5} style={{ padding: "10px 10px 4px", fontSize: 12, color: MUTED }}>
                              {t("analysis.collCoveragePre")} {fmtAmt(sumLending)} {t("analysis.collCoverageMid")} {fmtAmt(totalDebt)} ({t("analysis.collCoverageExisting")} {fmtAmt(existing)} + {t("analysis.collCoverageRequested")} {fmtAmt(requested)}) = <strong style={{ color: NAVY }}>{coverage.toFixed(2)}x</strong>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Definition bubble — desktop ── */}
      {definitionBubble && !isMobile && bubbleRect && definitions[definitionBubble] && (
        <div
          ref={bubbleRef}
          style={{
            position: "fixed",
            top: bubbleRect.bottom + 8,
            left: Math.max(8, Math.min(bubbleRect.right - 340, window.innerWidth - 356)),
            width: 340,
            background: "#fff",
            border: "1px solid #E8E2D9",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(27,43,75,0.14)",
            zIndex: 1000,
            padding: "16px 18px",
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.7,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: NAVY, fontSize: 13, paddingRight: 12 }}>{mName(definitionBubble)}</span>
            <button
              onClick={() => setDefinitionBubble(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>
          <DefContent def={definitions[definitionBubble]} lang={lang} />
        </div>
      )}

      {/* ── Definition bubble — mobile (bottom sheet) ── */}
      {definitionBubble && isMobile && definitions[definitionBubble] && (
        <>
          <div
            onClick={() => setDefinitionBubble(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(27,43,75,0.35)", zIndex: 998 }}
          />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "#fff", borderRadius: "16px 16px 0 0",
            padding: "20px 20px 36px",
            zIndex: 999, maxHeight: "72vh", overflowY: "auto",
            fontSize: 13, color: MUTED, lineHeight: 1.7,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 15, color: NAVY, paddingRight: 12 }}>{mName(definitionBubble)}</span>
              <button
                onClick={() => setDefinitionBubble(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 22, padding: 0, lineHeight: 1, flexShrink: 0, fontFamily: "Inter, sans-serif" }}
              >×</button>
            </div>
            <DefContent def={definitions[definitionBubble]} lang={lang} />
          </div>
        </>
      )}
    </div>
  );
}
