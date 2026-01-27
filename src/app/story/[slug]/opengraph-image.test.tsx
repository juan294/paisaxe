import { describe, it, expect, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    constructor() {
      return new Response("mock-image", {
        headers: { "content-type": "image/png" },
      });
    }
  },
}));

vi.mock("@/lib/stories-data", () => ({
  getStoryBySlugFromDB: vi.fn().mockImplementation((slug: string) => {
    if (slug === "lagos-covadonga") {
      return Promise.resolve({
        id: "lagos-covadonga",
        slug: "lagos-covadonga",
        title: "Lagos de Covadonga",
        subtitle: "Picos de Europa",
        description: "Dos lagos glaciares en los Picos de Europa",
        image: "/images/stories/lagos-covadonga.png",
        category: "nature",
        sourcePdf: "naturaleza.pdf",
      });
    }
    return Promise.resolve(null);
  }),
}));

import Image, { alt, size, contentType, runtime } from "./opengraph-image";
import * as ogModule from "./opengraph-image";

describe("story opengraph-image", () => {
  it("exports alt text", () => {
    expect(typeof alt).toBe("string");
    expect(alt.length).toBeGreaterThan(0);
  });

  it("exports standard OG image size", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("exports image/png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("exports edge runtime", () => {
    expect(runtime).toBe("edge");
  });

  it("default export is a function", () => {
    expect(typeof Image).toBe("function");
  });

  it("returns a Response for an existing story slug", async () => {
    const response = await Image({ params: Promise.resolve({ slug: "lagos-covadonga" }) });
    expect(response).toBeInstanceOf(Response);
  });

  it("returns a Response for a non-existing story slug (fallback)", async () => {
    const response = await Image({ params: Promise.resolve({ slug: "does-not-exist" }) });
    expect(response).toBeInstanceOf(Response);
  });

  it("does not export generateImageMetadata", () => {
    expect("generateImageMetadata" in ogModule).toBe(false);
  });
});
