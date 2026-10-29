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
        expect(Object.keys(request.questions).length).toBeLessThanOrEqual(10);
        expect(request.state).not.toHaveProperty("candidates");
        const eligible = (
          item.input as {
            catalog: {
              suitability: string;
              experience: { title: string; description: string | null };
            }[];
          }
        ).catalog
          .filter((r) => r.suitability !== "rejected")
          .slice(0, 10);
        expect(
          Object.values(request.questions).map(
            (q) =>
              (q as { instructions: { candidate: { title: string } } })
                .instructions.candidate.title,
          ),
        ).toEqual(eligible.map((r) => r.experience.title));
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
  expect(summary.metrics.positiveReferenceJudgedCount).toBeGreaterThan(0);
  expect(summary.metrics.positiveReferenceRecoveredCount).toBe(
    summary.metrics.positiveReferenceJudgedCount,
  );
  expect(summary.metrics.negativeReferencePromotedCount).toBe(0);
  expect(summary.metrics.blindPreferenceWins).toBeNull();
  expect(summary.metrics.blindPreferenceTies).toBeNull();
  expect(summary.metrics.p95LiveLatencyMs).toBeNull();
  expect(summary.metrics.adoptionReady).toBe(false);
  const fresh = summarizeExperienceMatch(
    rows.map((row) => ({ ...row, latencyKind: "fresh" })),
  );
  expect(fresh.metrics.judgmentSource).toBe("fresh_live");
  expect(fresh.metrics.fixtureAgreementCount).toBeNull();
  expect(fresh.metrics.fixtureAgreementDenominator).toBeNull();
  expect(fresh.metrics.fixtureAgreementInterval95).toBeNull();
  expect(fresh.metrics.referenceAgreementDenominator).toBe(40);
  const mixed = summarizeExperienceMatch(
    rows.map((row, index) => ({
      ...row,
      latencyKind: index ? "fixture" : "fresh",
    })),
  );
  expect(mixed.metrics.fixtureAgreementCount).toBeNull();
  expect(mixed.metrics.fixtureAgreementDenominator).toBeNull();
  expect(mixed.metrics.fixtureAgreementInterval95).toBeNull();
  expect(mixed.metrics.referenceAgreementCount).toBe(40);
  expect(fresh.metrics.referenceAgreementCount).toBe(40);
  expect(fresh.metrics.adoptionReadiness.reason).not.toMatch(
    /canned|no.*authorized or performed/i,
  );
  expect(fresh.metrics.adoptionReady).toBe(false);

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

it("offline support diagnostics reject forged, omitted, duplicated, reordered and inconsistent records from actual SDK outcomes", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  const suite = experienceMatchSuite(),
    item = suite.cases[0]!;
  const actual = await suite.evaluate(item.input, {
    fetch: async () => Response.json(item.fixtureResponses[0]!.body),
  });
  type DiagnosticResult = {
    offlineDiagnostics?: {
      candidates: {
        experienceId: string;
        probability: number;
        positive: boolean;
      }[];
    };
  };
  const pristine = actual.value as DiagnosticResult;
  expect(pristine.offlineDiagnostics!.candidates).toHaveLength(3);
  const mutations: [string, (value: DiagnosticResult) => void][] = [
    [
      "candidate_support_ids_changed",
      (value) => {
        value.offlineDiagnostics!.candidates[0]!.experienceId =
          "forged-candidate";
      },
    ],
    [
      "candidate_support_ids_changed",
      (value) => {
        value.offlineDiagnostics!.candidates[1]!.experienceId =
          value.offlineDiagnostics!.candidates[0]!.experienceId;
      },
    ],
    [
      "candidate_support_ids_changed",
      (value) => {
        value.offlineDiagnostics!.candidates.reverse();
      },
    ],
    [
      "candidate_support_ids_changed",
      (value) => {
        value.offlineDiagnostics!.candidates.pop();
      },
    ],
    [
      "missing_candidate_support_diagnostics",
      (value) => {
        delete value.offlineDiagnostics;
      },
    ],
    [
      "candidate_support_positive_inconsistent",
      (value) => {
        value.offlineDiagnostics!.candidates[0]!.probability = 0.01;
        value.offlineDiagnostics!.candidates[0]!.positive = true;
      },
    ],
    [
      "candidate_support_positive_inconsistent",
      (value) => {
        value.offlineDiagnostics!.candidates[0]!.probability = 0.9;
        value.offlineDiagnostics!.candidates[0]!.positive = false;
      },
    ],
  ];
  for (const [violation, mutate] of mutations) {
    const changed = structuredClone(actual.value) as DiagnosticResult;
    mutate(changed);
    expect(checkMatchInvariants(item.input, changed)).toContain(violation);
    const row: EvaluationCaseRecord = {
      id: item.id,
      split: item.split,
      input: item.input,
      inputHash: "0".repeat(64),
      expected: item.expected,
      baseline: item.baseline,
      requests: [],
      status: "complete",
      outcome: changed as EvaluationCaseRecord["outcome"],
      passed: false,
      reason: null,
      attemptIds: [],
      latencyMs: 1,
      latencyKind: "fresh",
      usage: null,
      costUsd: null,
      sourceRunId: "diagnostic-mutation",
    };
    expect(
      summarizeExperienceMatch([row]).metrics.candidateSupportDiagnostics,
    ).toEqual([]);
  }
  for (const caseId of ["match-20", "match-31"]) {
    const boundedCase = suite.cases.find((c) => c.id === caseId)!;
    const boundedOutput = await suite.evaluate(boundedCase.input, {
      fetch: async () => Response.json(boundedCase.fixtureResponses[0]!.body),
    });
    const changed = structuredClone(boundedOutput.value) as DiagnosticResult;
    const catalog = (
      boundedCase.input as {
        catalog: { suitability: string; experience: { id: string } }[];
      }
    ).catalog;
    const excluded =
      caseId === "match-20"
        ? catalog.find((row) => row.suitability === "rejected")!
        : catalog.filter((row) => row.suitability !== "rejected")[10]!;
    changed.offlineDiagnostics!.candidates[0]!.experienceId =
      excluded.experience.id;
    expect(checkMatchInvariants(boundedCase.input, changed)).toContain(
      "candidate_support_ids_changed",
    );
  }
  const degraded = await suite.evaluate(item.input, {
    fetch: async () => Response.json({}, { status: 429 }),
  });
  const contaminated = structuredClone(degraded.value) as DiagnosticResult;
  contaminated.offlineDiagnostics!.candidates =
    pristine.offlineDiagnostics!.candidates;
  expect(checkMatchInvariants(item.input, contaminated)).toContain(
    "unexpected_candidate_support_diagnostics",
  );
  const empty = suite.cases.find((c) => c.requests.length === 0)!;
  const emptyResult = await suite.evaluate(empty.input, {
    fetch: async () => {
      throw new Error("No inference for empty/rejected catalog");
    },
  });
  const fakeEmpty = structuredClone(emptyResult.value) as DiagnosticResult;
  fakeEmpty.offlineDiagnostics!.candidates =
    pristine.offlineDiagnostics!.candidates;
  expect(checkMatchInvariants(empty.input, fakeEmpty)).toContain(
    "unexpected_candidate_support_diagnostics",
  );
});
