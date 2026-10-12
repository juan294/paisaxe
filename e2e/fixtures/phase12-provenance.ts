import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import type { Story } from "../../src/types/immersive";
import { imageProvenanceFixture } from "../../src/test/image-provenance-fixture";
import { MOCK_FEATURE_FLAGS } from "./mock-data";

export const SYNTHETIC_ICON_PATHS = ["/icon-192.png", "/icon-512.png", "/icon-maskable-192.png"] as const;

/** Application artwork only; this synthetic record grants no real photo permission. */
export function syntheticIconProvenance(path: typeof SYNTHETIC_ICON_PATHS[number]): string {
  const bytes = readFileSync(join(process.cwd(), "public", path.slice(1)));
  return imageProvenanceFixture(path, bytes, bytes, {
    permission: "Application icon bytes used only as a synthetic browser fixture; no real photo permission",
    credit: "Synthetic application icon fixture",
    alt: "Synthetic application icon; not a photograph of a place",
    context: "thematic",
  });
}

export function syntheticStories(): Story[] {
  return SYNTHETIC_ICON_PATHS.map((image, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    slug: `phase12-synthetic-${index + 1}`,
    title: `Historia sintética ${index + 1}`,
    subtitle: "Fixture de navegación, no contenido turístico",
    description: "Ilustración de la aplicación para comprobar el contrato de imágenes.",
    image,
    imageSource: syntheticIconProvenance(image),
    category: "nature",
    sourcePdf: "",
    displayOrder: index,
  }));
}

/** Network/clock boundaries only; the real provider, cache, viewer and optimizer run. */
export async function installStoryFixture(page: Page, baseURL: string | undefined, stories: Story[]): Promise<void> {
  if (!baseURL) throw new Error("Synthetic provenance fixtures require a loopback application origin");
  const url = new URL(baseURL);
  expect(url.protocol).toBe("http:");
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  await page.context().addCookies([{ name: "paisaxe-locale", value: "es", url: url.origin }]);
  await page.addInitScript(() => sessionStorage.setItem("paisaxe-nav-hint-seen", "true"));
  // Age the genuine five-minute SSR seed without changing owned cache state or
  // pausing native timers. Its ordinary refresh must fetch the network fixture.
  await page.clock.setFixedTime(Date.now() + 6 * 60 * 1000);
  // Mock only the two public API fetch boundaries. Playwright routing disables
  // native HTTP caching, which would invalidate the optimizer deduplication oracle.
  // The real SSR seed, query refresh, store, viewer and image requests still run.
  await page.addInitScript(({ stories, flags }) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request ? request.url : input.toString(), window.location.href);
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      if (url.origin === window.location.origin && method === "GET" && !url.search && !url.hash &&
        (url.pathname === "/api/stories" || url.pathname === "/api/feature-flags")) {
        const signal = init?.signal === null ? undefined : init?.signal ?? request?.signal;
        signal?.throwIfAborted();
        return new Response(JSON.stringify(url.pathname === "/api/stories" ? { data: stories } : flags), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return nativeFetch(input, init);
    };
  }, { stories, flags: MOCK_FEATURE_FLAGS });
}
