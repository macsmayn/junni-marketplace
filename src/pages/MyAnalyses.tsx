import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

const NAVY  = "#1B2B4B";
const GOLD  = "#D4940A";
const CREAM = "#FAF8F4";
const GREEN = "#059669";
const RED   = "#DC2626";
const MUTED = "#7A7060";
const BORDER = "#E8E2D9";
const ORANGE = "#EA580C";

function fmtCurrency(n: number | null): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function scoreColor(s: number | null): string {
  if (s == null) return MUTED;
  if (s >= 80) return GREEN;
  if (s >= 60) return GOLD;
  return RED;
}

function confidenceLabel(pct: number | null): string {
  if (pct == null) return "";
  if (pct >= 60) return "High";
  if (pct >= 30) return "Moderate";
  if (pct >= 20) return "Low";
  return "Indicative";
}

function confidenceColor(pct: number | null): string {
  if (pct == null) return MUTED;
  if (pct >= 60) return GREEN;
  if (pct >= 30) return GOLD;
  if (pct >= 20) return ORANGE;
  return MUTED;
}

interface Analysis {
  id: string;
  title: string;
  industry: string;
  amount_requested: number | null;
  term_months: number | null;
  interest_rate: number | null;
  created_at: string;
  overall_score: number | null;
  risk_label: string | null;
  coverage_pct: number | null;
}

type SortKey = "created_at" | "overall_score" | "amount_requested";
type SortDir = "asc" | "desc";

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 13,
};

export default function MyAnalyses() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: auth0Loading } = useAuth0();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (auth0Loading) return;
    if (!isAuthenticated || !user?.sub) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData, error: uErr } = await supabase
          .from("users")
          .select("id,role")
          .eq("auth0_id", user.sub)
          .maybeSingle();
        if (uErr || !userData) {
          setError("Could not load your account.");
          setLoading(false);
          return;
        }

        let query = supabase
          .from("deals")
          .select("id,title,industry,amount_requested,term_months,interest_rate,created_at,borrower_id")
          .eq("deal_source", "lender_analysis")
          .order("created_at", { ascending: false });
        if (userData.role !== "admin") {
          query = query.eq("borrower_id", userData.id);
        }
        const { data: deals, error: dErr } = await query;
        if (dErr) { setError("Failed to load analyses."); setLoading(false); return; }
        if (!deals || deals.length === 0) { setAnalyses([]); setLoading(false); return; }

        const dealIds = deals.map((d: any) => d.id);
        const { data: scores } = await supabase
          .from("credit_scores")
          .select("deal_id,overall_score,risk_label,coverage_pct")
          .in("deal_id", dealIds);

        const scoreMap: Record<string, any> = {};
        for (const s of scores ?? []) scoreMap[s.deal_id] = s;

        setAnalyses(deals.map((d: any) => {
          const s = scoreMap[d.id] ?? null;
          return {
            id: d.id,
            title: d.title ?? "Untitled",
            industry: d.industry ?? "—",
            amount_requested: d.amount_requested ?? null,
            term_months: d.term_months ?? null,
            interest_rate: d.interest_rate ?? null,
            created_at: d.created_at,
            overall_score: s?.overall_score ?? null,
            risk_label: s?.risk_label ?? null,
            coverage_pct: s?.coverage_pct ?? null,
          };
        }));
      } catch (e: any) {
        setError(e?.message ?? "Unexpected error.");
      }
      setLoading(false);
    })();
  }, [auth0Loading, isAuthenticated, user?.sub]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span style={{ color: MUTED, opacity: 0.4, marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const sorted = [...analyses].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (auth0Loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* ── Nav bar ── */}
      <div style={{
        background: "#fff", borderBottom: `1px solid ${BORDER}`,
        padding: isMobile ? "12px 16px" : "12px 32px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => setLocation("/lender-dashboard")}
          style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}
        >
          ← Dashboard
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>My Analyses</span>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setLocation("/new-analysis")}
            style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >
            ✦ New Analysis
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "40px 40px 80px" }}>

        {/* ── Page header ── */}
        <div style={{
          display: "flex", alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between", flexDirection: isMobile ? "column" : "row",
          gap: 16, marginBottom: 28,
        }}>
          <div>
            <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: isMobile ? 26 : 32, color: NAVY, margin: 0, lineHeight: 1.1 }}>
              My Analyses
            </h1>
            {!loading && !error && (
              <div style={{ color: MUTED, fontSize: 13, marginTop: 5 }}>
                {analyses.length === 0
                  ? "No analyses yet"
                  : `${analyses.length} analysis${analyses.length !== 1 ? "es" : ""}`}
              </div>
            )}
          </div>

          {/* List / Cards toggle */}
          <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
            {(["list", "cards"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "7px 20px", fontSize: 12, fontWeight: 600,
                  fontFamily: "Inter, sans-serif", border: "none", cursor: "pointer",
                  background: viewMode === mode ? NAVY : "#fff",
                  color: viewMode === mode ? "#fff" : MUTED,
                  letterSpacing: "0.03em",
                }}
              >
                {mode === "list" ? "List" : "Cards"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: MUTED, fontSize: 14 }}>
            Loading analyses…
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "20px 24px", color: RED, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && analyses.length === 0 && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "72px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 700, fontSize: 22, color: NAVY, marginBottom: 10 }}>
              No analyses yet
            </div>
            <div style={{ color: MUTED, fontSize: 13, marginBottom: 28, maxWidth: 340, margin: "0 auto 28px" }}>
              Run your first analysis to see credit scores and financial metrics here.
            </div>
            <button
              onClick={() => setLocation("/new-analysis")}
              style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              ✦ New Analysis
            </button>
          </div>
        )}

        {/* ── List view ── */}
        {!loading && !error && analyses.length > 0 && viewMode === "list" && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}`, background: CREAM }}>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Industry</th>
                    <th
                      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("amount_requested")}
                    >
                      Amount{sortIcon("amount_requested")}
                    </th>
                    <th style={thStyle}>Term</th>
                    <th
                      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("overall_score")}
                    >
                      Score{sortIcon("overall_score")}
                    </th>
                    <th style={thStyle}>Risk</th>
                    <th style={thStyle}>Confidence</th>
                    <th
                      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("created_at")}
                    >
                      Date{sortIcon("created_at")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setLocation(`/analysis/${a.id}`)}
                      style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F5F2ED")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600, color: NAVY, minWidth: 200, maxWidth: 320 }}>
                        <div style={{ lineHeight: 1.4 }}>
                          {a.title}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: MUTED }}>{a.industry}</td>
                      <td style={tdStyle}>{fmtCurrency(a.amount_requested)}</td>
                      <td style={{ ...tdStyle, color: MUTED }}>
                        {a.term_months != null ? `${a.term_months} mo` : "—"}
                      </td>
                      <td style={tdStyle}>
                        {a.overall_score != null ? (
                          <span style={{
                            fontFamily: "Fraunces, Georgia, serif", fontWeight: 800,
                            fontSize: 18, color: scoreColor(a.overall_score),
                          }}>
                            {a.overall_score}
                          </span>
                        ) : (
                          <span style={{ color: MUTED, fontSize: 12, fontStyle: "italic" }}>Not scored</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {a.risk_label ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                            background: scoreColor(a.overall_score) + "1A",
                            color: scoreColor(a.overall_score),
                            border: `1px solid ${scoreColor(a.overall_score)}40`,
                          }}>
                            {a.risk_label}
                          </span>
                        ) : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {a.coverage_pct != null ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                            background: confidenceColor(a.coverage_pct), color: "#fff",
                          }}>
                            {confidenceLabel(a.coverage_pct)}
                          </span>
                        ) : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: MUTED, whiteSpace: "nowrap" }}>
                        {fmtDate(a.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Card view ── */}
        {!loading && !error && analyses.length > 0 && viewMode === "cards" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {sorted.map((a) => (
              <div
                key={a.id}
                onClick={() => setLocation(`/analysis/${a.id}`)}
                style={{
                  background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16,
                  padding: "24px", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.12s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "0 4px 20px rgba(27,43,75,0.10)";
                  el.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                {/* Score + badges row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    {a.overall_score != null ? (
                      <div style={{
                        fontFamily: "Fraunces, Georgia, serif", fontWeight: 800,
                        fontSize: 52, color: scoreColor(a.overall_score), lineHeight: 1,
                      }}>
                        {a.overall_score}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: MUTED, fontStyle: "italic", paddingTop: 12 }}>
                        Not scored yet
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {a.coverage_pct != null && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Data confidence</div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          background: confidenceColor(a.coverage_pct), color: "#fff",
                        }}>
                          {confidenceLabel(a.coverage_pct)}
                        </span>
                      </div>
                    )}
                    {a.risk_label && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Rating</div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: scoreColor(a.overall_score) + "1A",
                          color: scoreColor(a.overall_score),
                          border: `1px solid ${scoreColor(a.overall_score)}40`,
                        }}>
                          {a.risk_label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title + industry */}
                <div style={{ fontWeight: 700, fontSize: 15, color: NAVY, marginBottom: 3, lineHeight: 1.35 }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>{a.industry}</div>

                {/* Amount + term */}
                <div style={{ display: "flex", gap: 8, fontSize: 12, color: MUTED, alignItems: "center" }}>
                  <span>{fmtCurrency(a.amount_requested)}</span>
                  {a.term_months != null && <span style={{ color: BORDER }}>·</span>}
                  {a.term_months != null && <span>{a.term_months} mo</span>}
                </div>

                {/* Date */}
                <div style={{ fontSize: 11, color: MUTED, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                  {fmtDate(a.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
