import { describe, expect, it } from "vitest";
import {
  ALLOWED_LICENSES,
  CORE_ALLOWED_LICENSES,
  EXCEPTION_LICENSES,
  findDisallowedLicenses,
  isLicenseAllowed,
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
