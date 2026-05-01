import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildCspHeader } from "@/lib/proxy/csp";

/**
 * Tests for security headers.
 *
 * CSP is dynamically generated in proxy.ts.
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
      // CSP is set per-request in proxy.ts. next.config.ts must not
      // set a static CSP that would conflict with or override the dynamic one.
      expect(configContent).not.toMatch(/"Content-Security-Policy"/);
    });
  });
});

describe("CSP header via buildCspHeader (proxy.ts)", () => {
  const csp = buildCspHeader();

  it("should include unsafe-inline in script-src", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it("should NOT include strict-dynamic in script-src", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("'strict-dynamic'");
  });

  it("should include unsafe-eval only in development script-src", () => {
    const developmentCsp = buildCspHeader({ nodeEnv: "development" });
    const developmentScriptSrc = developmentCsp
      .split(";")
      .find((d) => d.trim().startsWith("script-src"))!;
    const defaultScriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;

    expect(developmentScriptSrc).toContain("'unsafe-eval'");
    expect(defaultScriptSrc).not.toContain("'unsafe-eval'");
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
    expect(connectSrc).toContain("wss://api.elevenlabs.io");
    expect(connectSrc).toContain("wss://api.us.elevenlabs.io");
    expect(connectSrc).not.toContain("wss://*.elevenlabs.io");
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
