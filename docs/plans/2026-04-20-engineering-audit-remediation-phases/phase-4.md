# Phase 4 — CSP Simplification + XSS Canary

**Scope:** Path B — delete the dead nonce scaffolding (`generateNonce`, `_nonce` param, `x-csp-nonce` header forwarding), tighten the `wss://*.elevenlabs.io` wildcard, add SRI to the Stripe external script, document that `'unsafe-inline'` is the intended policy with `react-markdown` as the sanitization primary defense. Audit `react-markdown` config for `rehypePlugins` / `allowDangerousHtml`. Add a real XSS canary E2E test (the inverse of the existing "JS executes" smoke test).

**Addresses:** §3.2 (High, downgraded from Critical), §4 bullet "CSP wildcard `wss://*.elevenlabs.io`", §9#4 audit react-markdown, §7 XSS canary gap.

**Batch eligibility:** `[batch-eligible]` — depends only on P1.

---

## Current State (verified 2026-04-20)

`src/lib/proxy/csp.ts:21-37`:
- `buildCspHeader(_nonce: string)` — param unused, prefixed `_` to suppress lint.
- Comment at L14-17 explicitly notes `'strict-dynamic'` is intentionally omitted and `'unsafe-inline'` is the policy.
- Exact current string:
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' blob: https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com;
  media-src 'self' blob:;
  worker-src 'self' blob:;
  frame-src https://js.stripe.com;
  object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```

`src/proxy.ts:44-46`:
```ts
const nonce = generateNonce();
request.headers.set("x-csp-nonce", nonce);
// L52: response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
```

Safe render sinks (already verified in audit §0):
- `src/components/immersive/voice-chat.tsx:311` — `<ReactMarkdown components={{ p, strong, ul, ol, li, a }}>` no `rehype-raw`, no `allowDangerousHtml`.
- `src/components/admin/agents-dashboard/safe-markdown.tsx:34` — `<ReactMarkdown allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed>`.

Existing `e2e/smoke.spec.ts` has "CSP canary" that tests JS *executes*. Needs the inverse.

## Target State

- `buildCspHeader()` takes no nonce argument and returns a static string.
- `generateNonce` and `x-csp-nonce` forwarding deleted from `src/proxy.ts`.
- `wss://*.elevenlabs.io` tightened to the specific subdomain used (TBD from elevenlabs agent configs; likely `wss://api.elevenlabs.io` or `wss://api.us.elevenlabs.io` — verify by reading `src/lib/elevenlabs-*` and runtime env).
- SRI added to Stripe script tag if loaded externally via `<Script src="https://js.stripe.com/v3">` (verify location).
- CSP comment block rewritten to explicitly state: "`'unsafe-inline'` is intentional for PPR compatibility. Primary XSS defense is `react-markdown` config (see `src/components/**/safe-markdown.tsx` and `voice-chat.tsx`). No `rehype-raw`, no `allowDangerousHtml`. New markdown sinks MUST be added to `e2e/xss-canary.spec.ts`."
- New E2E test `e2e/xss-canary.spec.ts` that pastes XSS payloads into chat input and asserts no `<script>` execution and no `onerror` fetch.
- Audit of all `react-markdown` usages to confirm none use `rehype-raw` / `allowDangerousHtml`.

## Implementation Steps

### Step 4.1 — Red: XSS canary E2E

`e2e/xss-canary.spec.ts` (new):

```ts
// Pseudocode
test("chat output does not execute injected script", async ({ page }) => {
  await page.goto("/immersive");
  // Intercept network to detect canary fetch
  let canaryHit = false;
  await page.route("**/xss-canary", route => { canaryHit = true; route.fulfill({ status: 200 }); });

  // Send a chat message containing common XSS payloads echoed back by a mock
  await page.fill("[data-test=chat-input]", "tell me about <img src=x onerror=fetch('/xss-canary')>");
  await page.click("[data-test=chat-send]");
  await page.waitForSelector("[data-test=chat-response]");
  await page.waitForTimeout(500); // wait for any deferred exec
  expect(canaryHit).toBe(false);

  // Also assert no <script> tag was rendered from Claude echoing the string
  const scriptCount = await page.locator("[data-test=chat-response] script").count();
  expect(scriptCount).toBe(0);
});

test("admin markdown renderer does not emit raw html", async ({ page }) => {
  // authenticated admin fixture
  await adminPage.goto("/admin/agents");
  // render a report that contains <script>/<iframe>/<img onerror>
  // assert these are NOT present in DOM (allowlist should have stripped them)
});
```

### Step 4.2 — Green: delete dead scaffolding

`src/lib/proxy/csp.ts`:

```ts
// Pseudocode
export function buildCspHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob: https://js.stripe.com",
    // ... rest
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io ...",
    //                                                     ^^^^^^^ tightened
  ].join("; ");
}
```

Replace the existing L13-19 comment with the updated doctrine (see Target State).

`src/proxy.ts`:

```diff
- const nonce = generateNonce();
- request.headers.set("x-csp-nonce", nonce);
  // ...
- response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
+ response.headers.set("Content-Security-Policy", buildCspHeader());
```

Delete `generateNonce` from `src/lib/proxy/csp.ts` (or wherever it lives). Delete any orphan imports.

### Step 4.3 — Tighten the ElevenLabs wildcard

Before editing, verify the actual WebSocket endpoints used:

```bash
grep -rn "elevenlabs.io" src/ agent_configs/ .env.local.example 2>/dev/null
```

The production ElevenLabs voice WebSocket is `wss://api.elevenlabs.io/v1/convai/...`. If a regional endpoint is used (e.g., `api.us.elevenlabs.io`), include both explicitly. Avoid the wildcard unless a third host is unavoidable.

### Step 4.4 — SRI for Stripe script

Find the Stripe script tag (likely in `src/app/layout.tsx` or a payments component):

```bash
grep -rn "js.stripe.com" src/
```

Stripe does not publish SRI hashes for `v3` because they update it in place. **SRI is therefore not feasible for the Stripe SDK.** Document this in the CSP comment: `frame-src https://js.stripe.com; script-src ... https://js.stripe.com` is trusted by origin, not hash. This is the documented Stripe guidance.

**Adjustment:** Skip SRI for Stripe. Instead, assert in `src/app/layout.tsx` that Stripe is the *only* external script origin and document why SRI cannot be applied.

### Step 4.5 — react-markdown audit

Grep for all usages:

```bash
grep -rn "ReactMarkdown\|react-markdown" src/
```

For each hit, verify:
- No `rehype-raw` in `rehypePlugins`.
- No `allowDangerousHtml` prop.
- Either `allowedElements` allowlist OR explicit `components` overrides.

Document the complete list in a new `docs/project/markdown-render-sinks.md` as a registry — any new markdown renderer added outside this list should fail review.

### Step 4.6 — CSP comment rewrite

`src/lib/proxy/csp.ts` block comment (replacing L13-19):

```ts
/**
 * CSP policy for Paisaxe.
 *
 * DELIBERATE DESIGN: `'unsafe-inline'` in script-src is intentional for PPR compatibility.
 * Nonces would require dynamic rendering on CSP-sensitive routes, conflicting with
 * `cacheComponents` PPR static shells.
 *
 * Primary XSS defense is enforced by output sanitization in the react-markdown configuration:
 *   - src/components/immersive/voice-chat.tsx — explicit `components={{}}` overrides, no rehype-raw
 *   - src/components/admin/agents-dashboard/safe-markdown.tsx — `allowedElements` allowlist
 *
 * See docs/project/markdown-render-sinks.md for the full registry.
 * Any new markdown renderer MUST:
 *   1. Use either `allowedElements` allowlist or explicit `components` overrides.
 *   2. Not import `rehype-raw`.
 *   3. Not set `allowDangerousHtml`.
 *   4. Be added to `e2e/xss-canary.spec.ts`.
 */
```

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test
npm run test:e2e -- xss-canary
```

Grep assertions:

```bash
grep -rn "generateNonce\|x-csp-nonce" src/ | grep -v "\.md:" || echo "clean"
grep -rn "rehype-raw\|allowDangerousHtml" src/ || echo "clean"
```

## Manual Success Criteria

1. Paste `<img src=x onerror=alert(1)>` into the chat input on local dev; observe rendered response — no alert, no browser dialog, text is escaped.
2. Browser devtools → Network → reload page → confirm CSP response header matches the new static string.
3. `docs/project/markdown-render-sinks.md` exists and lists every `ReactMarkdown` usage in the codebase.

## Rollback

`git revert` the merge. CSP is header-only — reverting immediately restores the old header.

## Files Touched

- `src/lib/proxy/csp.ts`
- `src/proxy.ts`
- `e2e/xss-canary.spec.ts` (new)
- `docs/project/markdown-render-sinks.md` (new)
- Any file that currently imports `generateNonce` (cleanup only)

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
