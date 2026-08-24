import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase, invokeFunction } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

const NAVY   = "#1B2B4B";
const GOLD   = "#D4940A";
const CREAM  = "#FAF8F4";
const GREEN  = "#059669";
const RED    = "#DC2626";
const MUTED  = "#7A7060";
const BORDER = "#E8E2D9";

// Hardcoded pricing display — not stored in DB
const PLAN_PRICE_EN: Record<string, string> = {
  solo_monthly:   "$500 CAD/month",
  solo_annual:    "$5,000 CAD/year",
  growth_monthly: "$750 CAD/month",
  growth_annual:  "$7,500 CAD/year",
};

const PLAN_PRICE_FR: Record<string, string> = {
  solo_monthly:   "500 $ CAD/mois",
  solo_annual:    "5 000 $ CAD/an",
  growth_monthly: "750 $ CAD/mois",
  growth_annual:  "7 500 $ CAD/an",
};

// Annual price expressed as a monthly equivalent (for the "saving" line)
const MONTHLY_EQUIV_EN: Record<string, string> = {
  solo_annual:   "$417 CAD",
  growth_annual: "$625 CAD",
};

const MONTHLY_EQUIV_FR: Record<string, string> = {
  solo_annual:   "417 $ CAD",
  growth_annual: "625 $ CAD",
};

const PLAN_GROUPS = [
  { key: "solo",   monthly: "solo_monthly",   annual: "solo_annual"   },
  { key: "growth", monthly: "growth_monthly", annual: "growth_annual" },
] as const;

const PLAN_BASE_NAMES: Record<string, string> = {
  solo:   "Solo",
  growth: "Growth",
};

function fmtDate(s: string | null, locale = "en-CA"): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

interface UserRow {
  id: string;
  org_id: string | null;
  org_role: string | null;
  role: string;
}

interface SubRow {
  status: string;
  plan_key: string | null;
  included_deals: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  trial_end: string | null;
}

interface PlanRow {
  plan_key: string;
  display_name: string;
  interval: string;
  included_deals: number | null;
  overage_cents: number | null;
}

export default function Billing() {
  const [, setLocation] = useLocation();
  const { user, isLoading: auth0Loading } = useAuth0();
  const { lang, t } = useLanguage();
  const dateLocale = lang === "fr" ? "fr-CA" : "en-CA";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userRow, setUserRow] = useState<UserRow | null>(null);
  const [orgName, setOrgName] = useState("");
  const [subscription, setSubscription] = useState<SubRow | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [usageCount, setUsageCount] = useState<number | null>(null);

  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const checkoutResult = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  ).get("checkout");

  useEffect(() => {
    if (auth0Loading || !user?.sub) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // 1. User row
        const { data: uRow, error: uErr } = await supabase
          .from("users")
          .select("id, org_id, org_role, role")
          .eq("auth0_id", user.sub)
          .maybeSingle();
        if (uErr || !uRow) {
          setLoadError("billing.loadError");
          setLoading(false);
          return;
        }
        setUserRow(uRow);

        // 2. Organization name
        if (uRow.org_id) {
          const { data: orgRow } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", uRow.org_id)
            .maybeSingle();
          setOrgName(orgRow?.name ?? "");
        }

        // 3. Active subscription
        let sub: SubRow | null = null;
        if (uRow.org_id) {
          const { data: subRow } = await supabase
            .from("subscriptions")
            .select("status, plan_key, included_deals, current_period_start, current_period_end, cancel_at_period_end, trial_end")
            .eq("org_id", uRow.org_id)
            .in("status", ["trialing", "active", "past_due"])
            .maybeSingle();
          sub = subRow ?? null;
          setSubscription(sub);
        }

        // 4. All active plans
        const { data: planRows } = await supabase
          .from("billing_plans")
          .select("plan_key, display_name, interval, included_deals, overage_cents")
          .eq("active", true)
          .order("sort_order", { ascending: true });
        setPlans(planRows ?? []);

        // 5. Usage this period (only if subscription exists)
        if (sub && uRow.org_id && sub.current_period_start && sub.current_period_end) {
          const { data: dealRows } = await supabase
            .from("deals")
            .select("id")
            .eq("org_id", uRow.org_id);
          const dealIds = (dealRows ?? []).map((d: any) => d.id as string);
          if (dealIds.length > 0) {
            const { count } = await supabase
              .from("credit_scores")
              .select("id", { count: "exact", head: true })
              .in("deal_id", dealIds)
              .gte("generated_at", sub.current_period_start)
              .lte("generated_at", sub.current_period_end);
            setUsageCount(count ?? 0);
          } else {
            setUsageCount(0);
          }
        }
      } catch {
        setLoadError("billing.loadError");
      }
      setLoading(false);
    })();
  }, [user?.sub, auth0Loading]);

  async function handleSubscribe(planKey: string) {
    setSubscribeError(null);
    setSubscribingPlan(planKey);
    const { data, error } = await invokeFunction("create-checkout-session", {
      plan_key: planKey,
      org_name: orgName.trim() || "My Organization",
    });
    if (error) {
      setSubscribeError("billing.subscribeError");
      setSubscribingPlan(null);
      return;
    }
    const url = (data as any)?.url;
    if (url) {
      window.location.href = url;
    } else {
      setSubscribeError("billing.subscribeError");
      setSubscribingPlan(null);
    }
  }

  async function handleManage() {
    setManageError(null);
    setManaging(true);
    const { data, error } = await invokeFunction("create-portal-session", {});
    if (error) {
      setManageError("billing.manageError");
      setManaging(false);
      return;
    }
    const url = (data as any)?.url;
    if (url) {
      window.location.href = url;
    } else {
      setManageError("billing.manageError");
      setManaging(false);
    }
  }

  function tStatus(status: string): string {
    if (status === "trialing") return t("billing.statusTrialing");
    if (status === "active")   return t("billing.statusActive");
    if (status === "past_due") return t("billing.statusPastDue");
    return status;
  }

  function statusColor(status: string): string {
    if (status === "active")   return GREEN;
    if (status === "trialing") return GOLD;
    if (status === "past_due") return RED;
    return MUTED;
  }

  // Derived values for the subscription panel
  const subPlanRow     = plans.find(p => p.plan_key === subscription?.plan_key);
  const included       = subscription?.included_deals ?? null;
  const usageOverage   = usageCount !== null && included !== null && usageCount > included ? usageCount - included : null;
  const overageCents   = subPlanRow?.overage_cents ?? null;
  const overageRateStr = overageCents != null
    ? (lang === "fr" ? `${(overageCents / 100).toFixed(0)} $ CAD` : `$${(overageCents / 100).toFixed(0)} CAD`)
    : "—";

  const planPrices = lang === "fr" ? PLAN_PRICE_FR : PLAN_PRICE_EN;
  const isOwner    = userRow?.org_role === "owner";

  if (auth0Loading || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: NAVY, background: CREAM }}>
        {t("billing.loading")}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* ── Nav ── */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setLocation("/lender-dashboard")}
          style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}
        >
          {t("billing.backToDashboard")}
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{t("billing.title")}</span>
        <div style={{ marginLeft: "auto" }}><LanguageToggle /></div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 80px" }}>

        {/* Checkout result banners */}
        {checkoutResult === "success" && (
          <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 10, padding: "14px 20px", color: GREEN, fontSize: 14, marginBottom: 28, fontWeight: 500 }}>
            {t("billing.checkoutSuccess")}
          </div>
        )}
        {checkoutResult === "cancelled" && (
          <div style={{ background: "#F9FAFB", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 20px", color: MUTED, fontSize: 14, marginBottom: 28 }}>
            {t("billing.checkoutCancelled")}
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 20px", color: RED, fontSize: 14, marginBottom: 28 }}>
            {t(loadError)}
          </div>
        )}

        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 800, fontSize: 32, color: NAVY, margin: "0 0 24px" }}>
          {t("billing.title")}
        </h1>

        {/* Non-owner notice */}
        {userRow && !isOwner && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 20px", color: "#92400E", fontSize: 14, marginBottom: 28 }}>
            {t("billing.ownerOnly")}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STATE B — active subscription                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {subscription && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "28px 32px", marginBottom: 32 }}>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 700, fontSize: 20, color: NAVY, margin: "0 0 20px" }}>
              {t("billing.currentPlanTitle")}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Plan name + status */}
              <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                    {t("billing.planLabel")}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>
                    {subPlanRow?.display_name ?? subscription.plan_key ?? "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                    {t("billing.statusLabel")}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: statusColor(subscription.status) }}>
                    {tStatus(subscription.status)}
                  </div>
                </div>
              </div>

              {/* Trial end date */}
              {subscription.status === "trialing" && subscription.trial_end && (
                <div style={{ fontSize: 13, color: MUTED }}>
                  {t("billing.trialEnds")}: <strong style={{ color: NAVY }}>{fmtDate(subscription.trial_end, dateLocale)}</strong>
                </div>
              )}

              {/* Usage */}
              {usageCount !== null && included !== null && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    {t("billing.usageTitle")}
                  </div>
                  <div style={{ fontSize: 14, color: NAVY }}>
                    {t("billing.usageCount")
                      .replace("{used}", String(usageCount))
                      .replace("{included}", String(included))}
                  </div>
                  {usageOverage !== null && (
                    <div style={{ fontSize: 13, color: RED, marginTop: 4 }}>
                      {t("billing.usageOverage")
                        .replace("{n}", String(usageOverage))
                        .replace("{rate}", overageRateStr)}
                    </div>
                  )}
                </div>
              )}

              {/* Period resets */}
              {subscription.current_period_end && (
                <div style={{ fontSize: 13, color: MUTED }}>
                  {t("billing.periodResets")}: <strong style={{ color: NAVY }}>{fmtDate(subscription.current_period_end, dateLocale)}</strong>
                </div>
              )}

              {/* Cancellation notice */}
              {subscription.cancel_at_period_end && subscription.current_period_end && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: RED }}>
                  {t("billing.cancelNotice").replace("{date}", fmtDate(subscription.current_period_end, dateLocale))}
                </div>
              )}

              {/* Manage billing */}
              {isOwner && (
                <div style={{ marginTop: 4 }}>
                  {manageError && (
                    <div style={{ fontSize: 13, color: RED, marginBottom: 8 }}>{t(manageError)}</div>
                  )}
                  <button
                    onClick={handleManage}
                    disabled={managing}
                    style={{
                      background: managing ? "#E8E2D9" : NAVY,
                      color: managing ? MUTED : "#fff",
                      border: "none", borderRadius: 8,
                      padding: "10px 24px", fontSize: 14, fontWeight: 600,
                      cursor: managing ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {managing ? t("billing.managing") : t("billing.manageBtn")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STATE A — no subscription: toggle + two plan cards               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {!subscription && (
          <div>
            <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 700, fontSize: 22, color: NAVY, margin: "0 0 8px" }}>
              {t("billing.plansTitle")}
            </h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
              {t("billing.plansSub")}
            </p>

            {/* ── Monthly / Annual segmented toggle ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 10, padding: 4 }}>
                <button
                  onClick={() => setBillingInterval("monthly")}
                  style={{
                    background: billingInterval === "monthly" ? "#fff" : "transparent",
                    border:     billingInterval === "monthly" ? `1px solid ${BORDER}` : "1px solid transparent",
                    borderRadius: 7, padding: "7px 22px",
                    fontSize: 13, fontWeight: 600,
                    color: billingInterval === "monthly" ? NAVY : MUTED,
                    cursor: "pointer", fontFamily: "Inter, sans-serif",
                    boxShadow: billingInterval === "monthly" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {t("billing.toggleMonthly")}
                </button>
                <button
                  onClick={() => setBillingInterval("annual")}
                  style={{
                    background: billingInterval === "annual" ? "#fff" : "transparent",
                    border:     billingInterval === "annual" ? `1px solid ${BORDER}` : "1px solid transparent",
                    borderRadius: 7, padding: "7px 22px",
                    fontSize: 13, fontWeight: 600,
                    color: billingInterval === "annual" ? NAVY : MUTED,
                    cursor: "pointer", fontFamily: "Inter, sans-serif",
                    boxShadow: billingInterval === "annual" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {t("billing.toggleAnnual")}
                </button>
              </div>
              {billingInterval === "annual" && (
                <span style={{ background: "#ECFDF5", color: GREEN, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                  {t("billing.priceMonthsFree")}
                </span>
              )}
            </div>

            {/* Org name input — only for owners */}
            {isOwner && (
              <div style={{ marginBottom: 28, maxWidth: 420 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                  {t("billing.orgNameLabel")}
                </label>
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: "Inter, sans-serif", color: NAVY, background: "#fff", outline: "none" }}
                  placeholder="Acme Lending Inc."
                />
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  {t("billing.orgNameHelper")}
                </div>
              </div>
            )}

            {subscribeError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: RED, marginBottom: 20 }}>
                {t(subscribeError)}
              </div>
            )}

            {/* Two plan cards (Solo and Growth) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              {PLAN_GROUPS.map(group => {
                const activePlanKey  = billingInterval === "annual" ? group.annual : group.monthly;
                const planRow        = plans.find(p => p.plan_key === activePlanKey);
                const price          = planPrices[activePlanKey];
                const isSubscribing  = subscribingPlan === activePlanKey;
                const monthlyEquiv   = billingInterval === "annual"
                  ? (lang === "fr" ? MONTHLY_EQUIV_FR : MONTHLY_EQUIV_EN)[activePlanKey]
                  : null;
                const overageDisplay = planRow?.overage_cents != null
                  ? (lang === "fr"
                      ? `${(planRow.overage_cents / 100).toFixed(0)} $ CAD`
                      : `$${(planRow.overage_cents / 100).toFixed(0)} CAD`)
                  : null;

                return (
                  <div
                    key={group.key}
                    style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    {/* Plan name */}
                    <div style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 700, fontSize: 22, color: NAVY }}>
                      {PLAN_BASE_NAMES[group.key]}
                    </div>

                    {/* Price + monthly equivalent */}
                    <div>
                      {price && (
                        <div style={{ fontSize: 22, fontWeight: 700, color: GOLD, lineHeight: 1.2 }}>
                          {price}
                        </div>
                      )}
                      {monthlyEquiv && (
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                          {t("billing.monthlyEquiv").replace("{price}", monthlyEquiv)}
                        </div>
                      )}
                    </div>

                    {/* Included analyses */}
                    {planRow?.included_deals != null && (
                      <div style={{ fontSize: 13, color: MUTED }}>
                        {t("billing.includedDeals").replace("{n}", String(planRow.included_deals))}
                      </div>
                    )}

                    {/* Overage rate */}
                    {overageDisplay && (
                      <div style={{ fontSize: 12, color: MUTED }}>
                        {t("billing.overageRate").replace("{rate}", overageDisplay)}
                      </div>
                    )}

                    {/* Subscribe button (owner only) */}
                    {isOwner && (
                      <button
                        onClick={() => handleSubscribe(activePlanKey)}
                        disabled={!!subscribingPlan}
                        style={{
                          marginTop: "auto",
                          background: !!subscribingPlan ? "#E8E2D9" : GOLD,
                          color:      !!subscribingPlan ? MUTED      : "#fff",
                          border: "none", borderRadius: 8,
                          padding: "10px 20px", fontSize: 14, fontWeight: 600,
                          cursor: !!subscribingPlan ? "not-allowed" : "pointer",
                          fontFamily: "Inter, sans-serif",
                          alignSelf: "flex-start",
                        }}
                      >
                        {isSubscribing ? t("billing.subscribing") : t("billing.subscribeBtn")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
