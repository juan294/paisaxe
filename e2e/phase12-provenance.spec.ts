import { test, expect } from "./fixtures/base-test";
import { installStoryFixture, syntheticIconProvenance, syntheticStories } from "./fixtures/phase12-provenance";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "../src/lib/image-provenance";
import type { ImageResult, Source } from "../src/types";

const answer = "Respuesta sintética para comprobar las citas y las imágenes, sin recomendaciones turísticas.";
const citation = {
  title: "Fuente estructurada sintética",
  url: "https://example.com/phase12/synthetic-source",
  license: "CC0-1.0",
  revision: "123456",
  attribution: "Synthetic source fixture; no factual approval",
};
const source: Source = {
  id: "synthetic-citation", title: "Rejected legacy synthetic label", snippet: "Synthetic fixture only",
  sourcePdf: "rejected-synthetic-guide.pdf", pageNumber: 77, citation,
};

for (const kind of ["reviewed synthetic icon", "missing provenance", "mismatched provenance"] as const) {
  test(`authored citation and ${kind} are rendered through the real chat`, async ({ page, baseURL }, testInfo) => {
    await installStoryFixture(page, baseURL, syntheticStories());
    const rejected = "/images/phase12-rejected-chat-fixture.webp";
    const accepted = kind === "reviewed synthetic icon";
    const image: ImageResult = {
      id: "synthetic-chat-image", path: accepted ? "/icon-192.png" : rejected,
      caption: "Rejected cached place caption", sourcePdf: "rejected-synthetic-guide.pdf",
      ...(kind === "missing provenance" ? {} : { provenance: syntheticIconProvenance("/icon-192.png") }),
    };
    const requests: string[] = [];
    page.on("request", request => requests.push(request.url()));
    let exchanges = 0;
    await page.route("**/api/chat/stream", async route => {
      expect(route.request().method()).toBe("POST");
      exchanges += 1;
      await route.fulfill({
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ type: "text", content: answer })}\n\ndata: ${JSON.stringify({ type: "done", sources: [source], images: [image] })}\n\n`,
      });
    });
    await page.goto("/immersive?story=phase12-synthetic-1");
    await expect(page.getByTestId("story-title").first()).toHaveText("Historia sintética 1");
    await page.getByTestId("ask-button").filter({ visible: true }).click();
    const chat = page.locator(".fixed.inset-0.z-50");
    await expect(chat).toBeVisible();
    await chat.getByRole("button", { name: /entendido|understood/i }).click();
    await chat.locator("input").fill("Comprobar la atribución sintética");
    await chat.locator('button[type="submit"]').click();
    const log = chat.getByRole("log");
    await expect(log.getByText(answer, { exact: true })).toBeVisible();
    const link = log.getByRole("link", { name: `${citation.title} · ${citation.attribution} · ${citation.license}`, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", citation.url);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(log.getByText(/Rejected legacy synthetic label|rejected-synthetic-guide\.pdf|Rejected cached place caption|, 77/)).toHaveCount(0);
    const figure = log.locator("figure");
    await expect(figure).toHaveCount(1);
    const rendered = figure.locator("img");
    await expect.poll(() => rendered.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    if (accepted) {
      expect(new URL(await rendered.evaluate((node: HTMLImageElement) => node.currentSrc)).searchParams.get("url")).toBe("/icon-192.png");
      await expect(rendered).toHaveAttribute("alt", "Synthetic application icon; not a photograph of a place");
      await expect(figure.getByRole("link", { name: "Synthetic application icon fixture", exact: true })).toHaveAttribute("href", "https://example.com/synthetic-photo-review");
      await expect(figure).toContainText("owner-permission");
      await expect(figure).toContainText("Imagen temática, no representa el lugar");
    } else {
      await expect(rendered).toHaveJSProperty("src", new URL(NEUTRAL_IMAGE, baseURL).href);
      await expect(rendered).toHaveAttribute("alt", NEUTRAL_CREDIT);
      await expect(figure.getByText(NEUTRAL_CREDIT, { exact: true })).toBeVisible();
      await expect(figure.locator("figcaption")).toHaveCount(0);
      await expect(figure.getByRole("link")).toHaveCount(0);
      expect(requests.filter(url => decodeURIComponent(url).includes(rejected))).toEqual([]);
    }
    expect(exchanges).toBe(1);
    const screenshot = testInfo.outputPath("synthetic-citation-and-image.png");
    await chat.screenshot({ path: screenshot });
    await testInfo.attach("Actual chat citation and synthetic image provenance", { path: screenshot, contentType: "image/png" });
  });
}
