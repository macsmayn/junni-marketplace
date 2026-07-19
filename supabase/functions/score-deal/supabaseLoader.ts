// ============================================================================
// Junni — Supabase Framework Loader
// The real data-access layer behind the score engine. Implements
// FrameworkLoader.getMetricsForIndustry() against the live framework tables:
//
//   metrics                       — catalog (name, canonical tier) for a version+industry
//   metric_threshold_bands        — canonical Strong/Adequate/Weak bands per metric
//   lender_threshold_overrides    — a lender's own bands (overrides canonical)
//   lender_metric_overrides       — a lender's tier re-grade + enable/disable
//
// Resolution rules (per the locked per-lender override model):
//   tier   = lender tier override  ELSE canonical metrics.importance_tier
//   enabled= lender override "enabled" flag (default true)
//   bands  = lender threshold override ELSE canonical metric_threshold_bands
//
// Pass lenderId = null/undefined to score with pure canonical defaults
// (e.g. the SBA demo, or a deal not yet attached to a lender policy).
//
// Schema-shape note: the tables use `industry_key` and `metric_name`; the
// engine's FrameworkMetric uses `industry_id` and `name`. This loader bridges
// that mapping so the orchestrator stays schema-agnostic.
// ============================================================================

import { FrameworkLoader, FrameworkMetric } from "./scoreEngine.ts";
import { MetricTier } from "./scorer.ts";

// Minimal shape of the Supabase client method we use (keeps this file free of a
// hard dependency on a specific client version; index.ts passes the real one).
export interface SupabaseLike {
  from(table: string): any;
}

const VALID_TIERS = ["Critical", "Important", "Supplementary", "Optional"] as const;

function asTier(t: string | null | undefined, fallback: MetricTier = "Important"): MetricTier {
  return (VALID_TIERS as readonly string[]).includes(t ?? "") ? (t as MetricTier) : fallback;
}

export interface LoaderOptions {
  /** Framework version to score against. If omitted, the loader resolves the active version. */
  versionId?: string;
  /** Lender whose policy overrides apply. Omit/null → canonical defaults only. */
  lenderId?: string | null;
}

/**
 * Build a FrameworkLoader bound to a Supabase client.
 * Usage in index.ts:
 *   const loader = makeSupabaseLoader(supabase, { lenderId });
 *   const result = await runScoreEngine(ctx, loader);
 */
export function makeSupabaseLoader(
  supabase: SupabaseLike,
  opts: LoaderOptions = {}
): FrameworkLoader {
  return {
    async getMetricsForIndustry(industry_id: string): Promise<FrameworkMetric[]> {
      // 1) Resolve the framework version (explicit, else the active one).
      const versionId = opts.versionId ?? (await resolveActiveVersionId(supabase));
      if (!versionId) {
        throw new Error("No framework version available (no active version and none supplied).");
      }

      // 2) Pull the metrics for this version+industry, with their canonical bands.
      //    industry_id from the engine maps to industry_key in the schema.
      const { data: metricRows, error: mErr } = await supabase
        .from("metrics")
        .select(
          "id, metric_name, importance_tier, primary_resolution, " +
          "metric_threshold_bands ( strong, adequate, weak )"
        )
        .eq("version_id", versionId)
        .eq("industry_key", industry_id);

      if (mErr) throw new Error(`metrics query failed: ${mErr.message}`);
      if (!metricRows || metricRows.length === 0) return [];

      // 3) Load lender overrides once (threshold + tier/enable), if a lender is set.
      const thresholdOverrides = new Map<string, { strong: string | null; adequate: string | null; weak: string | null }>();
      const policyOverrides = new Map<string, { tier?: string | null; enabled?: boolean | null }>();

      if (opts.lenderId) {
        const metricIds = metricRows.map((r: any) => r.id);

        const { data: thr } = await supabase
          .from("lender_threshold_overrides")
          .select("metric_id, strong, adequate, weak")
          .eq("lender_id", opts.lenderId)
          .in("metric_id", metricIds);
        for (const o of thr ?? []) {
          thresholdOverrides.set(o.metric_id, { strong: o.strong, adequate: o.adequate, weak: o.weak });
        }

        // lender_metric_overrides is the policy-level table (tier re-grade + enable/disable).
        // Guarded: if the table isn't present yet, ignore overrides rather than fail.
        try {
          const { data: pol } = await supabase
            .from("lender_metric_overrides")
            .select("metric_id, importance_tier_override, enabled")
            .eq("lender_id", opts.lenderId)
            .in("metric_id", metricIds);
          for (const o of pol ?? []) {
            policyOverrides.set(o.metric_id, {
              tier: o.importance_tier_override,
              enabled: o.enabled,
            });
          }
        } catch {
          /* table may not exist yet — canonical tiers/enabled apply */
        }
      }

      // 4) Resolve each metric to the engine's FrameworkMetric shape.
      return metricRows.map((row: any): FrameworkMetric => {
        // metric_threshold_bands comes back as an array (1:1) or object depending on client.
        const canonBands = Array.isArray(row.metric_threshold_bands)
          ? row.metric_threshold_bands[0]
          : row.metric_threshold_bands;

        const thr = thresholdOverrides.get(row.id);
        const pol = policyOverrides.get(row.id);

        // tier: lender override else canonical
        const tier = asTier(pol?.tier ?? row.importance_tier);

        // bands: lender threshold override else canonical
        const strong = thr?.strong ?? canonBands?.strong ?? null;
        const adequate = thr?.adequate ?? canonBands?.adequate ?? null;
        const weak = thr?.weak ?? canonBands?.weak ?? null;

        // enabled: default true unless a lender explicitly disabled it
        const enabled = pol?.enabled === false ? false : true;

        return {
          metric_id: row.id,
          name: row.metric_name,
          importance_tier: tier,
          primary_resolution: row.primary_resolution ?? null,
          strong_band: strong,
          adequate_band: adequate,
          weak_band: weak,
          enabled,
        };
      });
    },
  };
}

/** Resolve the single active framework version's id. */
async function resolveActiveVersionId(supabase: SupabaseLike): Promise<string | null> {
  const { data, error } = await supabase
    .from("framework_versions")
    .select("id")
    .eq("status", "active")
    .order("activated_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].id as string;
}
