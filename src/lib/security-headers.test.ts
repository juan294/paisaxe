import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests for security headers in next.config.ts.
 * These tests parse the config file to verify CSP directives and header policies.
 */
describe("Security headers in next.config.ts", () => {
  const configPath = resolve(__dirname, "../../next.config.ts");
  const configContent = readFileSync(configPath, "utf-8");

  describe("Content-Security-Policy", () => {
    it("should include blob: in script-src for AudioWorklet support", () => {
      // ElevenLabs SDK loads rawAudioProcessor as a blob: AudioWorklet module.
      // AudioWorklets are governed by script-src (not worker-src) per the CSP spec.
      // Match the actual CSP directive string (inside quotes), not TODO comments.
      const scriptSrcMatch = configContent.match(/"script-src ([^"]+)"/);
      expect(scriptSrcMatch).toBeTruthy();
      const scriptSrc = scriptSrcMatch![1];
      expect(scriptSrc).toContain("blob:");
    });

    it("should include blob: in worker-src", () => {
      const workerSrcMatch = configContent.match(/"worker-src ([^"]+)"/);
      expect(workerSrcMatch).toBeTruthy();
      const workerSrc = workerSrcMatch![1];
      expect(workerSrc).toContain("blob:");
    });

    it("should include blob: in media-src", () => {
      const mediaSrcMatch = configContent.match(/"media-src ([^"]+)"/);
      expect(mediaSrcMatch).toBeTruthy();
      const mediaSrc = mediaSrcMatch![1];
      expect(mediaSrc).toContain("blob:");
    });

    it("should include Vercel Analytics domains in connect-src", () => {
      const connectSrcMatch = configContent.match(/"connect-src ([^"]+)"/);
      expect(connectSrcMatch).toBeTruthy();
      const connectSrc = connectSrcMatch![1];
      expect(connectSrc).toContain("https://vitals.vercel-insights.com");
      expect(connectSrc).toContain("https://va.vercel-scripts.com");
    });
  });

  describe("Deprecated headers", () => {
    it("should not include X-XSS-Protection header", () => {
      expect(configContent).not.toContain("X-XSS-Protection");
    });
  });

  describe("Required security headers", () => {
    it("should include Strict-Transport-Security only in production", () => {
      expect(configContent).toContain("Strict-Transport-Security");
      // HSTS must be conditional on NODE_ENV to avoid poisoning localhost in browsers
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

    it("should include Content-Security-Policy", () => {
      expect(configContent).toContain("Content-Security-Policy");
    });
  });
});
