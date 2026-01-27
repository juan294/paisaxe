import { describe, it, expect } from "vitest";
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

  it("includes sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://paisaxe.com/sitemap.xml");
  });
});
