import { test, expect } from "./fixtures/base-test";
import { MOCK_FEATURE_FLAGS, MOCK_CHAT_RESPONSE } from "./fixtures/mock-data";

test.describe("SSE abort", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );
  });

  test("reloading during an in-flight chat stream aborts the request and the next chat still works", async ({ page }) => {
    let chatRequests = 0;
    const firstRequest = {
      release: undefined as (() => void) | undefined,
    };

    await page.route("**/api/chat/stream", async (route) => {
      chatRequests += 1;

      if (chatRequests === 1) {
        await new Promise<void>((resolve) => {
          firstRequest.release = resolve;
        });

        try {
          await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: `data: ${JSON.stringify({ type: "text", content: "late chunk" })}\n\n`,
          });
        } catch {
          // The page reload aborts the request before the delayed fulfill resolves.
        }

        return;
      }

      const textEvent = `data: ${JSON.stringify({ type: "text", content: MOCK_CHAT_RESPONSE.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: MOCK_CHAT_RESPONSE.images, sources: MOCK_CHAT_RESPONSE.sources })}\n\n`;

      await route.fulfill({
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

    await chatPanel.locator("input").fill("Start a long answer");
    await chatPanel.locator('button[type="submit"]').click();

    await expect.poll(() => chatRequests).toBe(1);

    await page.reload();
    firstRequest.release?.();

    await expect(page.locator("h1").first()).toBeVisible();

    await page.locator('[data-testid="ask-button"]').first().click();

    const reloadedChatPanel = page.locator(".fixed.inset-0.z-50");
    await expect(reloadedChatPanel).toBeVisible();

    const reloadedPrivacyButton = reloadedChatPanel.locator("button").filter({
      hasText: /entend|understood|ok/i,
    });
    if (await reloadedPrivacyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await reloadedPrivacyButton.click();
    }

    await reloadedChatPanel.locator("input").fill("Try again");
    await reloadedChatPanel.locator('button[type="submit"]').click();

    await expect.poll(() => chatRequests).toBe(2);
    await expect(
      reloadedChatPanel.getByText(/Lagos de Covadonga son dos lagos/)
    ).toBeVisible({ timeout: 5000 });
  });
});
