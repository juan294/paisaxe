import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { handleCanonicalDomain } from "./canonical-domain";
import { LOCATION_CONFIG } from "@/config/location";

// paisaxe.es is the canonical domain; paisaxe.com is the alternate.

function makeRequest(hostname: string, path = "/"): NextRequest {
  return new NextRequest(`https://${hostname}${path}`);
}

describe("handleCanonicalDomain", () => {
  it("returns null for the canonical domain (no redirect needed)", () => {
    const req = makeRequest(LOCATION_CONFIG.domain);
    expect(handleCanonicalDomain(req)).toBeNull();
  });

  it("returns null for localhost (dev environment)", () => {
    const req = makeRequest("localhost");
    expect(handleCanonicalDomain(req)).toBeNull();
  });

  it("returns null for 127.0.0.1 (dev environment)", () => {
    const req = makeRequest("127.0.0.1");
    expect(handleCanonicalDomain(req)).toBeNull();
  });

  it("redirects www.paisaxe.es → paisaxe.es with 308", () => {
    const req = makeRequest(`www.${LOCATION_CONFIG.domain}`, "/some/path");
    const res = handleCanonicalDomain(req);
    expect(res?.status).toBe(308);
    const location = res?.headers.get("location");
    expect(location).toContain(`https://${LOCATION_CONFIG.domain}`);
    expect(location).not.toContain("www.");
  });

  it("redirects paisaxe.com → paisaxe.es with 308", () => {
    const req = makeRequest(LOCATION_CONFIG.alternateDomain, "/immersive");
    const res = handleCanonicalDomain(req);
    expect(res?.status).toBe(308);
    const location = res?.headers.get("location");
    expect(location).toContain(`https://${LOCATION_CONFIG.domain}`);
    expect(location).toContain("/immersive");
  });

  it("redirects www.paisaxe.com → paisaxe.es with 308", () => {
    const req = makeRequest(`www.${LOCATION_CONFIG.alternateDomain}`, "/pricing");
    const res = handleCanonicalDomain(req);
    expect(res?.status).toBe(308);
    const location = res?.headers.get("location");
    expect(location).toContain(`https://${LOCATION_CONFIG.domain}`);
    expect(location).not.toContain("www.");
  });

  it("preserves the request path in the redirect URL", () => {
    const path = "/immersive?story=picos-de-europa";
    const req = makeRequest(LOCATION_CONFIG.alternateDomain, path);
    const res = handleCanonicalDomain(req);
    const location = res?.headers.get("location");
    expect(location).toContain("/immersive");
  });

  it("redirects uses https protocol", () => {
    const req = makeRequest(`www.${LOCATION_CONFIG.domain}`);
    const res = handleCanonicalDomain(req);
    const location = res?.headers.get("location");
    expect(location).toMatch(/^https:\/\//);
  });

  it("returns null for an unrecognised domain (neither canonical nor alternate)", () => {
    const req = makeRequest("staging.example.com");
    expect(handleCanonicalDomain(req)).toBeNull();
  });
});
