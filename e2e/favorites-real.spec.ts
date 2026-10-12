import { test, expect } from "./fixtures/auth";
import { assertLocalDatastore } from "../scripts/release/probe-guards";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "../src/lib/image-provenance";

/**
 * FE-B2: a real, UI-driven authenticated favorite round-trip.
 *
 * Every other E2E project (desktop, mobile, qa-journey) shares one webServer
 * that is always built with dummy Supabase credentials. auth-provider.tsx
 * inlines `NEXT_PUBLIC_SUPABASE_ANON_KEY` into the client bundle at build
 * time and skips its whole auth bootstrap when that key doesn't start with
 * "eyJ" (see auth-provider.tsx's "Skip auth with dummy credentials"
 * comment). That means no client-side authenticated interaction — including
 * clicking the bookmark button (src/components/immersive/bookmark-button.tsx,
 * wired through useFavorites in src/hooks/use-favorites.ts) — is reachable
 * from those projects, no matter what session the `authenticatedPage`
 * fixture injects into the browser context.
 *
 * qa-journey.spec.ts Journeys 10-11 papered over this by writing directly to
 * `localStorage.paisaxe_favorites` instead of driving the UI — the app's
 * real persistence is `/api/favorites` -> Postgres `user_favorites`, and a
 * regression there (like FE-B1) sails through those journeys undetected.
 *
 * This spec instead lives on its own `auth-integration` Playwright project
 * (playwright.config.ts), which is excluded from `desktop`/`mobile` and is
 * never selected by `npm run test:e2e`. It is only meaningful when the
 * shared webServer's build step actually bakes in a real anon key, which
 * requires running it standalone with real credentials pre-set and a fresh
 * build, e.g.:
 *
 *   PLAYWRIGHT_REUSE_SERVER=false \
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon JWT> \
 *   SUPABASE_SERVICE_KEY=<local service_role JWT> \
 *   QA_TEST_USER_EMAIL=qa-test-xxxx@paisaxe.dev \
 *   QA_TEST_USER_PASSWORD=<password> \
 *   npx playwright test --project=auth-integration
 *
 * Plan D-B still applies: never point this at production/Preview Supabase.
 * The guard below enforces that in code.
 */

test.beforeAll(() => {
  // Fail closed, never skip: a probe that opts out of running is a vacuous
  // pass — exactly the failure mode FE-B2 is about.
  assertLocalDatastore(process.env.NEXT_PUBLIC_SUPABASE_URL);
});

test("sign in, bookmark a story via the UI, reload, favorite persists from Postgres", async ({
  authenticatedPage, baseURL,
}) => {
  if (!baseURL) throw new Error("The favorites browser probe requires its application URL");
  const page = authenticatedPage;

  // Deterministic local fixture story (supabase/seed.sql) — guaranteed to
  // exist in the datastore so /api/favorites never rejects the storyId.
  await page.goto("/immersive?story=release-probe-local-story");

  const title = page.getByTestId("story-title").first();
  await expect(title).toBeVisible({ timeout: 15000 });

  // Locators are re-evaluated against the live DOM on every interaction, so
  // the same two are reused before and after the reload below rather than
  // re-querying by role each time.
  const addButton = page.getByRole("button", { name: "Add to saved" }).first();
  const removeButton = page.getByRole("button", { name: "Remove from saved" }).first();

  await expect(addButton, "signed-in user must see the toggle, not an auth prompt").toBeVisible({
    timeout: 10000,
  });

  const favoritePost = page.waitForResponse(
    (response) =>
      response.url().includes("/api/favorites") && response.request().method() === "POST",
  );
  await addButton.click();
  const postResponse = await favoritePost;
  expect(postResponse.status(), "the click must reach the real API route").toBeLessThan(300);

  await expect(removeButton, "UI reflects the toggle immediately").toBeVisible();

  try {
    // Reload the page and re-derive state fresh — nothing in localStorage
    // should be necessary for the button to still read "Remove from saved".
    // localStorage is only ever a cache of `/api/favorites`
    // (src/hooks/use-favorites.ts), so this is the assertion that actually
    // exercises the Postgres round-trip through the real UI.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("story-title").first()).toBeVisible({ timeout: 15000 });
    await expect(
      removeButton,
      "favorite must persist across reload by being read back from Postgres",
    ).toBeVisible({ timeout: 10000 });

    // Exercise the real saved-card surface, including its fresh datastore read.
    await page.goto("/favorites");
    await page.reload({ waitUntil: "domcontentloaded" });
    const savedLink = page.locator('a[href="/immersive?story=release-probe-local-story"]');
    await expect(savedLink).toHaveCount(1);
    await savedLink.scrollIntoViewIfNeeded();
    const card = savedLink.locator("xpath=..");
    const image = card.locator("img");
    await expect(image).toHaveJSProperty("src", new URL(NEUTRAL_IMAGE, baseURL).href);
    await expect(image).toHaveAttribute("alt", NEUTRAL_CREDIT);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(card.getByText(NEUTRAL_CREDIT, { exact: true })).toBeVisible();
    expect(await image.getAttribute("style")).not.toContain("data:image");
  } finally {
    // The saved-card check navigates away; restore the original bookmark surface
    // before using its existing real API DELETE cleanup.
    await page.goto("/immersive?story=release-probe-local-story");
    await expect(removeButton).toBeVisible({ timeout: 10000 });
    // Clean up regardless of the assertions above, so a failed run doesn't
    // leave the QA test user's favorite behind for the next run.
    const favoriteDelete = page.waitForResponse(
      (response) =>
        response.url().includes("/api/favorites") && response.request().method() === "DELETE",
    );
    await removeButton.click();
    const deleteResponse = await favoriteDelete;
    expect(deleteResponse.status()).toBeLessThan(300);
    await expect(addButton).toBeVisible();
  }
});


test("local story server landing page discloses neutral imagery and serves its own OG image", async ({
  browser, baseURL, request,
}, testInfo) => {
  if (!baseURL) throw new Error("The story browser probe requires a loopback application URL");
  const origin = new URL(baseURL);
  expect(origin.protocol).toBe("http:");
  expect(["localhost", "127.0.0.1"]).toContain(origin.hostname);
  // Let React's inline streaming reveal run while holding application hydration
  // and StoryRedirectClient, as in the presentation first-paint probes.
  const context = await browser.newContext({ baseURL });
  let releaseScripts!: () => void;
  let heldScripts = 0;
  const scriptGate = new Promise<void>(resolve => { releaseScripts = resolve; });
  try {
    await context.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => {
      if (new URL(route.request().url()).origin !== origin.origin) return route.fallback();
      heldScripts += 1;
      await scriptGate;
      await route.continue();
    });
    const page = await context.newPage();
    const response = await page.goto("/story/release-probe-local-story", { waitUntil: "commit" });
    expect(response?.status()).toBe(200);
    await expect.poll(() => heldScripts, "Actual application hydration scripts must be held").toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/story\/release-probe-local-story$/);
    const main = page.locator("main");
    await expect(main.locator("h1")).toBeVisible();
    await expect(main.getByRole("link", { name: "Ver experiencia interactiva" })).toHaveAttribute("href", "/immersive?story=release-probe-local-story");
    const image = main.locator("img");
    await expect(image).toHaveJSProperty("src", new URL(NEUTRAL_IMAGE, baseURL).href);
    await expect(image).toHaveAttribute("alt", NEUTRAL_CREDIT);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(main.getByText(NEUTRAL_CREDIT, { exact: true })).toBeVisible();
    expect(await image.getAttribute("style")).not.toContain("data:image");
    await expect(page.locator('link[rel="preload"][as="image"][href*=".webp"]')).toHaveCount(0);

    const metadata = page.locator('meta[property="og:image"]');
    await expect(metadata).toHaveCount(1);
    const value = await metadata.getAttribute("content");
    if (!value) throw new Error("The story is missing its generated OG metadata");
    const og = new URL(value, baseURL);
    expect(og.pathname).toContain("/story/release-probe-local-story/opengraph-image");
    await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
    const twitterImages = await page.locator('meta[name="twitter:image"]').evaluateAll(elements => elements.map(element => element.getAttribute("content")));
    for (const twitter of twitterImages) {
      if (!twitter) throw new Error("Empty Twitter image metadata");
      expect(new URL(twitter, baseURL).pathname).toContain("/story/release-probe-local-story/opengraph-image");
    }
    // Metadata can advertise SITE_URL. Fetch the same path from this owned
    // application only, never from the published host.
    const actual = await request.get(`${og.pathname}${og.search}`);
    expect(actual.status()).toBe(200);
    expect(actual.headers()["content-type"]).toContain("image/png");
    const bytes = await actual.body();
    expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    await testInfo.attach("Actual local story OG response", { body: bytes, contentType: "image/png" });
    await testInfo.attach("Actual local story neutral landing page before hydration", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    releaseScripts();
    await expect(page).toHaveURL(/\/immersive\?story=release-probe-local-story$/, { timeout: 15000 });
  } finally {
    releaseScripts();
    await context.close();
  }
});
