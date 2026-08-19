/**
 * E2E tests for the VISITOR-FACING voice flow — Pelayo, the ElevenLabs
 * voice guide gated behind the `visitor_voice_agent` feature flag and a
 * paid day-pass / voice purchase (see `useVoiceAccess` /
 * `src/hooks/use-voice-access.ts`).
 *
 * QA-M7 (#878): this filename previously held ADMIN component gating tests
 * (VoiceAgentChat/AgentsDashboard) that had nothing to do with the visitor
 * voice flow — the monetized feature the day-pass purchase actually buys
 * had zero browser-level coverage. Those admin tests now live in
 * `e2e/admin-agents-gating.spec.ts`. This file covers the real thing.
 *
 * Auth strategy — same constraint as admin-agents-gating.spec.ts
 * ─────────────────────────────────────────────────────────────
 * The E2E web server's NEXT_PUBLIC_SUPABASE_ANON_KEY is the literal string
 * "dummy_key_for_e2e", not a real JWT. `AuthProvider` short-circuits to
 * `user = null` whenever the anon key doesn't start with "eyJ" (calling
 * Supabase with a fake key otherwise hangs on DNS resolution — see
 * src/components/auth/auth-provider.tsx). Every visitor in this suite is
 * therefore permanently unauthenticated, and `useVoiceAccess().canUseVoice`
 * is always `false` — there is no client-side bypass for paid access
 * (`isWhitelisted` is hardcoded `false`; authorization lives server-side).
 *
 * What this DOES cover (real, reachable in CI):
 *   - The paywall gate: with no voice access, the chat header renders the
 *     "use your voice" upgrade CTA linking to /pricing (not the voice-mode
 *     toggle), and the CTA actually navigates there.
 *   - This is the state every real anonymous/unauthenticated visitor sees,
 *     so it is the state that matters most for the purchase funnel.
 *
 * What this explicitly does NOT cover (documented, not silently assumed):
 *   - "Access granted" — the mode toggle rendering and POST /api/voice-session
 *     actually being called to request a signed ElevenLabs URL. That
 *     requires a real authenticated session with a `voice_purchases` row,
 *     which (per the auth constraint above) is unreachable by mocking the
 *     fetch layer alone — `useVoiceAccess` never calls the API without a
 *     real `session.access_token`. Faking one would mean giving the E2E
 *     build a JWT-shaped anon key, which would also re-enable live Supabase
 *     calls for every OTHER spec in this suite (including the ones that
 *     rely on the short-circuit to avoid DNS hangs) — out of scope for this
 *     fix. Real coverage of that path belongs in an authenticated,
 *     Docker-Supabase-backed spec analogous to `e2e/favorites-real.spec.ts`
 *     (see its `auth-integration` Playwright project), seeded with a
 *     `voice_purchases` row for the QA test user. Filed as a follow-up.
 *   - The ElevenLabs voice connection itself (needs a live ElevenLabs
 *     session) and the server's actual signed-URL issuance — the API route
 *     already has unit coverage for that (see
 *     src/app/api/voice-session/route.test.ts).
 */

import { test, expect } from "./fixtures/base-test";
import { withFeatureFlags } from "./fixtures/mock-data";

test.describe("Visitor voice — paywall gate (no access)", () => {
  test.beforeEach(async ({ page }) => {
    // visitor_voice_agent enabled — the gate we're testing is the paid
    // access check, not the feature flag (the flag only controls whether
    // the immersive experience surfaces voice at all upstream of this).
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(withFeatureFlags({ visitor_voice_agent: true })),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("opening the chat panel shows the voice upgrade CTA, not a voice toggle", async ({
    page,
  }) => {
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // The upgrade CTA (a <Link> to /pricing carrying the AudioLines icon)
    // renders whenever the visitor lacks paid voice access — see
    // src/components/immersive/voice-chat/chat-header.tsx.
    const upgradeCta = chatPanel
      .getByRole("link")
      .filter({ has: page.locator("svg.lucide-audio-lines") });
    await expect(upgradeCta).toBeVisible();
    await expect(upgradeCta).toHaveAttribute("href", /^\/pricing/);

    // The voice/text mode TOGGLE (a <Button>, only rendered once
    // canUseVoice && agentId are both true) must be absent — the same icon
    // is reused there, so this only distinguishes correctly by role (link
    // vs button), matching the component's actual conditional rendering.
    const modeToggle = chatPanel
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-audio-lines") });
    await expect(modeToggle).not.toBeVisible();
  });

  test("upgrade CTA navigates to the pricing page", async ({ page }) => {
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    const upgradeCta = chatPanel
      .getByRole("link")
      .filter({ has: page.locator("svg.lucide-audio-lines") });
    await upgradeCta.click();

    await expect(page).toHaveURL(/\/pricing/);
  });

  test("upgrade CTA carries a returnTo pointing back at the current story", async ({
    page,
  }) => {
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    const upgradeCta = chatPanel
      .getByRole("link")
      .filter({ has: page.locator("svg.lucide-audio-lines") });
    const href = await upgradeCta.getAttribute("href");

    // storySlug is always defined for a story rendered via /immersive, so
    // ChatHeader takes the `?returnTo=<slug>` branch (see chat-header.tsx).
    expect(href).toMatch(/^\/pricing\?returnTo=.+/);
  });
});
