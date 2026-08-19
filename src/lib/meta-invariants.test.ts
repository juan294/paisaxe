/**
 * Meta-tests for QA-M4: admin-guard and RPC-name invariants.
 *
 * Two structural invariants currently hold only by convention (see
 * docs/agents/pre-launch-report.md, finding QA-M4):
 *
 *   1. Every exported HTTP method handler in an admin API route references
 *      one of the admin-auth guards from src/lib/admin-auth.ts.
 *   2. Every Supabase `.rpc("name")` call site in application source
 *      references a function name that is actually defined in a migration
 *      (catches typos/renames that would otherwise silently no-op).
 *
 * Follows the same scan-the-tree pattern as the AR-H2 logger migration
 * regression test in src/lib/logger-migration.test.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ADMIN_API_DIR = path.join(__dirname, "../app/api/admin");
const SRC_DIR = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(__dirname, "../../supabase/migrations");
const REPO_ROOT = path.join(__dirname, "../..");

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

/**
 * Admin-auth guard references accepted per exported HTTP method. Keep this
 * in sync with the exports of src/lib/admin-auth.ts — a new guard wrapper
 * needs to be added here too, or this check will false-positive.
 */
const ADMIN_GUARD_PATTERN = /validateAdminAuth\(|withAdmin\(|withAdminRead\(/;

/**
 * Recursively collect all `route.ts` files under a directory.
 */
function collectRouteFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      result.push(full);
    }
  }
  return result;
}

/**
 * Recursively collect all non-test TypeScript/TSX source files under a
 * directory.
 */
function collectSourceFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectSourceFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      result.push(full);
    }
  }
  return result;
}

/**
 * Split a route file's source into one segment per exported HTTP method
 * handler, so each handler's guard reference can be checked in isolation.
 */
function splitExportedMethods(
  content: string
): Array<{ method: string; line: number; body: string }> {
  const methodPattern = new RegExp(
    `^export\\s+(?:async\\s+)?function\\s+(${HTTP_METHODS.join("|")})\\b`,
    "gm"
  );
  const matches = [...content.matchAll(methodPattern)];
  const segments: Array<{ method: string; line: number; body: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const end = matches[i + 1]?.index ?? content.length;
    const line = content.slice(0, start).split("\n").length;
    segments.push({ method: match[1], line, body: content.slice(start, end) });
  }

  return segments;
}

describe("QA-M4 admin-guard invariant", () => {
  it("every exported HTTP method in an admin route references an admin-auth guard", () => {
    const routeFiles = collectRouteFiles(ADMIN_API_DIR);
    expect(routeFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const segments = splitExportedMethods(content);
      const rel = path.relative(REPO_ROOT, file);

      if (segments.length === 0) {
        violations.push(`${rel} — no exported HTTP method handler found`);
        continue;
      }

      for (const segment of segments) {
        if (!ADMIN_GUARD_PATTERN.test(segment.body)) {
          violations.push(
            `${rel}:${segment.line} — exported ${segment.method} has no admin-auth guard reference`
          );
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} admin route handler(s) without an admin-auth guard. ` +
          `Every admin route method must call validateAdminAuth(), or be wrapped in ` +
          `withAdmin()/withAdminRead() from "@/lib/admin-auth":\n\n` +
          violations.map((v) => `  ${v}`).join("\n")
      );
    }
  });
});

describe("QA-M4 RPC-name invariant", () => {
  it("every supabase .rpc() call references a function defined in a migration", () => {
    const sourceFiles = collectSourceFiles(SRC_DIR);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => path.join(MIGRATIONS_DIR, f));
    expect(migrationFiles.length).toBeGreaterThan(0);

    // Collect every function name defined across all migrations. Later
    // migrations may redefine (CREATE OR REPLACE) a function from an
    // earlier one — that's expected, not a violation.
    const definedFunctions = new Set<string>();
    const definitionPattern =
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    for (const file of migrationFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const match of content.matchAll(definitionPattern)) {
        definedFunctions.add(match[1]);
      }
    }
    expect(definedFunctions.size).toBeGreaterThan(0);

    // Collect every `.rpc("name"` call site across application source and
    // assert the referenced function exists in some migration. RPC calls
    // that pass a variable instead of a string literal are not statically
    // checkable and are intentionally skipped (see issue #875 regression
    // risk note).
    const rpcCallPattern = /\.rpc\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']/g;
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const match of content.matchAll(rpcCallPattern)) {
        const name = match[1];
        if (!definedFunctions.has(name)) {
          const line = content.slice(0, match.index ?? 0).split("\n").length;
          const rel = path.relative(REPO_ROOT, file);
          violations.push(
            `${rel}:${line} — .rpc("${name}") has no matching migration definition`
          );
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} .rpc() call(s) referencing a function with no ` +
          `matching migration definition:\n\n` +
          violations.map((v) => `  ${v}`).join("\n")
      );
    }
  });
});
