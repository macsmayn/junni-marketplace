import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

const NAVY   = "#1B2B4B";
const CREAM  = "#FAF8F4";
const MUTED  = "#7A7060";
const BORDER = "#E8E2D9";
const RED    = "#DC2626";

export default function CompleteProfile() {
  const [, setLocation] = useLocation();
  const { user } = useAuth0();
  const { t } = useLanguage();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("completeProfile.errorBlankFields");
      return;
    }

    setSaving(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { error: dbErr } = await supabase
      .from("users")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
      })
      .eq("auth0_id", user!.sub);

    setSaving(false);
    if (dbErr) {
      setError("completeProfile.errorSave");
      return;
    }
    setLocation("/lender-dashboard");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "10px 12px",
    border: `1px solid ${BORDER}`, borderRadius: 8,
    fontSize: 14, fontFamily: "Inter, sans-serif", color: NAVY,
    background: "#fff", outline: "none", marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: MUTED, letterSpacing: "0.07em",
    textTransform: "uppercase", marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* Nav */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{t("completeProfile.title")}</span>
        <div style={{ marginLeft: "auto" }}><LanguageToggle /></div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 80px" }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 32, color: NAVY, margin: "0 0 12px" }}>
          {t("completeProfile.title")}
        </h1>
        <p style={{ fontSize: 15, color: MUTED, margin: "0 0 32px", lineHeight: 1.6 }}>
          {t("completeProfile.subtitle")}
        </p>

        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "28px 32px", maxWidth: 480 }}>
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 20 }}>
                {t(error)}
              </div>
            )}

            <label style={labelStyle}>{t("completeProfile.firstNameLabel")}</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder={t("completeProfile.firstNamePlaceholder")}
              autoComplete="given-name"
              style={inputStyle}
              disabled={saving}
            />

            <label style={labelStyle}>{t("completeProfile.lastNameLabel")}</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder={t("completeProfile.lastNamePlaceholder")}
              autoComplete="family-name"
              style={{ ...inputStyle, marginBottom: 24 }}
              disabled={saving}
            />

            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? "#E8E2D9" : NAVY,
                color: saving ? MUTED : "#fff",
                border: "none", borderRadius: 8,
                padding: "11px 28px", fontSize: 14, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? t("completeProfile.saving") : t("completeProfile.continueBtn")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
