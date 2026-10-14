import { test, expect } from "@playwright/test";
import { installStoryFixture, syntheticStories } from "./fixtures/phase12-provenance";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "../src/lib/image-provenance";

test("current story image leads adjacent warming without duplicate optimizer fetches", async ({ page, baseURL }) => {
  await installStoryFixture(page, baseURL, syntheticStories());
  const requests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/_next/image") requests.push(request.url());
  });
  await page.goto("/immersive?story=phase12-synthetic-1");
  // Initial SSR may show neutral fallback. Begin measurement only after the
  // real cache refresh has rendered the exact reviewed synthetic raster story.
  await expect(page.getByTestId("story-title").first()).toHaveText("Historia sintética 1");
  const current = page.locator("main img[alt]:not([alt=''])").first();
  await expect(current).toBeVisible();
  await expect(current).toHaveAttribute("fetchpriority", "high");
  await expect.poll(() => current.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const initialUrl = await current.evaluate((image: HTMLImageElement) => image.currentSrc);
  expect(new URL(initialUrl).searchParams.get("url")).toBe("/icon-192.png");
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
  // The initial neutral SSR resource hint can remain in the document. Among
  // the three synthetic rasters, only the current image may be preloaded.
  const preloads = page.locator("link[rel='preload'][as='image'][imagesrcset*='icon-']");
  await expect(preloads).toHaveCount(1);
  await expect(preloads).toHaveAttribute("imagesrcset", /icon-192\.png/);
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

test("neutral images deduplicate adjacent warming and navigate without requesting rejected photos", async ({ page, baseURL }) => {
  const rejected = "/images/phase12-rejected-synthetic-photo.webp";
  const stories = syntheticStories().map(story => ({ ...story, image: rejected, imageSource: "Unverified synthetic credit", blurDataUrl: "data:image/png;base64,cmVqZWN0ZWQ=" }));
  await installStoryFixture(page, baseURL, stories);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/immersive?story=phase12-synthetic-1");
  await expect(page.getByTestId("story-title").first()).toHaveText("Historia sintética 1");
  const current = page.locator("main img[alt]:not([alt=''])").first();
  await expect(current).toHaveJSProperty("src", new URL(NEUTRAL_IMAGE, baseURL).href);
  await expect(current).toHaveAttribute("alt", NEUTRAL_CREDIT);
  await expect.poll(() => current.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator("main [aria-hidden='true'] img[alt='']")).toHaveCount(0);
  await expect(page.getByText(NEUTRAL_CREDIT, { exact: true }).first()).toBeVisible();
  expect(await current.getAttribute("style")).not.toContain("cmVqZWN0ZWQ=");
  const initialUrl = await current.evaluate((image: HTMLImageElement) => image.currentSrc);
  await page.getByTestId("next-story-button").filter({ visible: true }).click();
  await expect(page.getByTestId("story-title").first()).toHaveText("Historia sintética 2");
  expect(await current.evaluate((image: HTMLImageElement) => image.currentSrc)).toBe(initialUrl);
  await expect(page.locator("main [aria-hidden='true'] img[alt='']")).toHaveCount(0);
  expect(requests.filter(url => decodeURIComponent(url).includes(rejected))).toEqual([]);
});
