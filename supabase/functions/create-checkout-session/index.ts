import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auth0-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Caller verification via Auth0 /userinfo ────────────────────────────────
    const auth0Token = req.headers.get("X-Auth0-Token");
    if (!auth0Token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfoRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${auth0Token}` },
    });
    if (!userInfoRes.ok) {
      console.error("[create-checkout-session] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfo = await userInfoRes.json();
    const callerSub: string = userInfo.sub;

    if (!callerSub) {
      console.error("[create-checkout-session] /userinfo missing sub claim");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End caller verification ────────────────────────────────────────────────

    // ── Parse and validate body ────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const plan_key = typeof body.plan_key === "string" ? body.plan_key.trim() : "";
    const org_name = typeof body.org_name === "string" ? body.org_name.trim() : "";

    if (!plan_key) {
      return new Response(JSON.stringify({ error: "plan_key is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!org_name) {
      return new Response(JSON.stringify({ error: "org_name is required and must not be empty" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End body validation ────────────────────────────────────────────────────

    // ── DB lookups ─────────────────────────────────────────────────────────────

    // a. Look up the caller's user row
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id, org_id, org_role")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (userErr) {
      console.error("[create-checkout-session] users lookup failed:", userErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!userRow || !userRow.org_id) {
      return new Response(JSON.stringify({ error: "Account not provisioned. Please log out and log back in." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const orgId: string = userRow.org_id;

    // b. Only the org owner may start a subscription
    if (userRow.org_role !== "owner") {
      return new Response(JSON.stringify({ error: "Only the organization owner can start a subscription." }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // c. Look up the plan
    const { data: plan, error: planErr } = await supabase
      .from("billing_plans")
      .select("id, plan_key, base_price_id, metered_price_id")
      .eq("plan_key", plan_key)
      .eq("active", true)
      .maybeSingle();

    if (planErr) {
      console.error("[create-checkout-session] billing_plans lookup failed:", planErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!plan) {
      return new Response(JSON.stringify({ error: `Plan '${plan_key}' not found or not active.` }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // d. Look up the org's Stripe customer
    const { data: billingRow, error: billingErr } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (billingErr) {
      console.error("[create-checkout-session] billing_customers lookup failed:", billingErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!billingRow?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "Billing record not found for this organization." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const stripeCustomerId: string = billingRow.stripe_customer_id;

    // e. Check for an existing active subscription
    const { data: existingSub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("org_id", orgId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle();

    if (subErr) {
      console.error("[create-checkout-session] subscriptions lookup failed:", subErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (existingSub) {
      return new Response(JSON.stringify({ error: "This organization already has an active subscription." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End DB lookups ─────────────────────────────────────────────────────────

    // ── Update org name in DB and Stripe ──────────────────────────────────────
    const { error: orgUpdateErr } = await supabase
      .from("organizations")
      .update({ name: org_name })
      .eq("id", orgId);

    if (orgUpdateErr) {
      console.error("[create-checkout-session] organizations name update failed:", orgUpdateErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const stripeCustomerUpdateParams = new URLSearchParams({ name: org_name });
    const stripeCustomerUpdateRes = await fetch(
      `https://api.stripe.com/v1/customers/${stripeCustomerId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: stripeCustomerUpdateParams.toString(),
      },
    );

    if (!stripeCustomerUpdateRes.ok) {
      const errBody = await stripeCustomerUpdateRes.text();
      console.error("[create-checkout-session] Stripe customer name update failed — status:", stripeCustomerUpdateRes.status, "body:", errBody);
      return new Response(JSON.stringify({ error: "Failed to update billing profile" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End org name update ────────────────────────────────────────────────────

    // ── Create Stripe Checkout Session ────────────────────────────────────────
    const sessionParams = new URLSearchParams({
      mode: "subscription",
      customer: stripeCustomerId,
      "line_items[0][price]": plan.base_price_id,
      "line_items[0][quantity]": "1",
      "subscription_data[trial_period_days]": "14",
      "success_url": "https://app.junni.ca/billing?checkout=success",
      "cancel_url": "https://app.junni.ca/billing?checkout=cancelled",
      "client_reference_id": orgId,
      "subscription_data[metadata][org_id]": orgId,
      "subscription_data[metadata][plan_key]": plan_key,
      "metadata[org_id]": orgId,
    });

    // Metered line item must not include a quantity — Stripe rejects it
    if (plan.metered_price_id) {
      sessionParams.set("line_items[1][price]", plan.metered_price_id);
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sessionParams.toString(),
    });

    if (!sessionRes.ok) {
      const errBody = await sessionRes.text();
      console.error("[create-checkout-session] Stripe checkout session creation failed — status:", sessionRes.status, "body:", errBody);
      return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const session = await sessionRes.json();
    // ── End Checkout Session ───────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("[create-checkout-session] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
