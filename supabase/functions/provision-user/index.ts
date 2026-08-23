import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Same CORS headers as score-deal
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auth0-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com",
]);

// Derives a provisional org name from an email address.
// For free-mail domains, uses the local part (before @).
// For business domains, strips the TLD and title-cases the remainder.
// Example: "someone@meridiancapital.com" → "Meridiancapital"
function deriveOrgName(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return "Organization";

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1).toLowerCase();

  if (FREE_MAIL_DOMAINS.has(domain)) {
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  // Use only the first domain segment (e.g. "rbc" from "rbc.co.uk", "meridiancapital" from "meridiancapital.com")
  const firstSegment = domain.split(".")[0];
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Caller verification via Auth0 /userinfo ────────────────────────────────
    // The anon key travels in Authorization (for Supabase's verify_jwt gate).
    // The caller's Auth0 ID token travels in X-Auth0-Token, verified here via
    // Auth0's /userinfo endpoint to establish caller identity before any DB work.
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
      console.error("[provision-user] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfo = await userInfoRes.json();
    const callerSub: string = userInfo.sub;
    const callerEmail: string = userInfo.email;
    const callerName: string | null = userInfo.name ?? null;

    if (!callerSub || !callerEmail) {
      console.error(
        "[provision-user] /userinfo missing required claims — sub present:",
        !!callerSub,
        "email present:",
        !!callerEmail,
      );
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End caller verification ────────────────────────────────────────────────

    // ── Idempotency check ─────────────────────────────────────────────────────
    // Safe to call on every login: if the user already has a non-null org_id,
    // the row is fully provisioned — return immediately without touching anything.
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, org_id")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (existingUser?.org_id != null) {
      return new Response(
        JSON.stringify({
          user_id: existingUser.id,
          org_id: existingUser.org_id,
          already_provisioned: true,
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    // ── End idempotency check ──────────────────────────────────────────────────

    const orgName = deriveOrgName(callerEmail);

    // ── Stripe customer creation ───────────────────────────────────────────────
    // Must succeed before any DB writes. If Stripe fails, abort with 502.
    // Never log the secret key.
    //
    // Search first to avoid creating a duplicate when a previous attempt
    // succeeded at Stripe but failed at the billing_customers insert and was
    // compensating-cleaned (org_id reset to null, Stripe customer orphaned).
    let stripeCustomerId: string | null = null;

    const searchQuery = new URLSearchParams({
      query: `metadata['auth0_sub']:'${callerSub}'`,
    });
    const stripeSearchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?${searchQuery.toString()}`,
      {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      },
    );

    if (!stripeSearchRes.ok) {
      const searchErr = await stripeSearchRes.text();
      console.error(
        "[provision-user] Stripe customer search failed — status:",
        stripeSearchRes.status,
        "body:",
        searchErr,
        "— falling through to create new customer",
      );
    } else {
      const searchData = await stripeSearchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        stripeCustomerId = searchData.data[0].id;
        console.error(
          "[provision-user] Reusing existing Stripe customer:",
          stripeCustomerId,
          "for sub:",
          callerSub,
        );
      }
    }

    if (!stripeCustomerId) {
      const stripeParams = new URLSearchParams({
        email: callerEmail,
        name: orgName,
        "metadata[auth0_sub]": callerSub,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: stripeParams.toString(),
      });

      if (!stripeRes.ok) {
        const stripeErr = await stripeRes.text();
        console.error(
          "[provision-user] Stripe customer creation failed — status:",
          stripeRes.status,
          "body:",
          stripeErr,
        );
        return new Response(JSON.stringify({ error: "Failed to create billing customer" }), {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const stripeCustomer = await stripeRes.json();
      stripeCustomerId = stripeCustomer.id;
    }
    // ── End Stripe ─────────────────────────────────────────────────────────────

    // ── DB writes (in order; compensating cleanup on failure) ─────────────────

    // a. Insert organization
    const { data: orgData, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgErr || !orgData) {
      console.error("[provision-user] organizations insert failed:", orgErr);
      return new Response(JSON.stringify({ error: "Failed to create organization" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const orgId: string = orgData.id;

    // b. Upsert user — `role` column intentionally omitted; DB default handles it
    const userPayload: Record<string, unknown> = {
      auth0_id: callerSub,
      email: callerEmail,
      org_id: orgId,
      org_role: "owner",
    };
    if (callerName) userPayload.full_name = callerName;

    const { data: userData, error: userErr } = await supabase
      .from("users")
      .upsert(userPayload, { onConflict: "auth0_id" })
      .select("id")
      .single();

    if (userErr || !userData) {
      console.error("[provision-user] users upsert failed:", userErr);
      const { error: cleanupErr } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId);
      if (cleanupErr) {
        console.error("[provision-user] org cleanup after users upsert failure:", cleanupErr);
      }
      return new Response(JSON.stringify({ error: "Failed to provision user" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userId: string = userData.id;

    // c. Insert billing record
    const { error: billingErr } = await supabase
      .from("billing_customers")
      .insert({ org_id: orgId, stripe_customer_id: stripeCustomerId });

    if (billingErr) {
      console.error("[provision-user] billing_customers insert failed:", billingErr);
      // Compensating cleanup: delete org row and reset user's org_id so the
      // function remains retryable (idempotency check uses org_id != null).
      const { error: orgCleanupErr } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId);
      if (orgCleanupErr) {
        console.error("[provision-user] org cleanup after billing failure:", orgCleanupErr);
      }
      const { error: userCleanupErr } = await supabase
        .from("users")
        .update({ org_id: null })
        .eq("auth0_id", callerSub);
      if (userCleanupErr) {
        console.error("[provision-user] user org_id reset after billing failure:", userCleanupErr);
      }
      console.error("[provision-user] ORPHANED STRIPE CUSTOMER — no billing_customers row was written for:", stripeCustomerId);
      return new Response(JSON.stringify({ error: "Failed to create billing record" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── End DB writes ──────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ user_id: userId, org_id: orgId, already_provisioned: false }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("[provision-user] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
