import { test, expect } from "@playwright/test";

test("current story image leads adjacent warming without duplicate optimizer fetches", async ({ page }) => {
  // Routing disables the browser cache; exercise real optimizer reuse instead.
  await page.addInitScript(() => sessionStorage.setItem("paisaxe-nav-hint-seen", "true"));
  const requests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/_next/image") requests.push(request.url());
  });
  await page.goto("/immersive");
  const current = page.locator("main img[alt]:not([alt=''])").first();
  await expect(current).toBeVisible();
  await expect(current).toHaveAttribute("fetchpriority", "high");
  await expect.poll(() => current.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const initialUrl = await current.evaluate((image: HTMLImageElement) => image.currentSrc);
  const adjacent = page.locator("main [aria-hidden='true'] img[alt='']");
  await expect(adjacent).toHaveCount(2);
  for (const image of await adjacent.all()) {
    await expect(image).toHaveAttribute("loading", "eager");
    await expect(image).toHaveAttribute("fetchpriority", "low");
  }
  const warmedNext = adjacent.first();
  await expect.poll(() => warmedNext.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const warmedNextUrl = await warmedNext.evaluate((image: HTMLImageElement) => image.currentSrc);
  expect(warmedNextUrl).not.toBe(initialUrl);
  const preloads = page.locator("link[rel='preload'][as='image']");
  await expect(preloads).toHaveCount(1);
  expect(requests.filter(url => url === initialUrl)).toHaveLength(1);
  const initialTitle = await page.locator("main h1").innerText();
  const next = page.getByTestId("next-story-button");
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator("main h1")).not.toHaveText(initialTitle);
  await expect.poll(() => current.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const nextUrl = await current.evaluate((image: HTMLImageElement) => image.currentSrc);
  expect(nextUrl).toBe(warmedNextUrl);
  expect(requests.filter(url => url === nextUrl)).toHaveLength(1);
  await expect(page.getByRole("button", { name: /^(Discover it|Descúbrelo)$/ })).toBeEnabled();
});
