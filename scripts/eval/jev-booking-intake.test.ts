// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { JevJsonValue } from "../../src/lib/jev/contracts";
import {
  bookingIntakeSuite,
  loadBookingIntakeCorpus,
} from "./jev-booking-intake";
import {
  runEvaluation,
  hashJev,
  type EvaluationCaseRecord,
} from "../lib/jev-evaluation";
import { afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
it("freezes independently authored40/120 cases and30 route scenarios without expected labels in model state", () => {
  const corpus = loadBookingIntakeCorpus();
  expect(corpus.tuning).toHaveLength(40);
  expect(corpus.heldout).toHaveLength(120);
  expect(corpus.scenarios).toHaveLength(30);
  const suite = bookingIntakeSuite();
  expect(suite.cases).toHaveLength(160);
  for (const item of suite.cases)
    for (const request of item.requests)
      expect(JSON.stringify(request.state)).not.toContain('"expected"');
});
it("runs deterministic synthetic transport through owned interpretation, never qualifying live quality", async () => {
  const suite = bookingIntakeSuite();
  suite.cases = suite.cases.slice(0, 3);
  const run = await runEvaluation(suite, {
    mode: "fixture",
    outputRoot: mkdtempSync(join(tmpdir(), "jev-intake-")),
  });
  expect(run.qualification).toBe("experimental_unqualified");
  expect(run.cases).toHaveLength(3);
  expect(run.budget.totalRequests).toBe(0);
  expect(run.cases.every((c) => c.passed)).toBe(true);
});

it("fixture semantic judgments are input-bound and never enter actual model requests", async () => {
  const { validateBookingIntakeJudgments } = await import(
    "./jev-booking-intake"
  );
  const { hashJev } = await import("../lib/jev-evaluation");
  const corpus = loadBookingIntakeCorpus();
  const item = corpus.heldout.find((c) => c.id === "h103-uncertain-pets")!;
  const raw = {
    schemaVersion: 1,
    provenance: "synthetic_fixture_only",
    policy: "noul-labels-v1",
    judgments: [
      {
        caseId: item.id,
        inputHash: hashJev(item.input),
        answers: { required_pets: "uncertain" },
        rationale: "Uncertainty is explicit in the authored synthetic text.",
      },
    ],
  };
  expect(validateBookingIntakeJudgments(raw, corpus).get(item.id)).toEqual({
    required_pets: "uncertain",
  });
  raw.judgments[0]!.inputHash = "0".repeat(64);
  expect(() => validateBookingIntakeJudgments(raw, corpus)).toThrow(
    /input hash/i,
  );
});

it("all160 synthetic HTTP fixture cases respect the independently frozen raw labels", async () => {
  const suite = bookingIntakeSuite();
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only-key");
  vi.stubEnv("JEV_ENABLED_TASKS", "");
  try {
    for (const item of suite.cases) {
      let calls = 0;
      const result = await suite.evaluate(item.input, {
        fetch: async (_url, init) => {
          const planned = item.requests[calls];
          const canned = item.fixtureResponses[calls++];
          expect(planned, `${item.id}:plannedrequest`).toBeTruthy();
          expect(canned, `${item.id}:cannedresponse`).toBeTruthy();
          const request = JSON.parse(String(init?.body));
          expect(request).not.toHaveProperty("expected");
          expect(JSON.stringify(request)).not.toContain('"rationale"');
          return Response.json(canned!.body, { status: canned!.status });
        },
      });
      expect(calls, item.id).toBe(item.requests.length);
      expect(result.unavailable, item.id).toBe(false);
      expect(suite.compare?.(result.value, item.expected), item.id).toBe(true);
    }
  } finally {
    vi.unstubAllEnvs();
  }
}, 15000);

afterEach(() => vi.unstubAllEnvs());
let fixtureRows: Promise<EvaluationCaseRecord[]> | undefined;
async function assessmentRows() {
  if (!fixtureRows)
    fixtureRows = (async () => {
      const suite = bookingIntakeSuite();
      vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
      const rows: EvaluationCaseRecord[] = [];
      for (const item of suite.cases) {
        let calls = 0;
        const result = await suite.evaluate(item.input, {
          fetch: async (url) => {
            expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
            const response = item.fixtureResponses[calls++];
            if (!response) throw new Error("unexpected fixture request");
            return Response.json(response.body, { status: response.status });
          },
        });
        expect(result.unavailable, item.id).toBe(false);
        expect(suite.compare!(result.value, item.expected), item.id).toBe(true);
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
      return rows;
    })();
  return structuredClone(await fixtureRows);
}
function abstain(rows: EvaluationCaseRecord[], count: number) {
  for (const row of rows
    .filter(
      (r) =>
        r.split === "heldout" &&
        (r.expected as { status: string }).status === "accepted",
    )
    .slice(0, count)) {
    row.outcome = {
      status: "fallback",
      reason: "required_semantics_uncertain",
    };
    row.passed = false;
  }
}
it("published intake target accepts48of60 eligible abstentions but rejects47, without changing per-case failures or qualification", async () => {
  const suite = bookingIntakeSuite(),
    rows = await assessmentRows();
  expect(suite.assessmentPolicy).toBe("booking-intake-heldout-semantic-80-v1");
  expect(suite.canQualify).toBe(false);
  expect(suite.assess).toBeTypeOf("function");
  abstain(rows, 12);
  const a = suite.assess!(rows);
  expect(a.targetsMet).toBe(true);
  expect(a.metrics).toMatchObject({
    heldoutEligibleCount: 60,
    heldoutCorrectAcceptedCount: 48,
    heldoutFallbackCorrectCount: 60,
    tuningCount: 40,
    heldoutCount: 120,
    adoptionReady: false,
    pairedPerformanceStatus: "UNMEASURED",
  });
  expect(rows.filter((r) => r.passed === false)).toHaveLength(12);
  abstain(rows, 13);
  expect(suite.assess!(rows).targetsMet).toBe(false);
});
it.each([
  "wrong_criteria",
  "false_accept",
  "forbidden_action",
  "missing",
  "duplicate",
  "unavailable",
  "provider_reason",
  "changed_reference",
])("intake assessment fails closed on %s across all160 rows", async (kind) => {
  const rows = await assessmentRows(),
    suite = bookingIntakeSuite();
  abstain(rows, 12);
  const tuning = rows.find(
      (r) =>
        r.split === "tuning" &&
        (r.expected as { status: string }).status === "accepted",
    )!,
    fallback = rows.find(
      (r) =>
        r.split === "tuning" &&
        (r.expected as { status: string }).status === "fallback",
    )!;
  if (kind === "wrong_criteria")
    (tuning.outcome as { criteria: { partySize: number } }).criteria.partySize =
      12;
  if (kind === "false_accept")
    fallback.outcome = structuredClone(tuning.outcome);
  if (kind === "forbidden_action")
    tuning.outcome = {
      ...(tuning.outcome as Record<string, JevJsonValue>),
      action: "create_booking",
    };
  if (kind === "missing") rows.pop();
  if (kind === "duplicate") rows[159] = structuredClone(rows[158]!);
  if (kind === "unavailable") tuning.status = "unavailable";
  if (kind === "provider_reason")
    tuning.outcome = { status: "fallback", reason: "invalid_config" };
  if (kind === "changed_reference") tuning.expected = { status: "fallback" };
  expect(suite.assess!(rows).targetsMet).toBe(false);
});
it("tuning abstentions stay separate from the heldout80percent denominator and exact criteria keep canonical key equality", async () => {
  const rows = await assessmentRows(),
    suite = bookingIntakeSuite();
  abstain(rows, 12);
  for (const row of rows.filter(
    (r) =>
      r.split === "tuning" &&
      (r.expected as { status: string }).status === "accepted",
  )) {
    row.outcome = {
      status: "fallback",
      reason: "required_semantics_uncertain",
    };
    row.passed = false;
  }
  expect(suite.assess!(rows).targetsMet).toBe(true);
  const reference = rows.find(
    (r) =>
      r.split === "heldout" &&
      (r.outcome as { status: string }).status === "accepted",
  )!;
  const criteria = (reference.outcome as { criteria: Record<string, unknown> })
    .criteria;
  (reference.outcome as { criteria: Record<string, unknown> }).criteria =
    Object.fromEntries(Object.entries(criteria).reverse());
  expect(suite.compare!(reference.outcome, reference.expected)).toBe(true);
  expect(suite.assess!(rows).targetsMet).toBe(true);
});
it("bounded intake evaluation records effective timeout identity and actual SDK deadline stays operational", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  const suite = bookingIntakeSuite({ timeoutMs: 10 }),
    item = suite.cases[0]!;
  expect(suite.questionIdentity).toMatchObject({
    executionProfile: { timeoutMs: 10 },
  });
  expect(hashJev(suite.questionIdentity)).not.toBe(
    hashJev(bookingIntakeSuite().questionIdentity),
  );
  let calls = 0;
  const failed = await suite.evaluate(item.input, {
    fetch: async () => {
      calls++;
      return new Promise(() => {});
    },
  });
  expect(failed).toMatchObject({
    unavailable: true,
    value: { status: "fallback", reason: "deadline" },
  });
  expect(calls).toBe(1);
  const recovered = await suite.evaluate(item.input, {
    fetch: async () => Response.json(item.fixtureResponses[0]!.body),
  });
  expect(recovered.unavailable).toBe(false);
  expect(suite.compare!(recovered.value, item.expected)).toBe(true);
});
it("invalid or absent evaluator configuration is operational, dispatches no HTTP, and corrected configuration recovers", async () => {
  const suite = bookingIntakeSuite({ timeoutMs: 100 }),
    item = suite.cases[0]!,
    fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(item.fixtureResponses[0]!.body),
    );
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  vi.stubEnv("JEV_ENABLED_TASKS", "unknown_task");
  expect(await suite.evaluate(item.input, { fetch })).toMatchObject({
    unavailable: true,
    reason: "invalid_config",
    value: { status: "fallback", reason: "invalid_config" },
  });
  vi.stubEnv("JEV_ENABLED_TASKS", "");
  vi.stubEnv("TYPESAFE_API_KEY", "");
  expect(await suite.evaluate(item.input, { fetch })).toMatchObject({
    unavailable: true,
    reason: "not_configured",
  });
  expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  const recovered = await suite.evaluate(item.input, { fetch });
  expect(recovered.unavailable).toBe(false);
  expect(suite.compare!(recovered.value, item.expected)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
