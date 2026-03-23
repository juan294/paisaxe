# Phase 1: Fix CSRF in LLM Quality Tests `[batch-eligible]`

> **Files**: `src/tests/qa/llm-quality.test.ts`
> **Estimated effort**: Small

## Problem

`sendChatMessage()` in `llm-quality.test.ts:25-51` makes bare `fetch()` calls without CSRF tokens. The proxy returns 403 on all POST requests to `/api/chat`. Blocked for 4 weeks — 0/12 LLM tests pass.

## Approach

The LLM quality tests run against a live server (`http://localhost:3000` or `NEXT_PUBLIC_SITE_URL`). The fix acquires a real CSRF token by hitting a page endpoint first, then includes it in subsequent requests.

**Key insight**: `e2e/api.spec.ts` already has a working `getCsrfHeaders()` pattern — we adapt it for Vitest/Node.js fetch.

## Changes

### `src/tests/qa/llm-quality.test.ts`

```pseudo
+ // CSRF token cache (reused across tests in the same run)
+ let csrfCache: { cookie: string; token: string } | null = null;
+
+ async function acquireCsrfToken(): Promise<{ cookie: string; token: string }> {
+   if (csrfCache) return csrfCache;
+   // Hit any page to get the __csrf cookie from Set-Cookie header
+   const res = await fetch(`${API_URL}/immersive`);
+   const setCookie = res.headers.get('set-cookie') || '';
+   const match = setCookie.match(/__csrf=([a-f0-9]+)/);
+   const token = match?.[1] || '';
+   if (!token) throw new Error('Failed to acquire CSRF token — is the server running?');
+   csrfCache = { cookie: `__csrf=${token}`, token };
+   return csrfCache;
+ }

  // In sendChatMessage(), add CSRF headers:
  async function sendChatMessage(message: string, retries = 3): Promise<ChatResponse> {
+   const csrf = await acquireCsrfToken();
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
-       headers: { 'Content-Type': 'application/json' },
+       headers: {
+         'Content-Type': 'application/json',
+         'Cookie': csrf.cookie,
+         'x-csrf-token': csrf.token,
+       },
        body: JSON.stringify({ message }),
      });
      // ... rest unchanged
    }
  }
```

## Verification

```bash
# Requires dev server running
npm run dev &
npm run test:qa
```

All 12 tests should now hit the chat API without 403.

## Notes

- The chat API still uses real Claude API calls, so these tests consume credits
- Tests have 30s timeout per test case to accommodate LLM response time
- If the server isn't running, the new error message will be clear: "Failed to acquire CSRF token"
