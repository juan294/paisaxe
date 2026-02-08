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
    it("should not include blob: in script-src", () => {
      // Extract script-src directive
      const scriptSrcMatch = configContent.match(/script-src\s+([^"]+)/);
      expect(scriptSrcMatch).toBeTruthy();
      const scriptSrc = scriptSrcMatch![1];
      expect(scriptSrc).not.toContain("blob:");
    });

    it("should include blob: in worker-src", () => {
      const workerSrcMatch = configContent.match(/worker-src\s+([^"]+)/);
      expect(workerSrcMatch).toBeTruthy();
      const workerSrc = workerSrcMatch![1];
      expect(workerSrc).toContain("blob:");
    });

    it("should include blob: in media-src", () => {
      const mediaSrcMatch = configContent.match(/media-src\s+([^"]+)/);
      expect(mediaSrcMatch).toBeTruthy();
      const mediaSrc = mediaSrcMatch![1];
      expect(mediaSrc).toContain("blob:");
    });
  });

  describe("Deprecated headers", () => {
    it("should not include X-XSS-Protection header", () => {
      expect(configContent).not.toContain("X-XSS-Protection");
    });
  });

  describe("Required security headers", () => {
    it("should include Strict-Transport-Security", () => {
      expect(configContent).toContain("Strict-Transport-Security");
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
