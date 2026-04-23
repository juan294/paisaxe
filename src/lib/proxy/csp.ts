/**
 * Build the Content-Security-Policy header value.
 *
 * DELIBERATE DESIGN: `'unsafe-inline'` in script-src is intentional for PPR
 * compatibility. Nonces would require dynamic rendering on CSP-sensitive
 * routes, conflicting with cacheComponents/PPR static shells.
 *
 * Primary XSS defense is enforced by output sanitization in the react-markdown
 * configuration:
 * - src/components/immersive/voice-chat.tsx — explicit components overrides
 *   and no raw HTML passthrough
 * - src/components/admin/agents-dashboard/safe-markdown.tsx — allowedElements
 *   allowlist with unwrapDisallowed
 *
 * See docs/project/markdown-render-sinks.md for the full registry. New
 * markdown renderers must be added there and covered by e2e/xss-canary.spec.ts.
 *
 * Stripe's hosted SDK is trusted by origin, not SRI hash: Stripe updates
 * https://js.stripe.com/v3 in place and does not publish stable integrity
 * hashes for it.
 */
export function buildCspHeader(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io wss://api.us.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
