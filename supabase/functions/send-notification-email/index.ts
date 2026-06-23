import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const record = body.record;

    if (!record?.user_id || !record?.title || !record?.message || !record?.id) {
      console.error("[send-notification-email] Missing required fields in record:", record);
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up the user's email
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("id", record.user_id)
      .single();

    if (userError || !userData?.email) {
      console.log(`[send-notification-email] No email found for user ${record.user_id} — skipping send.`);
      return new Response(JSON.stringify({ skipped: "no email" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userEmail = userData.email;

    // Build HTML body
    const linkHtml = record.link
      ? `<p><a href="https://junni-marketplace.netlify.app${record.link}">View</a></p>`
      : "";
    const html = `<p>${record.message}</p>${linkHtml}`;

    // Send via Resend REST API
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Junni <onboarding@resend.dev>",
        to: [userEmail],
        subject: record.title,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error(`[send-notification-email] Resend error for notification ${record.id}:`, errText);
      return new Response(JSON.stringify({ error: "Email send failed", detail: errText }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-notification-email] Email sent to ${userEmail} for notification ${record.id}.`);

    // Mark notification as email_sent
    const { error: updateErr } = await supabase
      .from("notifications")
      .update({ email_sent: true })
      .eq("id", record.id);

    if (updateErr) {
      console.error(`[send-notification-email] Failed to mark email_sent for notification ${record.id}:`, updateErr);
    }

    return new Response(JSON.stringify({ sent: true, to: userEmail }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[send-notification-email] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
