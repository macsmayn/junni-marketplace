// Sends trial-expiry reminder emails to customers whose trial ends in 3 days or 1 day.
// Scheduled daily at 06:05 UTC via pg_cron (see README for the cron.schedule call).
//
// Authentication: X-Data-Retention-Secret header (same secret as data-retention).
//
// Reminder windows (2-day ranges to survive a missed cron run):
//   3-day: trial_end in [now+2d, now+4d)  →  sets trial_reminder_3d_sent_at
//   1-day: trial_end in [now+0d, now+2d)  →  sets trial_reminder_1d_sent_at
//
// Guard: both columns are timestamptz on subscriptions; a non-null value means
//        the email was already sent for that subscription and is never resent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-data-retention-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(date: Date, lang: "en" | "fr"): string {
  const MONTHS_EN = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const MONTHS_FR = [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre",
  ];
  const d = date.getUTCDate();
  const m = lang === "fr" ? MONTHS_FR[date.getUTCMonth()] : MONTHS_EN[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return lang === "fr" ? `${d} ${m} ${y}` : `${m} ${d}, ${y}`;
}

function formatAmount(amountCad: number | null, lang: "en" | "fr"): string {
  if (amountCad == null) return lang === "fr" ? "votre montant d'abonnement" : "your subscription amount";
  return `$${amountCad.toLocaleString("en-CA")} CAD`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    let secretKey: string;
    try { secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"] ?? ""; }
    catch { secretKey = ""; }
    if (!secretKey) {
      console.error("[trial-reminders] SUPABASE_SECRET_KEYS missing or 'default' entry not found");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const DATA_RETENTION_SECRET = Deno.env.get("DATA_RETENTION_SECRET") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

    // ── Authenticate — scheduler only (X-Data-Retention-Secret) ─────────────────
    const secretHeader = req.headers.get("X-Data-Retention-Secret");
    if (!secretHeader || !DATA_RETENTION_SECRET || secretHeader !== DATA_RETENTION_SECRET) {
      console.error("[trial-reminders] Invalid or missing X-Data-Retention-Secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End authentication ───────────────────────────────────────────────────────

    const supabase = createClient(SUPABASE_URL, secretKey);
    const now = new Date();
    const nowIso = now.toISOString();

    // ── Find subscriptions in each reminder window ───────────────────────────────
    const window3dStart = new Date(now.getTime() + 2 * DAY_MS).toISOString();
    const window3dEnd   = new Date(now.getTime() + 4 * DAY_MS).toISOString();
    const window1dStart = nowIso;
    const window1dEnd   = new Date(now.getTime() + 2 * DAY_MS).toISOString();

    const { data: trialingSubs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, org_id, plan_key, trial_end, trial_reminder_3d_sent_at, trial_reminder_1d_sent_at")
      .eq("status", "trialing")
      .not("trial_end", "is", null);

    if (subsErr) {
      console.error("[trial-reminders] subscriptions fetch failed:", subsErr);
      return new Response(JSON.stringify({ error: "Internal error fetching subscriptions" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    type ReminderType = "3d" | "1d";
    type PendingReminder = { sub: any; reminderType: ReminderType };
    const pending: PendingReminder[] = [];

    for (const sub of trialingSubs ?? []) {
      if (!sub.trial_end) continue;
      const trialEnd = sub.trial_end as string;

      const is3dWindow = trialEnd >= window3dStart && trialEnd < window3dEnd;
      const is1dWindow = trialEnd >= window1dStart && trialEnd < window1dEnd;

      if (is3dWindow && !sub.trial_reminder_3d_sent_at) {
        pending.push({ sub, reminderType: "3d" });
      } else if (is1dWindow && !sub.trial_reminder_1d_sent_at) {
        pending.push({ sub, reminderType: "1d" });
      }
    }

    if (pending.length === 0) {
      console.log("[trial-reminders] No reminders due —", now.toISOString());
      return new Response(JSON.stringify({ run_at: nowIso, reminders_sent: 0, reminders_failed: 0, details: [] }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Pre-fetch plan data in bulk ──────────────────────────────────────────────
    const { data: planRows } = await supabase
      .from("billing_plans")
      .select("plan_key, display_name, price_monthly_cad");

    const planMap = new Map<string, { display_name: string; price_monthly_cad: number | null }>();
    for (const p of planRows ?? []) {
      planMap.set(p.plan_key, { display_name: p.display_name, price_monthly_cad: p.price_monthly_cad });
    }

    // ── Process each pending reminder ────────────────────────────────────────────
    interface ReminderResult {
      org_id: string;
      stripe_subscription_id: string;
      reminder_type: ReminderType;
      owner_email: string | null;
      sent: boolean;
      error?: string;
    }
    const results: ReminderResult[] = [];

    for (const { sub, reminderType } of pending) {
      const orgId: string = sub.org_id;
      const subId: string = sub.stripe_subscription_id;

      try {
        // Look up org owner
        const { data: ownerMembership, error: ownerErr } = await supabase
          .from("organization_members")
          .select("users(email, full_name, language), org_id, organizations(name)")
          .eq("org_id", orgId)
          .eq("org_role", "owner")
          .maybeSingle();

        if (ownerErr) {
          console.error(`[trial-reminders] owner lookup failed for org ${orgId}:`, ownerErr);
          results.push({ org_id: orgId, stripe_subscription_id: subId, reminder_type: reminderType, owner_email: null, sent: false, error: "owner lookup failed" });
          continue;
        }

        const ownerUser = ownerMembership?.users as { email: string | null; full_name: string | null; language: string | null } | null;
        const org = ownerMembership?.organizations as { name: string } | null;
        const ownerEmail = ownerUser?.email ?? null;

        if (!ownerEmail) {
          console.error(`[trial-reminders] no owner email for org ${orgId}`);
          results.push({ org_id: orgId, stripe_subscription_id: subId, reminder_type: reminderType, owner_email: null, sent: false, error: "no owner email" });
          continue;
        }

        const lang: "en" | "fr" = ownerUser?.language === "fr" ? "fr" : "en";
        const firstName = (ownerUser?.full_name ?? "").split(" ")[0] || null;
        const orgName = org?.name ?? "";
        const trialEndDate = new Date(sub.trial_end as string);

        const planKey: string = sub.plan_key ?? "";
        const plan = planMap.get(planKey);
        const planName = plan?.display_name ?? (planKey || "your plan");
        const amount = formatAmount(plan?.price_monthly_cad ?? null, lang);

        const greeting = lang === "fr"
          ? (firstName ? `Bonjour ${firstName},` : "Bonjour,")
          : (firstName ? `Hi ${firstName},`      : "Hi,");

        const trialEndStr = formatDate(trialEndDate, lang);

        let subject: string;
        let html: string;

        if (reminderType === "3d") {
          if (lang === "fr") {
            subject = `Votre essai Junni se termine dans 3 jours`;
            html = `<p>${greeting}</p>
<p>Votre essai gratuit de Junni (plan <strong>${planName}</strong>) se termine le <strong>${trialEndStr}</strong> — dans 3 jours.</p>
<p>À cette date, <strong>${amount}/mois</strong> sera prélevé sur votre carte enregistrée et votre abonnement passera automatiquement en mode actif.</p>
<p>Si vous souhaitez annuler ou modifier votre abonnement avant la facturation, vous pouvez le faire à tout moment depuis votre page de facturation :</p>
<p><a href="https://app.junni.ca/billing">Gérer mon abonnement →</a></p>
<p>L'équipe Junni</p>`;
          } else {
            subject = `Your Junni trial ends in 3 days`;
            html = `<p>${greeting}</p>
<p>Your free Junni trial (${planName} plan) ends on <strong>${trialEndStr}</strong> — 3 days from now.</p>
<p>On that date, <strong>${amount}/month</strong> will be charged to your card on file and your subscription will automatically become active.</p>
<p>If you'd like to cancel or change your plan before being charged, you can do so at any time:</p>
<p><a href="https://app.junni.ca/billing">Manage my subscription →</a></p>
<p>The Junni team</p>`;
          }
        } else {
          // 1d reminder
          if (lang === "fr") {
            subject = `Votre essai Junni se termine demain`;
            html = `<p>${greeting}</p>
<p>Rappel : votre essai gratuit de Junni (plan <strong>${planName}</strong>) se termine demain, le <strong>${trialEndStr}</strong>.</p>
<p>Demain, <strong>${amount}/mois</strong> sera prélevé sur votre carte enregistrée.</p>
<p>Pour annuler avant la facturation ou mettre à jour votre mode de paiement :</p>
<p><a href="https://app.junni.ca/billing">Gérer mon abonnement →</a></p>
<p>L'équipe Junni</p>`;
          } else {
            subject = `Your Junni trial ends tomorrow`;
            html = `<p>${greeting}</p>
<p>Reminder: your free Junni trial (${planName} plan) ends tomorrow, <strong>${trialEndStr}</strong>.</p>
<p>Tomorrow, <strong>${amount}/month</strong> will be charged to your card on file.</p>
<p>To cancel before being charged or update your payment method:</p>
<p><a href="https://app.junni.ca/billing">Manage my subscription →</a></p>
<p>The Junni team</p>`;
          }
        }

        // Send via Resend
        if (!RESEND_API_KEY) {
          console.error("[trial-reminders] RESEND_API_KEY not configured");
          results.push({ org_id: orgId, stripe_subscription_id: subId, reminder_type: reminderType, owner_email: ownerEmail, sent: false, error: "RESEND_API_KEY not configured" });
          continue;
        }

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: "Junni <notifications@junni.ca>", to: [ownerEmail], subject, html }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          console.error(`[trial-reminders] email to ${ownerEmail} failed (${resendRes.status}):`, errBody);
          results.push({ org_id: orgId, stripe_subscription_id: subId, reminder_type: reminderType, owner_email: ownerEmail, sent: false, error: `Resend ${resendRes.status}` });
          continue;
        }

        console.log(`[trial-reminders] ${reminderType} reminder sent to ${ownerEmail} — org ${orgId}, trial ends ${sub.trial_end}`);

        // Mark sent — never re-send this reminder for this subscription
        const sentField = reminderType === "3d" ? "trial_reminder_3d_sent_at" : "trial_reminder_1d_sent_at";
        const { error: updateErr } = await supabase
          .from("subscriptions")
          .update({ [sentField]: nowIso })
          .eq("stripe_subscription_id", subId);

        if (updateErr) {
          console.error(`[trial-reminders] failed to set ${sentField} for ${subId}:`, updateErr);
        }

        results.push({ org_id: orgId, stripe_subscription_id: subId, reminder_type: reminderType, owner_email: ownerEmail, sent: true });

      } catch (err: any) {
        console.error(`[trial-reminders] unhandled error for org ${orgId} (${reminderType}):`, err.message);
        results.push({ org_id: orgId, stripe_subscription_id: subId, reminder_type: reminderType, owner_email: null, sent: false, error: err.message });
      }
    }

    const sentCount = results.filter((r) => r.sent).length;
    const failedCount = results.filter((r) => !r.sent).length;

    console.log(`[trial-reminders] done — ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({ run_at: nowIso, reminders_sent: sentCount, reminders_failed: failedCount, details: results }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[trial-reminders] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
