/**
 * Meta-tests for QA-M4: admin-guard and RPC-name invariants.
 *
 * Two structural invariants currently hold only by convention (see
 * docs/agents/pre-launch-report.md, finding QA-M4):
 *
 *   1. Every exported HTTP method handler in an admin API route references
 *      one of the admin-auth guards from src/lib/admin-auth.ts.
 *   2. Every Supabase `.rpc("name")` call site in application source
 *      references a function name that is actually live in a migration
 *      (catches typos/renames/drops that would otherwise silently no-op).
 *
 * Follows the same scan-the-tree pattern as the AR-H2 logger migration
 * regression test in src/lib/logger-migration.test.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import { collectFiles } from "./collect-files";

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

function collectRouteFiles(dir: string): string[] {
  return collectFiles(dir, (name) => name === "route.ts");
}

function collectSourceFiles(dir: string): string[] {
  return collectFiles(
    dir,
    (name) =>
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
  );
}

/** Line number (1-based) of a character offset within `content`. */
function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/** Throw a formatted error listing every violation, or do nothing if none. */
function reportViolations(violations: string[], header: string): void {
  if (violations.length > 0) {
    throw new Error(`${header}\n\n` + violations.map((v) => `  ${v}`).join("\n"));
  }
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
    segments.push({
      method: match[1],
      line: lineAt(content, start),
      body: content.slice(start, end),
    });
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

    reportViolations(
      violations,
      `Found ${violations.length} admin route handler(s) without an admin-auth guard. ` +
        `Every admin route method must call validateAdminAuth(), or be wrapped in ` +
        `withAdmin()/withAdminRead() from "@/lib/admin-auth":`
    );
  });
});

describe("QA-M4 RPC-name invariant", () => {
  /**
   * Function names live at the end of migration history: a name is added by
   * CREATE (OR REPLACE) FUNCTION and removed by DROP FUNCTION. Processing
   * migrations in filename order (numeric prefixes are chronological) and
   * applying each file's events in source order means a function that was
   * dropped and never recreated is correctly treated as gone, not merely
   * "defined at some point".
   */
  function collectLiveFunctionNames(migrationFiles: string[]): Set<string> {
    const createPattern =
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const dropPattern =
      /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;

    const live = new Set<string>();

    for (const file of [...migrationFiles].sort()) {
      const content = fs.readFileSync(file, "utf-8");
      const events: Array<{ index: number; name: string; drop: boolean }> = [];

      for (const match of content.matchAll(createPattern)) {
        events.push({ index: match.index ?? 0, name: match[1], drop: false });
      }
      for (const match of content.matchAll(dropPattern)) {
        events.push({ index: match.index ?? 0, name: match[1], drop: true });
      }
      events.sort((a, b) => a.index - b.index);

      for (const event of events) {
        if (event.drop) {
          live.delete(event.name);
        } else {
          live.add(event.name);
        }
      }
    }

    return live;
  }

  it("every supabase .rpc() call references a function live in a migration", () => {
    const sourceFiles = collectSourceFiles(SRC_DIR);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => path.join(MIGRATIONS_DIR, f));
    expect(migrationFiles.length).toBeGreaterThan(0);

    const liveFunctions = collectLiveFunctionNames(migrationFiles);
    expect(liveFunctions.size).toBeGreaterThan(0);

    // RPC calls that pass a variable instead of a string literal aren't
    // statically checkable (see issue #875 regression risk note) and are
    // skipped for the migration-match check — but every `.rpc(` call site is
    // still counted so a shift from literal to dynamic names doesn't shrink
    // this invariant's coverage silently. All current call sites use string
    // literals, so this must stay at 0 unless a reviewer deliberately widens
    // the allowance.
    const anyRpcCallPattern = /\.rpc\(/g;
    const literalRpcCallPattern = /\.rpc\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']/g;
    const violations: string[] = [];
    let dynamicCallSites = 0;

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (!content.includes(".rpc(")) continue;

      const totalCalls = [...content.matchAll(anyRpcCallPattern)].length;
      const literalCalls = [...content.matchAll(literalRpcCallPattern)];
      dynamicCallSites += totalCalls - literalCalls.length;

      for (const match of literalCalls) {
        const name = match[1];
        if (!liveFunctions.has(name)) {
          const rel = path.relative(REPO_ROOT, file);
          violations.push(
            `${rel}:${lineAt(content, match.index ?? 0)} — .rpc("${name}") has no live migration definition`
          );
        }
      }
    }

    expect(
      dynamicCallSites,
      "a .rpc() call using a dynamic (non-literal) function name was found — " +
        "this invariant cannot statically verify it against migrations; " +
        "review it manually and, if intentional, update this test's baseline"
    ).toBe(0);

    reportViolations(
      violations,
      `Found ${violations.length} .rpc() call(s) referencing a function with no live migration definition:`
    );
  });
});
