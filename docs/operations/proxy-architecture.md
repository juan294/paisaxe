# Proxy Architecture

Paisaxe uses `src/proxy.ts` — the Next.js 16 replacement for `middleware.ts`. The two cannot coexist; creating a `middleware.ts` will break the build.

All request interception logic lives in `proxy.ts` and the `src/lib/proxy/` module directory.

## Middleware Chain Order

Requests flow through these layers in sequence:

```
Request
  │
  ▼
1. Canonical domain redirect
   src/lib/proxy/maintenance.ts — redirects paisaxe.com → paisaxe.es
   │
  ▼
2. Maintenance mode
   src/lib/proxy/maintenance.ts — serves maintenance page if flag enabled
   │
  ▼
3. CORS
   src/lib/proxy/cors.ts — sets Access-Control-Allow-* headers for /api/*
   │
  ▼
4. CSP
   src/lib/proxy/csp.ts — sets Content-Security-Policy header
   │
  ▼
5. CSRF protection
   src/lib/proxy/csrf-proxy.ts — double-submit cookie validation for
   state-mutating requests (POST/PUT/PATCH/DELETE to /api/*)
   │
  ▼
6. Auth session refresh
   src/lib/proxy/auth-refresh.ts — calls Supabase getUser() to keep
   session cookies fresh without requiring an explicit refresh endpoint
   │
  ▼
7. Request correlation ID
   src/lib/proxy/request-id.ts — generates x-request-id, propagates
   to response headers and request context
   │
  ▼
8. Story URL rewrite
   src/proxy.ts — /story/[slug] → /immersive?story=[slug] for SEO URLs
   │
  ▼
Route Handler / Page
```

## Key Files

| File | Responsibility |
|------|----------------|
| `src/proxy.ts` | Entry point — orchestrates all middleware modules |
| `src/lib/proxy/auth-refresh.ts` | Supabase session refresh |
| `src/lib/proxy/cors.ts` | CORS headers for API routes |
| `src/lib/proxy/csp.ts` | Content-Security-Policy header |
| `src/lib/proxy/csrf-proxy.ts` | CSRF double-submit cookie enforcement |
| `src/lib/proxy/maintenance.ts` | Maintenance mode + domain redirect |
| `src/lib/proxy/request-id.ts` | Correlation ID generation and propagation |
| `src/lib/csrf.ts` | Server-side CSRF token generation |
| `src/lib/csrf-client.ts` | Client-side CSRF token fetch + header injection |
| `src/lib/request-context.ts` | AsyncLocalStorage context for request ID access in handlers |

## CSP Policy

The current CSP is PPR-compatible (no nonces):

```
script-src 'self' 'unsafe-inline' blob: https://js.stripe.com
```

- `'unsafe-inline'` is required for Next.js hydration inline scripts
- `'self'` covers same-origin scripts loaded by Next.js
- Nonce-based CSP is **incompatible with PPR** (`cacheComponents`) — prerendered HTML is built without nonces at build time

The E2E canary test (`e2e/xss-canary.spec.ts`) verifies JavaScript executes correctly. If CSP ever blocks scripts, this test fails immediately.

## CSRF Protection

All state-mutating API requests (`POST`, `PUT`, `PATCH`, `DELETE` to `/api/*`) require a valid CSRF token via the double-submit cookie pattern:

1. Client fetches a token from `/api/csrf` (or reads it from the `csrf-token` cookie)
2. Client includes the token in the `X-CSRF-Token` request header
3. `csrf-proxy.ts` validates the header matches the cookie value

Public webhooks (`/api/webhooks/*`) and cron routes (`/api/cron/*`) are exempt — they use their own signature verification.

## Request Correlation IDs

Every request gets a unique `x-request-id` UUID. It is:

- Set in the response `x-request-id` header (visible in browser devtools)
- Stored in `AsyncLocalStorage` via `src/lib/request-context.ts` for access anywhere in a handler without prop-drilling
- Included in every structured log line via the Pino logger
- Forwarded to Sentry as a tag for log correlation

## Migration Note

This project migrated from `middleware.ts` to `proxy.ts` when upgrading to Next.js 16. The patterns are similar but not identical — see the [Next.js 16 proxy docs](https://nextjs.org/) for differences. Never add a `middleware.ts` file to this project.
