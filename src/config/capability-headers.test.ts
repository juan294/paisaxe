// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Capability URLs (/booking/<id>.<token>, /operator/<id>.<token>) must never
 * leak through a Referer header (PayPal hackathon plan, F05). next.config.ts
 * sets a site-wide Referrer-Policy; for one path, the LAST matching entry that
 * sets a key wins (Next.js headers() semantics), so the capability override
 * must come after the site-wide one.
 */
async function lastHeader(path: string, key: string): Promise<string | undefined> {
  const entries = (await nextConfig.headers?.()) ?? [];
  let value: string | undefined;
  for (const entry of entries) {
    const pattern = new RegExp(`^${entry.source.replace(/:path\*/, ".*").replace("/(.*)", "/.*")}$`);
    if (!pattern.test(path)) continue;
    const header = entry.headers.find((h) => h.key.toLowerCase() === key);
    if (header) value = header.value;
  }
  return value;
}

describe("Referrer-Policy and X-Robots-Tag on capability routes", () => {
  it.each([
    "/booking/11111111-2222-4333-8444-555555555555.token",
    "/booking/11111111-2222-4333-8444-555555555555.token/return",
    "/operator/a7e5c0de-0000-4000-8000-000000000001.token",
  ])(
    "is no-referrer for %s",
    async (path) => {
      expect(await lastHeader(path, "referrer-policy")).toBe("no-referrer");
      expect(await lastHeader(path, "x-robots-tag")).toBe("noindex");
    }
  );

  it("stays strict-origin-when-cross-origin everywhere else", async () => {
    expect(await lastHeader("/immersive", "referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(await lastHeader("/acceso", "referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(await lastHeader("/immersive", "x-robots-tag")).toBeUndefined();
  });
});
