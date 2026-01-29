import { test, expect } from "@playwright/test";
import { MOCK_CHAT_RESPONSE, MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

test.describe("Chat panel", () => {
  test.beforeEach(async ({ page }) => {
    // Mock feature flags
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    // Mock chat API
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CHAT_RESPONSE),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("opens chat panel when Ask button is clicked", async ({ page }) => {
    // Find and click the "ask about" button
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    // Chat panel should appear (it's a fixed overlay with z-50)
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();
  });

  test("sends a message and receives a mocked response", async ({ page }) => {
    // Open chat
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    // Wait for chat panel
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Dismiss privacy notice if shown
    const privacyButton = page.locator("button").filter({ hasText: /entend|accept|ok/i });
    if (await privacyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await privacyButton.click();
    }

    // Type a message in the input
    const input = chatPanel.locator("input");
    await input.fill("¿Dónde están los Lagos de Covadonga?");

    // Submit the form
    const sendButton = chatPanel.locator('button[type="submit"]');
    await sendButton.click();

    // User message should appear
    await expect(chatPanel.getByText("¿Dónde están los Lagos de Covadonga?")).toBeVisible();

    // Wait for mocked assistant response
    await expect(
      chatPanel.getByText(/Lagos de Covadonga son dos lagos/)
    ).toBeVisible({ timeout: 5000 });
  });

  test("closes chat panel via close button", async ({ page }) => {
    // Open chat
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Click the close button (X icon)
    const closeButton = chatPanel.locator("button").filter({ has: page.locator("svg.lucide-x") });
    await closeButton.click();

    // Chat panel should be gone
    await expect(chatPanel).not.toBeVisible();
  });
});
