import { test, expect } from "./fixtures/base-test";
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

    // Mock streaming chat API with SSE response
    await page.route("**/api/chat/stream", (route) => {
      // Build SSE response with text chunk and done event
      const textEvent = `data: ${JSON.stringify({ type: "text", content: MOCK_CHAT_RESPONSE.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: MOCK_CHAT_RESPONSE.images, sources: MOCK_CHAT_RESPONSE.sources })}\n\n`;
      const sseBody = textEvent + doneEvent;

      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("opens chat panel when Ask button is clicked", async ({ page }) => {
    // Find and click the "ask about" button
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    // Chat panel should appear (it's a fixed overlay with z-50)
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();
  });

  test("sends a message and receives a mocked response", async ({ page }) => {
    // Open chat
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    // Wait for chat panel
    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Dismiss privacy notice if shown (must be inside chat panel)
    const privacyButton = chatPanel.locator("button").filter({ hasText: /entend|understood|ok/i });
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
    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    // Click the close button (X icon)
    const closeButton = chatPanel.locator("button").filter({ has: page.locator("svg.lucide-x") });
    await closeButton.click();

    // Chat panel should be gone
    await expect(chatPanel).not.toBeVisible();
  });

  test("shows generic error UI when SSE stream returns error event", async ({ page }) => {
    // Override the beforeEach route to return an SSE error event
    await page.route("**/api/chat/stream", (route) => {
      const errorEvent = `data: ${JSON.stringify({ type: "error", message: "Internal server error" })}\n\n`;
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: errorEvent,
      });
    });

    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    const privacyButton = chatPanel.locator("button").filter({ hasText: /entend|understood|ok/i });
    if (await privacyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await privacyButton.click();
    }

    const input = chatPanel.locator("input");
    await input.fill("Test question");

    const sendButton = chatPanel.locator('button[type="submit"]');
    await sendButton.click();

    // Error copy should appear in the assistant message
    await expect(
      chatPanel.getByText(/Lo siento|error|sorry/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
