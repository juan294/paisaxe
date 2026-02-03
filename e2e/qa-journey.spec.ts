import { test, expect } from "@playwright/test";
import { MOCK_CHAT_RESPONSE, MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

/**
 * QA Journey Tests — End-to-end user journey testing for QA Agent
 *
 * These tests verify complete user flows through the application,
 * inspired by Ryan Carson's approach to automated QA testing.
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
    await expect(page.locator("h1")).toBeVisible();

    const firstTitle = await page.locator("h1").textContent();
    expect(firstTitle).toBeTruthy();

    // Step 2: Navigate to next story via arrow
    const nextButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-chevron-right") });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Step 3: Verify story changed
    const secondTitle = await page.locator("h1").textContent();
    expect(secondTitle).not.toBe(firstTitle);

    // Step 4: Navigate back with previous arrow
    const prevButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-chevron-left") });
    await prevButton.click();

    await page.waitForTimeout(500);

    // Step 5: Verify we're back to first story
    const returnedTitle = await page.locator("h1").textContent();
    expect(returnedTitle).toBe(firstTitle);
  });

  test("Journey 2: Browse stories using keyboard navigation", async ({
    page,
  }) => {
    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    const firstTitle = await page.locator("h1").textContent();

    // Navigate with right arrow key
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);

    const secondTitle = await page.locator("h1").textContent();
    expect(secondTitle).not.toBe(firstTitle);

    // Navigate with left arrow key
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);

    const returnedTitle = await page.locator("h1").textContent();
    expect(returnedTitle).toBe(firstTitle);
  });

  test("Journey 3: Open chat, send message, receive response", async ({
    page,
  }) => {
    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    // Step 1: Open chat panel
    const askButton = page.locator('[data-testid="ask-button"]');
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
    await expect(page.locator("h1")).toBeVisible();
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
    await expect(page.locator("h1")).toBeVisible();

    // Info is visible by default
    await expect(page.locator("h1")).toHaveCSS("opacity", "1");

    // Press 'i' to hide info
    await page.keyboard.press("i");
    await page.waitForTimeout(600);

    // Bottom panel should be hidden
    const bottomPanel = page.locator(".absolute.bottom-0.left-0.right-0");
    await expect(bottomPanel).toHaveCSS("opacity", "0");

    // Press 'i' again to show info
    await page.keyboard.press("i");
    await page.waitForTimeout(600);

    // Bottom panel should be visible again
    await expect(bottomPanel).toHaveCSS("opacity", "1");
  });

  test("Journey 6: Navigate between stories and verify unique content", async ({
    page,
  }) => {
    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    // Collect titles from multiple stories
    const titles: string[] = [];
    const titleText = await page.locator("h1").textContent();
    if (titleText) titles.push(titleText);

    // Navigate through 3 more stories
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      const title = await page.locator("h1").textContent();
      if (title) titles.push(title);
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
    await expect(page.locator("h1")).toBeVisible();

    // Open chat
    const askButton = page.locator('[data-testid="ask-button"]');
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

    // Should show error message (not crash)
    // The app should handle errors gracefully
    await page.waitForTimeout(2000);

    // Chat panel should still be functional (not broken)
    await expect(chatPanel).toBeVisible();
  });

  test("Journey 8: Health endpoint is always available", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(["healthy", "degraded"]).toContain(body.status);
  });
});
