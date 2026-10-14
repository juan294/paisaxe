import { expect, type Page, type Request } from "@playwright/test";
import type { MOCK_FEATURE_FLAGS } from "./mock-data";

type FlagPayload = typeof MOCK_FEATURE_FLAGS;

/**
 * Opt in before navigation, then settle explicitly after the real page hydrates.
 * Exercise the existing 60-second SSR cache and normal window-focus refresh,
 * without changing application state. The clock continues progressing normally
 * after each jump, so subsequent autoplay and dialog timers still run.
 */
export async function mockFeatureFlagsAfterSsr(
  page: Page,
  payload: FlagPayload,
): Promise<(nextPayload?: FlagPayload) => Promise<void>> {
  await page.clock.install();
  let currentPayload = payload;
  let revision = 0;
  let receivedRevision = -1;
  const requests = new WeakMap<Request, number>();
  page.on("response", (response) => {
    const requestRevision = requests.get(response.request());
    if (requestRevision !== undefined && response.status() === 200) {
      void response.finished().then((error) => {
        if (!error) receivedRevision = Math.max(receivedRevision, requestRevision);
      }).catch(() => { /* A closed page must not look like a consumed response. */ });
    }
  });
  await page.route("**/api/feature-flags", async (route) => {
    requests.set(route.request(), revision);
    await route.fulfill({ status: 200, json: currentPayload });
  });

  return async (nextPayload) => {
    if (nextPayload !== undefined) {
      currentPayload = nextPayload;
      revision += 1;
    }
    await expect(page.locator('[data-story-navigation-ready="true"]:visible')).toHaveCount(1);
    // Dummy-host suites may already have fetched because their TTL is zero.
    // Focus also refreshes later revisions after the one-shot SSR timer ran.
    if (receivedRevision < revision) {
      await page.clock.fastForward(61_000);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    }
    await expect.poll(() => receivedRevision, {
      message: "The page must consume this revision of its mocked feature flags",
    }).toBe(revision);
    // Network completion precedes response.json()/React's scheduled update.
    // Yield browser tasks and two paints before callers assert the actual UI.
    // The on-to-off cases additionally require an observable state transition.
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Flag response paint did not settle")), 2_000);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.clearTimeout(timeout);
        resolve();
      }));
    }));
  };
}
