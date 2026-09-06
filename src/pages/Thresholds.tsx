import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase, invokeFunctionWithDetails } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

const NAVY   = "#1B2B4B";
const GOLD   = "#D4940A";
const CREAM  = "#FAF8F4";
const GREEN  = "#059669";
const RED    = "#DC2626";
const MUTED  = "#7A7060";
const BORDER = "#E8E2D9";

const INDUSTRY_LABELS_FR: Record<string, string> = {
  "Agriculture & Agri-Food":           "Agriculture et agroalimentaire",
  "Construction":                      "Construction",
  "Education":                         "Éducation",
  "Energy":                            "Énergie",
  "Financial Services":                "Services financiers",
  "Food & Beverage":                   "Alimentation et boissons",
  "Government & Public Sector":        "Gouvernement et secteur public",
  "Healthcare & Life Sciences":        "Santé et sciences de la vie",
  "Hospitality & Lodging":             "Hôtellerie et hébergement",
  "Insurance":                         "Assurance",
  "Manufacturing":                     "Fabrication",
  "Media & Entertainment":             "Médias et divertissement",
  "Mining & Metals":                   "Mines et métaux",
  "Other":                             "Autre",
  "Professional Services":             "Services professionnels",
  "Real Estate":                       "Immobilier",
  "Retail & Consumer":                 "Commerce de détail et consommation",
  "Special Purpose Vehicles":          "Véhicules à usage spécial",
  "Technology & Telecommunications":   "Technologie et télécommunications",
  "Transportation & Logistics":        "Transport et logistique",
  "Wholesale & Distribution":          "Commerce de gros et distribution",
};

const TIER_ORDER = ["Critical", "Important", "Supplementary", "Optional"];

interface ThresholdMetric {
  metric_id: string;
  metric_name: string;
  importance_tier: string;
  unit: string | null;
  canonical: { strong: string | null; adequate: string | null; weak: string | null };
  override: { strong: string | null; adequate: string | null; weak: string | null; version: number } | null;
}

interface EditState {
  strong: string;
  adequate: string;
  weak: string;
}

function initEdit(m: ThresholdMetric): EditState {
  return {
    strong:   m.override?.strong   ?? "",
    adequate: m.override?.adequate ?? "",
    weak:     m.override?.weak     ?? "",
  };
}

export default function Thresholds() {
  const [, setLocation] = useLocation();
  const { user, isLoading: auth0Loading } = useAuth0();
  const { lang, t } = useLanguage();

  const [loading, setLoading]                     = useState(true);
  const [metricsLoading, setMetricsLoading]       = useState(false);
  const [loadError, setLoadError]                 = useState<string | null>(null);
  const [canEdit, setCanEdit]                     = useState(false);
  const [orgId, setOrgId]                         = useState<string | null>(null);

  const [industries, setIndustries]               = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry]   = useState<string>("");

  const [metrics, setMetrics]                     = useState<ThresholdMetric[]>([]);

  // Per-metric edit state
  const [edits, setEdits]   = useState<Record<string, EditState>>({});
  const [dirty, setDirty]   = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // rowErrors values are either i18n keys ("thresholds.*") or raw server messages.
  function displayRowError(err: string): string {
    return err.startsWith("thresholds.") ? t(err) : err;
  }

  // Reason modal
  const [reasonModal, setReasonModal]   = useState<{ metricId: string; action: "set" | "reset" } | null>(null);
  const [reasonText, setReasonText]     = useState("");
  const [reasonError, setReasonError]   = useState<string | null>(null);
  const [reasonSaving, setReasonSaving] = useState(false);

  // ── Load industries from DB ───────────────────────────────────────────────
  async function loadIndustries() {
    const { data, error } = await supabase
      .from("industries")
      .select("industry_key")
      .order("industry_key", { ascending: true });
    if (error || !data || data.length === 0) {
      // Fall back to static list
      const staticList = Object.keys(INDUSTRY_LABELS_FR).sort();
      setIndustries(staticList);
      return staticList;
    }
    const keys = data.map((r: any) => r.industry_key as string);
    setIndustries(keys);
    return keys;
  }

  // ── Load metrics for selected industry ───────────────────────────────────
  const loadMetrics = useCallback(async (industryKey: string) => {
    if (!industryKey) return;
    setMetricsLoading(true);
    setRowErrors({});
    const { data, httpStatus } = await invokeFunctionWithDetails("set-threshold", {
      action: "list",
      industry_key: industryKey,
    });
    setMetricsLoading(false);
    if (httpStatus >= 400 || !data?.metrics) {
      setLoadError("thresholds.loadError");
      return;
    }
    const rows: ThresholdMetric[] = data.metrics;
    setMetrics(rows);
    // Pre-populate edits from current override values
    const newEdits: Record<string, EditState> = {};
    for (const m of rows) {
      newEdits[m.metric_id] = initEdit(m);
    }
    setEdits(newEdits);
    setDirty(new Set());
  }, []);

  // ── Refresh a single metric row after save/reset ──────────────────────────
  async function refreshMetric(metricId: string, industryKey: string) {
    const { data, httpStatus } = await invokeFunctionWithDetails("set-threshold", {
      action: "list",
      industry_key: industryKey,
    });
    if (httpStatus >= 400 || !data?.metrics) return;
    const updated: ThresholdMetric | undefined = (data.metrics as ThresholdMetric[]).find(
      m => m.metric_id === metricId
    );
    if (!updated) return;
    setMetrics(prev => prev.map(m => m.metric_id === metricId ? updated : m));
    setEdits(prev => ({ ...prev, [metricId]: initEdit(updated) }));
    setDirty(prev => { const s = new Set(prev); s.delete(metricId); return s; });
  }

  // ── Initial page load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (auth0Loading || !user?.sub) return;
    (async () => {
      setLoading(true);
      setLoadError(null);

      // Get user row
      const { data: uRow, error: uErr } = await supabase
        .from("users")
        .select("id, active_org_id")
        .eq("auth0_id", user.sub)
        .maybeSingle();

      if (uErr || !uRow || !uRow.active_org_id) {
        setLoadError("thresholds.loadError");
        setLoading(false);
        return;
      }

      const activeOrgId = uRow.active_org_id as string;
      setOrgId(activeOrgId);

      // Get org role
      const { data: membership } = await supabase
        .from("organization_members")
        .select("org_role")
        .eq("org_id", activeOrgId)
        .eq("user_id", uRow.id)
        .maybeSingle();

      const role = membership?.org_role ?? "member";
      setCanEdit(role === "owner" || role === "credit_admin");

      // Load industries
      const industryList = await loadIndustries();

      // Find default industry from most recent deal
      let defaultIndustry = industryList[0] ?? "";
      const { data: recentDeal } = await supabase
        .from("deals")
        .select("industry")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentDeal?.industry && industryList.includes(recentDeal.industry)) {
        defaultIndustry = recentDeal.industry;
      }
      setSelectedIndustry(defaultIndustry);

      setLoading(false);
    })();
  }, [user?.sub, auth0Loading]);

  // ── Reload metrics when industry changes ──────────────────────────────────
  useEffect(() => {
    if (selectedIndustry) loadMetrics(selectedIndustry);
  }, [selectedIndustry, loadMetrics]);

  // ── Handle field change ───────────────────────────────────────────────────
  function handleFieldChange(metricId: string, field: keyof EditState, value: string) {
    setEdits(prev => ({
      ...prev,
      [metricId]: { ...(prev[metricId] ?? { strong: "", adequate: "", weak: "" }), [field]: value },
    }));
    setDirty(prev => { const s = new Set(prev); s.add(metricId); return s; });
    setRowErrors(prev => { const r = { ...prev }; delete r[metricId]; return r; });
  }

  // ── Handle Cancel for a row ───────────────────────────────────────────────
  function handleCancel(metricId: string) {
    const m = metrics.find(x => x.metric_id === metricId);
    if (m) setEdits(prev => ({ ...prev, [metricId]: initEdit(m) }));
    setDirty(prev => { const s = new Set(prev); s.delete(metricId); return s; });
    setRowErrors(prev => { const r = { ...prev }; delete r[metricId]; return r; });
  }

  // ── Open reason modal ─────────────────────────────────────────────────────
  function openReason(metricId: string, action: "set" | "reset") {
    setReasonText("");
    setReasonError(null);
    setReasonModal({ metricId, action });
  }

  function closeReason() {
    setReasonModal(null);
    setReasonText("");
    setReasonError(null);
  }

  // ── Confirm save or reset ─────────────────────────────────────────────────
  async function handleReasonConfirm() {
    if (!reasonModal) return;
    if (reasonText.trim().length < 10) {
      setReasonError("thresholds.reasonMinLength");
      return;
    }

    const { metricId, action } = reasonModal;
    setReasonSaving(true);

    if (action === "set") {
      const edit = edits[metricId] ?? { strong: "", adequate: "", weak: "" };
      setSaving(prev => { const s = new Set(prev); s.add(metricId); return s; });
      closeReason();

      const { data, httpStatus } = await invokeFunctionWithDetails("set-threshold", {
        action: "set",
        metric_id: metricId,
        strong:   edit.strong   || null,
        adequate: edit.adequate || null,
        weak:     edit.weak     || null,
        reason:   reasonText.trim(),
      });

      setSaving(prev => { const s = new Set(prev); s.delete(metricId); return s; });
      setReasonSaving(false);

      if (httpStatus >= 400) {
        const errMsg = httpStatus === 400 && data?.error ? data.error : "thresholds.saveError";
        setRowErrors(prev => ({ ...prev, [metricId]: errMsg }));
        return;
      }
      await refreshMetric(metricId, selectedIndustry);
    } else {
      setSaving(prev => { const s = new Set(prev); s.add(metricId); return s; });
      closeReason();

      const { data, httpStatus } = await invokeFunctionWithDetails("set-threshold", {
        action: "reset",
        metric_id: metricId,
        reason: reasonText.trim(),
      });

      setSaving(prev => { const s = new Set(prev); s.delete(metricId); return s; });
      setReasonSaving(false);

      if (httpStatus >= 400) {
        const errMsg = httpStatus === 400 && data?.error ? data.error : "thresholds.resetError";
        setRowErrors(prev => ({ ...prev, [metricId]: errMsg }));
        return;
      }
      await refreshMetric(metricId, selectedIndustry);
    }
  }

  // ── Group metrics by tier ─────────────────────────────────────────────────
  const grouped = TIER_ORDER.map(tier => ({
    tier,
    items: metrics.filter(m => m.importance_tier === tier),
  })).filter(g => g.items.length > 0);

  const industryLabel = (key: string) =>
    lang === "fr" ? (INDUSTRY_LABELS_FR[key] ?? key) : key;

  const tierLabel = (tier: string) => {
    const key = `thresholds.tier${tier}` as string;
    return t(key) || tier;
  };

  const tierColor = (tier: string) => {
    if (tier === "Critical")     return "#DC2626";
    if (tier === "Important")    return "#D97706";
    if (tier === "Supplementary") return "#2563EB";
    return MUTED;
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.07em", color: MUTED, padding: "10px 14px",
    textAlign: "left", borderBottom: `1px solid ${BORDER}`,
    background: "rgba(27,43,75,0.02)", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    fontSize: 13, padding: "12px 14px", color: NAVY,
    borderBottom: `1px solid ${BORDER}`, verticalAlign: "middle",
  };
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: `1px solid ${BORDER}`,
    borderRadius: 14, padding: "24px 28px", marginBottom: 24,
  };
  const h2Style: React.CSSProperties = {
    fontFamily: "Fraunces, Georgia, serif", fontWeight: 700,
    fontSize: 18, color: NAVY, margin: "0 0 18px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "7px 10px",
    border: `1px solid ${BORDER}`, borderRadius: 7,
    fontSize: 13, fontFamily: "Inter, sans-serif", color: NAVY,
    background: "#fff", outline: "none",
    minWidth: 120,
  };

  if (auth0Loading || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY, background: CREAM }}>
        {t("thresholds.loading")}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* Nav */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setLocation("/lender-dashboard")}
          style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}
        >
          {t("thresholds.backToDashboard")}
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{t("thresholds.title")}</span>
        <div style={{ marginLeft: "auto" }}><LanguageToggle /></div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 32px 80px" }}>

        {loadError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 20px", color: RED, fontSize: 14, marginBottom: 28 }}>
            {t(loadError)}
          </div>
        )}

        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 32, color: NAVY, margin: "0 0 8px" }}>
          {t("thresholds.title")}
        </h1>

        {!canEdit && (
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 28 }}>
            {t("thresholds.readOnly")}
          </div>
        )}
        {canEdit && <div style={{ marginBottom: 28 }} />}

        {/* ── Industry selector ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            {t("thresholds.industryLabel")}
          </label>
          <select
            value={selectedIndustry}
            onChange={e => setSelectedIndustry(e.target.value)}
            style={{
              padding: "10px 14px",
              border: `1px solid ${BORDER}`, borderRadius: 9,
              fontSize: 14, fontFamily: "Inter, sans-serif", color: NAVY,
              background: "#fff", cursor: "pointer", outline: "none",
              minWidth: 280,
            }}
          >
            {industries.map(key => (
              <option key={key} value={key}>{industryLabel(key)}</option>
            ))}
          </select>
        </div>

        {/* ── Metrics ───────────────────────────────────────────────────── */}
        {canEdit && !metricsLoading && metrics.length > 0 && (
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
            {t("thresholds.bandFormatHint")}
          </div>
        )}

        {metricsLoading ? (
          <div style={{ color: MUTED, fontSize: 14, padding: "40px 0" }}>{t("thresholds.loading")}</div>
        ) : metrics.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 14 }}>{t("thresholds.noMetrics")}</div>
        ) : (
          grouped.map(group => (
            <div key={group.tier} style={cardStyle}>
              <h2 style={{ ...h2Style, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: `${tierColor(group.tier)}18`, color: tierColor(group.tier),
                  letterSpacing: "0.04em",
                }}>
                  {tierLabel(group.tier)}
                </span>
              </h2>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, minWidth: 180 }}>{t("thresholds.colMetric")}</th>
                      <th style={{ ...thStyle, minWidth: 120 }}>{t("thresholds.colStrong")}</th>
                      <th style={{ ...thStyle, minWidth: 120 }}>{t("thresholds.colAdequate")}</th>
                      <th style={{ ...thStyle, minWidth: 120 }}>{t("thresholds.colWeak")}</th>
                      <th style={{ ...thStyle, minWidth: 160 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((m, i) => {
                      const isLast    = i === group.items.length - 1;
                      const isDirty   = dirty.has(m.metric_id);
                      const isSaving  = saving.has(m.metric_id);
                      const isOverride = m.override !== null;
                      const edit      = edits[m.metric_id] ?? initEdit(m);
                      const rowError  = rowErrors[m.metric_id];

                      const rowBorderStyle = isLast ? "none" : `1px solid ${BORDER}`;

                      return (
                        <>
                          <tr key={m.metric_id}>
                            {/* Metric name */}
                            <td style={{ ...tdStyle, borderBottom: (isDirty || rowError) ? "none" : rowBorderStyle, fontWeight: 600 }}>
                              {m.metric_name}
                              {m.unit && (
                                <span style={{ fontSize: 11, color: MUTED, fontWeight: 400, marginLeft: 6 }}>({m.unit})</span>
                              )}
                            </td>

                            {/* Strong */}
                            <td style={{ ...tdStyle, borderBottom: (isDirty || rowError) ? "none" : rowBorderStyle }}>
                              {canEdit ? (
                                <input
                                  type="text"
                                  value={edit.strong}
                                  placeholder={m.canonical.strong ?? t("thresholds.defaultPlaceholder")}
                                  onChange={e => handleFieldChange(m.metric_id, "strong", e.target.value)}
                                  disabled={isSaving}
                                  style={{ ...inputStyle, borderColor: isOverride && !isDirty ? GOLD : BORDER, opacity: isSaving ? 0.5 : 1 }}
                                />
                              ) : (
                                <span style={{ color: isOverride ? NAVY : MUTED }}>
                                  {m.override?.strong ?? m.canonical.strong ?? "—"}
                                </span>
                              )}
                            </td>

                            {/* Adequate */}
                            <td style={{ ...tdStyle, borderBottom: (isDirty || rowError) ? "none" : rowBorderStyle }}>
                              {canEdit ? (
                                <input
                                  type="text"
                                  value={edit.adequate}
                                  placeholder={m.canonical.adequate ?? t("thresholds.defaultPlaceholder")}
                                  onChange={e => handleFieldChange(m.metric_id, "adequate", e.target.value)}
                                  disabled={isSaving}
                                  style={{ ...inputStyle, borderColor: isOverride && !isDirty ? GOLD : BORDER, opacity: isSaving ? 0.5 : 1 }}
                                />
                              ) : (
                                <span style={{ color: isOverride ? NAVY : MUTED }}>
                                  {m.override?.adequate ?? m.canonical.adequate ?? "—"}
                                </span>
                              )}
                            </td>

                            {/* Weak */}
                            <td style={{ ...tdStyle, borderBottom: (isDirty || rowError) ? "none" : rowBorderStyle }}>
                              {canEdit ? (
                                <input
                                  type="text"
                                  value={edit.weak}
                                  placeholder={m.canonical.weak ?? t("thresholds.defaultPlaceholder")}
                                  onChange={e => handleFieldChange(m.metric_id, "weak", e.target.value)}
                                  disabled={isSaving}
                                  style={{ ...inputStyle, borderColor: isOverride && !isDirty ? GOLD : BORDER, opacity: isSaving ? 0.5 : 1 }}
                                />
                              ) : (
                                <span style={{ color: isOverride ? NAVY : MUTED }}>
                                  {m.override?.weak ?? m.canonical.weak ?? "—"}
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td style={{ ...tdStyle, borderBottom: (isDirty || rowError) ? "none" : rowBorderStyle }}>
                              {isSaving ? (
                                <span style={{ fontSize: 12, color: MUTED }}>{t("thresholds.saving")}</span>
                              ) : isDirty ? (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <button
                                    onClick={() => openReason(m.metric_id, "set")}
                                    style={{
                                      background: NAVY, color: "#fff", border: "none",
                                      borderRadius: 7, padding: "6px 14px", fontSize: 12,
                                      fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
                                    }}
                                  >
                                    {t("thresholds.save")}
                                  </button>
                                  <button
                                    onClick={() => handleCancel(m.metric_id)}
                                    style={{
                                      background: "none", color: MUTED,
                                      border: `1px solid ${BORDER}`,
                                      borderRadius: 7, padding: "6px 14px", fontSize: 12,
                                      fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
                                    }}
                                  >
                                    {t("thresholds.cancel")}
                                  </button>
                                </div>
                              ) : isOverride ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{
                                    display: "inline-block", fontSize: 11, fontWeight: 700,
                                    padding: "3px 10px", borderRadius: 20,
                                    background: "rgba(212,148,10,0.12)", color: GOLD,
                                    border: `1px solid rgba(212,148,10,0.35)`,
                                  }}>
                                    {t("metric.customThreshold")}
                                  </span>
                                  {canEdit && (
                                    <button
                                      onClick={() => openReason(m.metric_id, "reset")}
                                      style={{
                                        background: "none", border: "none", color: RED,
                                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                                        fontFamily: "Inter, sans-serif", padding: 0,
                                        textDecoration: "underline",
                                      }}
                                    >
                                      {t("thresholds.resetLink")}
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </td>
                          </tr>

                          {/* Row error or save/cancel row */}
                          {rowError && (
                            <tr key={`${m.metric_id}-err`}>
                              <td colSpan={5} style={{ padding: "4px 14px 12px", borderBottom: rowBorderStyle }}>
                                <span style={{ fontSize: 12, color: RED }}>{displayRowError(rowError)}</span>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Reason modal ────────────────────────────────────────────────────── */}
      {reasonModal && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(27,43,75,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={e => { if (e.target === e.currentTarget) closeReason(); }}
        >
          <div style={{
            background: "#fff", borderRadius: 14,
            padding: "32px 36px", maxWidth: 480, width: "90vw",
            boxShadow: "0 16px 48px rgba(27,43,75,0.18)",
          }}>
            <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 700, fontSize: 18, color: NAVY, margin: "0 0 8px" }}>
              {t("thresholds.reasonTitle")}
            </h3>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.55 }}>
              {t("thresholds.reasonHelp")}
            </p>

            <textarea
              value={reasonText}
              onChange={e => { setReasonText(e.target.value); setReasonError(null); }}
              placeholder={t("thresholds.reasonPlaceholder")}
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px",
                border: `1px solid ${reasonError ? RED : BORDER}`, borderRadius: 8,
                fontSize: 13, fontFamily: "Inter, sans-serif", color: NAVY,
                background: "#fff", outline: "none", resize: "vertical",
                marginBottom: 8,
              }}
            />

            {reasonError && (
              <div style={{ fontSize: 12, color: RED, marginBottom: 12 }}>{t(reasonError)}</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={closeReason}
                disabled={reasonSaving}
                style={{
                  background: "none", border: `1px solid ${BORDER}`, color: MUTED,
                  borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600,
                  cursor: reasonSaving ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif",
                }}
              >
                {t("thresholds.reasonCancel")}
              </button>
              <button
                onClick={handleReasonConfirm}
                disabled={reasonSaving}
                style={{
                  background: reasonSaving ? "#E8E2D9" : NAVY, color: reasonSaving ? MUTED : "#fff",
                  border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600,
                  cursor: reasonSaving ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif",
                }}
              >
                {t("thresholds.reasonConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
