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
      console.error("[invite-member] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfo = await userInfoRes.json();
    const callerSub: string = userInfo.sub;

    if (!callerSub) {
      console.error("[invite-member] /userinfo missing sub claim");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End caller verification ────────────────────────────────────────────────

    const { data: callerUser, error: callerErr } = await supabase
      .from("users")
      .select("id, org_id, org_role, full_name, language")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (callerErr) {
      console.error("[invite-member] users lookup failed:", callerErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!callerUser.org_id) {
      return new Response(JSON.stringify({ error: "Account not provisioned. Please log out and log back in." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (!action) {
      return new Response(JSON.stringify({ error: "action is required (invite | revoke | list)" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End parse body ─────────────────────────────────────────────────────────

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: list
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "list") {
      const [{ data: invites, error: invitesErr }, { data: members, error: membersErr }] = await Promise.all([
        supabase
          .from("org_invites")
          .select("id, email, status, created_at")
          .eq("org_id", callerUser.org_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, email, full_name, org_role")
          .eq("org_id", callerUser.org_id)
          .order("full_name", { ascending: true }),
      ]);

      if (invitesErr) console.error("[invite-member] list: org_invites fetch failed:", invitesErr);
      if (membersErr) console.error("[invite-member] list: users fetch failed:", membersErr);

      return new Response(
        JSON.stringify({ invites: invites ?? [], members: members ?? [] }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: invite
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "invite") {
      if (callerUser.org_role !== "owner") {
        return new Response(JSON.stringify({ error: "Only the organization owner can invite members." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // 1. Validate email
      const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawEmail || !emailRegex.test(rawEmail)) {
        return new Response(JSON.stringify({ error: "A valid email address is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // 2. Reject if email already belongs to a user in any org
      const { data: existingUser, error: existingUserErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", rawEmail)
        .maybeSingle();

      if (existingUserErr) {
        console.error("[invite-member] invite: users email check failed:", existingUserErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "A Junni account already exists for this email address. Ask them to log in directly." }),
          { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      // 3. Reject if a pending invite already exists for this email
      const { data: existingInvite, error: existingInviteErr } = await supabase
        .from("org_invites")
        .select("id")
        .eq("org_id", callerUser.org_id)
        .ilike("email", rawEmail)
        .eq("status", "pending")
        .maybeSingle();

      if (existingInviteErr) {
        console.error("[invite-member] invite: org_invites pending check failed:", existingInviteErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (existingInvite) {
        return new Response(
          JSON.stringify({ error: "A pending invitation already exists for this email address." }),
          { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      // 4. Seat limit enforcement
      const { data: subscription, error: subErr } = await supabase
        .from("subscriptions")
        .select("plan_key")
        .eq("org_id", callerUser.org_id)
        .in("status", ["trialing", "active", "past_due"])
        .maybeSingle();

      if (subErr) {
        console.error("[invite-member] invite: subscriptions lookup failed:", subErr);
        return new Response(JSON.stringify({ error: "Internal error checking subscription" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (!subscription) {
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "This organization does not have an active subscription." }),
          { status: 402, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const { data: planRow, error: planErr } = await supabase
        .from("billing_plans")
        .select("max_seats")
        .eq("plan_key", subscription.plan_key)
        .maybeSingle();

      if (planErr) {
        console.error("[invite-member] invite: billing_plans lookup failed:", planErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const maxSeats: number | null = planRow?.max_seats ?? null;

      if (maxSeats !== null) {
        const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
          supabase
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("org_id", callerUser.org_id),
          supabase
            .from("org_invites")
            .select("id", { count: "exact", head: true })
            .eq("org_id", callerUser.org_id)
            .eq("status", "pending"),
        ]);

        const currentTotal = (memberCount ?? 0) + (pendingCount ?? 0);
        if (currentTotal + 1 > maxSeats) {
          return new Response(
            JSON.stringify({
              error: "seat_limit",
              message: `Your plan allows up to ${maxSeats} seat${maxSeats === 1 ? "" : "s"} (${memberCount ?? 0} member${(memberCount ?? 0) === 1 ? "" : "s"} + ${pendingCount ?? 0} pending invite${(pendingCount ?? 0) === 1 ? "" : "s"}). Please upgrade your plan to invite additional members.`,
            }),
            { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
          );
        }
      }

      // 5. Insert invite row
      const { data: inviteRow, error: insertErr } = await supabase
        .from("org_invites")
        .insert({
          org_id: callerUser.org_id,
          email: rawEmail,
          invited_by: callerUser.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr || !inviteRow) {
        console.error("[invite-member] invite: org_invites insert failed:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // 6. Look up org name for email copy
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", callerUser.org_id)
        .maybeSingle();

      const orgName: string = orgRow?.name ?? "your team";
      const inviterName: string = callerUser.full_name ?? "A colleague";

      // 7. Send invite email via Resend
      let emailSent = false;
      try {
        const subject = `You've been invited to join ${orgName} on Junni`;
        const html =
          `<p>Hi,</p>` +
          `<p>${inviterName} has invited you to join <strong>${orgName}</strong> on Junni, a credit analysis platform for lending professionals.</p>` +
          `<p>To accept this invitation, sign up at the link below using this exact email address (<strong>${rawEmail}</strong>):</p>` +
          `<p><a href="https://app.junni.ca">Join ${orgName} on Junni →</a></p>` +
          `<p>Once you've created your account with this email, you'll be added to ${orgName} automatically.</p>` +
          `<p>The Junni team</p>`;

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Junni <notifications@junni.ca>", to: [rawEmail], subject, html }),
        });
        if (!resendRes.ok) {
          console.error("[invite-member] invite: email send failed for", rawEmail, ":", await resendRes.text());
        } else {
          emailSent = true;
          console.log("[invite-member] invite: email sent to", rawEmail);
        }
      } catch (emailErr: any) {
        console.error("[invite-member] invite: email threw:", emailErr.message);
      }

      return new Response(
        JSON.stringify({ invite_id: inviteRow.id, email_sent: emailSent }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: revoke
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "revoke") {
      if (callerUser.org_role !== "owner") {
        return new Response(JSON.stringify({ error: "Only the organization owner can revoke invitations." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const inviteId = typeof body.invite_id === "string" ? body.invite_id.trim() : "";
      if (!inviteId) {
        return new Response(JSON.stringify({ error: "invite_id is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const { data: revokedRows, error: revokeErr } = await supabase
        .from("org_invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)
        .eq("org_id", callerUser.org_id)
        .eq("status", "pending")
        .select("id");

      if (revokeErr) {
        console.error("[invite-member] revoke: update failed:", revokeErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (!revokedRows || revokedRows.length === 0) {
        return new Response(
          JSON.stringify({ error: "Invitation not found or is not pending." }),
          { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      console.log("[invite-member] revoke: invite", inviteId, "revoked by org", callerUser.org_id);
      return new Response(
        JSON.stringify({ revoked: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ── Unknown action ─────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ error: `Unknown action "${action}". Valid actions: invite, revoke, list.` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("[invite-member] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
