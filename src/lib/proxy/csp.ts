import crypto from "crypto";

/**
 * Generate a CSP nonce for per-request script authorization.
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Build the Content-Security-Policy header value.
 *
 * Notes:
 * - 'strict-dynamic' is intentionally NOT used — PPR (cacheComponents)
 *   prebuilds HTML at build time without nonces. In CSP Level 3,
 *   'strict-dynamic' overrides 'self', blocking all scripts when nonces
 *   aren't in the HTML.
 * - blob: is required in script-src for ElevenLabs AudioWorklet processor.
 * - https://js.stripe.com is explicitly listed for Stripe checkout.
 */
export function buildCspHeader(_nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
