import { test, expect } from "./fixtures/auth";
import { assertLocalDatastore } from "../scripts/release/probe-guards";

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
  authenticatedPage,
}) => {
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
  } finally {
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
