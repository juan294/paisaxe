# Phase 3 — Logging + Sentry PII Hardening

**Scope:** Close the PII leak surface across the shared logger, Sentry, and the 139 `console.*` callsites in `src/app/api/**`. Hybrid Option 3: install a process-wide console shim for immediate safety, migrate the top-10 highest-PII callsites to structured logger calls, add an ESLint rule to block new `console.*` in `src/app/api/**`.

**Addresses:** §3.4 (High), partial §9#2 (foundation for correlation IDs in P8).

**Batch eligibility:** `[batch-eligible]` — depends only on P1.

---

## Current State (verified 2026-04-20)

`src/lib/logger.ts` (49 LoC):
- Named export `logger` with `info` / `warn` / `error` methods, each `(msg: string, meta?: Record<string, unknown>)`.
- Prod: `pino({ level: "info" })`, no `redact` config.
- Dev/test: bypasses console, writes JSON via `process.stdout.write(entry)`.
- No console interception.

Sentry configs (all three): no `beforeSend`, no `beforeBreadcrumb`.
- `sentry.client.config.ts` (14 LoC)
- `sentry.server.config.ts` (11 LoC)
- `sentry.edge.config.ts` (10 LoC)

139 `console.*` matches in `src/app/api/**` across 42 files. Top 10 by count:

| count | file |
|---|---|
| 11 | `src/app/api/webhooks/elevenlabs/route.ts` |
| 9 | `src/app/api/admin/marketing/accounts/route.ts` |
| 8 | `src/app/api/webhooks/stripe/route.ts` |
| 8 | `src/app/api/admin/marketing/schedule/route.ts` |
| 7 | `src/app/api/mcp/make-booking/route.ts` |
| 6 | `src/app/api/admin/stories/route.ts` |
| 5 | `src/app/api/webhooks/translate/route.ts` |
| 5 | `src/app/api/admin/costs-analytics/route.ts` |
| 5 | `src/app/api/admin/marketing/posts/route.ts` |
| 4 | `src/app/api/cron/github-traffic-sync/route.ts` |

## Target State

1. Pino `redact` config covering emails, phones, tokens, Stripe identifiers, Supabase payloads.
2. Sentry `beforeSend` in all three configs: strip `event.request.cookies`, `event.request.data`, redact headers, hash `event.user.email`.
3. Process-wide `console` shim installed via Next.js `instrumentation.ts` that routes `console.error/warn/info` through Pino. This means *any* current or future `console.*` callsite (outside of intentional CLI scripts) is automatically redacted.
4. Top-10 callsites migrated to structured logger calls (`logger.error("[TAG]", { ...fields })`) — this unlocks structured search in Vercel logs.
5. ESLint `no-restricted-syntax` rule forbidding `console.*` in `src/app/api/**` (new code).

## Implementation Steps

### Step 3.1 — Red: redact + beforeSend tests

`src/lib/logger.test.ts` (new):

```ts
// Pseudocode
it("redacts email/phone/token/user_id in structured metadata", () => {
  const spy = captureStdout();
  logger.error("failure", { email: "x@y.z", phone: "+34...", token: "sk_...", user_id: "u-1" });
  const out = spy.text();
  expect(out).not.toContain("x@y.z");
  expect(out).toContain("[REDACTED]");
});

it("redacts deeply nested paths (req.headers.cookie)", () => {
  const spy = captureStdout();
  logger.info("req", { req: { headers: { cookie: "sb-access=abc" } } });
  expect(spy.text()).not.toContain("sb-access=abc");
});
```

`sentry.server.test.ts` (new) — verify beforeSend behavior with a synthetic event; assert `event.request.cookies === undefined` and `event.user.email` is hashed.

### Step 3.2 — Green: Pino redact

Update `src/lib/logger.ts`:

```ts
// Pseudocode — production branch
const pinoLogger = pino({
  level: "info",
  redact: {
    paths: [
      "*.email", "*.phone", "*.token", "*.authorization",
      "*.cookie", "*.password", "*.api_key", "*.apiKey",
      "*.stripe_customer_id", "*.payment_provider_id", "*.user_id",
      "*.session_token",
      "req.headers.cookie", "req.headers.authorization",
      "*.req.headers.cookie", "*.req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
```

Also update the dev/test branch: apply the same redaction manually (traverse `meta` object before `process.stdout.write`), or switch dev/test to use Pino with a pretty transport so the single redact config covers all envs. Simpler: use Pino everywhere, drop the `process.stdout.write` custom sink.

### Step 3.3 — Green: Sentry beforeSend in all three configs

Pseudocode identical across `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (extract to `src/lib/sentry-before-send.ts` to avoid drift):

```ts
// src/lib/sentry-before-send.ts
export function sanitizeSentryEvent(event) {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      for (const key of ["cookie", "authorization", "x-api-key"]) {
        if (event.request.headers[key]) event.request.headers[key] = "[REDACTED]";
      }
    }
  }
  if (event.user?.email) {
    event.user.email = `sha256:${hashShort(event.user.email)}`;
  }
  return event;
}
```

Each `Sentry.init({ ... })` gets `beforeSend: sanitizeSentryEvent,`.

### Step 3.4 — Console shim in instrumentation.ts

Next.js runs `instrumentation.ts` (or `src/instrumentation.ts`) once per runtime. Pseudocode:

```ts
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("./lib/logger");
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    console.error = (msg: unknown, ...rest: unknown[]) => {
      logger.error(String(msg), { args: rest });
    };
    console.warn = (msg: unknown, ...rest: unknown[]) => {
      logger.warn(String(msg), { args: rest });
    };
    console.info = (msg: unknown, ...rest: unknown[]) => {
      logger.info(String(msg), { args: rest });
    };
    // Keep originals available for intentional CLI scripts if needed
    (globalThis as any).__console_original = { error: originalError, warn: originalWarn, info: originalInfo };
  }
}
```

Verify Sentry's default console integration does not double-capture — check `Sentry.consoleLoggingIntegration` or equivalent in the current Sentry version and disable if it causes duplicate breadcrumbs.

Edge runtime: shim does not apply (we check `NEXT_RUNTIME === "nodejs"`). Edge-only callsites (rare) remain on `console.*`; those must be migrated manually in Step 3.5 if they handle PII.

### Step 3.5 — Migrate top-10 callsites to structured logger

For each of the 10 files, replace `console.error("[TAG]", err)` with `logger.error("[TAG]", { error: err.message, ...context })`. Mechanical change; do it file-by-file with a small test per file asserting the tag appears in the structured output.

Priority order (highest PII exposure first):
1. `src/app/api/webhooks/stripe/route.ts` — payment data
2. `src/app/api/webhooks/elevenlabs/route.ts` — voice/user data
3. `src/app/api/mcp/make-booking/route.ts` — phone, email, name
4. `src/app/api/admin/marketing/accounts/route.ts` — OAuth tokens
5. `src/app/api/admin/marketing/schedule/route.ts`
6. `src/app/api/admin/stories/route.ts`
7. `src/app/api/webhooks/translate/route.ts`
8. `src/app/api/admin/costs-analytics/route.ts`
9. `src/app/api/admin/marketing/posts/route.ts`
10. `src/app/api/cron/github-traffic-sync/route.ts`

### Step 3.6 — ESLint rule

Append to `eslint.config.mjs`:

```js
// Pseudocode
{
  files: ["src/app/api/**/*.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.object.name='console']",
        message: "Use the shared logger from @/lib/logger instead of console.* in API routes. See docs/plans/2026-04-20-engineering-audit-remediation-phases/phase-3.md.",
      },
    ],
  },
},
```

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint       # should fail if any new console.* added to src/app/api/**
npm run test -- src/lib/logger
npm run test -- sentry
npm run test       # full suite stays green
```

Regression grep:

```bash
grep -rn "console\.\(error\|warn\|info\)" src/app/api/ | wc -l
# Expect <= current count minus top-10 migrations; trend to zero over time.
```

## Manual Success Criteria

1. Trigger a known PII-containing error path locally (e.g., booking with a test phone number + failing API call); inspect `process.stdout` output — assert no phone/email appears in plaintext.
2. Trigger a Sentry event in dev (e.g., `throw new Error("test"); // with req.headers.cookie present`) and confirm via Sentry dashboard that `event.request.cookies` is absent and `event.user.email` is hashed.
3. Attempt to add `console.error("secret email: a@b.c")` in any `src/app/api/**` file — ESLint must fail.

## Rollback

`git revert` the merge. The shim is additive; reverting restores `console.*` direct behavior. No data migration required.

## Files Touched

- `src/instrumentation.ts` (new or extended)
- `src/lib/logger.ts`
- `src/lib/logger.test.ts` (new)
- `src/lib/sentry-before-send.ts` (new)
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `eslint.config.mjs`
- 10 top-callsite API route files (listed in Step 3.5)

## Exit Gate

STOP. Confirm merge to `develop` with green CI. This phase unblocks P8 (correlation IDs).
