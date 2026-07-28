// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  analyzeRelease,
  runCli,
  type EvidenceManifest,
  type ProbeEvidence,
} from "./analyze-release-run";
import type { RequiredProbeManifest } from "./required-probes";

const TREE = "95a62c4be18d9b222187b88a450ba02bcc664365";
const OTHER_TREE = "0123456789abcdef0123456789abcdef01234567";
const NOW = new Date("2026-07-28T12:00:00Z");

/**
 * A two-probe required set: one plain HTTP probe and one that must produce
 * datastore + cleanup evidence. Small enough to reason about, wide enough to
 * exercise every invariant.
 */
const REQUIRED: RequiredProbeManifest = {
  version: 1,
  probes: [
    {
      id: "health-status",
      title: "health",
      owner: "release",
      tier: "deployed-readonly",
      safety: "read-only",
      runner: { kind: "playwright", project: "release-required", selector: "@release-required health-status" },
      oracles: ["http"],
    },
    {
      id: "favorite-roundtrip",
      title: "favorites",
      owner: "release",
      tier: "local-docker",
      safety: "mutating-local",
      runner: {
        kind: "playwright",
        project: "release-required-local",
        selector: "@release-required @local-docker favorite-roundtrip",
      },
      oracles: ["datastore", "cleanup"],
    },
  ],
};

const PASSING_PROBES: ProbeEvidence[] = [
  { id: "health-status", status: "passed", oracles: ["http"] },
  {
    id: "favorite-roundtrip",
    status: "passed",
    oracles: ["datastore", "cleanup"],
    cleanup: "removed",
  },
];

function evidence(overrides: Partial<EvidenceManifest> = {}): EvidenceManifest {
  return {
    version: 1,
    candidate_tree: TREE,
    shipped_tree: TREE,
    deployed_tree: TREE,
    target_url: "https://paisaxe.es",
    probes: PASSING_PROBES,
    ...overrides,
  };
}

function analyze(overrides: Partial<EvidenceManifest> = {}) {
  return analyzeRelease(evidence(overrides), REQUIRED, NOW);
}

describe("analyzeRelease — the positive case", () => {
  it("passes when every required probe passed with its declared evidence", () => {
    const result = analyze();

    expect(result.blockers).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.passedCount).toBe(2);
  });
});

describe("analyzeRelease — blocking cases", () => {
  it("D03: blocks a run in which nothing passed", () => {
    const result = analyze({ probes: [] });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(expect.stringMatching(/D03/));
  });

  it("D04: blocks when a required probe skipped", () => {
    const result = analyze({
      probes: [
        PASSING_PROBES[0],
        { ...PASSING_PROBES[1], status: "skipped" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(
      expect.stringMatching(/required probe "favorite-roundtrip" is skipped/)
    );
  });

  it("D04: blocks when a required probe is absent from the evidence entirely", () => {
    const result = analyze({ probes: [PASSING_PROBES[0]] });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(expect.stringMatching(/has no evidence/));
  });

  it("blocks a required probe that failed even when an exception quarantines it", () => {
    const result = analyze({
      probes: [PASSING_PROBES[0], { ...PASSING_PROBES[1], status: "failed" }],
      exceptions: [
        {
          probe: "favorite-roundtrip",
          reason: "flaky, tracked in #999",
          expires: "2026-12-31",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(expect.stringMatching(/is failed/));
    expect(result.blockers).toContainEqual(
      expect.stringMatching(/quarantine cannot excuse a required probe/)
    );
  });

  it("D06: blocks when the deployed tree is not the candidate tree", () => {
    const result = analyze({ deployed_tree: OTHER_TREE });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(expect.stringMatching(/trees disagree/));
  });

  it("D06: blocks when identity is missing altogether", () => {
    const result = analyze({ deployed_tree: undefined });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(
      expect.stringMatching(/deployed_tree is missing/)
    );
  });

  it("blocks when a required probe reports no evidence for a declared oracle", () => {
    const result = analyze({
      probes: [
        PASSING_PROBES[0],
        { ...PASSING_PROBES[1], oracles: ["cleanup"] },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(
      expect.stringMatching(/declares the datastore oracle but reports no datastore evidence/)
    );
  });

  it("blocks when fixture data was left behind", () => {
    const result = analyze({
      probes: [
        PASSING_PROBES[0],
        { ...PASSING_PROBES[1], cleanup: "left-behind" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(
      expect.stringMatching(/left fixture data behind/)
    );
  });

  it("blocks on an expired exception rather than ignoring it", () => {
    const result = analyze({
      exceptions: [
        { probe: "some-optional-probe", reason: "waived", expires: "2026-01-01" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(expect.stringMatching(/expired on 2026-01-01/));
  });

  it("blocks on an exception whose expiry cannot be parsed", () => {
    const result = analyze({
      exceptions: [{ probe: "some-optional-probe", expires: "next tuesday" }],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContainEqual(expect.stringMatching(/unparseable expiry/));
  });

  it("allows an unexpired exception that does not cover a required probe", () => {
    const result = analyze({
      exceptions: [
        { probe: "some-optional-probe", reason: "waived", expires: "2026-12-31" },
      ],
    });

    expect(result.ok).toBe(true);
  });
});

describe("runCli", () => {
  it("exits non-zero when no evidence path is given", () => {
    expect(runCli(["node", "analyze-release-run.ts"])).toBe(1);
  });

  it("exits non-zero when the evidence file cannot be read", () => {
    expect(
      runCli(["node", "analyze-release-run.ts", "--evidence", "/nonexistent/evidence.yaml"])
    ).toBe(1);
  });
});
