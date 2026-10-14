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
  const connectSrc = (value: string) => value.split(";").find((d) => d.trim().startsWith("connect-src"))!;

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

  it("in development also allows a loopback Supabase on another port (an isolated stack), never in production", () => {
    const isolated = { supabaseUrl: "http://127.0.0.1:54821" };
    const development = connectSrc(buildCspHeader({ nodeEnv: "development", ...isolated }));
    expect(development).toContain("http://127.0.0.1:54821");
    expect(development).toContain("ws://127.0.0.1:54821");
    expect(connectSrc(buildCspHeader({ nodeEnv: "production", ...isolated }))).not.toContain("54821");
    // A hosted project is already covered by *.supabase.co; anything else that is not loopback is never added.
    expect(connectSrc(buildCspHeader({ nodeEnv: "development", supabaseUrl: "https://abc.supabase.co" }))).not.toContain("https://abc.supabase.co");
    expect(connectSrc(buildCspHeader({ nodeEnv: "development", supabaseUrl: "http://evil.example:54321" }))).not.toContain("evil");
    expect(connectSrc(buildCspHeader({ nodeEnv: "development", supabaseUrl: "not a url" }))).not.toContain("not a url");
  });

  it("allows the local Supabase in connect-src only in development (#1000)", () => {
    for (const host of ["127.0.0.1:54321", "localhost:54321"]) {
      const supabaseUrl = `http://${host}`;
      const development = connectSrc(buildCspHeader({ nodeEnv: "development", supabaseUrl }));
      const production = connectSrc(buildCspHeader({ nodeEnv: "production", supabaseUrl }));
      expect(development).toContain(`http://${host}`);
      expect(development).toContain(`ws://${host}`);
      expect(production).not.toMatch(/127\.0\.0\.1|localhost/);
    }
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
    expect(scriptSrc).toContain("https://checkout.stripe.com");

    const frameSrc = csp.split(";").find((d) => d.trim().startsWith("frame-src"))!;
    expect(frameSrc).toContain("https://js.stripe.com");
    expect(frameSrc).toContain("https://checkout.stripe.com");

    const connectSrc = csp.split(";").find((d) => d.trim().startsWith("connect-src"))!;
    expect(connectSrc).toContain("https://api.stripe.com");
    expect(connectSrc).toContain("https://checkout.stripe.com");

    const imgSrc = csp.split(";").find((d) => d.trim().startsWith("img-src"))!;
    expect(imgSrc).toContain("https://*.stripe.com");
  });

  it("should keep unsafe-inline in style-src for Tailwind/Next.js CSS", () => {
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"))!;
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("should include frame-ancestors none", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
