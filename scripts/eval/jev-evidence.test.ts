// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import {
  evidenceSuite,
  loadEvidenceCorpus,
  summarizeEvidence,
} from "./jev-evidence";
import type { EvaluationCaseRecord } from "../lib/jev-evaluation";
import { runEvaluation } from "../lib/jev-evaluation";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
afterEach(() => vi.unstubAllEnvs());
it("independently authored6tuning/24heldout execute through actual SDK and preserve cited-subset/expected-label isolation", async () => {
  const corpus = loadEvidenceCorpus();
  expect(corpus.tuning).toHaveLength(6);
  expect(corpus.heldout).toHaveLength(24);
  const suite = evidenceSuite();
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  const rows: EvaluationCaseRecord[] = [];
  for (const item of suite.cases) {
    let count = 0;
    const result = await suite.evaluate(item.input, {
      fetch: async (url, init) => {
        expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
        const body = JSON.parse(String(init?.body));
        expect(JSON.stringify(body)).not.toMatch(
          /"expected"|"judgments"|"rubric"/,
        );
        expect(
          body.state.passages.map((p: { id: string }) => p.id).sort(),
        ).toEqual([...body.state.claim.citedPassageIds].sort());
        const fixture = item.fixtureResponses[count++];
        expect(fixture, item.id).toBeTruthy();
        return Response.json(fixture!.body, { status: fixture!.status });
      },
    });
    expect(result.unavailable, item.id).toBe(false);
    expect(suite.compare!(result.value, item.expected), item.id).toBe(true);
    expect(count).toBe(item.requests.length);
    rows.push({
      id: item.id,
      split: item.split,
      input: item.input,
      inputHash: "0".repeat(64),
      expected: item.expected,
      baseline: null,
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
  const assessed = summarizeEvidence(rows);
  expect(assessed.targetsMet).toBe(true);
  expect(assessed.metrics.falseSupportCount).toBe(0);
  expect(assessed.metrics.supportRecall).toBe(1);
  expect(assessed.metrics.macroF1).toBe(1);
  expect(assessed.metrics.heldoutCount).toBe(24);
  const abstained = structuredClone(rows);
  const positive = abstained.find(
    (r) =>
      r.split === "heldout" &&
      (r.expected as { label: string }).label === "supported",
  )!;
  positive.outcome = {
    claims: [{ label: "unavailable", unavailableKind: "semantic" }],
  };
  positive.passed = false;
  const summary = summarizeEvidence(abstained);
  expect(summary.targetsMet).toBe(false);
  expect(summary.metrics.supportRecall).toBe(7 / 8);
  expect(summary.metrics.semanticAbstentionCount).toBe(1);
  const falsePositive = structuredClone(rows);
  falsePositive.find(
    (r) =>
      r.split === "heldout" &&
      (r.expected as { label: string }).label === "not_established",
  )!.outcome = { claims: [{ label: "supported" }] };
  expect(summarizeEvidence(falsePositive).metrics.falseSupportCount).toBe(1);
  expect(summarizeEvidence(falsePositive).targetsMet).toBe(false);
});
it("semantic conflicting evidence is complete but wrong/abstained in metrics; provider failure is partial and old evidence survives explicit retry", async () => {
  const original = evidenceSuite(),
    item = original.cases[0]!,
    fixture = structuredClone(item.fixtureResponses[0]!.body) as {
      answers: Record<string, { type: string; noul?: number }>;
    };
  fixture.answers.support!.noul = 0.99;
  fixture.answers.contradiction!.noul = 0.99;
  const suite = {
    ...original,
    cases: [{ ...item, fixtureResponses: [{ status: 200, body: fixture }] }],
  };
  const root = mkdtempSync(join(tmpdir(), "jev-evidence-suite-"));
  const semantic = await runEvaluation(suite, {
    mode: "fixture",
    outputRoot: root,
  });
  expect(semantic.complete).toBe(true);
  expect(semantic.cases[0]).toMatchObject({
    status: "complete",
    passed: false,
    outcome: {
      claims: [{ label: "unavailable", reason: "ambiguous_evidence" }],
    },
  });
  expect(semantic.qualified).toBe(false);
  const failure = await runEvaluation(
    {
      ...original,
      cases: [
        {
          ...item,
          fixtureResponses: [
            { status: 429, body: { error: "synthetic-rate" } },
          ],
        },
      ],
    },
    { mode: "fixture", outputRoot: root },
  );
  expect(failure.complete).toBe(false);
  expect(failure.cases[0]?.status).toBe("unavailable");
  const before = readFileSync(join(failure.directory, "run.json"), "utf8");
  const recovery = await runEvaluation(
    { ...original, cases: [item] },
    { mode: "fixture", outputRoot: root },
  );
  expect(recovery.complete).toBe(true);
  expect(readFileSync(join(failure.directory, "run.json"), "utf8")).toBe(
    before,
  );
});
