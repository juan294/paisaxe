import { createServer, type ServerResponse } from "node:http";
import type { Page, Request, Route } from "@playwright/test";
import { test, expect } from "./fixtures/base-test";
import { MOCK_FEATURE_FLAGS, MOCK_CHAT_RESPONSE } from "./fixtures/mock-data";

const CONSENT_KEY = "paisaxe-privacy-acknowledged";
const LATE_TEXT = "late chunk from the cancelled first request";

async function openReadyChat(page: Page, acknowledgePrivacy: boolean) {
  await page.getByTestId("ask-button").first().click();
  const chatPanel = page.getByRole("dialog");
  await expect(chatPanel, "Chat must open before checking consent").toBeVisible();

  const privacyButton = chatPanel.getByRole("button", {
    name: /^(entendido|entendío|got it|compris|verstanden|entendi)$/i,
  });
  if (acknowledgePrivacy) {
    await expect(privacyButton, "A fresh visitor must see the privacy notice").toBeVisible();
    await privacyButton.click();
  }
  await expect(privacyButton, "Acknowledged consent must survive reload").toHaveCount(0);
  await expect.poll(
    () => page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY),
    { message: "Privacy acknowledgement must be persisted" }
  ).toBe("true");

  const input = chatPanel.getByRole("textbox");
  await expect(input, "Wait for auth initialization to render the composer").toBeVisible();
  await expect(input, "Composer must be ready for the next request").toBeEnabled();
  return { chatPanel, input };
}

test.describe("SSE abort", () => {
  test.beforeEach(async ({ page }) => {
    // Diagnostic mode for the phase's 40-run reliability check. It exercises
    // the same assertions and timeout budgets under controlled browser load.
    if (process.env.SSE_READINESS_DELAYED === "true") {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200_000,
        uploadThroughput: 93_750,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      test.info().annotations.push({
        type: "controlled-delay",
        description: "CPU 4x; network 150ms, 200000 B/s down, 93750 B/s up",
      });
    }
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
    let firstRequest: Request | undefined;
    let streamResponse: ServerResponse | undefined;
    let streamCancelled = false;
    let streamRequestBody = "";
    let streamRequestEnded = false;
    const streamServer = createServer((request, response) => {
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => { streamRequestBody += chunk; });
      request.on("end", () => { streamRequestEnded = true; });
      streamResponse = response;
      response.on("close", () => { streamCancelled = !response.writableEnded; });
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": new URL(page.url()).origin,
      });
      response.flushHeaders();
      // Send bytes so the browser is reading a real unfinished HTTP stream,
      // rather than a request paused inside Playwright's routing machinery.
      response.write(": first stream is open\n\n");
    });
    const releaseFirst = () => {
      if (streamResponse && !streamResponse.writableEnded) {
        streamResponse.end(`data: ${JSON.stringify({ type: "text", content: LATE_TEXT })}\n\n`);
      }
    };
    let streamUrl: string;

    const chatRoute = async (route: Route) => {
      chatRequests += 1;
      if (chatRequests === 1) {
        firstRequest = route.request();
        await route.continue({ url: streamUrl });
        return;
      }

      const textEvent = `data: ${JSON.stringify({ type: "text", content: MOCK_CHAT_RESPONSE.message })}\n\n`;
      const doneEvent = `data: ${JSON.stringify({ type: "done", images: MOCK_CHAT_RESPONSE.images, sources: MOCK_CHAT_RESPONSE.sources })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: textEvent + doneEvent,
      });
    };
    try {
      await new Promise<void>((resolve, reject) => {
        streamServer.once("error", reject);
        streamServer.listen(0, "127.0.0.1", resolve);
      });
      const address = streamServer.address();
      if (!address || typeof address === "string") throw new Error("Streaming fixture did not bind a loopback port");
      streamUrl = `http://127.0.0.1:${address.port}/api/chat/stream`;
      await page.route("**/api/chat/stream", chatRoute);
      await page.goto("/immersive");
      await expect(page.locator("h1").first()).toBeVisible();
      const { chatPanel, input } = await openReadyChat(page, true);
      await input.fill("Start a long answer");
      const [request] = await Promise.all([
        page.waitForRequest((request) => request.url().endsWith("/api/chat/stream") && request.method() === "POST"),
        chatPanel.locator('button[type="submit"]').click(),
      ]);
      await expect.poll(() => firstRequest === request, { message: "First POST must reach the held route" }).toBe(true);
      expect(request.postDataJSON().message).toBe("Start a long answer");
      await expect.poll(() => streamResponse !== undefined, {
        message: "The first POST must reach the real loopback streaming server",
      }).toBe(true);
      await expect.poll(() => firstRequest?.response().then((response) => response?.status()), {
        message: "The browser must receive the first stream's HTTP headers",
      }).toBe(200);
      await expect.poll(() => streamRequestEnded, {
        message: "The server must receive the complete first POST body",
      }).toBe(true);
      expect(JSON.parse(streamRequestBody).message).toBe("Start a long answer");
      expect(streamCancelled, "The first HTTP stream must remain open until reload").toBe(false);
      await expect(input, "The first request must still be in flight").toBeDisabled();

      await page.reload();
      // A peer close before end() is cancellation of the actual HTTP stream.
      // Observe it before releasing the fixture, independently of browser
      // automation events for requests belonging to the old document.
      await expect.poll(() => streamCancelled, {
        message: "The loopback server must observe its unfinished response being closed",
      }).toBe(true);
      releaseFirst();

      await expect(page.locator("h1").first()).toBeVisible();
      const { chatPanel: reloadedChatPanel, input: reloadedInput } = await openReadyChat(page, false);
      await expect(reloadedChatPanel.getByText(LATE_TEXT, { exact: true })).toHaveCount(0);
      await reloadedInput.fill("Try again");
      const [nextRequest] = await Promise.all([
        page.waitForRequest((request) => request.url().endsWith("/api/chat/stream") && request.method() === "POST"),
        reloadedChatPanel.locator('button[type="submit"]').click(),
      ]);
      expect(nextRequest.postDataJSON().message).toBe("Try again");
      await expect.poll(() => chatRequests).toBe(2);
      await expect(reloadedChatPanel.getByText(MOCK_CHAT_RESPONSE.message, { exact: true })).toBeVisible();
      await expect(reloadedInput, "The second SSE done event must restore the composer").toBeEnabled();
      await expect(reloadedChatPanel.getByText(LATE_TEXT, { exact: true })).toHaveCount(0);
    } finally {
      // Release even when readiness, submission or cancellation assertions fail.
      try {
        releaseFirst();
        await page.unroute("**/api/chat/stream", chatRoute);
      } finally {
        // Close only the server created by this test, including held/idle
        // sockets if an earlier assertion or route cleanup failed.
        streamServer.closeAllConnections();
        if (streamServer.listening) {
          await new Promise<void>((resolve, reject) => {
            streamServer.close((error) => error ? reject(error) : resolve());
          });
        }
      }
    }
  });
});
