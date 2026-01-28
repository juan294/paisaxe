import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows root path", () => {
    const result = robots();
    expect(result.rules).toContainEqual(
      expect.objectContaining({
        userAgent: "*",
        allow: "/",
      })
    );
  });

  it("disallows api, admin, and auth paths", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.disallow).toContain("/api/");
    expect(rule.disallow).toContain("/admin/");
    expect(rule.disallow).toContain("/auth/");
  });

  it("includes sitemap URL with default fallback", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://paisaxe.com/sitemap.xml");
  });

  describe("uses NEXT_PUBLIC_SITE_URL env var", () => {
    const CUSTOM_URL = "https://custom.example.com";

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", CUSTOM_URL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses env var for sitemap URL", () => {
      const result = robots();
      expect(result.sitemap).toBe(`${CUSTOM_URL}/sitemap.xml`);
    });
  });
});
