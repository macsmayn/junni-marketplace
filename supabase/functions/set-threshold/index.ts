import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Band format validator ───────────────────────────────────────────────────
// Ported from score-deal/bandParser.ts so validation and scoring agree exactly.
// Returns "qualitative" | "op" | "range" | "bare" | null (null = empty/inherit).
// "bare" (a lone number with no operator) is the only shape the engine cannot grade.
function parseBandKind(bandText: string | null | undefined): string | null {
  if (!bandText || typeof bandText !== "string") return null;
  const t = bandText.trim();
  if (!/\d/.test(t)) return "qualitative";

  const s = t
    .replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/[–—]/g, "-")
    .replace(/\([^)]*\)/g, "").replace(/%/g, "")
    .replace(/\b(days|months|day|mo|yrs?|years?|pts|bps)\b/gi, "")
    .replace(/(\d)\s*x\b/gi, "$1").trim();

  const nums = (s.match(/-?\d+\.?\d*/g) || []).map(Number);
  if (nums.length === 0) return "qualitative";

  // Range: two numbers with a dash following a digit (lookbehind prevents "-5" from matching).
  const rangeMatch = s.match(/(-?\d+\.?\d*)\s*(?<=\d)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch && nums.length >= 2) return "range";

  // Single comparison operator.
  const opMatch = s.match(/(<=|>=|<|>)\s*(-?\d+\.?\d*)/);
  if (opMatch) return "op";

  // Bare number — ambiguous; engine produces Unparseable.
  return "bare";
}

const BAND_FORMAT_MSG =
  `Accepted formats: a comparison such as "≤ 1.5x" or "> 4.0%", ` +
  `or a range such as "1.6x – 4.0x". Text with no digits (e.g. "Positive") is also accepted.`;

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
      console.error("[set-threshold] SUPABASE_SECRET_KEYS missing or 'default' entry not found");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN")!;

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
      console.error("[set-threshold] /userinfo rejected token — status:", userInfoRes.status);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userInfo = await userInfoRes.json();
    const callerSub: string = userInfo.sub;

    if (!callerSub) {
      console.error("[set-threshold] /userinfo missing sub claim");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End caller verification ────────────────────────────────────────────────

    const { data: callerUser, error: callerErr } = await supabase
      .from("users")
      .select("id, active_org_id")
      .eq("auth0_id", callerSub)
      .maybeSingle();

    if (callerErr) {
      console.error("[set-threshold] users lookup failed:", callerErr);
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
    if (!callerUser.active_org_id) {
      return new Response(JSON.stringify({ error: "Account not provisioned. Please log out and log back in." }), {
        status: 409,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const orgId: string = callerUser.active_org_id;
    const userId: string = callerUser.id;

    // ── Look up caller's role in their active org ──────────────────────────────
    const { data: callerMembership, error: membershipErr } = await supabase
      .from("organization_members")
      .select("org_role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipErr) {
      console.error("[set-threshold] organization_members lookup failed:", membershipErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const callerOrgRole: string | null = callerMembership?.org_role ?? null;
    // ── End role lookup ────────────────────────────────────────────────────────

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
      return new Response(JSON.stringify({ error: "action is required (list | set | reset)" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    // ── End parse body ─────────────────────────────────────────────────────────

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: list
    // Any member may call. Returns canonical bands + org overrides for every
    // metric in the requested industry.
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "list") {
      const industryKey = typeof body.industry_key === "string" ? body.industry_key.trim() : "";
      if (!industryKey) {
        return new Response(JSON.stringify({ error: "industry_key is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // One query for metrics + canonical bands, one for threshold overrides, one for policy overrides.
      const [
        { data: metricRows, error: mErr },
        { data: overrideRows, error: oErr },
        { data: policyRows, error: pErr },
      ] = await Promise.all([
        supabase
          .from("metrics")
          .select("id, metric_name, importance_tier, unit, metric_threshold_bands ( strong, adequate, weak, very_strong, very_weak )")
          .eq("industry_key", industryKey),
        supabase
          .from("lender_threshold_overrides")
          .select("metric_id, strong, adequate, weak, very_strong, very_weak, version")
          .eq("org_id", orgId),
        supabase
          .from("lender_metric_overrides")
          .select("metric_id, importance_tier_override, enabled")
          .eq("org_id", orgId),
      ]);

      if (mErr) {
        console.error("[set-threshold] list: metrics query failed:", mErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (oErr) {
        console.error("[set-threshold] list: lender_threshold_overrides query failed:", oErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (pErr) {
        console.error("[set-threshold] list: lender_metric_overrides query failed:", pErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Index overrides by metric_id for O(1) join.
      const overrideByMetricId = new Map<string, any>();
      for (const o of overrideRows ?? []) {
        overrideByMetricId.set(o.metric_id, o);
      }
      const policyByMetricId = new Map<string, any>();
      for (const p of policyRows ?? []) {
        policyByMetricId.set(p.metric_id, p);
      }

      const metrics = (metricRows ?? []).map((m: any) => {
        const canon = Array.isArray(m.metric_threshold_bands)
          ? m.metric_threshold_bands[0]
          : m.metric_threshold_bands;
        const override = overrideByMetricId.get(m.id) ?? null;
        const policy   = policyByMetricId.get(m.id)   ?? null;
        return {
          metric_id:                m.id,
          metric_name:              m.metric_name,
          importance_tier:          m.importance_tier,
          importance_tier_override: policy?.importance_tier_override ?? null,
          enabled:                  policy?.enabled ?? true,
          unit:                     m.unit ?? null,
          canonical: {
            strong:      canon?.strong      ?? null,
            adequate:    canon?.adequate    ?? null,
            weak:        canon?.weak        ?? null,
            very_strong: canon?.very_strong ?? null,
            very_weak:   canon?.very_weak   ?? null,
          },
          override: override ? {
            strong:      override.strong      ?? null,
            adequate:    override.adequate    ?? null,
            weak:        override.weak        ?? null,
            very_strong: override.very_strong ?? null,
            very_weak:   override.very_weak   ?? null,
            version:     override.version,
          } : null,
        };
      });

      return new Response(
        JSON.stringify({ metrics }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: set
    // OWNER or CREDIT_ADMIN only. Upserts threshold override and writes log.
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "set") {
      if (callerOrgRole !== "owner" && callerOrgRole !== "credit_admin") {
        return new Response(JSON.stringify({ error: "Only an owner or credit admin can set threshold overrides." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const metricId = typeof body.metric_id === "string" ? body.metric_id.trim() : "";
      if (!metricId) {
        return new Response(JSON.stringify({ error: "metric_id is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // reason is required and must be at least 10 characters.
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10) {
        return new Response(JSON.stringify({
          error: "A written justification is required and is kept permanently. Please provide at least 10 characters.",
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Normalise band values: blank string → null (inherit canonical).
      const newStrong   = typeof body.strong   === "string" && body.strong.trim()   ? body.strong.trim()   : null;
      const newAdequate = typeof body.adequate  === "string" && body.adequate.trim() ? body.adequate.trim() : null;
      const newWeak     = typeof body.weak      === "string" && body.weak.trim()     ? body.weak.trim()     : null;

      if (newStrong === null && newAdequate === null && newWeak === null) {
        return new Response(JSON.stringify({ error: "At least one of strong, adequate, or weak must be provided." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Validate band format: the engine cannot grade bare numbers (no operator, no range).
      // Port of parseBandValue from score-deal/bandParser.ts — must stay in sync.
      for (const [label, val] of [["strong", newStrong], ["adequate", newAdequate], ["weak", newWeak]] as [string, string | null][]) {
        if (val !== null && parseBandKind(val) === "bare") {
          return new Response(JSON.stringify({
            error: `'${label}' band "${val}" cannot be parsed by the scoring engine. ${BAND_FORMAT_MSG}`,
          }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
      }

      // Read the existing override (if any) to capture old values for the log,
      // and to determine the next version number.
      const { data: existingOverride, error: existingErr } = await supabase
        .from("lender_threshold_overrides")
        .select("strong, adequate, weak, version")
        .eq("org_id", orgId)
        .eq("metric_id", metricId)
        .maybeSingle();

      if (existingErr) {
        console.error("[set-threshold] set: existing override lookup failed:", existingErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // If no existing override, read canonical bands for the log's old_* fields.
      let oldStrong:   string | null = null;
      let oldAdequate: string | null = null;
      let oldWeak:     string | null = null;

      if (existingOverride) {
        oldStrong   = existingOverride.strong   ?? null;
        oldAdequate = existingOverride.adequate ?? null;
        oldWeak     = existingOverride.weak     ?? null;
      } else {
        const { data: canonRow, error: canonErr } = await supabase
          .from("metric_threshold_bands")
          .select("strong, adequate, weak")
          .eq("metric_id", metricId)
          .maybeSingle();
        if (canonErr) {
          console.error("[set-threshold] set: canonical bands lookup failed:", canonErr);
          return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        oldStrong   = canonRow?.strong   ?? null;
        oldAdequate = canonRow?.adequate ?? null;
        oldWeak     = canonRow?.weak     ?? null;
      }

      const nextVersion = (existingOverride?.version ?? 0) + 1;

      // Upsert the override row.
      const { error: upsertErr } = await supabase
        .from("lender_threshold_overrides")
        .upsert(
          {
            org_id:     orgId,
            metric_id:  metricId,
            strong:     newStrong,
            adequate:   newAdequate,
            weak:       newWeak,
            version:    nextVersion,
            created_by: userId,
          },
          { onConflict: "org_id,metric_id" }
        );

      if (upsertErr) {
        console.error("[set-threshold] set: upsert failed:", upsertErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Write the audit log only after the override succeeded.
      const { error: logErr } = await supabase
        .from("threshold_override_log")
        .insert({
          org_id:       orgId,
          metric_id:    metricId,
          old_strong:   oldStrong,
          old_adequate: oldAdequate,
          old_weak:     oldWeak,
          new_strong:   newStrong,
          new_adequate: newAdequate,
          new_weak:     newWeak,
          changed_by:   userId,
          changed_at:   new Date().toISOString(),
          reason,
        });

      if (logErr) {
        console.error(`[set-threshold] set: audit log insert failed for org ${orgId} metric ${metricId}:`, logErr);
        // Roll back: restore the previous state before returning 500.
        if (existingOverride) {
          await supabase.from("lender_threshold_overrides").upsert(
            {
              org_id:     orgId,
              metric_id:  metricId,
              strong:     existingOverride.strong     ?? null,
              adequate:   existingOverride.adequate   ?? null,
              weak:       existingOverride.weak       ?? null,
              version:    existingOverride.version,
              created_by: userId,
            },
            { onConflict: "org_id,metric_id" }
          );
        } else {
          await supabase.from("lender_threshold_overrides").delete()
            .eq("org_id", orgId).eq("metric_id", metricId);
        }
        return new Response(
          JSON.stringify({ error: "The change could not be recorded and was not applied." }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      console.log(`[set-threshold] set: metric ${metricId} → v${nextVersion} for org ${orgId} by user ${userId}`);
      return new Response(
        JSON.stringify({ updated: true, version: nextVersion }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: reset
    // OWNER or CREDIT_ADMIN only. Deletes the override and writes log.
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "reset") {
      if (callerOrgRole !== "owner" && callerOrgRole !== "credit_admin") {
        return new Response(JSON.stringify({ error: "Only an owner or credit admin can reset threshold overrides." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const metricId = typeof body.metric_id === "string" ? body.metric_id.trim() : "";
      if (!metricId) {
        return new Response(JSON.stringify({ error: "metric_id is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10) {
        return new Response(JSON.stringify({
          error: "A written justification is required and is kept permanently. Please provide at least 10 characters.",
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Read the existing override before deleting so we can log the old values.
      const { data: existingOverride, error: existingErr } = await supabase
        .from("lender_threshold_overrides")
        .select("strong, adequate, weak")
        .eq("org_id", orgId)
        .eq("metric_id", metricId)
        .maybeSingle();

      if (existingErr) {
        console.error("[set-threshold] reset: existing override lookup failed:", existingErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (!existingOverride) {
        // Nothing to delete — return reset: false without touching the log.
        return new Response(
          JSON.stringify({ reset: false }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      // Delete the override row.
      const { error: deleteErr } = await supabase
        .from("lender_threshold_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("metric_id", metricId);

      if (deleteErr) {
        console.error("[set-threshold] reset: delete failed:", deleteErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Write the audit log only after the delete succeeded.
      const { error: logErr } = await supabase
        .from("threshold_override_log")
        .insert({
          org_id:       orgId,
          metric_id:    metricId,
          old_strong:   existingOverride.strong   ?? null,
          old_adequate: existingOverride.adequate ?? null,
          old_weak:     existingOverride.weak     ?? null,
          new_strong:   null,
          new_adequate: null,
          new_weak:     null,
          changed_by:   userId,
          changed_at:   new Date().toISOString(),
          reason,
        });

      if (logErr) {
        console.error(`[set-threshold] reset: audit log insert failed for org ${orgId} metric ${metricId}:`, logErr);
        // Roll back: re-insert the override row that was just deleted.
        await supabase.from("lender_threshold_overrides").insert({
          org_id:     orgId,
          metric_id:  metricId,
          strong:     existingOverride.strong     ?? null,
          adequate:   existingOverride.adequate   ?? null,
          weak:       existingOverride.weak       ?? null,
          created_by: userId,
        });
        return new Response(
          JSON.stringify({ error: "The change could not be recorded and was not applied." }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      console.log(`[set-threshold] reset: metric ${metricId} removed for org ${orgId} by user ${userId}`);
      return new Response(
        JSON.stringify({ reset: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: set_metric
    // OWNER or CREDIT_ADMIN only. Upserts a lender_metric_overrides row
    // (tier re-grade + enable/disable) and writes to metric_override_log.
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "set_metric") {
      if (callerOrgRole !== "owner" && callerOrgRole !== "credit_admin") {
        return new Response(JSON.stringify({ error: "Only an owner or credit admin can set metric policy overrides." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const metricId = typeof body.metric_id === "string" ? body.metric_id.trim() : "";
      if (!metricId) {
        return new Response(JSON.stringify({ error: "metric_id is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10) {
        return new Response(JSON.stringify({
          error: "A written justification is required and is kept permanently. Please provide at least 10 characters.",
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // tier: null/undefined → inherit canonical; valid string → override.
      let newTier: string | null;
      if (body.tier === null || body.tier === undefined) {
        newTier = null;
      } else if (
        typeof body.tier === "string" &&
        ["Critical", "Important", "Supplementary", "Optional"].includes(body.tier.trim())
      ) {
        newTier = body.tier.trim();
      } else {
        return new Response(JSON.stringify({
          error: "'tier' must be one of 'Critical', 'Important', 'Supplementary', 'Optional', or null.",
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (typeof body.enabled !== "boolean") {
        return new Response(JSON.stringify({ error: "'enabled' must be a boolean." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const newEnabled: boolean = body.enabled as boolean;

      // Read existing override to capture old values for the log and the next version.
      const { data: existingOverride, error: existingErr } = await supabase
        .from("lender_metric_overrides")
        .select("importance_tier_override, enabled, version")
        .eq("org_id", orgId)
        .eq("metric_id", metricId)
        .maybeSingle();

      if (existingErr) {
        console.error("[set-threshold] set_metric: existing override lookup failed:", existingErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // No existing row → read canonical tier from metrics for the log's old_tier.
      let oldTier: string | null = null;
      let oldEnabled: boolean = true;

      if (existingOverride) {
        oldTier    = existingOverride.importance_tier_override ?? null;
        oldEnabled = existingOverride.enabled;
      } else {
        const { data: canonRow, error: canonErr } = await supabase
          .from("metrics")
          .select("importance_tier")
          .eq("id", metricId)
          .maybeSingle();
        if (canonErr) {
          console.error("[set-threshold] set_metric: canonical tier lookup failed:", canonErr);
          return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        oldTier    = canonRow?.importance_tier ?? null;
        oldEnabled = true;
      }

      const nextVersion = (existingOverride?.version ?? 0) + 1;

      // Upsert the policy override row.
      const { error: upsertErr } = await supabase
        .from("lender_metric_overrides")
        .upsert(
          {
            org_id:                   orgId,
            metric_id:                metricId,
            importance_tier_override: newTier,
            enabled:                  newEnabled,
            version:                  nextVersion,
            created_by:               userId,
          },
          { onConflict: "org_id,metric_id" }
        );

      if (upsertErr) {
        console.error("[set-threshold] set_metric: upsert failed:", upsertErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Write the audit log only after the upsert succeeded.
      const { error: logErr } = await supabase
        .from("metric_override_log")
        .insert({
          org_id:      orgId,
          metric_id:   metricId,
          old_tier:    oldTier,
          new_tier:    newTier,
          old_enabled: oldEnabled,
          new_enabled: newEnabled,
          changed_by:  userId,
          changed_at:  new Date().toISOString(),
          reason,
        });

      if (logErr) {
        console.error(`[set-threshold] set_metric: audit log insert failed for org ${orgId} metric ${metricId}:`, logErr);
        // Roll back: restore the previous state.
        if (existingOverride) {
          await supabase.from("lender_metric_overrides").upsert(
            {
              org_id:                   orgId,
              metric_id:                metricId,
              importance_tier_override: existingOverride.importance_tier_override ?? null,
              enabled:                  existingOverride.enabled,
              version:                  existingOverride.version,
              created_by:               userId,
            },
            { onConflict: "org_id,metric_id" }
          );
        } else {
          await supabase.from("lender_metric_overrides").delete()
            .eq("org_id", orgId).eq("metric_id", metricId);
        }
        return new Response(
          JSON.stringify({ error: "The change could not be recorded and was not applied." }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      console.log(`[set-threshold] set_metric: metric ${metricId} → tier=${newTier} enabled=${newEnabled} v${nextVersion} for org ${orgId} by user ${userId}`);
      return new Response(
        JSON.stringify({ updated: true, version: nextVersion }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: reset_metric
    // OWNER or CREDIT_ADMIN only. Deletes the policy override row and logs.
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "reset_metric") {
      if (callerOrgRole !== "owner" && callerOrgRole !== "credit_admin") {
        return new Response(JSON.stringify({ error: "Only an owner or credit admin can reset metric policy overrides." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const metricId = typeof body.metric_id === "string" ? body.metric_id.trim() : "";
      if (!metricId) {
        return new Response(JSON.stringify({ error: "metric_id is required." }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10) {
        return new Response(JSON.stringify({
          error: "A written justification is required and is kept permanently. Please provide at least 10 characters.",
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Read existing override before deleting so we can log the old values.
      const { data: existingOverride, error: existingErr } = await supabase
        .from("lender_metric_overrides")
        .select("importance_tier_override, enabled")
        .eq("org_id", orgId)
        .eq("metric_id", metricId)
        .maybeSingle();

      if (existingErr) {
        console.error("[set-threshold] reset_metric: existing override lookup failed:", existingErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (!existingOverride) {
        // Nothing to delete — return reset: false without touching the log.
        return new Response(
          JSON.stringify({ reset: false }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      // Delete the override row.
      const { error: deleteErr } = await supabase
        .from("lender_metric_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("metric_id", metricId);

      if (deleteErr) {
        console.error("[set-threshold] reset_metric: delete failed:", deleteErr);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Write the audit log only after the delete succeeded.
      // new_tier = null and new_enabled = true represent the canonical (unoverridden) state.
      const { error: logErr } = await supabase
        .from("metric_override_log")
        .insert({
          org_id:      orgId,
          metric_id:   metricId,
          old_tier:    existingOverride.importance_tier_override ?? null,
          new_tier:    null,
          old_enabled: existingOverride.enabled,
          new_enabled: true,
          changed_by:  userId,
          changed_at:  new Date().toISOString(),
          reason,
        });

      if (logErr) {
        console.error(`[set-threshold] reset_metric: audit log insert failed for org ${orgId} metric ${metricId}:`, logErr);
        // Roll back: re-insert the deleted row.
        await supabase.from("lender_metric_overrides").insert({
          org_id:                   orgId,
          metric_id:                metricId,
          importance_tier_override: existingOverride.importance_tier_override ?? null,
          enabled:                  existingOverride.enabled,
          created_by:               userId,
        });
        return new Response(
          JSON.stringify({ error: "The change could not be recorded and was not applied." }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      console.log(`[set-threshold] reset_metric: metric ${metricId} removed for org ${orgId} by user ${userId}`);
      return new Response(
        JSON.stringify({ reset: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ── Unknown action ─────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ error: `Unknown action "${action}". Valid actions: list, set, reset, set_metric, reset_metric.` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("[set-threshold] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
