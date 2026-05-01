/**
 * Centralized environment variable layer.
 *
 * All env var reads go through this module to ensure:
 * - Consistent .trim() hygiene (Vercel CLI may add invisible whitespace)
 * - Presence validation with helpful error messages
 * - A single choke-point for configuration debugging
 *
 * See: https://github.com/juanmgonzalez/paisaxe/issues/289 (AR-M1)
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
// IMPORTANT (#556): NEXT_PUBLIC_* getters MUST use static `process.env.NAME`
// access, not the dynamic `getEnv("NAME")` helper. Next.js / Turbopack only
// inlines NEXT_PUBLIC vars into the client bundle when accessed by literal
// name — `process.env[key]` is left as a runtime lookup against the empty
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

/** Supabase service role key (server-only, trimmed) */
export const getSupabaseServiceRoleKey = () => getEnv("SUPABASE_SERVICE_ROLE_KEY");

/** Legacy Supabase service key (server-only, trimmed) */
export const getSupabaseServiceKey = () => getEnv("SUPABASE_SERVICE_KEY");

/** Stripe secret key (server-only, trimmed) */
export const getStripeSecretKey = () => getEnv("STRIPE_SECRET_KEY");

/** Stripe day-pass price ID (server-only, trimmed) */
export const getStripeDayPassPriceId = () => getEnv("STRIPE_DAY_PASS_PRICE_ID");

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
