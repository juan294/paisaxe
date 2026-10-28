// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import {
  experienceMatchSuite,
  loadExperienceMatchCorpus,
  checkMatchInvariants,
  summarizeExperienceMatch,
} from "./jev-experience-match";
import {
  runEvaluation,
  type EvaluationCaseRecord,
} from "../lib/jev-evaluation";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("all40 independently authored hard-filtered shortlists run through actualSDK HTTP without DB, labels, rejected IDs or uncapped candidates", async () => {
  const corpus = loadExperienceMatchCorpus(),
    suite = experienceMatchSuite();
  expect(corpus.cases).toHaveLength(40);
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  vi.stubEnv("JEV_ENABLED_TASKS", "");
  vi.stubGlobal("fetch", () => {
    throw new Error("No DB or other global transport permitted");
  });
  const rows: EvaluationCaseRecord[] = [];
  for (const item of suite.cases) {
    let calls = 0;
    const before = JSON.stringify(item.input);
    const outcome = await suite.evaluate(item.input, {
      fetch: async (url, init) => {
        expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
        const request = JSON.parse(String(init?.body));
        expect(JSON.stringify(request)).not.toMatch(
          /"expected"|"judgments"|"rubric"/,
        );
        expect(request.state.candidates.length).toBeLessThanOrEqual(10);
        const eligible = (
          item.input as {
            catalog: { suitability: string; experience: { id: string } }[];
          }
        ).catalog
          .filter((r) => r.suitability !== "rejected")
          .slice(0, 10)
          .map((r) => r.experience.id);
        expect(
          request.state.candidates.map((r: { id: string }) => r.id),
        ).toEqual(eligible);
        const fixture = item.fixtureResponses[calls++];
        expect(fixture, item.id).toBeTruthy();
        return Response.json(fixture!.body, { status: fixture!.status });
      },
    });
    expect(outcome.unavailable, item.id).toBe(false);
    expect(suite.compare!(outcome.value, item.expected), item.id).toBe(true);
    expect(checkMatchInvariants(item.input, outcome.value), item.id).toEqual(
      [],
    );
    expect(calls, item.id).toBe(item.requests.length);
    expect(JSON.stringify(item.input)).toBe(before);
    rows.push({
      id: item.id,
      split: item.split,
      input: item.input,
      inputHash: "0".repeat(64),
      expected: item.expected,
      baseline: item.baseline,
      requests: [],
      status: "complete",
      outcome: outcome.value,
      passed: true,
      reason: null,
      attemptIds: [],
      latencyMs: 0,
      latencyKind: "fixture",
      usage: null,
      costUsd: null,
      sourceRunId: "fixture",
    });
  }
  const summary = summarizeExperienceMatch(rows);
  expect(summary.targetsMet).toBe(true);
  expect(summary.metrics.hardInvariantPassCount).toBe(40);
  expect(summary.metrics.fixtureAgreementCount).toBe(40);
  expect(summary.metrics.blindPreferenceWins).toBeNull();
  expect(summary.metrics.blindPreferenceTies).toBeNull();
  expect(summary.metrics.p95LiveLatencyMs).toBeNull();
  expect(summary.metrics.adoptionReady).toBe(false);
  expect(suite.canQualify).toBe(false);
  const wrong = structuredClone(rows);
  (wrong[0]!.outcome as { catalog: { experience: { priceCents: number } }[] })
    .catalog[0]!.experience.priceCents++;
  expect(summarizeExperienceMatch(wrong).targetsMet).toBe(false);
  expect(summarizeExperienceMatch(wrong).metrics.hardInvariantPassCount).toBe(
    39,
  );
});
it.each(["missing", "partial", "invalid", "provider"])(
  "MATCH05 %s provider response degrades deterministic shortlist while retaining all hard facts",
  async (mode) => {
    vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
    const suite = experienceMatchSuite(),
      item = suite.cases[0]!;
    let calls = 0;
    const result = await suite.evaluate(item.input, {
      fetch: async () => {
        calls++;
        if (mode === "provider")
          return Response.json({ error: "fixture-rate" }, { status: 429 });
        const body = structuredClone(item.fixtureResponses[0]!.body) as {
          answers?: Record<string, unknown>;
        };
        if (mode === "missing") delete body.answers;
        if (mode === "partial")
          delete body.answers![Object.keys(body.answers!)[0]!];
        if (mode === "invalid")
          body.answers![Object.keys(body.answers!)[0]!] = {
            type: "noul",
            noul: 2,
          };
        return Response.json(body);
      },
    });
    expect(result.unavailable).toBe(true);
    expect(result.reason).toBe(
      mode === "provider" ? "rate_limited" : "invalid_response",
    );
    expect(result.value).toMatchObject({
      status: "degraded",
      examinedCount: 0,
    });
    expect(
      (
        result.value as { suggestions: { styleFit: string }[] }
      ).suggestions.every((s) => s.styleFit === "not_established"),
    ).toBe(true);
    expect(checkMatchInvariants(item.input, result.value)).toEqual([]);
    expect(calls).toBe(1);
    expect(suite.compare!(result.value, item.expected)).toBe(false);
  },
);
it("hard invariant comparator detects changed unknowns, rejected promotion, altered alternatives, cross-partition ordering and caps independently of labels", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  const suite = experienceMatchSuite();
  const item = suite.cases.find((c) =>
    (c.input as { catalog: { suitability: string }[] }).catalog.some(
      (r) => r.suitability === "unconfirmed",
    ),
  )!;
  const evaluated = await suite.evaluate(item.input, {
    fetch: async () => Response.json(item.fixtureResponses[0]!.body),
  });
  const raw = evaluated.value as {
    catalog: {
      suitability: string;
      verdicts: { verdict: string }[];
      alternatives: unknown[];
    }[];
    suggestions: unknown[];
  };
  const changed = structuredClone(raw);
  changed.catalog.find(
    (r) => r.suitability === "unconfirmed",
  )!.verdicts[0]!.verdict = "supported";
  expect(checkMatchInvariants(item.input, changed)).toContain(
    "catalog_hard_facts_changed",
  );
  const rejectedItem = suite.cases.find((c) =>
    (c.input as { catalog: { suitability: string }[] }).catalog.some(
      (r) => r.suitability === "rejected",
    ),
  )!;
  const rejectedResult = await suite.evaluate(rejectedItem.input, {
    fetch: async () => Response.json(rejectedItem.fixtureResponses[0]!.body),
  });
  const promoted = structuredClone(rejectedResult.value) as {
    catalog: { suitability: string }[];
    suggestions: unknown[];
  };
  promoted.suggestions = [
    {
      ...promoted.catalog.find((r) => r.suitability === "rejected")!,
      styleFit: "estimated",
    },
  ];
  expect(checkMatchInvariants(rejectedItem.input, promoted)).toContain(
    "suggestion_outside_eligible_cap",
  );
  const tooMany = structuredClone(raw);
  tooMany.suggestions = Array.from({ length: 4 }, () => raw.suggestions[0]);
  expect(checkMatchInvariants(item.input, tooMany)).toContain(
    "suggestion_cap_exceeded",
  );
  const alternatives = structuredClone(raw);
  alternatives.catalog[0]!.alternatives.push({
    date: "2099-01-01",
    startTime: "00:00",
    available: 999,
  });
  expect(checkMatchInvariants(item.input, alternatives)).toContain(
    "catalog_hard_facts_changed",
  );
  const duplicate = structuredClone(raw);
  duplicate.suggestions = [raw.suggestions[0], raw.suggestions[0]];
  expect(checkMatchInvariants(item.input, duplicate)).toContain(
    "duplicate_suggestions",
  );
  expect(
    checkMatchInvariants(item.input, {
      ...raw,
      truncated: true,
      examinedCount: 999,
    }),
  ).toEqual(
    expect.arrayContaining(["truncation_changed", "examined_count_changed"]),
  );
  expect(checkMatchInvariants(item.input, null)).toEqual([
    "invalid_snapshot_or_result",
  ]);
  const reversed = structuredClone(raw);
  reversed.suggestions.reverse();
  expect(
    raw.suggestions.some(
      (r) => (r as { suitability: string }).suitability === "unconfirmed",
    ),
  ).toBe(true);
  expect(checkMatchInvariants(item.input, reversed)).toContain(
    "suitability_partition_changed",
  );
});
it("invariants reject empty catalog success and non-deterministic degraded shortlist", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  const suite = experienceMatchSuite(),
    item = suite.cases[0]!;
  const result = await suite.evaluate(item.input, {
    fetch: async () => Response.json({}, { status: 429 }),
  });
  const actual = result.value as { suggestions: unknown[] };
  expect(actual.suggestions).toHaveLength(3);
  expect(
    checkMatchInvariants(item.input, { ...actual, suggestions: [] }),
  ).toContain("empty_catalog_success");
  expect(
    checkMatchInvariants(item.input, {
      ...actual,
      suggestions: [...actual.suggestions].reverse(),
    }),
  ).toContain("degraded_shortlist_changed");
});

it("P6-EVAL-01 runner preserves deterministic degraded facts but marks provider failures partial; answered uncertainty is complete", async () => {
  const original = experienceMatchSuite(),
    first = original.cases[0]!;
  const failed = await runEvaluation(
    {
      ...original,
      cases: [
        {
          ...first,
          fixtureResponses: [
            { status: 429, body: { error: "synthetic-rate" } },
          ],
        },
      ],
    },
    {
      mode: "fixture",
      outputRoot: mkdtempSync(join(tmpdir(), "jev-match-partial-")),
    },
  );
  expect(failed.complete).toBe(false);
  expect(failed.cases[0]).toMatchObject({
    status: "unavailable",
    reason: "rate_limited",
    outcome: { status: "degraded", examinedCount: 0 },
  });
  expect(checkMatchInvariants(first.input, failed.cases[0]!.outcome)).toEqual(
    [],
  );
  const uncertain = original.cases.find((item) => item.id === "match-36")!;
  const answered = await runEvaluation(
    { ...original, cases: [uncertain] },
    {
      mode: "fixture",
      outputRoot: mkdtempSync(join(tmpdir(), "jev-match-answered-")),
    },
  );
  expect(answered.complete).toBe(true);
  expect(answered.cases[0]).toMatchObject({
    status: "complete",
    outcome: { status: "matched", reason: "no_clear_style_match" },
  });
  expect(answered.qualified).toBe(false);
});
