// Enforces the permissive-only production license policy documented in
// docs/project/license-exceptions.md ("MIT, Apache-2.0, BSD, ISC") as a real
// allowlist, not a denylist.
//
// Why not `license-checker --onlyAllow`: that flag matches by substring
// (`licenseString.includes(allowedToken)`), not exact SPDX-token equality —
// see license-checker/lib/index.js and the license-checker-rseidelsohn fork,
// both of which use the same `.includes()` check. That means once "MIT" is an
// allowed token, ANY license string containing "MIT" as a substring silently
// passes too, including source-available licenses like "FSL-1.1-MIT" — the
// exact class of dependency this check exists to catch (issue #847 / SE-M3).
// Verified empirically: `npx license-checker --production --onlyAllow "MIT"`
// exits 0 for @sentry/cli@2.58.5 (license "FSL-1.1-MIT") even with the
// FSL-1.1-MIT token entirely absent from the allow list.
//
// This script instead parses each package's exact SPDX license expression
// (single ID, or a parenthesized " AND "/" OR " compound) and matches each
// token by strict equality against an explicit allowlist. Anything not
// matched fails the build — an unreviewed license can no longer pass
// silently the way it did under the old denylist.
//
// Any new EXCEPTION_LICENSES entry MUST have a corresponding justification in
// docs/project/license-exceptions.md.

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Baseline permissive-only families allowed under CLAUDE.md's
// "No copyleft dependencies" policy (MIT, Apache-2.0, BSD, ISC), plus a small
// set of license IDs that are permissive-equivalent but outside those four
// named families and already present in the dependency tree (see the
// "Dual-licensed dependencies" and license-summary review in issue #847).
export const CORE_ALLOWED_LICENSES = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSD-4-Clause",
  "ISC",
  "0BSD",
  "BlueOak-1.0.0",
  "Unlicense",
  "CC-BY-4.0",
]);

// Documented, justified exceptions — see docs/project/license-exceptions.md.
export const EXCEPTION_LICENSES = new Set([
  "LGPL-3.0-or-later", // Exception 1: @img/sharp-libvips-* (weak copyleft, dynamically linked, unmodified, SaaS deployment)
  "FSL-1.1-MIT", // Exception 4: @sentry/cli (build-time only, converts to MIT after 2 years)
]);

export const ALLOWED_LICENSES = new Set([...CORE_ALLOWED_LICENSES, ...EXCEPTION_LICENSES]);

export interface LicenseCheckerEntry {
  licenses?: string;
  private?: boolean;
}

export type LicenseCheckerReport = Record<string, LicenseCheckerEntry>;

/**
 * Splits a license-checker SPDX expression into its atomic license IDs and the
 * boolean operator joining them, mirroring license-checker's own output shape:
 * a bare ID ("MIT"), or a parenthesized "(A AND B)" / "(A OR B ...)" expression.
 */
function parseExpression(licenseString: string): { operator: "AND" | "OR" | null; tokens: string[] } {
  const trimmed = licenseString.trim();
  const unwrapped =
    trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1).trim() : trimmed;

  if (unwrapped.includes(" OR ")) {
    return { operator: "OR", tokens: unwrapped.split(" OR ").map((t) => t.trim()) };
  }
  if (unwrapped.includes(" AND ")) {
    return { operator: "AND", tokens: unwrapped.split(" AND ").map((t) => t.trim()) };
  }
  return { operator: null, tokens: [unwrapped] };
}

/**
 * True if a package's SPDX license expression is satisfied by `allowed`:
 * - OR expression: at least one branch must be allowed (we elect the
 *   permissive branch, per the "Dual-licensed dependencies" policy).
 * - AND expression: every branch applies simultaneously, so all must be
 *   allowed.
 * - Single ID: must match exactly (no substring matching).
 */
export function isLicenseAllowed(licenseString: string, allowed: Set<string> = ALLOWED_LICENSES): boolean {
  const { operator, tokens } = parseExpression(licenseString);
  if (operator === "OR") {
    return tokens.some((t) => allowed.has(t));
  }
  return tokens.every((t) => allowed.has(t));
}

/**
 * Validates a license-checker JSON report against the allowlist. Skips
 * private packages (i.e., this repo's own root package, which reports
 * "UNLICENSED" and is never distributed as a dependency).
 */
export function findDisallowedLicenses(
  report: LicenseCheckerReport,
  allowed: Set<string> = ALLOWED_LICENSES
): string[] {
  const violations: string[] = [];
  for (const [pkg, entry] of Object.entries(report)) {
    if (entry.private) continue;
    const license = entry.licenses ?? "UNKNOWN";
    if (!isLicenseAllowed(license, allowed)) {
      violations.push(`${pkg}: "${license}"`);
    }
  }
  return violations.sort();
}

function runCli(): void {
  const json = execSync("npx license-checker --production --json", {
    maxBuffer: 1024 * 1024 * 50,
  }).toString();
  const report: LicenseCheckerReport = JSON.parse(json);

  const violations = findDisallowedLicenses(report);

  if (violations.length > 0) {
    console.error("✗ Production dependencies with licenses outside the allowlist:\n");
    for (const v of violations) {
      console.error(`  ${v}`);
    }
    console.error(
      "\nAllowed licenses: " +
        [...ALLOWED_LICENSES].sort().join(", ") +
        "\n\nIf this license is acceptable, add a justified exception to " +
        "docs/project/license-exceptions.md AND add its exact SPDX ID to " +
        "EXCEPTION_LICENSES in scripts/check-production-licenses.ts."
    );
    process.exit(1);
  }

  const count = Object.values(report).filter((e) => !e.private).length;
  console.log(`✓ ${count} production dependencies passed the license allowlist check`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
