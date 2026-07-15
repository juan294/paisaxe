import { test, expect } from "./fixtures/base-test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

// #722: /story/[slug] redirects to /immersive?story=<slug> server-side and
// had no E2E coverage of its own. "lagos-covadonga" is the first fallback
// story (content/fallback-stories.json), the same one immersive.spec.ts
// relies on when the dummy e2e Supabase config falls back to static content.
test.describe("Story slug page", () => {
  test("renders the story title after redirecting to the immersive viewer", async ({
    page,
  }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    await page.goto("/story/lagos-covadonga");

    await expect(page).toHaveURL(/\/immersive\?story=lagos-covadonga/);
    await expect(page.getByTestId("story-title").first()).toBeVisible({ timeout: 15000 });
  });
});
