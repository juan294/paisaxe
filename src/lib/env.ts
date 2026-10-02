/**
 * Centralized environment variable layer.
 *
 * All env var reads go through this module to ensure:
 * - Consistent .trim() hygiene (Vercel CLI may add invisible whitespace)
 * - Presence validation with helpful error messages
 * - A single choke-point for configuration debugging
 *
 * See: https://github.com/juan294/paisaxe/issues/289
 *
 * ─── SECURITY BOUNDARY ────────────────────────────────────────────────────────
 * This file is imported by client components (e.g. auth-provider.tsx) for the
 * NEXT_PUBLIC_* getters, so it CANNOT carry `import "server-only"` at the top.
 *
 * The getters marked "server-only" below (Supabase service keys, Stripe secret
 * keys) must NEVER be called from client-side code. They are safe here because:
 *   1. `process.env[key]` is a Node.js runtime lookup — the browser polyfill
 *      always returns `undefined`, so no secret is inlined into the bundle.
 *   2. The module that USES these secrets (supabase-admin.ts, stripe.ts, etc.)
 *      carries `import "server-only"`, which enforces the boundary at the
 *      call-site level. A client bundle that somehow reached those modules
 *      would fail the Next.js build before shipping.
 *
 * If you add a new getter for a secret (non-NEXT_PUBLIC_) env var, mark it
 * "server-only" in its JSDoc and ensure it is only consumed by server-guarded
 * modules.
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Read an environment variable, trimming whitespace.
 * Returns undefined if not set or empty after trimming.
 */
export function getEnv(key: string): string | undefined;
export function getEnv(key: string, defaultValue: string): string;
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key]?.trim();
  if (!value) return defaultValue;
  return value;
}

/**
 * Read a required environment variable, trimming whitespace.
 * Throws a clear error if the variable is missing or empty.
 */
export function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// ─── Typed constants ────────────────────────────────────────────────────────
// These are lazy getters rather than module-level constants so they don't
// throw at import time — callers that don't use Supabase/Stripe shouldn't
// crash. Use requireEnv() inside functions that truly need the value at
// call-time, or reference these helpers directly.
//
// IMPORTANT (#556): NEXT_PUBLIC_* getters MUST use literal property access
// (`process.env` followed by the variable name), not the dynamic
// `getEnv("...")` helper. Next.js / Turbopack only inlines NEXT_PUBLIC vars
// into the client bundle when accessed by literal name — `process.env[key]`
// is left as a runtime lookup against the empty
// browser polyfill, returning undefined and silently breaking client features
// (e.g. the Supabase browser client falls back to null and sign-in becomes
// a dead button). Server-only vars can use either form because Node has a
// real `process.env`.

/** Supabase project URL (public, trimmed). */
export const getSupabaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;

/** Supabase anonymous key (public, trimmed). */
export const getSupabaseAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;

/**
 * Supabase service-role key (server-only, trimmed).
 *
 * AR-L3 (#865): this was previously resolved via
 * `getSupabaseServiceRoleKey() ?? getSupabaseServiceKey()` across two
 * differently-named env vars for the same credential. `vercel env ls`
 * against production and preview, plus the local `.env.local`, confirmed
 * only `SUPABASE_SERVICE_KEY` is actually ever set anywhere — the
 * `SUPABASE_SERVICE_ROLE_KEY` accessor had no live value in any real
 * environment, so the `??` fallback was silently doing all the work. The
 * dead accessor and the fallback are removed; a misconfigured deployment
 * now fails loudly (createAdminClient throws) instead of silently
 * resolving through an unused name.
 */
export const getSupabaseServiceKey = () => getEnv("SUPABASE_SERVICE_KEY");

/** Stripe secret key (server-only, trimmed) */
export const getStripeSecretKey = () => getEnv("STRIPE_SECRET_KEY");

/** Stripe day-pass price ID (server-only, trimmed) */
export const getStripeDayPassPriceId = () => getEnv("STRIPE_DAY_PASS_PRICE_ID");

/** Stripe weekly-pass price ID (server-only, trimmed) — #137 */
export const getStripeWeeklyPassPriceId = () => getEnv("STRIPE_WEEKLY_PRICE_ID");

/** Stripe monthly-pass price ID (server-only, trimmed) — #137 */
export const getStripeMonthlyPassPriceId = () => getEnv("STRIPE_MONTHLY_PRICE_ID");

/** Stripe webhook secret (server-only, trimmed) */
export const getStripeWebhookSecret = () => getEnv("STRIPE_WEBHOOK_SECRET");

/** Site URL (public, trimmed). */
export const getSiteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined;

/** PostHog API key (public, trimmed). */
export const getPostHogKey = () =>
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || undefined;

/** PostHog host (public, trimmed). */
export const getPostHogHost = () =>
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";
