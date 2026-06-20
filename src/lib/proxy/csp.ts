/**
 * Build the Content-Security-Policy header value.
 *
 * DELIBERATE DESIGN: `'unsafe-inline'` in script-src is intentional for PPR
 * compatibility. Nonces would require dynamic rendering on CSP-sensitive
 * routes, conflicting with cacheComponents/PPR static shells.
 *
 * Primary XSS defense is enforced by output sanitization in the markdown
 * renderers:
 * - src/components/immersive/voice-chat/chat-markdown.tsx — safe-link
 *   allowlist and no raw HTML passthrough
 * - src/components/admin/agents-dashboard/safe-markdown.tsx — no raw HTML
 *   or link rendering
 *
 * See docs/project/markdown-render-sinks.md for the full registry. New
 * markdown renderers must be added there and covered by e2e/xss-canary.spec.ts.
 *
 * Stripe's hosted SDK is trusted by origin, not SRI hash: Stripe updates
 * https://js.stripe.com/v3 in place and does not publish stable integrity
 * hashes for it.
 */
type BuildCspHeaderOptions = {
  nodeEnv?: NodeJS.ProcessEnv["NODE_ENV"];
};

export function buildCspHeader({ nodeEnv = process.env.NODE_ENV }: BuildCspHeaderOptions = {}): string {
  // SE-L2: 'unsafe-inline' is intentional for PPR compatibility (see file header).
  // Compensating controls that MUST remain active CI gates to justify this trade-off:
  //   1. XSS canary — e2e/xss-canary.spec.ts verifies injected <script> and
  //      onerror attributes are stripped before reaching the DOM. This runs in
  //      the default `desktop` and `mobile` Playwright projects on every push.
  //   2. Render-sink registry — docs/project/markdown-render-sinks.md enumerates
  //      every component authorised to render markdown. New renderers MUST be
  //      added to the registry AND covered by xss-canary before merging.
  //   3. No raw HTML passthrough — chat-markdown.tsx and safe-markdown.tsx use
  //      allowlisted safe-link renderers with no dangerouslySetInnerHTML.
  // DO NOT remove 'unsafe-inline' without first re-enabling nonces in the root
  // layout (which forces the layout dynamic and breaks PPR static shells).
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
    nodeEnv === "development" ? "'unsafe-eval'" : null,
    "blob:",
    "https://js.stripe.com",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    scriptSrc,
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
