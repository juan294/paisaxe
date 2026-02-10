import { test, expect } from "@playwright/test";
import {
  MOCK_CHAT_RESPONSE,
  MOCK_CHAT_RESPONSE_FOLLOWUP,
  MOCK_FEATURE_FLAGS,
  withFeatureFlags,
} from "./fixtures/mock-data";

/**
 * Pre-Launch Validation E2E Tests
 *
 * Covers remaining test gaps before launch:
 * - Static pages (privacy, terms, pricing)
 * - API route smoke tests (suggestions, voice-access, checkout)
 * - Chat multi-turn messageIndex verification
 * - Feature flag gating (suggestions, fullscreen)
 * - Language switching
 *
 * Run with: npx playwright test pre-launch.spec.ts
 */

/** Dismiss the privacy notice in the chat panel if it appears. */
async function dismissPrivacyNotice(chatPanel: import("@playwright/test").Locator) {
  // The privacy notice button text varies by locale: "Entendido" (ES), "Got it" (EN), etc.
  const privacyButton = chatPanel
    .locator("button")
    .filter({ hasText: /entend|understood|got it|ok|compris/i });
  if (await privacyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await privacyButton.click();
  }
}

// ─── Static Pages ────────────────────────────────────────────────

test.describe("Static pages", () => {
  test("privacy page loads", async ({ page }) => {
    const response = await page.goto("/privacy");
    expect(response?.ok()).toBe(true);

    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    const response = await page.goto("/terms");
    expect(response?.ok()).toBe(true);

    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("pricing page loads for anonymous user", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.ok()).toBe(true);

    // Should show the price and a CTA
    await expect(page.getByText("€1.99")).toBeVisible();
  });
});

// ─── API Route Smoke Tests ───────────────────────────────────────

test.describe("API route smoke tests", () => {
  test("POST /api/suggestions rejects empty body", async ({ request }) => {
    const response = await request.post("/api/suggestions", {
      data: {},
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/suggestions rejects short name", async ({ request }) => {
    const response = await request.post("/api/suggestions", {
      data: { placeName: "Ab" },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("3");
  });

  test("GET /api/voice-access returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/voice-access");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/checkout/day-pass rejects without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout/day-pass");
    // Returns 401 (no user) or 500 (Stripe not configured) — either is non-200
    expect(response.ok()).toBe(false);

    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});

// ─── Chat Multi-Turn messageIndex ────────────────────────────────

test.describe("Chat messageIndex", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );
  });

  test("first message sends messageIndex 0", async ({ page }) => {
    let capturedIndex: number | undefined;

    await page.route("**/api/chat/stream", (route) => {
      const postData = route.request().postDataJSON();
      capturedIndex = postData?.messageIndex;

      const textEvent = `data: ${JSON.stringify({ type: "text", content: MOCK_CHAT_RESPONSE.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: MOCK_CHAT_RESPONSE.images, sources: MOCK_CHAT_RESPONSE.sources })}\n\n`;
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    });

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    // Open chat
    await page.locator('[data-testid="ask-button"]').click();
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Dismiss privacy notice if shown
    await dismissPrivacyNotice(chatPanel);

    // Send first message
    await chatPanel.locator("input").fill("Question one");
    await chatPanel.locator('button[type="submit"]').click();

    // Wait for response
    await expect(
      chatPanel.getByText(/Lagos de Covadonga son dos lagos/)
    ).toBeVisible({ timeout: 5000 });

    expect(capturedIndex).toBe(0);
  });

  test("second message sends messageIndex 1", async ({ page }) => {
    const capturedIndices: number[] = [];

    await page.route("**/api/chat/stream", (route) => {
      const postData = route.request().postDataJSON();
      capturedIndices.push(postData?.messageIndex);

      // Alternate responses so we can identify them
      const isSecond = capturedIndices.length === 2;
      const mockResponse = isSecond
        ? MOCK_CHAT_RESPONSE_FOLLOWUP
        : MOCK_CHAT_RESPONSE;

      const textEvent = `data: ${JSON.stringify({ type: "text", content: mockResponse.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: mockResponse.images, sources: mockResponse.sources })}\n\n`;
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    });

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    // Open chat
    await page.locator('[data-testid="ask-button"]').click();
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Dismiss privacy notice
    await dismissPrivacyNotice(chatPanel);

    // Send first message
    await chatPanel.locator("input").fill("Question one");
    await chatPanel.locator('button[type="submit"]').click();

    await expect(
      chatPanel.getByText(/Lagos de Covadonga son dos lagos/)
    ).toBeVisible({ timeout: 5000 });

    // Send second message
    await chatPanel.locator("input").fill("Question two");
    await chatPanel.locator('button[type="submit"]').click();

    await expect(
      chatPanel.getByText(/Senda del Cares/)
    ).toBeVisible({ timeout: 5000 });

    expect(capturedIndices).toEqual([0, 1]);
  });
});

// ─── Feature Flag Gating ─────────────────────────────────────────

test.describe("Feature flag gating", () => {
  test("suggest button hidden when flag off", async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    await expect(
      page.locator("[data-suggest-place-trigger]")
    ).toHaveCount(0);
  });

  test("suggest button visible when flag on", async ({ page }, testInfo) => {
    // Suggest button uses hidden md:block — skip on mobile
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) testInfo.skip();
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          withFeatureFlags({ user_story_suggestions: true })
        ),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    await expect(
      page.locator("[data-suggest-place-trigger]")
    ).toBeVisible();
  });

  test("fullscreen button hidden when flag off", async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    // Fullscreen button has translated aria-label (Fullscreen, Pantalla completa, etc.)
    await expect(
      page.getByRole("button", { name: /fullscreen|pantalla completa|plein|ecrã/i })
    ).toHaveCount(0);
  });

  test("fullscreen button visible when flag on", async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          withFeatureFlags({ fullscreen_button: true })
        ),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /fullscreen|pantalla completa|plein|ecrã/i })
    ).toBeVisible();
  });
});

// ─── Language Switching ──────────────────────────────────────────

test.describe("Language switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("language switcher visible in toolbar", async ({ page }) => {
    // The switcher is a div with role="group" and language-related aria-label
    const switcher = page.locator('div[role="group"]').first();
    await expect(switcher).toBeVisible();
  });

  test("switching to ES changes UI text", async ({ page }) => {
    // Desktop Chrome defaults to English — switch to ES
    const switcher = page.locator('div[role="group"]').first();
    await switcher.locator("button").first().click();

    // Click ES in the dropdown
    const esButton = page.locator('div[role="group"]').getByRole("option", { name: "ES", exact: true });
    await esButton.click();
    await page.waitForTimeout(300);

    // Open chat to check Spanish placeholder
    await page.locator('[data-testid="ask-button"]').click();
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    await dismissPrivacyNotice(chatPanel);

    const input = chatPanel.locator("input");
    await expect(input).toHaveAttribute(
      "placeholder",
      /escribe tu pregunta/i
    );
  });

  test("switching to EN shows English text", async ({ page }) => {
    // First switch to ES, then back to EN to verify round-trip
    const switcher = page.locator('div[role="group"]').first();

    // Switch to ES first
    await switcher.locator("button").first().click();
    const esButton = page.locator('div[role="group"]').getByRole("option", { name: "ES", exact: true });
    await esButton.click();
    await page.waitForTimeout(300);

    // Now switch back to EN
    await switcher.locator("button").first().click();
    const enButton = page.locator('div[role="group"]').getByRole("option", { name: "EN", exact: true });
    await enButton.click();
    await page.waitForTimeout(300);

    // Open chat to check English placeholder
    await page.locator('[data-testid="ask-button"]').click();
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    await dismissPrivacyNotice(chatPanel);

    const input = chatPanel.locator("input");
    await expect(input).toHaveAttribute(
      "placeholder",
      /ask about this place/i
    );
  });

  test("language persists in localStorage", async ({ page }) => {
    // Switch to ES (different from default EN)
    const switcher = page.locator('div[role="group"]').first();
    await switcher.locator("button").first().click();
    const esButton = page.locator('div[role="group"]').getByRole("option", { name: "ES", exact: true });
    await esButton.click();
    await page.waitForTimeout(300);

    const storedLocale = await page.evaluate(() =>
      localStorage.getItem("paisaxe-locale")
    );
    expect(storedLocale).toBe("es");
  });

  test("chat input placeholder changes with language", async ({ page }) => {
    // Mock chat API
    await page.route("**/api/chat/stream", (route) => {
      const textEvent = `data: ${JSON.stringify({ type: "text", content: MOCK_CHAT_RESPONSE.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: MOCK_CHAT_RESPONSE.images, sources: MOCK_CHAT_RESPONSE.sources })}\n\n`;
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    });

    // Open chat (default locale is EN in Desktop Chrome)
    await page.locator('[data-testid="ask-button"]').click();
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    await dismissPrivacyNotice(chatPanel);

    const input = chatPanel.locator("input");
    const placeholderEN = await input.getAttribute("placeholder");

    // Close chat (use the accessible name set by the component)
    const closeButton = chatPanel.getByRole("button", { name: /close/i });
    await closeButton.click();
    await expect(chatPanel).not.toBeVisible();

    // Switch to ES
    const switcher = page.locator('div[role="group"]').first();
    await switcher.locator("button").first().click();
    const esButton = page.locator('div[role="group"]').getByRole("option", { name: "ES", exact: true });
    await esButton.click();
    await page.waitForTimeout(300);

    // Re-open chat
    await page.locator('[data-testid="ask-button"]').click();
    await expect(chatPanel).toBeVisible();

    await dismissPrivacyNotice(chatPanel);

    const placeholderES = await input.getAttribute("placeholder");

    // Placeholders should be different (EN vs ES)
    expect(placeholderES).not.toBe(placeholderEN);
  });
});
