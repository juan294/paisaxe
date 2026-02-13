import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildCspHeader } from "@/proxy";

/**
 * Tests for security headers.
 *
 * CSP is now dynamically generated per-request in proxy.ts with a nonce.
 * Static security headers remain in next.config.ts.
 */
describe("Security headers in next.config.ts", () => {
  const configPath = resolve(__dirname, "../../next.config.ts");
  const configContent = readFileSync(configPath, "utf-8");

  describe("Deprecated headers", () => {
    it("should not include X-XSS-Protection header", () => {
      expect(configContent).not.toContain("X-XSS-Protection");
    });
  });

  describe("Required security headers", () => {
    it("should include Strict-Transport-Security only in production", () => {
      expect(configContent).toContain("Strict-Transport-Security");
      expect(configContent).toMatch(/process\.env\.NODE_ENV\s*===?\s*["']production["']/);
    });

    it("should include X-Content-Type-Options", () => {
      expect(configContent).toContain("X-Content-Type-Options");
    });

    it("should include X-Frame-Options", () => {
      expect(configContent).toContain("X-Frame-Options");
    });

    it("should include Referrer-Policy", () => {
      expect(configContent).toContain("Referrer-Policy");
    });

    it("should NOT include static CSP in next.config.ts (now dynamic in proxy.ts)", () => {
      // CSP is set per-request in proxy.ts with a nonce. next.config.ts must not
      // set a static CSP that would conflict with or override the dynamic one.
      expect(configContent).not.toMatch(/"Content-Security-Policy"/);
    });
  });
});

describe("CSP header via buildCspHeader (proxy.ts)", () => {
  const testNonce = "test-nonce-abc123";
  const csp = buildCspHeader(testNonce);

  it("should include nonce in script-src", () => {
    expect(csp).toContain(`'nonce-${testNonce}'`);
  });

  it("should NOT include unsafe-inline in script-src", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("should include strict-dynamic in script-src", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("should include blob: in script-src for AudioWorklet support", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).toContain("blob:");
  });

  it("should include blob: in worker-src", () => {
    const workerSrc = csp.split(";").find((d) => d.trim().startsWith("worker-src"))!;
    expect(workerSrc).toContain("blob:");
  });

  it("should include blob: in media-src", () => {
    const mediaSrc = csp.split(";").find((d) => d.trim().startsWith("media-src"))!;
    expect(mediaSrc).toContain("blob:");
  });

  it("should include Vercel Analytics domains in connect-src", () => {
    const connectSrc = csp.split(";").find((d) => d.trim().startsWith("connect-src"))!;
    expect(connectSrc).toContain("https://vitals.vercel-insights.com");
    expect(connectSrc).toContain("https://va.vercel-scripts.com");
  });

  it("should include Stripe domains for embedded checkout", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).toContain("https://js.stripe.com");

    const frameSrc = csp.split(";").find((d) => d.trim().startsWith("frame-src"))!;
    expect(frameSrc).toContain("https://js.stripe.com");

    const connectSrc = csp.split(";").find((d) => d.trim().startsWith("connect-src"))!;
    expect(connectSrc).toContain("https://api.stripe.com");
  });

  it("should keep unsafe-inline in style-src for Tailwind/Next.js CSS", () => {
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"))!;
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("should include frame-ancestors none", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
