import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { handleRootRedirect } from "./root-redirect";

function makeRequest(path: string): NextRequest {
  return new NextRequest(`https://paisaxe.es${path}`);
}

describe("handleRootRedirect", () => {
  it("redirects / to /immersive with status 308", () => {
    const req = makeRequest("/");
    const res = handleRootRedirect(req);
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toContain("/immersive");
  });

  it("returns null for /immersive (no redirect)", () => {
    const req = makeRequest("/immersive");
    expect(handleRootRedirect(req)).toBeNull();
  });

  it("returns null for /pricing", () => {
    const req = makeRequest("/pricing");
    expect(handleRootRedirect(req)).toBeNull();
  });

  it("returns null for /api/chat", () => {
    const req = makeRequest("/api/chat");
    expect(handleRootRedirect(req)).toBeNull();
  });

  it("returns null for /story/some-slug", () => {
    const req = makeRequest("/story/picos-de-europa");
    expect(handleRootRedirect(req)).toBeNull();
  });

  it("uses 308 permanent redirect (preserves method)", () => {
    const req = makeRequest("/");
    const res = handleRootRedirect(req);
    expect(res?.status).toBe(308);
  });

  it("preserves the hostname in the redirect URL", () => {
    const req = makeRequest("/");
    const res = handleRootRedirect(req);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("paisaxe.es");
  });
});
