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
    let secretKey: string;
    try { secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? '{}')['default'] ?? ''; }
    catch { secretKey = ''; }
    if (!secretKey) {
      console.error("[create-portal-session] SUPABASE_SECRET_KEYS missing or 'default' entry not found");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabase = createClient(SUPABASE_URL, secretKey);

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
      console.error("[create-portal-session] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfo = await userInfoRes.json();
    const callerSub: string = userInfo.sub;

    if (!callerSub) {
      console.error("[create-portal-session] /userinfo missing sub claim");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End caller verification ────────────────────────────────────────────────

    // ── DB lookups ─────────────────────────────────────────────────────────────

    // a. Look up the caller's user row
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id, active_org_id")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (userErr) {
      console.error("[create-portal-session] users lookup failed:", userErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!userRow || !userRow.active_org_id) {
      return new Response(JSON.stringify({ error: "Account not provisioned. Please log out and log back in." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const orgId: string = userRow.active_org_id;

    // b. Only the org owner may manage billing
    const { data: membership, error: membershipErr } = await supabase
      .from("organization_members")
      .select("org_role")
      .eq("org_id", orgId)
      .eq("user_id", userRow.id)
      .maybeSingle();

    if (membershipErr) {
      console.error("[create-portal-session] organization_members lookup failed:", membershipErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (membership?.org_role !== "owner") {
      return new Response(JSON.stringify({ error: "Only the organization owner can manage billing." }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // c. Look up the org's Stripe customer
    const { data: billingRow, error: billingErr } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (billingErr) {
      console.error("[create-portal-session] billing_customers lookup failed:", billingErr);
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
    // ── End DB lookups ─────────────────────────────────────────────────────────

    // ── Create Stripe Customer Portal session ─────────────────────────────────
    const portalParams = new URLSearchParams({
      customer: stripeCustomerId,
      return_url: "https://app.junni.ca/billing",
    });

    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: portalParams.toString(),
    });

    if (!portalRes.ok) {
      const errBody = await portalRes.text();
      console.error("[create-portal-session] Stripe portal session creation failed — status:", portalRes.status, "body:", errBody);
      return new Response(JSON.stringify({ error: "Failed to create billing portal session" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const portalSession = await portalRes.json();
    // ── End portal session creation ────────────────────────────────────────────

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("[create-portal-session] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
