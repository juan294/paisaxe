import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { handleStoryRewrite } from "./story-rewrite";

function makeRequest(path: string): NextRequest {
  return new NextRequest(`https://paisaxe.es${path}`);
}

describe("handleStoryRewrite", () => {
  it("rewrites /story/:slug to /immersive?story=:slug with status 308", () => {
    const req = makeRequest("/story/picos-de-europa");
    const res = handleStoryRewrite(req);
    expect(res?.status).toBe(308);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("/immersive");
    expect(location).toContain("story=picos-de-europa");
  });

  it("rewrites a slug with numbers and dashes", () => {
    const req = makeRequest("/story/oviedo-2024");
    const res = handleStoryRewrite(req);
    expect(res?.status).toBe(308);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("story=oviedo-2024");
  });

  it("rewrites a slug with underscores", () => {
    const req = makeRequest("/story/costa_verde");
    const res = handleStoryRewrite(req);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("story=costa_verde");
  });

  it("returns null for /story/ with no slug", () => {
    const req = makeRequest("/story/");
    expect(handleStoryRewrite(req)).toBeNull();
  });

  it("returns null for paths that are not /story/:slug", () => {
    const req = makeRequest("/immersive");
    expect(handleStoryRewrite(req)).toBeNull();
  });

  it("returns null for the root path", () => {
    const req = makeRequest("/");
    expect(handleStoryRewrite(req)).toBeNull();
  });

  it("returns null for /api/chat", () => {
    const req = makeRequest("/api/chat");
    expect(handleStoryRewrite(req)).toBeNull();
  });

  it("returns null for nested /story/a/b (only top-level slugs match)", () => {
    const req = makeRequest("/story/a/b");
    expect(handleStoryRewrite(req)).toBeNull();
  });

  it("uses 308 permanent redirect", () => {
    const req = makeRequest("/story/cudillero");
    const res = handleStoryRewrite(req);
    expect(res?.status).toBe(308);
  });

  it("sets ?story= query parameter to the exact slug value", () => {
    const slug = "somiedo-park";
    const req = makeRequest(`/story/${slug}`);
    const res = handleStoryRewrite(req);
    const location = res?.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("story")).toBe(slug);
    expect(url.pathname).toBe("/immersive");
  });
});
