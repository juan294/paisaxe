import { test, expect } from "./fixtures/base-test";
import {
  test as authTest,
  expect as authExpect,
  hasAuthCredentials,
} from "./fixtures/auth";
import {
  MOCK_CHAT_RESPONSE,
  MOCK_CHAT_RESPONSE_FOLLOWUP,
  MOCK_FEATURE_FLAGS,
  MOCK_SUGGESTION_RESPONSE,
  withFeatureFlags,
} from "./fixtures/mock-data";
import type { Locator } from "@playwright/test";

/**
 * /immersive is PPR-prerendered: the static shell can render a nav button
 * visible+enabled before React attaches its click handler, so an early click
 * is swallowed. Retry click+assert as a unit until the title actually changes.
 */
async function clickAndAwaitTitleChange(
  button: Locator,
  title: Locator,
  previousTitle: string
) {
  await expect(async () => {
    await button.click();
    await expect(title).not.toHaveText(previousTitle, { timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

/**
 * QA Journey Tests — End-to-end user journey testing for QA Agent
 *
 * These tests verify complete user flows through the application,
 * inspired by Ryan Carson's approach to automated QA testing.
 *
 * Anonymous tests: Always run, use mocked APIs
 * Authenticated tests: Run only if QA_TEST_USER credentials are configured
 *
 * Run with: npx playwright test qa-journey.spec.ts
 * Run headed: npx playwright test qa-journey.spec.ts --headed
 */

test.describe("QA Journey: Anonymous User", () => {
  test.beforeEach(async ({ page }) => {
    // Mock feature flags to ensure consistent test environment
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    // Mock chat API for deterministic testing
    await page.route("**/api/chat/stream", (route) => {
      const textEvent = `data: ${JSON.stringify({ type: "text", content: MOCK_CHAT_RESPONSE.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: MOCK_CHAT_RESPONSE.images, sources: MOCK_CHAT_RESPONSE.sources })}\n\n`;
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    });
  });

  test("Journey 1: Browse stories and navigate with arrows", async ({
    page,
  }) => {
    // Step 1: Navigate to immersive view
    await page.goto("/immersive");
    const title = page.getByTestId("story-title").first();
    await expect(title).toContainText(/\S+/);

    const firstTitle = await title.textContent();
    expect(firstTitle).toBeTruthy();

    // Step 2: Navigate to next story via arrow
    // Use .first() to avoid strict mode violations during i18n hydration overlap
    const nextButton = page.getByTestId("next-story-button").first();
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    await clickAndAwaitTitleChange(nextButton, title, firstTitle!);

    // Step 3: Verify story changed
    const secondTitle = await title.textContent();
    expect(secondTitle).not.toBe(firstTitle);

    // Step 4: Navigate back with previous arrow
    const prevButton = page.getByTestId("prev-story-button").first();
    await clickAndAwaitTitleChange(prevButton, title, secondTitle!);

    // Step 5: Verify we're back to first story
    const returnedTitle = await title.textContent();
    expect(returnedTitle).toBe(firstTitle);
  });

  test("Journey 2: Browse stories using keyboard navigation", async ({
    page,
  }) => {
    await page.goto("/immersive");
    const title = page.getByTestId("story-title").first();
    await expect(title).toContainText(/\S+/);

    const firstTitle = await title.textContent();

    // Click story-title to establish keyboard focus — it sits at z-10 (info panel),
    // above the full-screen toggle button at z-[5], so no panel-toggle side effect.
    await expect(title).toBeVisible({ timeout: 5000 });
    await title.click();

    // Navigate with right arrow key
    await page.keyboard.press("ArrowRight");
    await expect(title).not.toHaveText(firstTitle!, {
      timeout: 3000,
    });

    const secondTitle = await title.textContent();
    expect(secondTitle).not.toBe(firstTitle);

    // Navigate with left arrow key — window retains focus from the click above
    await page.keyboard.press("ArrowLeft");
    await expect(title).not.toHaveText(secondTitle!, {
      timeout: 3000,
    });

    const returnedTitle = await title.textContent();
    expect(returnedTitle).toBe(firstTitle);
  });

  test("Journey 3: Open chat, send message, receive response", async ({
    page,
  }) => {
    await page.goto("/immersive");
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);

    // Step 1: Open chat panel
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await expect(askButton).toBeVisible({ timeout: 5000 });
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Step 2: Dismiss privacy notice if shown
    const privacyButton = chatPanel
      .locator("button")
      .filter({ hasText: /entend|understood|ok/i });
    if (await privacyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await privacyButton.click();
    }

    // Step 3: Type and send a question
    const input = chatPanel.locator("input");
    await input.fill("¿Qué puedo ver en los Lagos de Covadonga?");

    const sendButton = chatPanel.locator('button[type="submit"]');
    await sendButton.click();

    // Step 4: Verify user message appears
    await expect(
      chatPanel.getByText("¿Qué puedo ver en los Lagos de Covadonga?")
    ).toBeVisible();

    // Step 5: Verify assistant response (mocked)
    await expect(
      chatPanel.getByText(/Lagos de Covadonga son dos lagos/)
    ).toBeVisible({ timeout: 5000 });

    // Step 6: Close chat and verify we're back to story
    const closeButton = chatPanel
      .locator("button")
      .filter({ has: page.locator("svg.lucide-x") });
    await closeButton.click();

    await expect(chatPanel).not.toBeVisible();
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);
  });

  test("Journey 4: Favorites page shows sign-in prompt for anonymous users", async ({
    page,
  }) => {
    // Navigate directly to favorites
    await page.goto("/favorites");

    // Should see empty state with explore link (anonymous users can still browse)
    const exploreLink = page.getByRole("link", { name: /explor/i });
    await expect(exploreLink).toBeVisible();

    // Should have back link to immersive
    const header = page.locator("header");
    const backLink = header.locator('a[href="/immersive"]');
    await expect(backLink).toBeVisible();
  });

  test("Journey 5: Toggle story info overlay with keyboard", async ({
    page,
  }) => {
    await page.goto("/immersive");
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);

    // Info is visible by default
    const bottomPanel = page.getByTestId("story-info-panel").first();
    await expect(bottomPanel).toHaveClass(/opacity-100/);

    // Click story-title to establish keyboard focus while the panel is visible
    // (z-10 > z-[5] full-screen toggle button — no panel-toggle side effect)
    await page.getByTestId("story-title").first().click();

    // Press 'i' to hide info
    await page.keyboard.press("i");

    // Bottom panel should be hidden (wait for CSS transition to complete)
    await expect(bottomPanel).toHaveClass(/opacity-0/, { timeout: 5000 });

    // Press 'i' again to show info — window retains focus from the click above
    await page.keyboard.press("i");

    // Bottom panel should be visible again
    await expect(bottomPanel).toHaveClass(/opacity-100/, { timeout: 5000 });
  });

  test("Journey 6: Navigate between stories and verify unique content", async ({
    page,
  }) => {
    await page.goto("/immersive");
    const title = page.getByTestId("story-title").first();
    await expect(title).toContainText(/\S+/);

    // Collect titles from multiple stories
    const titles: string[] = [];
    const titleText = await title.textContent();
    if (titleText) titles.push(titleText);

    // Establish keyboard focus once — story-title is at z-10 (info panel),
    // above the full-screen toggle button at z-[5], no panel-toggle side effect.
    // Window retains focus for all subsequent key presses in this loop.
    await expect(title).toBeVisible({ timeout: 5000 });
    await title.click();

    // Navigate through 3 more stories, waiting for title to actually change
    for (let i = 0; i < 3; i++) {
      const prevTitle = titles[titles.length - 1];
      await page.keyboard.press("ArrowRight");
      await expect(title).not.toHaveText(prevTitle!, { timeout: 5000 });
      const currentTitle = await title.textContent();
      if (currentTitle) titles.push(currentTitle);
    }

    // Verify we got 4 titles and at least 3 are unique
    // (carousel may loop, but consecutive stories should be different)
    expect(titles.length).toBe(4);

    // Check that consecutive titles are different
    for (let i = 1; i < titles.length; i++) {
      expect(titles[i]).not.toBe(titles[i - 1]);
    }
  });
});

test.describe("QA Journey: Error Handling", () => {
  test("Journey 7: Graceful handling when API is unavailable", async ({
    page,
  }) => {
    // Mock feature flags to succeed
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    // Mock chat API to fail
    await page.route("**/api/chat/stream", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    await page.goto("/immersive");
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);

    // Open chat
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Dismiss privacy notice if shown
    const privacyButton = chatPanel
      .locator("button")
      .filter({ hasText: /entend|understood|ok/i });
    if (await privacyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await privacyButton.click();
    }

    // Try to send a message
    const input = chatPanel.locator("input");
    await input.fill("Test question");

    const sendButton = chatPanel.locator('button[type="submit"]');
    await sendButton.click();

    // Should show error message (not crash) — wait for the chat panel to remain
    // visible and stable after the API call completes (mocked as instant 500)
    // The app should handle errors gracefully
    await expect(chatPanel).toBeVisible({ timeout: 5000 });

    // Chat panel should still be functional (not broken)
    await expect(chatPanel).toBeVisible();
  });

  test("Journey 8: Health endpoint is always available", async ({ request }) => {
    const response = await request.get("/api/health");
    // Health endpoint returns 200 (healthy) or 503 (degraded) — both are valid
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(["healthy", "degraded"]).toContain(body.status);
  });
});

test.describe("QA Journey: New Features", () => {
  test("Journey 13: Submit a place suggestion as anonymous user", async ({
    page,
  }, testInfo) => {
    // Suggest button uses hidden md:block — skip on mobile
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) testInfo.skip(true, "Suggest button uses hidden md:block — not visible on mobile");
    // Enable suggestion feature flag
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          withFeatureFlags({ user_story_suggestions: true })
        ),
      })
    );

    // Mock suggestion API
    await page.route("**/api/suggestions", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION_RESPONSE),
      })
    );

    // Step 1: Navigate to immersive view and wait for it to load
    await page.goto("/immersive", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="story-title"]').first()).toBeVisible({ timeout: 15000 });

    // Step 2: Click the suggest button
    const suggestButton = page.locator("[data-suggest-place-trigger]");
    await expect(suggestButton).toBeVisible();
    await suggestButton.click();

    // Step 3: Dialog should open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Step 4: Fill the form
    await dialog.locator("#place-name").fill("Playa del Silencio");

    // Add optional comment
    await dialog.locator("#comment").fill("A beautiful hidden beach");

    // Step 5: Submit
    await dialog.locator('button[type="submit"]').click();

    // Step 6: See success state (text-based — lucide icons render as img in Playwright)
    await expect(
      dialog.getByText(/thank|gracias|success/i)
    ).toBeVisible({ timeout: 5000 });

    // Step 7: Dialog auto-closes after success (2s timeout in component)
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Step 8: Back on immersive view
    await expect(page.locator('[data-testid="story-title"]').first()).toBeVisible({ timeout: 10000 });
  });

  test("Journey 14: Multi-turn chat conversation", async ({ page }) => {
    // Mock feature flags
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    // Track call count to return different responses
    let callCount = 0;
    await page.route("**/api/chat/stream", (route) => {
      callCount++;
      const mockResponse =
        callCount === 1 ? MOCK_CHAT_RESPONSE : MOCK_CHAT_RESPONSE_FOLLOWUP;

      const textEvent = `data: ${JSON.stringify({ type: "text", content: mockResponse.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: mockResponse.images, sources: mockResponse.sources })}\n\n`;
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    });

    // Step 1: Navigate to immersive
    await page.goto("/immersive");
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);

    // Step 2: Open chat
    await page.locator('[data-testid="ask-button"]').first().click();
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Dismiss privacy notice if shown
    await chatPanel
      .getByRole("button", {
        name: /^(entendido|entendío|got it|compris|verstanden)$/i,
      })
      .click({ timeout: 2000 })
      .catch(() => {});

    // Step 3: Send first message
    await chatPanel.locator("input").fill("Tell me about the lakes");
    await chatPanel.locator('button[type="submit"]').click();

    // Step 4: Verify first user message and assistant response
    await expect(
      chatPanel.getByText("Tell me about the lakes")
    ).toBeVisible();
    await expect(
      chatPanel.getByText(/Lagos de Covadonga son dos lagos/)
    ).toBeVisible({ timeout: 5000 });

    // Step 5: Send second message
    await chatPanel.locator("input").fill("What about hiking?");
    await chatPanel.locator('button[type="submit"]').click();

    // Step 6: Verify second user message and assistant response
    await expect(chatPanel.getByText("What about hiking?")).toBeVisible();
    await expect(
      chatPanel.getByText(/Senda del Cares/)
    ).toBeVisible({ timeout: 5000 });

    // Step 7: Both conversations should be visible (scroll history)
    await expect(
      chatPanel.getByText("Tell me about the lakes")
    ).toBeVisible();
    await expect(chatPanel.getByText("What about hiking?")).toBeVisible();

    // Step 8: Close chat and return to immersive
    const closeButton = chatPanel
      .locator("button")
      .filter({ has: page.locator("svg.lucide-x") });
    await closeButton.click();

    await expect(chatPanel).not.toBeVisible();
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);
  });
});

/**
 * Authenticated User Journeys
 *
 * These tests require QA_TEST_USER_EMAIL and QA_TEST_USER_PASSWORD to be set.
 * They automatically skip if credentials are not configured.
 *
 * Setup: Run `./scripts/setup-qa-test-user.sh` to create the test user.
 *
 * QA-H1 (#868): this project shares a webServer built with a dummy Supabase
 * anon key (see playwright.config.ts). auth-provider.tsx inlines
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time and skips its whole auth
 * bootstrap whenever that key isn't a real JWT, so `useAuth()` — and
 * therefore `useFavorites()` — reports `user = null` here no matter what
 * session the `authenticatedPage` fixture injects server-side. Three tests
 * that used to live here ("can access favorites page", "add favorite via
 * API", "localStorage favorites persistence") were removed because they
 * could never fail in this build:
 *   - The "access favorites page" assertion (`/saved|favorites/i` visible)
 *     was satisfied by the always-rendered header AND by the anonymous
 *     sign-in wall's copy, so it passed whether or not real auth worked.
 *   - The two "add favorite" tests wrote directly to
 *     `localStorage.paisaxe_favorites` and then asserted localStorage
 *     contained what they had just written — a tautology that never
 *     touched `/api/favorites` or Postgres, and would pass even if the real
 *     persistence path (e.g. FE-B1) were completely broken.
 *
 * The real, UI-driven authenticated favorite round-trip (click the bookmark
 * button -> POST /api/favorites -> Postgres -> reload -> GET /api/favorites)
 * now lives in e2e/favorites-real.spec.ts, run via the `auth-integration`
 * Playwright project against a build with real Supabase credentials. See
 * that spec for how to run it. This suite keeps only the one test below,
 * which exercises real navigation and doesn't depend on client-side auth
 * state to pass or fail.
 */
authTest.describe("QA Journey: Authenticated User", () => {
  // Skip entire suite if auth credentials not configured — but fail closed
  // (QA-M2, #873) under CI or an explicit REQUIRE_AUTH_JOURNEYS flag, so a
  // release gate can never report "passed" while this whole suite silently
  // didn't execute. A credential-less local run without either signal still
  // skips, so a developer without QA credentials keeps a usable anonymous-only
  // E2E run.
  authTest.beforeAll(() => {
    if (!hasAuthCredentials()) {
      if (process.env.CI || process.env.REQUIRE_AUTH_JOURNEYS) {
        throw new Error(
          "QA test user credentials not configured (QA_TEST_USER_EMAIL / QA_TEST_USER_PASSWORD), " +
            "but CI or REQUIRE_AUTH_JOURNEYS requires this authenticated-journey suite to run. " +
            "Refusing to silently skip a suite this gate depends on."
        );
      }
      authTest.skip(true, "QA test user credentials not configured (QA_TEST_USER_EMAIL / QA_TEST_USER_PASSWORD)");
    }
  });

  authTest(
    "Navigate from favorites back to immersive",
    async ({ authenticatedPage }) => {
      const page = authenticatedPage;

      // Go to favorites
      await page.goto("/favorites");
      await authExpect(page.locator("header")).toBeVisible({ timeout: 10000 });

      // Find the back button/link to immersive
      const backLink = page.locator('a[href="/immersive"]').first();
      await authExpect(backLink).toBeVisible();

      // Click to go back
      await backLink.click();

      // Should be on immersive page
      await page.waitForURL("**/immersive");
      await authExpect(page.getByTestId("story-title").first()).toContainText(/\S+/, { timeout: 10000 });
    }
  );
});
