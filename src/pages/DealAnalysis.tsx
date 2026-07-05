import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

const NAVY = "#1B2B4B";
const GOLD = "#D4940A";
const CREAM = "#FAF8F4";
const GREEN = "#059669";
const RED = "#DC2626";
const MUTED = "#7A7060";

const TIER_ORDER = ["Critical", "Important", "Supplementary", "Optional"];

function fmtValue(v: number | null, name: string, strongBand?: string | null): string {
  if (v === null || v === undefined) return "—";
  if (strongBand) {
    const b = strongBand.toLowerCase();
    if (b.includes("%")) return `${v.toFixed(1)}%`;
    if (b.includes("x")) return `${v.toFixed(2)}x`;
    if (b.includes("day")) return `${v.toFixed(1)} days`;
    // no band token matched — fall through to name-based logic
  }
  const n = name.toLowerCase();
  const isRatio = n.includes("ratio") || n.includes("coverage") || n.includes("dscr") ||
    n.includes("leverage") || n.includes("debt /") || n.includes("/ ebitda") || n.includes("/ debt");
  const isPct = n.includes("margin") || n.includes("growth") || n.includes("return on") ||
    n.includes("roa") || n.includes("roe") || n.includes("intensity") || n.includes("yield");
  const isDays = n.includes("days") || n.includes("dso") || n.includes("dpo") || n.includes("dio") ||
    n.includes("ccc") || n.includes("cycle");
  const isMonths = n.includes("payback") || n.includes("duration");
  const isYears = n.includes("walt") || n.includes("lease term") || n.includes("reserve life") ||
    n.includes("mine life") || n.includes("amortization");
  if (isDays) return `${v.toFixed(1)} days`;
  if (isMonths) return `${v.toFixed(1)} months`;
  if (isYears) return `${v.toFixed(1)} years`;
  if (isPct) return `${v.toFixed(1)}%`;
  if (isRatio) return `${v.toFixed(2)}x`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function gradeChip(grade: string) {
  const color = grade === "Strong" ? GREEN : grade === "Adequate" ? GOLD : RED;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      background: color + "1A", color, border: `1px solid ${color}40`,
    }}>{grade}</span>
  );
}

function riskChip(label: string) {
  const color = label === "Strong" || label === "Very Low" ? GREEN
    : label === "Adequate" || label === "Low" ? GOLD
    : label === "Moderate" ? "#D97706"
    : RED;
  return (
    <span style={{
      display: "inline-block", padding: "4px 14px", borderRadius: 99,
      fontSize: 13, fontWeight: 700, background: color + "1A", color,
      border: `1px solid ${color}40`,
    }}>{label}</span>
  );
}

function statusLabel(status: string) {
  if (status === "needs_document_or_input" || status === "needs_input") return { text: "Needs data", color: GOLD };
  if (status === "needs_review") return { text: "Needs review", color: RED };
  return { text: "Qualitative", color: MUTED };
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

function DefContent({ def }: { def: any }) {
  return (
    <>
      {def.what_it_is && (
        <div style={{ color: NAVY, fontWeight: 500, marginBottom: 4 }}>{def.what_it_is}</div>
      )}
      {def.what_it_measures && (
        <div style={{ marginBottom: 4 }}>{def.what_it_measures}</div>
      )}
      {(def.high_value_means || def.low_value_means) && (
        <div style={{ marginBottom: 4 }}>
          {def.high_value_means && <div>↑ Higher: {def.high_value_means}</div>}
          {def.low_value_means && <div>↓ Lower: {def.low_value_means}</div>}
        </div>
      )}
      {def.why_it_matters && (
        <div style={{ fontStyle: "italic", marginBottom: 6 }}>{def.why_it_matters}</div>
      )}
      {def.formula_plain && (
        <code style={{ fontSize: 11, background: "#EDE9E1", padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", color: NAVY }}>{def.formula_plain}</code>
      )}
    </>
  );
}

export default function DealAnalysis() {
  const { dealId } = useParams<{ dealId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: auth0Loading } = useAuth0();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [deal, setDeal] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [notScoredOpen, setNotScoredOpen] = useState(false);
  const [definitions, setDefinitions] = useState<Record<string, any>>({});
  const [definitionBubble, setDefinitionBubble] = useState<string | null>(null);
  const [bubbleRect, setBubbleRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

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
    if (!dealId) return;
    (async () => {
      setLoading(true);
      const [{ data: d }, { data: s, error: sErr }, { data: m }] = await Promise.all([
        supabase.from("deals").select("title,industry,amount_requested,term_months,interest_rate").eq("id", dealId).single(),
        supabase.from("credit_scores").select("overall_score,risk_label,summary,strengths,risks,coverage_pct,critical_floor_applied,score_source").eq("deal_id", dealId).maybeSingle(),
        supabase.from("score_metric_results").select("*").eq("deal_id", dealId).order("tier").order("metric_name"),
      ]);
      if (sErr) console.error("credit_scores fetch:", sErr);
      setDeal(d);
      setScore(s);
      const metricRows = (m as MetricRow[]) ?? [];
      setMetrics(metricRows);

      const names = [...new Set(metricRows.map(r => r.metric_name))];
      if (names.length > 0) {
        const { data: defs } = await supabase
          .from("metric_definitions")
          .select("metric_name,what_it_is,what_it_measures,high_value_means,low_value_means,why_it_matters,formula_plain")
          .in("metric_name", names);
        const defMap: Record<string, any> = {};
        for (const def of defs ?? []) defMap[def.metric_name] = def;
        setDefinitions(defMap);
      }

      setLoading(false);
    })();
  }, [dealId]);

  if (auth0Loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  if (!isAuthenticated) { setLocation("/login"); return null; }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY }}>
      Loading analysis…
    </div>
  );

  if (!deal) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: RED }}>
      Deal not found.
    </div>
  );

  const scored = metrics.filter(m => m.counted);
  const notScored = metrics.filter(m => !m.counted);
  const byTier = TIER_ORDER.map(t => ({ tier: t, rows: scored.filter(m => m.tier === t) })).filter(g => g.rows.length > 0);

  const openBubble = (metricName: string, rect: DOMRect) => {
    if (definitionBubble === metricName) {
      setDefinitionBubble(null);
    } else {
      setDefinitionBubble(metricName);
      setBubbleRect(rect);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* ── Nav bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E2D9", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => window.history.back()} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>
          ← Back
        </button>
        <span style={{ color: "#E8E2D9" }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Deal Analysis</span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "40px 24px 80px" }}>

        {/* ── 1. Header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 24 : 30, color: NAVY, margin: 0, lineHeight: 1.15 }}>
            {deal.title ?? "Untitled Deal"}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 10, fontSize: 13, color: MUTED }}>
            <span>{deal.industry ?? "—"}</span>
            <span>·</span>
            <span>${Number(deal.amount_requested ?? 0).toLocaleString()} requested</span>
            <span>·</span>
            <span>{deal.term_months ?? "—"} months @ {deal.interest_rate ?? "—"}%</span>
          </div>
        </div>

        {/* ── 2. Score card ── */}
        {score ? (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px", marginBottom: 28, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 16 : 32 }}>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 56 : 72, color: NAVY, lineHeight: 1 }}>
                {score.overall_score ?? "—"}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>out of 100</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {score.risk_label && riskChip(score.risk_label)}
                {score.score_source === "engine" && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: GOLD, border: `1px solid ${GOLD}50`, borderRadius: 99, padding: "2px 8px", letterSpacing: "0.05em" }}>
                    DETERMINISTIC ENGINE
                  </span>
                )}
                {score.critical_floor_applied && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: RED, borderRadius: 99, padding: "2px 9px", letterSpacing: "0.04em" }}>
                    ⚠ CRITICAL FLOOR APPLIED
                  </span>
                )}
              </div>
              {metrics.length > 0 && (
                <div style={{ fontSize: 13, color: MUTED }}>
                  Based on{" "}
                  <strong style={{ color: NAVY }}>{scored.length}</strong> of{" "}
                  <strong style={{ color: NAVY }}>{metrics.length}</strong> metrics{" "}
                  {score.coverage_pct != null && (
                    <span style={{ color: MUTED }}>({score.coverage_pct}% coverage)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: "24px", marginBottom: 28, color: MUTED, fontSize: 13 }}>
            No score available yet for this deal.
          </div>
        )}

        {/* ── 3. Metric table (counted = true) ── */}
        {byTier.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 14px" }}>
              Scored Metrics
            </h2>
            {byTier.map(({ tier, rows }) => (
              <div key={tier} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 6, paddingLeft: 2 }}>
                  {tier}
                </div>
                <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 12, overflow: "hidden" }}>
                  {rows.map((row, i) => {
                    const isExpanded = expandedRow === row.metric_name;
                    const isLast = i === rows.length - 1;
                    const hasDef = !!definitions[row.metric_name];
                    return (
                      <div key={row.metric_name} style={{ borderBottom: isLast ? "none" : "1px solid #F0EDE8" }}>
                        {/* Row header — click to expand grade detail */}
                        <div
                          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto auto" : "2fr 1fr 1fr auto", alignItems: "center", gap: isMobile ? 8 : 16, padding: isMobile ? "12px 14px" : "13px 18px", cursor: "pointer" }}
                          onClick={() => setExpandedRow(isExpanded ? null : row.metric_name)}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{row.metric_name}</span>
                          <span style={{ fontSize: 13, color: MUTED, textAlign: "right" }}>{fmtValue(row.value, row.metric_name, row.strong_band)}</span>
                          <span>{gradeChip(row.grade)}</span>
                          {/* ⓘ — opens definition bubble, does not expand row */}
                          <span
                            style={{ fontSize: 14, color: hasDef ? GOLD : "#C8C0B0", userSelect: "none", cursor: hasDef ? "pointer" : "default", lineHeight: 1 }}
                            title={hasDef ? "What is this metric?" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasDef) return;
                              openBubble(row.metric_name, (e.currentTarget as HTMLElement).getBoundingClientRect());
                            }}
                          >ⓘ</span>
                        </div>

                        {/* Band row (muted, desktop only, hidden when expanded) */}
                        {!isMobile && !isExpanded && (row.strong_band || row.adequate_band || row.weak_band) && (
                          <div style={{ display: "flex", gap: 20, padding: "0 18px 10px", fontSize: 11, color: MUTED }}>
                            <span>Strong: {row.strong_band ?? "—"}</span>
                            <span>Adequate: {row.adequate_band ?? "—"}</span>
                            <span>Weak: {row.weak_band ?? "—"}</span>
                          </div>
                        )}

                        {/* Expanded — grade detail only (no definition) */}
                        {isExpanded && (
                          <div style={{ padding: isMobile ? "0 14px 14px" : "0 18px 16px", borderTop: "1px solid #F0EDE8", background: CREAM }}>
                            <div style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.7 }}>
                              {row.compute_detail && <div><strong>Formula:</strong> {row.compute_detail}</div>}
                              {row.grade_reason && <div style={{ marginTop: 4 }}><strong>Grade reason:</strong> {row.grade_reason}</div>}
                              {(row.strong_band || row.adequate_band || row.weak_band) && (
                                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                                  {row.strong_band && <span style={{ color: GREEN }}>Strong: {row.strong_band}</span>}
                                  {row.adequate_band && <span style={{ color: GOLD }}>Adequate: {row.adequate_band}</span>}
                                  {row.weak_band && <span style={{ color: RED }}>Weak: {row.weak_band}</span>}
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
                Not Scored ({notScored.length})
              </span>
              <span style={{ fontSize: 13, color: MUTED, transform: notScoredOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
            </button>
            {notScoredOpen && (
              <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 12, overflow: "hidden" }}>
                {notScored.map((row, i) => {
                  const sl = statusLabel(row.status);
                  return (
                    <div key={row.metric_name} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 2fr", gap: isMobile ? 2 : 16, padding: isMobile ? "10px 14px" : "11px 18px", borderBottom: i < notScored.length - 1 ? "1px solid #F0EDE8" : "none", alignItems: "start" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{row.metric_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sl.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sl.text}</span>
                      <span style={{ fontSize: 12, color: MUTED }}>{row.compute_detail ?? row.grade_reason ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 5. Narrative ── */}
        {score && (score.summary || score.strengths?.length || score.risks?.length) && (
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 36px" }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 18, color: NAVY, margin: "0 0 14px" }}>
              Analyst Narrative
            </h2>
            {score.summary && (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 20px" }}>{score.summary}</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 20 : 32 }}>
              {score.strengths?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: GREEN, marginBottom: 10 }}>Strengths</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {score.strengths.map((s: string, i: number) => (
                      <li key={i} style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {score.risks?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: RED, marginBottom: 10 }}>Risks</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {score.risks.map((r: string, i: number) => (
                      <li key={i} style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Definition bubble — desktop (fixed card) ── */}
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
            <span style={{ fontWeight: 700, color: NAVY, fontSize: 13, paddingRight: 12 }}>{definitionBubble}</span>
            <button
              onClick={() => setDefinitionBubble(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>
          <DefContent def={definitions[definitionBubble]} />
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
              <span style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 15, color: NAVY, paddingRight: 12 }}>{definitionBubble}</span>
              <button
                onClick={() => setDefinitionBubble(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 22, padding: 0, lineHeight: 1, flexShrink: 0, fontFamily: "Inter, sans-serif" }}
              >×</button>
            </div>
            <DefContent def={definitions[definitionBubble]} />
          </div>
        </>
      )}
    </div>
  );
}
