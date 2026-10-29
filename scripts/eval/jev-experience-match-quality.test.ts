// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import {
  experienceMatchQualitySuite,
  loadMatchQualityCorpus,
  validateMatchQualityCorpus,
} from "./jev-experience-match-quality";
import { checkMatchInvariants } from "./jev-experience-match";
import { hashJev, type EvaluationCaseRecord } from "../lib/jev-evaluation";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("generates all40 frozen blind-quality candidates through actual SDK transport without exposing references", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "quality-fixture-only");
  vi.stubGlobal("fetch", () => {
    throw new Error("No global network is permitted");
  });
  const suite = experienceMatchQualitySuite(),
    rows: EvaluationCaseRecord[] = [];
  expect(suite.cases).toHaveLength(40);
  expect(suite.canQualify).toBe(false);
  for (const item of suite.cases) {
    let calls = 0;
    let actualRequest: unknown;
    const result = await suite.evaluate(item.input, {
      fetch: async (_url, init) => {
        actualRequest = JSON.parse(String(init?.body));
        return Response.json(item.fixtureResponses[calls++]!.body);
      },
    });
    expect(result.unavailable, item.id).toBe(false);
    expect(calls, item.id).toBe(item.requests.length);
    if (calls)
      expect(JSON.stringify(actualRequest)).not.toMatch(
        /"reference"|"supportedIds"|"unsupportedIds"|"unknownIds"|"expected"|"rubric"/,
      );
    expect(checkMatchInvariants(item.input, result.value), item.id).toEqual([]);
    expect(suite.compare!(result.value, item.expected)).toBe(true);
    rows.push({
      id: item.id,
      split: item.split,
      input: item.input,
      inputHash: hashJev(item.input),
      expected: item.expected,
      baseline: item.baseline,
      requests: [],
      status: "complete",
      outcome: result.value,
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
  const summary = suite.assess!(rows);
  expect(summary.targetsMet).toBe(true);
  expect(summary.metrics).toMatchObject({
    scope: "blind_quality_candidate_generation_only",
    caseCount: 40,
    hardInvariantPassCount: 40,
    blindPreferenceWins: null,
    blindPreferenceTies: null,
    adoptionReady: false,
  });
  expect(suite.assess!(rows.slice(1)).targetsMet).toBe(false);
  const bad = structuredClone(rows);
  (bad[0]!.outcome as { catalog: { experience: { priceCents: number } }[] })
    .catalog[0]!.experience.priceCents++;
  expect(suite.assess!(bad).targetsMet).toBe(false);
});

it.each([
  "duplicate_case",
  "unknown_reference",
  "overlapping_reference",
  "missing_reference",
])("rejects %s before any provider request", (mutation) => {
  const corpus = structuredClone(loadMatchQualityCorpus());
  const first = corpus.cases[0]!;
  if (mutation === "duplicate_case") corpus.cases[1]!.id = first.id;
  if (mutation === "unknown_reference")
    first.reference.supportedIds.push("not-in-catalog");
  if (mutation === "overlapping_reference")
    first.reference.unsupportedIds.push(first.reference.supportedIds[0]!);
  if (mutation === "missing_reference") first.reference.supportedIds.pop();
  expect(() => validateMatchQualityCorpus(corpus)).toThrow();
});
