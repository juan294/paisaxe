/**
 * Regression test for AR-H2: Logger migration.
 *
 * Verifies that all API routes use the structured logger (`src/lib/logger.ts`)
 * instead of raw `console.*` calls, and that the logger module exports the
 * required interface.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import { collectFiles } from "./collect-files";

const API_DIR = path.join(__dirname, "../app/api");

/**
 * Collect all non-test TypeScript route files under src/app/api.
 */
function collectRouteFiles(dir: string): string[] {
  return collectFiles(
    dir,
    (name) =>
      name.endsWith(".ts") &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".spec.ts")
  );
}

describe("AR-H2 Logger migration regression", () => {
  it("src/lib/logger.ts exports logger with info, warn, and error methods", async () => {
    const { logger } = await import("./logger");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("all API route files import the structured logger (no bare console.* calls)", () => {
    const routeFiles = collectRouteFiles(API_DIR);
    expect(routeFiles.length).toBeGreaterThan(0);

    const consoleCalls = /console\.(error|warn|log|info)\s*\(/;
    const violations: string[] = [];

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (consoleCalls.test(lines[i])) {
          const rel = path.relative(path.join(__dirname, "../.."), file);
          violations.push(`${rel}:${i + 1} — ${lines[i].trim()}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} console.* call(s) in API routes. Use logger from "@/lib/logger" instead:\n\n` +
          violations.map((v) => `  ${v}`).join("\n")
      );
    }
  });
});
