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

    case "invoice.paid":
      console.log("[stripe-webhook] invoice.paid received — invoice id:", (event.data.object as Stripe.Invoice).id, "— no action taken");
      break;

    case "invoice.payment_failed":
      console.log("[stripe-webhook] invoice.payment_failed received — invoice id:", (event.data.object as Stripe.Invoice).id, "— no action taken");
      break;

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
