import { useEffect, useState } from "react";
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

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  org_role: string;
}

interface PendingInvite {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

export default function Team() {
  const [, setLocation] = useLocation();
  const { user, isLoading: auth0Loading } = useAuth0();
  const { lang, t } = useLanguage();
  const dateLocale = lang === "fr" ? "fr-CA" : "en-CA";

  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [isOwner, setIsOwner]           = useState(false);
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [invites, setInvites]           = useState<PendingInvite[]>([]);

  const [inviteEmail, setInviteEmail]               = useState("");
  const [inviting, setInviting]                     = useState(false);
  const [inviteError, setInviteError]               = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess]           = useState(false);
  const [inviteEmailNotSent, setInviteEmailNotSent] = useState(false);
  const [showBillingLink, setShowBillingLink]       = useState(false);

  const [revokingId, setRevokingId]   = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function loadTeam() {
    const { data, httpStatus } = await invokeFunctionWithDetails("invite-member", { action: "list" });
    if (httpStatus >= 400 || !data) {
      setLoadError("team.loadError");
      return;
    }
    setMembers(data.members ?? []);
    setInvites((data.invites ?? []).filter((i: PendingInvite) => i.status === "pending"));
  }

  useEffect(() => {
    if (auth0Loading || !user?.sub) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: uRow, error: uErr } = await supabase
          .from("users")
          .select("id, active_org_id, role")
          .eq("auth0_id", user.sub)
          .maybeSingle();

        if (uErr || !uRow) {
          setLoadError("team.loadError");
          setLoading(false);
          return;
        }

        if (uRow.active_org_id) {
          const { data: membership } = await supabase
            .from("organization_members")
            .select("org_role")
            .eq("org_id", uRow.active_org_id)
            .eq("user_id", uRow.id)
            .maybeSingle();
          setIsOwner(membership?.org_role === "owner");
        }

        await loadTeam();
      } catch {
        setLoadError("team.loadError");
      }
      setLoading(false);
    })();
  }, [user?.sub, auth0Loading]);

  async function handleInvite() {
    setInviteError(null);
    setInviteSuccess(false);
    setInviteEmailNotSent(false);
    setShowBillingLink(false);

    if (!inviteEmail.trim()) {
      setInviteError("team.errorBadEmail");
      return;
    }

    setInviting(true);
    const { data, httpStatus } = await invokeFunctionWithDetails("invite-member", {
      action: "invite",
      email: inviteEmail.trim(),
    });
    setInviting(false);

    if (httpStatus >= 400) {
      if (httpStatus === 402) {
        setInviteError("team.errorNoSubscription");
        setShowBillingLink(true);
      } else if (httpStatus === 403) {
        setInviteError("team.errorNotOwner");
      } else if (httpStatus === 409 && data?.error === "seat_limit") {
        setInviteError(data?.message ?? "team.errorGeneric");
      } else if (httpStatus === 409) {
        setInviteError("team.errorDuplicateInvite");
      } else {
        setInviteError("team.errorBadEmail");
      }
      return;
    }

    if (data?.email_sent === false) {
      setInviteEmailNotSent(true);
    } else {
      setInviteSuccess(true);
    }
    setInviteEmail("");
    await loadTeam();
  }

  async function handleRevoke(inviteId: string) {
    setRevokeError(null);
    setRevokingId(inviteId);
    const { httpStatus } = await invokeFunctionWithDetails("invite-member", {
      action: "revoke",
      invite_id: inviteId,
    });
    setRevokingId(null);
    if (httpStatus >= 400) {
      setRevokeError("team.revokeError");
      return;
    }
    await loadTeam();
  }

  function fmtDate(s: string): string {
    return new Date(s).toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // inviteError can be either an i18n key ("team.xxx") or a raw server message
  function displayInviteError(): string {
    if (!inviteError) return "";
    return inviteError.startsWith("team.") ? t(inviteError) : inviteError;
  }

  if (auth0Loading || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY, background: CREAM }}>
        {t("team.loading")}
      </div>
    );
  }

  const thStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.07em", color: MUTED, padding: "10px 14px",
    textAlign: "left", borderBottom: `1px solid ${BORDER}`,
    background: "rgba(27,43,75,0.02)",
  };
  const tdStyle: React.CSSProperties = {
    fontSize: 13, padding: "12px 14px", color: NAVY,
    borderBottom: `1px solid ${BORDER}`,
  };
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: `1px solid ${BORDER}`,
    borderRadius: 14, padding: "28px 32px", marginBottom: 28,
  };
  const h2Style: React.CSSProperties = {
    fontFamily: "Fraunces, Georgia, serif", fontWeight: 700,
    fontSize: 20, color: NAVY, margin: "0 0 20px",
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* Nav */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setLocation("/lender-dashboard")}
          style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}
        >
          {t("team.backToDashboard")}
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{t("team.title")}</span>
        <div style={{ marginLeft: "auto" }}><LanguageToggle /></div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 80px" }}>

        {loadError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 20px", color: RED, fontSize: 14, marginBottom: 28 }}>
            {t(loadError)}
          </div>
        )}

        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 32, color: NAVY, margin: "0 0 32px" }}>
          {t("team.title")}
        </h1>

        {/* ── Team members ──────────────────────────────────────────── */}
        <div style={cardStyle}>
          <h2 style={h2Style}>{t("team.membersSection")}</h2>
          {members.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 14 }}>{t("team.noMembers")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t("team.colName")}</th>
                    <th style={thStyle}>{t("team.colEmail")}</th>
                    <th style={thStyle}>{t("team.colRole")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.id}>
                      <td style={{ ...tdStyle, fontWeight: 600, borderBottom: i < members.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        {m.full_name || m.email}
                      </td>
                      <td style={{ ...tdStyle, color: MUTED, borderBottom: i < members.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        {m.email}
                      </td>
                      <td style={{ ...tdStyle, borderBottom: i < members.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        <span style={{
                          display: "inline-block", fontSize: 11, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 20,
                          background: m.org_role === "owner" ? "rgba(212,148,10,0.12)" : "rgba(27,43,75,0.07)",
                          color: m.org_role === "owner" ? GOLD : NAVY,
                        }}>
                          {m.org_role === "owner" ? t("team.roleOwner") : t("team.roleMember")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pending invitations ───────────────────────────────────── */}
        <div style={cardStyle}>
          <h2 style={h2Style}>{t("team.invitesSection")}</h2>
          {revokeError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 16 }}>
              {t(revokeError)}
            </div>
          )}
          {invites.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 14 }}>{t("team.noInvites")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t("team.colInviteEmail")}</th>
                    <th style={thStyle}>{t("team.colSent")}</th>
                    {isOwner && <th style={{ ...thStyle, textAlign: "right" }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv, i) => (
                    <tr key={inv.id}>
                      <td style={{ ...tdStyle, fontWeight: 600, borderBottom: i < invites.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        {inv.email}
                      </td>
                      <td style={{ ...tdStyle, color: MUTED, borderBottom: i < invites.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        {fmtDate(inv.created_at)}
                      </td>
                      {isOwner && (
                        <td style={{ ...tdStyle, textAlign: "right", borderBottom: i < invites.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revokingId !== null}
                            style={{
                              background: "none",
                              border: `1px solid ${BORDER}`,
                              color: revokingId === inv.id ? MUTED : RED,
                              borderRadius: 7, padding: "5px 12px",
                              fontSize: 12, fontWeight: 600,
                              cursor: revokingId !== null ? "not-allowed" : "pointer",
                              fontFamily: "Inter, sans-serif",
                              opacity: revokingId !== null && revokingId !== inv.id ? 0.5 : 1,
                            }}
                          >
                            {revokingId === inv.id ? t("team.revoking") : t("team.revokeBtn")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Invite a colleague (owners only) ─────────────────────── */}
        {isOwner && (
          <div style={cardStyle}>
            <h2 style={h2Style}>{t("team.inviteSection")}</h2>

            {inviteSuccess && (
              <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", color: GREEN, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
                {t("team.inviteSuccess")}
              </div>
            )}
            {inviteEmailNotSent && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", color: "#92400E", fontSize: 13, marginBottom: 16 }}>
                {t("team.inviteEmailNotSent")}
              </div>
            )}
            {inviteError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 16 }}>
                {displayInviteError()}
                {showBillingLink && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => setLocation("/billing")}
                      style={{ background: "none", border: "none", color: RED, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0, textDecoration: "underline" }}
                    >
                      {t("team.goBilling")}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ maxWidth: 420 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                {t("team.inviteEmailLabel")}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !inviting) handleInvite(); }}
                placeholder={t("team.inviteEmailPlaceholder")}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 12px",
                  border: `1px solid ${BORDER}`, borderRadius: 8,
                  fontSize: 14, fontFamily: "Inter, sans-serif", color: NAVY,
                  background: "#fff", outline: "none", marginBottom: 12,
                }}
              />
              <button
                onClick={handleInvite}
                disabled={inviting}
                style={{
                  background: inviting ? "#E8E2D9" : NAVY,
                  color: inviting ? MUTED : "#fff",
                  border: "none", borderRadius: 8,
                  padding: "10px 24px", fontSize: 14, fontWeight: 600,
                  cursor: inviting ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {inviting ? t("team.sending") : t("team.sendBtn")}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
