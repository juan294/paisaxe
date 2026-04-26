import { test, expect } from "./fixtures/base-test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

test.describe("XSS canary", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );
  });

  test("chat markdown output does not execute injected html", async ({ page }) => {
    let canaryHit = false;

    await page.route("**/xss-canary", (route) => {
      canaryHit = true;
      return route.fulfill({ status: 200, body: "blocked" });
    });

    const payload = `<img src=x onerror=fetch('/xss-canary')><script>fetch('/xss-canary')</script>`;

    await page.route("**/api/chat/stream", (route) => {
      const textEvent = `data: ${JSON.stringify({ type: "text", content: payload })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`;

      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    });

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();

    const askButton = page.locator('[data-testid="ask-button"]').first();
    await askButton.click();

    const chatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(chatPanel).toBeVisible();

    const privacyButton = chatPanel.locator("button").filter({ hasText: /entend|understood|ok/i });
    if (await privacyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await privacyButton.click();
    }

    await chatPanel.locator("input").fill("Show me the payload");
    await chatPanel.locator('button[type="submit"]').click();

    const messageLog = chatPanel.locator('[role="log"]');
    await expect(messageLog).toContainText("fetch('/xss-canary')");
    await expect(messageLog.locator("script")).toHaveCount(0);
    await expect(messageLog.locator("img")).toHaveCount(0);
    await expect(messageLog.locator("[onerror]")).toHaveCount(0);

    // Wait for any pending async XSS payloads to fire before asserting no canary hit
    await page.waitForLoadState("networkidle");
    expect(canaryHit).toBe(false);
  });
});
