import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";
import { translateBandUnits } from "../lib/bandUnits";
import { fmtValue } from "../lib/metricFormat";
import {
  NAVY, GOLD, CREAM, GREEN, RED, MUTED, TIER_ORDER,
  gradeChip, riskChip, DefContent,
} from "../lib/analysisRender";

export default function DealAnalysisHistory() {
  const { dealId, version } = useParams<{ dealId: string; version: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: auth0Loading } = useAuth0();
  const { lang, t } = useLanguage();

  const versionNum = parseInt(version ?? "", 10);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [deal, setDeal] = useState<any>(null);
  const [histScore, setHistScore] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [capItems, setCapItems] = useState<any[]>([]);
  const [sourcesUses, setSourcesUses] = useState<any[]>([]);
  const [collateral, setCollateral] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<Record<string, any>>({});

  const [capPredates, setCapPredates] = useState(false);
  const [suPredates, setSuPredates] = useState(false);
  const [collPredates, setCollPredates] = useState(false);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [definitionBubble, setDefinitionBubble] = useState<string | null>(null);
  const [bubbleRect, setBubbleRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const locale = lang === "fr" ? "fr-CA" : "en-US";
  const dateLocale = lang === "fr" ? "fr-CA" : "en-CA";
  const fmtAmt = (n: number) =>
    locale === "fr-CA" ? `${n.toLocaleString("fr-CA")} $` : `$${n.toLocaleString("en-US")}`;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!definitionBubble || isMobile) return;
    const close = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node))
        setDefinitionBubble(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [definitionBubble, isMobile]);

  useEffect(() => {
    if (!dealId || isNaN(versionNum)) return;
    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: hs } = await supabase
        .from("credit_scores_history")
        .select("*")
        .eq("deal_id", dealId)
        .eq("version", versionNum)
        .maybeSingle();

      if (!hs) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const archivedAt: string = hs.archived_at;

      const [
        { data: dealRow },
        { data: metricRows },
        { data: capRows },
        { data: suRows },
        { data: collRows },
        { data: qsData },
      ] = await Promise.all([
        supabase.from("deals")
          .select("title,deal_label,industry,city,province,amount_requested,term_months,interest_rate,ebitda,revolver_limit,revolver_drawn,enterprise_value,existing_debt")
          .eq("id", dealId)
          .single(),
        supabase.from("score_metric_results_history")
          .select("*")
          .eq("deal_id", dealId)
          .eq("version", versionNum),
        supabase.from("capitalization_items_history")
          .select("*")
          .eq("deal_id", dealId)
          .eq("version", versionNum)
          .order("sort_order"),
        supabase.from("sources_uses_entries_history")
          .select("*")
          .eq("deal_id", dealId)
          .eq("version", versionNum)
          .order("sort_order"),
        supabase.from("collateral_assets_history")
          .select("*")
          .eq("deal_id", dealId)
          .eq("version", versionNum),
        supabase.from("credit_questions")
          .select("*")
          .eq("deal_id", dealId)
          .lte("created_at", archivedAt)
          .or(`superseded_at.is.null,superseded_at.gt.${archivedAt}`)
          .order("created_at"),
      ]);

      // For each structure table that returned 0 rows, check if ANY rows exist
      // for this deal at other versions (= this version predates archiving).
      let capPre = false, suPre = false, collPre = false;
      if ((capRows ?? []).length === 0) {
        const { data: anyRow } = await supabase.from("capitalization_items_history")
          .select("version").eq("deal_id", dealId).limit(1).maybeSingle();
        capPre = !!anyRow;
      }
      if ((suRows ?? []).length === 0) {
        const { data: anyRow } = await supabase.from("sources_uses_entries_history")
          .select("version").eq("deal_id", dealId).limit(1).maybeSingle();
        suPre = !!anyRow;
      }
      if ((collRows ?? []).length === 0) {
        const { data: anyRow } = await supabase.from("collateral_assets_history")
          .select("version").eq("deal_id", dealId).limit(1).maybeSingle();
        collPre = !!anyRow;
      }

      const metricNames = [...new Set((metricRows ?? []).map((r: any) => r.metric_name))];
      let defMap: Record<string, any> = {};
      if (metricNames.length > 0) {
        const { data: defs } = await supabase
          .from("metric_definitions")
          .select("metric_name,metric_name_fr,what_it_is,what_it_measures,high_value_means,low_value_means,why_it_matters,formula_plain,what_it_is_fr,what_it_measures_fr,high_value_means_fr,low_value_means_fr,why_it_matters_fr,formula_plain_fr")
          .in("metric_name", metricNames);
        for (const def of defs ?? []) defMap[def.metric_name] = def;
      }

      setHistScore(hs);
      setDeal(dealRow ?? null);
      setMetrics(metricRows ?? []);
      setCapItems(capRows ?? []);
      setSourcesUses(suRows ?? []);
      setCollateral(collRows ?? []);
      setQuestions(qsData ?? []);
      setDefinitions(defMap);
      setCapPredates(capPre);
      setSuPredates(suPre);
      setCollPredates(collPre);
      setLoading(false);
    })();
  }, [dealId, versionNum]);

  if (auth0Loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      {t("common.loading")}
    </div>
  );
  if (!isAuthenticated) { setLocation("/login"); return null; }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY }}>
      {t("history.loading")}
    </div>
  );

  if (notFound || !histScore) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: RED }}>
      {t("history.notFound")}
    </div>
  );

  const scored = metrics.filter((m: any) => m.counted);
  const notScored = metrics.filter((m: any) => !m.counted);
  const byTier = TIER_ORDER
    .map(tier => ({ tier, rows: scored.filter((m: any) => m.tier === tier) }))
    .filter(g => g.rows.length > 0);

  const mName = (englishName: string) =>
    (lang === "fr" && definitions[englishName]?.metric_name_fr) || englishName;

  const tierLabel = (tier: string) => {
    const map: Record<string, string> = {
      Critical:      t("analysis.tierCritical"),
      Important:     t("analysis.tierImportant"),
      Supplementary: t("analysis.tierSupplementary"),
      Optional:      t("analysis.tierOptional"),
    };
    return map[tier] ?? tier;
  };

  const openBubble = (metricName: string, rect: DOMRect) => {
    if (definitionBubble === metricName) setDefinitionBubble(null);
    else { setDefinitionBubble(metricName); setBubbleRect(rect); }
  };

  const displayExecSummary = (lang === "fr" && histScore.executive_summary_fr?.trim())
    ? histScore.executive_summary_fr
    : histScore.executive_summary;
  const displaySummary = (lang === "fr" && histScore.summary_fr) ? histScore.summary_fr : histScore.summary;
  const displayStrengths = (lang === "fr" && histScore.strengths_fr?.length) ? histScore.strengths_fr : histScore.strengths;
  const displayRisks = (lang === "fr" && histScore.risks_fr?.length) ? histScore.risks_fr : histScore.risks;

  const archivedDateStr = new Date(histScore.archived_at).toLocaleDateString(
    dateLocale, { month: "long", day: "numeric", year: "numeric" }
  );

  const scoreConfidenceLabel = (pct: number) => {
    if (pct >= 60) return t("analysis.scoreConfidenceHigh");
    if (pct >= 30) return t("analysis.scoreConfidenceModerate");
    if (pct >= 20) return t("analysis.scoreConfidenceLow");
    return t("analysis.scoreConfidenceIndicative");
  };

  const notAvailableNotice = (sectionTitle: string) => (
    <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "20px 18px" : "24px 28px", marginTop: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: NAVY, marginBottom: 8 }}>
        {sectionTitle}
      </div>
      <div style={{ fontSize: 13, color: MUTED, fontStyle: "italic" }}>{t("history.noStructureData")}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* ── History banner — always visible, sticky ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 500,
        background: "#0F1E38",
        borderBottom: "3px solid #3B82F6",
        padding: "11px 24px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "Inter, sans-serif", display: "block" }}>
            {t("history.banner")}
          </span>
          <span style={{ color: "#93C5FD", fontSize: 11, fontFamily: "Inter, sans-serif" }}>
            {t("history.bannerDetail").replace("{v}", String(versionNum)).replace("{date}", archivedDateStr)}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#93C5FD", fontFamily: "Inter, sans-serif", flex: 1, minWidth: 160 }}>
          {t("history.bannerWarning")}
        </span>
        <button
          onClick={() => setLocation(`/analysis/${dealId}`)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid #3B82F6",
            background: "transparent", color: "#3B82F6", fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
          }}
        >{t("history.backToLive")}</button>
      </div>

      {/* ── Nav bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E2D9", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => setLocation(`/analysis/${dealId}`)}
          style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}
        >
          {t("analysis.back")}
        </button>
        <span style={{ color: "#E8E2D9" }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
          {t("history.pageTitle").replace("{v}", String(versionNum))}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <LanguageToggle />
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "40px 24px 80px" }}>

        {/* ── Deal header ── */}
        {deal && (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 24 : 30, color: NAVY, margin: 0, lineHeight: 1.15 }}>
              {deal.title ?? t("analysis.untitled")}
            </h1>
            {deal.deal_label && (
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{deal.deal_label}</div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 10, fontSize: 13, color: MUTED }}>
              <span>{deal.industry ?? "—"}</span>
              <span>·</span>
              <span>{fmtAmt(Number(deal.amount_requested ?? 0))} {t("analysis.requested")}</span>
              <span>·</span>
              <span>{deal.term_months ?? "—"} {t("analysis.monthsWord")} @ {deal.interest_rate ?? "—"}%</span>
            </div>
          </div>
        )}

        {/* ── Score card ── */}
        <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginBottom: 28, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 16 : 32 }}>
          <div style={{ textAlign: "center", minWidth: 110 }}>
            <div style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 56 : 72, color: NAVY, lineHeight: 1 }}>
              {histScore.overall_score ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("analysis.outOf100")}</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {histScore.risk_label && riskChip(histScore.risk_label, t)}
              {histScore.score_source === "engine" && (
                <span style={{ fontSize: 10, fontWeight: 600, color: GOLD, border: `1px solid ${GOLD}50`, borderRadius: 99, padding: "2px 8px", letterSpacing: "0.05em" }}>
                  {t("analysis.deterministicEngine")}
                </span>
              )}
              {histScore.critical_floor_applied && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: RED, borderRadius: 99, padding: "2px 9px", letterSpacing: "0.04em" }}>
                  {histScore.capped_reason === "severe_critical"
                    ? t("analysis.capSevereCritical")
                    : histScore.capped_reason === "multiple_weak_criticals"
                    ? t("analysis.capMultipleWeak")
                    : t("analysis.criticalFloor")}
                </span>
              )}
            </div>
            {metrics.length > 0 && (
              <div style={{ fontSize: 13, color: MUTED }}>
                {t("analysis.basedOn")}{" "}
                <strong style={{ color: NAVY }}>{scored.length}</strong>{" "}{t("analysis.ofWord")}{" "}
                <strong style={{ color: NAVY }}>{metrics.length}</strong> {t("analysis.metricsWord")}{" "}
                {histScore.coverage_pct != null && (
                  <span style={{ color: MUTED }}>({histScore.coverage_pct}% {t("analysis.coveragePct")})</span>
                )}
              </div>
            )}
            {histScore.coverage_pct != null && (
              <div>
                <span style={{
                  display: "inline-block", fontSize: 10, fontWeight: 700, color: "#fff", borderRadius: 99, padding: "2px 9px", letterSpacing: "0.04em",
                  background: histScore.coverage_pct >= 60 ? "#059669" : histScore.coverage_pct >= 30 ? "#D4940A" : histScore.coverage_pct >= 20 ? "#EA580C" : "#7A7060",
                }}>
                  {scoreConfidenceLabel(histScore.coverage_pct)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Executive summary ── */}
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

        {/* ── Scored metrics ── */}
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
                  {rows.map((row: any, i: number) => {
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
                          <div style={{ display: "flex", gap: 20, padding: "0 18px 10px", fontSize: 11, color: MUTED, alignItems: "center" }}>
                            <span>{t("analysis.bandStrong")}: {translateBandUnits(row.strong_band, lang) ?? "—"}</span>
                            <span>{t("analysis.bandAdequate")}: {translateBandUnits(row.adequate_band, lang) ?? "—"}</span>
                            <span>{t("analysis.bandWeak")}: {translateBandUnits(row.weak_band, lang) ?? "—"}</span>
                            {row.band_is_override && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: GOLD, border: `1px solid ${GOLD}70`, borderRadius: 99, padding: "1px 7px", letterSpacing: "0.04em" }}>
                                {t("metric.customThreshold")}
                              </span>
                            )}
                          </div>
                        )}

                        {isExpanded && (
                          <div style={{ padding: isMobile ? "0 14px 14px" : "0 18px 16px", borderTop: "1px solid #F0EDE8", background: CREAM }}>
                            <div style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.7 }}>
                              {row.compute_detail && <div><strong>{t("analysis.formulaLabel")}</strong> {row.compute_detail}</div>}
                              {row.grade_reason && <div style={{ marginTop: 4 }}><strong>{t("analysis.gradeReasonLabel")}</strong> {row.grade_reason}</div>}
                              {(row.strong_band || row.adequate_band || row.weak_band) && (
                                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center" }}>
                                  {row.strong_band && <span style={{ color: GREEN }}>{t("analysis.bandStrong")}: {translateBandUnits(row.strong_band, lang)}</span>}
                                  {row.adequate_band && <span style={{ color: GOLD }}>{t("analysis.bandAdequate")}: {translateBandUnits(row.adequate_band, lang)}</span>}
                                  {row.weak_band && <span style={{ color: RED }}>{t("analysis.bandWeak")}: {translateBandUnits(row.weak_band, lang)}</span>}
                                  {row.band_is_override && (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: GOLD, border: `1px solid ${GOLD}70`, borderRadius: 99, padding: "1px 7px", letterSpacing: "0.04em" }}>
                                      {t("metric.customThreshold")}
                                    </span>
                                  )}
                                </div>
                              )}
                              {hasDef && (
                                <div style={{ marginTop: 10 }}>
                                  <DefContent def={definitions[row.metric_name]} lang={lang} />
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

        {/* ── Narrative ── */}
        {(displaySummary || displayStrengths?.length || displayRisks?.length) && (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginBottom: 24 }}>
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

        {/* ── Capitalization ── */}
        {capItems.length > 0 ? (() => {
          const DEBT_CATS = ["Senior Debt", "Subordinated Debt", "Shareholder Loans"];
          const CAT_ORDER: Record<string, number> = { "Senior Debt": 0, "Subordinated Debt": 1, "Shareholder Loans": 2, "Preferred Equity": 3, "Common Equity": 4, "Other": 5 };
          const sorted = [...capItems].sort((a: any, b: any) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99));
          const totalCap = capItems.reduce((s: number, r: any) => s + Number(r.amount), 0);
          const totalDebt = capItems.filter((r: any) => DEBT_CATS.includes(r.category)).reduce((s: number, r: any) => s + Number(r.amount), 0);
          const totalEquity = totalCap - totalDebt;
          const ebitdaVal = deal?.ebitda ? Number(deal.ebitda) : 0;
          const hasEbitda = ebitdaVal > 0;
          const capHeaders = [t("analysis.capColInstrument"), t("analysis.capColCategory"), t("analysis.capColAmount"), t("analysis.capColPctCap"), ...(hasEbitda ? [t("analysis.capColXEbitda")] : [])];
          let cumDebt = 0;
          return (
            <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: NAVY, marginBottom: 4 }}>{t("analysis.capitalization")}</div>
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
            </div>
          );
        })() : capPredates ? notAvailableNotice(t("analysis.capitalization")) : null}

        {/* ── Sources & Uses ── */}
        {sourcesUses.length > 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: NAVY, marginBottom: 16 }}>{t("analysis.sourcesUses")}</div>
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
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: MUTED, marginBottom: 10 }}>{t("analysis.uses")}</div>
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
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: MUTED, marginBottom: 10 }}>{t("analysis.sources")}</div>
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
        ) : suPredates ? notAvailableNotice(t("analysis.sourcesUses")) : null}

        {/* ── Collateral ── */}
        {collateral.length > 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontVariant: "small-caps", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: NAVY, marginBottom: 14 }}>{t("analysis.collateralTitle")}</div>
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
        ) : collPredates ? notAvailableNotice(t("analysis.collateralTitle")) : null}

        {/* ── Diligence questions (as of this version) ── */}
        {questions.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginTop: 24 }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 6px" }}>
              {t("analysis.diligenceQuestions")}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: MUTED, fontStyle: "italic" }}>
              {t("history.questionsAsOf")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {questions.map((q: any) => {
                const qText = (lang === "fr" && q.question_text_fr) ? q.question_text_fr : q.question_text;
                const statusColor = q.status === "answered" ? GREEN : q.status === "dismissed" ? MUTED : GOLD;
                return (
                  <div key={q.id} style={{ border: "1px solid #E8E2D9", borderRadius: 10, padding: isMobile ? "14px" : "18px", background: "#fff" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
                      {q.priority === "high" && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(220,38,38,0.08)", color: RED, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                          {t("analysis.priorityHigh")}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, border: `1px solid ${statusColor}40`, color: statusColor, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                        {q.status}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: 14, color: NAVY, lineHeight: 1.6, fontWeight: 500 }}>{qText}</p>
                    {q.answer?.trim() && (
                      <div style={{ fontSize: 13, color: NAVY, background: CREAM, borderRadius: 6, padding: "10px 12px", lineHeight: 1.6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                          {t("analysis.answerLabel")}
                        </span>
                        {q.answer}
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* ── Definition bubble — mobile ── */}
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
