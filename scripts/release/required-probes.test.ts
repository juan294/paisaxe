// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  collectSpecTitles,
  compareSelection,
  loadManifest,
  playwrightProbes,
  validateManifest,
  type RequiredProbe,
  type RequiredProbeManifest,
} from "./required-probes";

function probe(overrides: Partial<RequiredProbe> = {}): RequiredProbe {
  return {
    id: "health-status",
    title: "health",
    owner: "release",
    tier: "deployed-readonly",
    safety: "read-only",
    runner: {
      kind: "playwright",
      project: "release-required",
      selector: "@release-required health-status",
    },
    oracles: ["http"],
    ...overrides,
  };
}

function manifest(probes: RequiredProbe[]): RequiredProbeManifest {
  return { version: 1, probes };
}

describe("the committed manifest", () => {
  const committed = loadManifest();

  it("is valid", () => {
    expect(validateManifest(committed)).toEqual([]);
  });

  it("declares at least one probe per oracle the release analyzer relies on", () => {
    const oracles = new Set(committed.probes.flatMap((p) => p.oracles));

    expect(oracles).toContain("identity");
    expect(oracles).toContain("http");
    expect(oracles).toContain("ui");
    expect(oracles).toContain("datastore");
    expect(oracles).toContain("cleanup");
  });

  it("keeps every mutating probe off deployed environments", () => {
    for (const p of committed.probes) {
      if (p.safety === "mutating-local") {
        expect(p.tier).toBe("local-docker");
      }
      if (p.tier === "deployed-readonly") {
        expect(p.safety).toBe("read-only");
      }
    }
  });
});

describe("validateManifest", () => {
  it("rejects an empty manifest — no required probes is a vacuous pass", () => {
    expect(validateManifest(manifest([]))[0]).toMatch(/no probes/);
  });

  it("rejects duplicate ids", () => {
    expect(validateManifest(manifest([probe(), probe()]))).toContainEqual(
      expect.stringMatching(/Duplicate probe id/)
    );
  });

  it("rejects a probe with no oracles — nothing would count as evidence", () => {
    expect(validateManifest(manifest([probe({ oracles: [] })]))).toContainEqual(
      expect.stringMatching(/declares no oracles/)
    );
  });

  it("rejects a mutating probe outside the local-docker tier", () => {
    const errors = validateManifest(
      manifest([probe({ safety: "mutating-local", tier: "deployed-readonly" })])
    );

    expect(errors).toContainEqual(
      expect.stringMatching(/mutating probes may only run in the local-docker tier/)
    );
  });

  it("rejects a local-docker probe routed to the deployed project", () => {
    const errors = validateManifest(
      manifest([
        probe({
          tier: "local-docker",
          safety: "mutating-local",
          runner: {
            kind: "playwright",
            project: "release-required",
            selector: "@release-required x",
          },
        }),
      ])
    );

    expect(errors).toContainEqual(
      expect.stringMatching(/must run in project "release-required-local"/)
    );
  });

  it("rejects a selector missing the @release-required tag", () => {
    const errors = validateManifest(
      manifest([
        probe({
          runner: {
            kind: "playwright",
            project: "release-required",
            selector: "untagged probe",
          },
        }),
      ])
    );

    expect(errors).toContainEqual(expect.stringMatching(/must contain the @release-required tag/));
  });

  it("rejects unknown tiers, safety classes and oracles", () => {
    const errors = validateManifest(
      manifest([
        probe({
          tier: "production-write" as RequiredProbe["tier"],
          safety: "whatever" as RequiredProbe["safety"],
          oracles: ["vibes" as RequiredProbe["oracles"][number]],
        }),
      ])
    );

    expect(errors).toContainEqual(expect.stringMatching(/unknown tier/));
    expect(errors).toContainEqual(expect.stringMatching(/unknown safety class/));
    expect(errors).toContainEqual(expect.stringMatching(/unknown oracle/));
  });
});

describe("compareSelection", () => {
  const single = manifest([probe()]);

  it("accepts an exact match", () => {
    expect(
      compareSelection(single, {
        "release-required": ["@release-required health-status: returns 200"],
      })
    ).toEqual([]);
  });

  it("fails when a declared probe is not selected — a probe was dropped", () => {
    expect(compareSelection(single, { "release-required": [] })).toContainEqual(
      expect.stringMatching(/Playwright selects no such test/)
    );
  });

  it("fails when a selected test is not declared — requiredness was assumed", () => {
    expect(
      compareSelection(single, {
        "release-required": [
          "@release-required health-status: returns 200",
          "@release-required smuggled-in: does something",
        ],
      })
    ).toContainEqual(expect.stringMatching(/no probe in the manifest declares it/));
  });
});

describe("collectSpecTitles", () => {
  it("flattens nested Playwright suites", () => {
    const titles = collectSpecTitles([
      {
        specs: [{ title: "a" }],
        suites: [{ specs: [{ title: "b" }], suites: [{ specs: [{ title: "c" }] }] }],
      },
    ]);

    expect(titles).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for an empty listing", () => {
    expect(collectSpecTitles()).toEqual([]);
  });
});

describe("playwrightProbes", () => {
  it("excludes script-runner probes", () => {
    const probes = playwrightProbes(
      manifest([
        probe(),
        probe({
          id: "migration-posture",
          tier: "local",
          runner: { kind: "script", command: "npm run check-migrations" },
          oracles: ["static"],
        }),
      ])
    );

    expect(probes.map((p) => p.id)).toEqual(["health-status"]);
  });
});
