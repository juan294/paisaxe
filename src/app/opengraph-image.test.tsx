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

import Image, { alt, size, contentType, runtime } from "./opengraph-image";

describe("root opengraph-image", () => {
  it("exports alt text describing the image", () => {
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

  it("default export is a function that returns a Response", async () => {
    expect(typeof Image).toBe("function");
    const response = await Image();
    expect(response).toBeInstanceOf(Response);
  });
});
