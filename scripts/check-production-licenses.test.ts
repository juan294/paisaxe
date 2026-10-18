import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALLOWED_LICENSES,
  CORE_ALLOWED_LICENSES,
  EXCEPTION_LICENSES,
  findDisallowedLicenses,
  isLicenseAllowed,
  readDeclaredLicenses,
  type LicenseCheckerReport,
} from "./check-production-licenses";

describe("isLicenseAllowed", () => {
  it("allows a single core-permissive SPDX ID", () => {
    expect(isLicenseAllowed("MIT")).toBe(true);
    expect(isLicenseAllowed("Apache-2.0")).toBe(true);
    expect(isLicenseAllowed("ISC")).toBe(true);
    expect(isLicenseAllowed("BSD-3-Clause")).toBe(true);
  });

  it("allows a documented exception license", () => {
    expect(isLicenseAllowed("FSL-1.1-MIT")).toBe(true);
    expect(isLicenseAllowed("LGPL-3.0-or-later")).toBe(true);
  });

  it("does not allow FSL-1.1-MIT via substring collision with MIT", () => {
    // Regression guard for the exact bug this script exists to fix: license-checker's
    // own --onlyAllow does `license.includes(token)`, so an allowed "MIT" token also
    // matches "FSL-1.1-MIT". Verify that isolated from EXCEPTION_LICENSES, "MIT" alone
    // does NOT admit "FSL-1.1-MIT" under this script's exact-token matching.
    const allowedWithoutFsl = new Set([...CORE_ALLOWED_LICENSES]);
    expect(allowedWithoutFsl.has("MIT")).toBe(true);
    expect(isLicenseAllowed("FSL-1.1-MIT", allowedWithoutFsl)).toBe(false);
  });

  it("rejects an unreviewed license by default", () => {
    expect(isLicenseAllowed("GPL-3.0")).toBe(false);
    expect(isLicenseAllowed("SSPL-1.0")).toBe(false);
    expect(isLicenseAllowed("SomeMadeUpLicense-1.0")).toBe(false);
  });

  it("allows an OR expression when at least one branch is allowed", () => {
    expect(isLicenseAllowed("(MPL-2.0 OR Apache-2.0)")).toBe(true);
    expect(isLicenseAllowed("(MIT OR WTFPL)")).toBe(true);
  });

  it("rejects an OR expression when no branch is allowed", () => {
    expect(isLicenseAllowed("(GPL-3.0 OR AGPL-3.0)")).toBe(false);
  });

  it("requires every branch of an AND expression to be allowed", () => {
    expect(isLicenseAllowed("(Apache-2.0 AND MIT)")).toBe(true);
    expect(isLicenseAllowed("(Apache-2.0 AND GPL-3.0)")).toBe(false);
  });

  it("uses the exported ALLOWED_LICENSES set by default", () => {
    for (const license of ALLOWED_LICENSES) {
      expect(isLicenseAllowed(license)).toBe(true);
    }
  });
});

describe("findDisallowedLicenses", () => {
  it("skips private packages (the repo's own root package)", () => {
    const report: LicenseCheckerReport = {
      "paisaxe@1.6.0": { licenses: "UNLICENSED", private: true },
      "zod@4.4.3": { licenses: "MIT" },
    };
    expect(findDisallowedLicenses(report)).toEqual([]);
  });

  it("flags a package whose license is outside the allowlist", () => {
    const report: LicenseCheckerReport = {
      "left-pad@1.0.0": { licenses: "WTFPL" },
    };
    expect(findDisallowedLicenses(report)).toEqual(['left-pad@1.0.0: "WTFPL"']);
  });

  it("reproduces the #847 finding: FSL-1.1-MIT fails without the documented exception", () => {
    const report: LicenseCheckerReport = {
      "@sentry/cli@2.58.5": { licenses: "FSL-1.1-MIT" },
      "@sentry/cli-darwin@2.58.5": { licenses: "FSL-1.1-MIT" },
    };
    const withoutException = new Set([...CORE_ALLOWED_LICENSES]);
    expect(findDisallowedLicenses(report, withoutException)).toEqual([
      '@sentry/cli-darwin@2.58.5: "FSL-1.1-MIT"',
      '@sentry/cli@2.58.5: "FSL-1.1-MIT"',
    ]);

    // ...and passes once the documented exception (EXCEPTION_LICENSES, default set) is in play.
    expect(findDisallowedLicenses(report)).toEqual([]);
    expect(EXCEPTION_LICENSES.has("FSL-1.1-MIT")).toBe(true);
  });

  it("passes clean on an empty report", () => {
    expect(findDisallowedLicenses({})).toEqual([]);
  });
});

// The installed Sentry 11 graph reports sentry@0.45.0 as Apache*, while
// its package.json declares FSL-1.1-Apache-2.0 (nightly run 39092472558).
describe("Sentry 11 build-tool license inventory", () => {
  it("uses exact package metadata instead of the scanner's inferred Apache label", () => {
    const directory = mkdtempSync(join(tmpdir(), "paisaxe-license-"));
    try {
      writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "sentry", version: "0.45.0", license: "FSL-1.1-Apache-2.0" }));
      const report = readDeclaredLicenses({ "sentry@0.45.0": { licenses: "Apache*", path: directory } });
      expect(report["sentry@0.45.0"]?.licenses).toBe("FSL-1.1-Apache-2.0");
      expect(findDisallowedLicenses(report)).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("matches npm's canonical key to a published v-prefixed manifest version", () => {
    const directory = mkdtempSync(join(tmpdir(), "paisaxe-license-"));
    try {
      writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "@upstash/core-analytics", version: "v0.0.10", license: "MIT" }));
      const report = readDeclaredLicenses({ "@upstash/core-analytics@0.0.10": { licenses: "MIT", path: directory } });
      expect(findDisallowedLicenses(report)).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("rejects metadata from a different package even if it declares MIT", () => {
    const directory = mkdtempSync(join(tmpdir(), "paisaxe-license-"));
    try {
      writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "other", version: "0.45.0", license: "MIT" }));
      expect(() => readDeclaredLicenses({ "sentry@0.45.0": { licenses: "Apache*", path: directory } })).toThrow(/package identity/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("keeps inferred or missing licenses outside the allowlist when no declared ID exists", () => {
    const directory = mkdtempSync(join(tmpdir(), "paisaxe-license-"));
    try {
      writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "sentry", version: "0.45.0" }));
      expect(findDisallowedLicenses(readDeclaredLicenses({ "sentry@0.45.0": { licenses: "Apache*", path: directory } }))).toEqual(['sentry@0.45.0: "Apache*"']);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("admits only the reviewed package/version/license pairs", () => {
    expect(findDisallowedLicenses({
      "lightningcss@1.33.0": { licenses: "MPL-2.0" },
      "lightningcss-linux-x64-gnu@1.33.0": { licenses: "MPL-2.0" },
      "lightningcss-darwin-arm64@1.33.0": { licenses: "MPL-2.0" },
      "sentry@0.45.0": { licenses: "FSL-1.1-Apache-2.0" },
    })).toEqual([]);
    expect(isLicenseAllowed("MPL-2.0")).toBe(false);
    expect(isLicenseAllowed("FSL-1.1-Apache-2.0")).toBe(false);
    expect(findDisallowedLicenses({
      "unknown@1.33.0": { licenses: "MPL-2.0" },
      "lightningcss-unreviewed@1.33.0": { licenses: "MPL-2.0" },
      "lightningcss@1.34.0": { licenses: "MPL-2.0" },
      "sentry@0.46.0": { licenses: "FSL-1.1-Apache-2.0" },
      "sentry@0.45.0": { licenses: "GPL-3.0" },
    })).toHaveLength(5);
  });

  it("lets a caller's explicit license set withhold the package exceptions", () => {
    expect(findDisallowedLicenses({ "sentry@0.45.0": { licenses: "FSL-1.1-Apache-2.0" } }, CORE_ALLOWED_LICENSES)).toHaveLength(1);
  });
});
