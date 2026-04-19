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

/** Supabase project URL (public, trimmed) */
export const getSupabaseUrl = () => getEnv("NEXT_PUBLIC_SUPABASE_URL");

/** Supabase anonymous key (public, trimmed) */
export const getSupabaseAnonKey = () => getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/** Stripe secret key (server-only, trimmed) */
export const getStripeSecretKey = () => getEnv("STRIPE_SECRET_KEY");

/** Stripe day-pass price ID (server-only, trimmed) */
export const getStripeDayPassPriceId = () => getEnv("STRIPE_DAY_PASS_PRICE_ID");

/** Stripe webhook secret (server-only, trimmed) */
export const getStripeWebhookSecret = () => getEnv("STRIPE_WEBHOOK_SECRET");

/** Site URL (public, trimmed) */
export const getSiteUrl = () => getEnv("NEXT_PUBLIC_SITE_URL");

/** PostHog API key (public, trimmed) */
export const getPostHogKey = () => getEnv("NEXT_PUBLIC_POSTHOG_KEY");

/** PostHog host (public, trimmed) */
export const getPostHogHost = () =>
  getEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
