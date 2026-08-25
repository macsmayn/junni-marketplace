import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
  const STRIPE_WEBHOOK_SIGNING_SECRET = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  // ── Read raw body — MUST precede any JSON parsing for signature verification ──
  const body = await req.text();
  const signature = req.headers.get("Stripe-Signature") ?? "";

  // ── Signature verification ────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SIGNING_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  // ── End signature verification ────────────────────────────────────────────────

  // ── Idempotency: record event before processing ───────────────────────────────
  const { error: insertErr } = await supabase
    .from("stripe_events")
    .insert({ stripe_event_id: event.id, event_type: event.type, payload: event });

  if (insertErr) {
    // Duplicate key — event already processed; acknowledge and stop
    if (insertErr.code === "23505") {
      console.log("[stripe-webhook] Duplicate event, ignoring:", event.id);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[stripe-webhook] stripe_events insert failed:", insertErr);
    return new Response(JSON.stringify({ error: "Failed to record event" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  // ── End idempotency ───────────────────────────────────────────────────────────

  // ── Event handling ────────────────────────────────────────────────────────────
  try {
    await handleEvent(event, supabase);

    // Mark processed
    await supabase
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

  } catch (err: any) {
    console.error("[stripe-webhook] Processing failed for event", event.id, "type", event.type, ":", err.message);
    await supabase
      .from("stripe_events")
      .update({ error: err.message })
      .eq("stripe_event_id", event.id);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  // ── End event handling ────────────────────────────────────────────────────────

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleEvent(event: Stripe.Event, supabase: ReturnType<typeof createClient>) {
  switch (event.type) {

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscription(sub, supabase);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("[stripe-webhook] invoice.paid — invoice id:", invoice.id);

      const paidSubId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;

      if (!paidSubId) {
        console.log("[stripe-webhook] invoice.paid: no subscription id — skipping");
        break;
      }

      // Only email if recovering from past_due — check DB status before this event updates it
      const { data: paidSubRow, error: paidSubErr } = await supabase
        .from("subscriptions")
        .select("org_id, status")
        .eq("stripe_subscription_id", paidSubId)
        .maybeSingle();

      if (paidSubErr || !paidSubRow) {
        console.error("[stripe-webhook] invoice.paid: subscriptions lookup failed for", paidSubId, paidSubErr);
        break;
      }

      if (paidSubRow.status !== "past_due") {
        console.log("[stripe-webhook] invoice.paid: status is", paidSubRow.status, "— no recovery email needed");
        break;
      }

      const { data: paidOwner, error: paidOwnerErr } = await supabase
        .from("users")
        .select("email, full_name, language")
        .eq("org_id", paidSubRow.org_id)
        .eq("org_role", "owner")
        .maybeSingle();

      if (paidOwnerErr || !paidOwner?.email) {
        console.error("[stripe-webhook] invoice.paid: owner lookup failed for org", paidSubRow.org_id, paidOwnerErr);
        break;
      }

      try {
        const isFr = paidOwner.language === "fr";
        const firstName = (paidOwner.full_name ?? "").split(" ")[0] || null;
        const greeting  = isFr
          ? (firstName ? `Bonjour ${firstName},` : "Bonjour,")
          : (firstName ? `Hi ${firstName},`      : "Hi,");

        const subject = isFr
          ? "Votre paiement Junni a été traité avec succès"
          : "Your Junni payment went through";

        const html = isFr
          ? `<p>${greeting}</p>
<p>Bonne nouvelle : votre paiement a été traité avec succès et votre abonnement Junni est maintenant actif.</p>
<p>Vous pouvez consulter les détails de votre abonnement à tout moment :</p>
<p><a href="https://app.junni.ca/billing">Voir la facturation →</a></p>
<p>L'équipe Junni</p>`
          : `<p>${greeting}</p>
<p>Good news — your payment went through and your Junni subscription is now active.</p>
<p>You can view your subscription details at any time:</p>
<p><a href="https://app.junni.ca/billing">View billing →</a></p>
<p>The Junni team</p>`;

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Junni <notifications@junni.ca>", to: [paidOwner.email], subject, html }),
        });
        if (!resendRes.ok) {
          console.error("[stripe-webhook] invoice.paid: recovery email failed for org", paidSubRow.org_id, ":", await resendRes.text());
        } else {
          console.log("[stripe-webhook] invoice.paid: recovery email sent to", paidOwner.email);
        }
      } catch (emailErr: any) {
        console.error("[stripe-webhook] invoice.paid: recovery email threw:", emailErr.message);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("[stripe-webhook] invoice.payment_failed — invoice id:", invoice.id);

      const failedSubId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;

      if (!failedSubId) {
        console.error("[stripe-webhook] invoice.payment_failed: no subscription id on invoice", invoice.id);
        break;
      }

      const { data: failedSubRow, error: failedSubErr } = await supabase
        .from("subscriptions")
        .select("org_id")
        .eq("stripe_subscription_id", failedSubId)
        .maybeSingle();

      if (failedSubErr || !failedSubRow?.org_id) {
        console.error("[stripe-webhook] invoice.payment_failed: subscriptions lookup failed for", failedSubId, failedSubErr);
        break;
      }

      const { data: failedOwner, error: failedOwnerErr } = await supabase
        .from("users")
        .select("email, full_name, language")
        .eq("org_id", failedSubRow.org_id)
        .eq("org_role", "owner")
        .maybeSingle();

      if (failedOwnerErr || !failedOwner?.email) {
        console.error("[stripe-webhook] invoice.payment_failed: owner lookup failed for org", failedSubRow.org_id, failedOwnerErr);
        break;
      }

      try {
        const isFr = failedOwner.language === "fr";
        const firstName = (failedOwner.full_name ?? "").split(" ")[0] || null;
        const greeting  = isFr
          ? (firstName ? `Bonjour ${firstName},` : "Bonjour,")
          : (firstName ? `Hi ${firstName},`      : "Hi,");

        const subject = isFr
          ? "Problème de paiement pour votre abonnement Junni"
          : "Payment issue with your Junni subscription";

        const html = isFr
          ? `<p>${greeting}</p>
<p>Nous n'avons pas pu traiter votre dernier paiement pour votre abonnement Junni. Pas d'inquiétude — nous réessaierons automatiquement au cours des prochains jours.</p>
<p>Si vous souhaitez mettre à jour votre mode de paiement dès maintenant, vous pouvez le faire à tout moment depuis votre page de facturation :</p>
<p><a href="https://app.junni.ca/billing">Gérer la facturation →</a></p>
<p>N'hésitez pas à nous contacter si vous avez des questions.</p>
<p>L'équipe Junni</p>`
          : `<p>${greeting}</p>
<p>We were unable to process your most recent payment for your Junni subscription. No need to worry — we will retry automatically over the next few days.</p>
<p>If you'd like to update your payment method right away, you can do so at any time from your billing page:</p>
<p><a href="https://app.junni.ca/billing">Manage billing →</a></p>
<p>Feel free to reach out if you have any questions.</p>
<p>The Junni team</p>`;

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Junni <notifications@junni.ca>", to: [failedOwner.email], subject, html }),
        });
        if (!resendRes.ok) {
          console.error("[stripe-webhook] invoice.payment_failed: email failed for org", failedSubRow.org_id, ":", await resendRes.text());
        } else {
          console.log("[stripe-webhook] invoice.payment_failed: email sent to", failedOwner.email);
        }
      } catch (emailErr: any) {
        console.error("[stripe-webhook] invoice.payment_failed: email threw:", emailErr.message);
      }
      break;
    }

    case "checkout.session.completed":
      console.log("[stripe-webhook] checkout.session.completed received — session id:", (event.data.object as Stripe.Checkout.Session).id, "— no action taken");
      break;

    default:
      console.log("[stripe-webhook] Unhandled event type:", event.type, "id:", event.id);
  }
}

async function handleSubscription(sub: Stripe.Subscription, supabase: ReturnType<typeof createClient>) {
  const orgId: string | undefined = sub.metadata?.org_id;
  const planKey: string | undefined = sub.metadata?.plan_key;

  if (!orgId) {
    console.error("[stripe-webhook] subscription", sub.id, "has no metadata.org_id — cannot sync");
    return;
  }

  // Look up included_deals from billing_plans
  let includedDeals: number | null = null;
  if (planKey) {
    const { data: planRow, error: planErr } = await supabase
      .from("billing_plans")
      .select("included_deals")
      .eq("plan_key", planKey)
      .maybeSingle();
    if (planErr) {
      console.error("[stripe-webhook] billing_plans lookup failed for plan_key", planKey, ":", planErr);
    } else if (planRow) {
      includedDeals = planRow.included_deals ?? null;
    }
  }

  const firstItem = sub.items?.data?.[0];
  const stripePriceId: string | null = firstItem?.price?.id ?? null;

  // unix seconds → ISO string, or null if undefined. Defensive against API version differences
  // where period fields may live on the item rather than the subscription root.
  function unixToIso(seconds: number | null | undefined): string | null {
    if (seconds == null || isNaN(seconds)) return null;
    return new Date(seconds * 1000).toISOString();
  }

  const periodStart = sub.current_period_start ?? firstItem?.current_period_start;
  const periodEnd   = sub.current_period_end   ?? firstItem?.current_period_end;

  if (periodStart == null) {
    console.error("[stripe-webhook] subscription", sub.id, "has no current_period_start on sub or first item");
  }
  if (periodEnd == null) {
    console.error("[stripe-webhook] subscription", sub.id, "has no current_period_end on sub or first item");
  }

  const upsertPayload: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    org_id: orgId,
    status: sub.status,
    plan_key: planKey ?? null,
    stripe_price_id: stripePriceId,
    included_deals: includedDeals,
    current_period_start: unixToIso(periodStart),
    current_period_end: unixToIso(periodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_end: unixToIso(sub.trial_end),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from("subscriptions")
    .upsert(upsertPayload, { onConflict: "stripe_subscription_id" });

  if (upsertErr) {
    console.error("[stripe-webhook] subscriptions upsert failed for", sub.id, ":", upsertErr);
    throw new Error(`subscriptions upsert failed: ${upsertErr.message}`);
  }

  console.log("[stripe-webhook] subscription synced — id:", sub.id, "org_id:", orgId, "status:", sub.status);
}
