import { test, expect } from "@playwright/test";
import { requireReleaseTarget } from "../scripts/release/probe-guards";
import { parseChatSmokeEvents, assertChatSmokeShape } from "../scripts/release/chat-smoke";

/**
 * Release-required probes — deployed environment, READ-ONLY.
 *
 * Every test here is tagged `@release-required` and is selected by the
 * `release-required` Playwright project. The manifest at
 * `quality/required-probes.yaml` is the source of truth for which probes are
 * required; scripts/release/required-probes.ts asserts the two agree.
 *
 * Two rules govern this file (plan D-B and D05):
 *
 * 1. NOTHING HERE MUTATES. Preview shares the production Supabase project and
 *    holds live-mode Stripe keys, so a "harmless" write is a production write.
 *    Only GETs, plus POSTs that are rejected before any side effect.
 * 2. NOTHING HERE SKIPS. A missing prerequisite fails the probe. A required
 *    probe that silently skips is a vacuous pass, which is the failure mode
 *    this whole wave exists to eliminate — see the `mcp.spec.ts` pattern the
 *    plan explicitly forbids, and the throw-loudly pattern in
 *    e2e/fixtures/auth.ts.
 *
 * These deliberately restate assertions that local specs also make. That
 * duplication is the point: the local specs prove the code is correct, these
 * prove the *deployment* is.
 */

test.beforeAll(() => {
  // Fail closed: without an explicit target these probes would silently verify
  // localhost and report a green release for an unexamined deployment.
  requireReleaseTarget(process.env.RELEASE_TARGET_URL);
});

test("@release-required health-status: /api/health returns 200 and status healthy", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);

  const body = await response.json();
  // /api/health is always HTTP 200 by design (DO-H1); "degraded" lives in the
  // body, so the status code alone would be a vacuous assertion.
  expect(body.status).toBe("healthy");
  expect(body.timestamp).toEqual(expect.any(String));
});

test("@release-required health-db: /api/health/db is reachable and well-formed", async ({
  request,
}) => {
  const response = await request.get("/api/health/db");

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.success).toBe(true);
});

test("@release-required csp-canary: homepage renders and client JS executes", async ({
  page,
}) => {
  // If CSP blocks scripts (e.g. 'strict-dynamic' reintroduced against a
  // nonce-less PPR shell), pages never hydrate and stay on the spinner.
  const response = await page.goto("/favorites");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("link", { name: /explore stories|explorar historias/i })
  ).toBeVisible({ timeout: 15_000 });
});

test("@release-required story-read-path: the story page serves real content", async ({
  page,
}) => {
  const response = await page.goto("/immersive");
  expect(response?.status()).toBe(200);

  const title = page.getByTestId("story-title").first();
  await expect(title).toBeVisible({ timeout: 15_000 });
  // Non-empty, not a placeholder frame: the read path reached actual content.
  await expect(title).toContainText(/\S{3,}/);
});

test("@release-required admin-denial: admin route denies an unauthenticated caller", async ({
  request,
}) => {
  const response = await request.get("/api/admin/agent-reports");

  expect(response.status()).toBe(401);
  expect((await response.json()).error).toBe("Authentication required");
});

test("@release-required webhook-unsigned: webhook rejects an unsigned payload", async ({
  request,
}) => {
  // Rejected before any handler side effect, which is what keeps this probe
  // read-only against a live deployment.
  const response = await request.post("/api/webhooks/supabase", {
    data: {
      table_name: "stories",
      operation: "UPDATE",
      timestamp: new Date().toISOString(),
    },
  });

  expect([401, 403]).toContain(response.status());
});

// QA-H2 (#869): exercises the real embedding → search → rerank → generate
// pipeline against deployed Anthropic/Voyage/Supabase upstreams. Nothing else
// in the required-probe suite touches chat — every browser-level chat test
// intercepts this endpoint with a canned SSE response, so a Voyage dimension
// change, a match_chunks signature drift, an SDK breaking change, or an
// expired key can currently ship with a fully green release.
//
// Read-only: `/api/chat/stream` (src/app/api/chat/stream/route.ts) only
// reads (embedding lookup, vector search) and calls out to Claude/Voyage —
// it never writes to Supabase or anywhere else.
//
// Assertions are on SHAPE only, never on answer content — see chat-smoke.ts.
test("@release-required chat-smoke: chat/RAG pipeline responds with retrieved sources", async ({
  request,
}) => {
  // BE-H1: a caller with no trusted Vercel IP header shares the tight
  // "untrusted" bucket (3 req/60s, shared across every such caller). Setting
  // our own x-vercel-forwarded-for value gives this probe its own bucket
  // under the default per-IP limit (10 req/60s in src/lib/rate-limit.ts)
  // instead of contending with, or exhausting, that shared bucket.
  // 203.0.113.0/24 is reserved for documentation/testing (RFC 5737) and will
  // never collide with a real visitor's IP.
  const response = await request.post("/api/chat/stream", {
    headers: { "x-vercel-forwarded-for": "203.0.113.42" },
    data: { message: "¿Qué se puede ver en los Lagos de Covadonga?" },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/event-stream");

  const events = parseChatSmokeEvents(await response.text());
  assertChatSmokeShape(events);
});
