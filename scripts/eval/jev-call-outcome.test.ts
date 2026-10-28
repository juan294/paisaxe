// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import {
  callOutcomeSuite,
  summarizeCallAdvice,
  loadCallOutcomeCorpus,
} from "./jev-call-outcome";
import type { EvaluationCaseRecord } from "../lib/jev-evaluation";
afterEach(() => vi.unstubAllEnvs());
it("freezes40tuning and120heldout references and executes all synthetic HTTP labels through the real advisor", async () => {
  const corpus = loadCallOutcomeCorpus();
  expect(corpus.tuning).toHaveLength(40);
  expect(corpus.heldout).toHaveLength(120);
  const suite = callOutcomeSuite();
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-only");
  vi.stubEnv("JEV_ENABLED_TASKS", "");
  const rows: EvaluationCaseRecord[] = [];
  for (const item of suite.cases) {
    let calls = 0;
    const result = await suite.evaluate(item.input, {
      fetch: async (_url, init) => {
        const response = item.fixtureResponses[calls++];
        expect(response, item.id).toBeTruthy();
        const request = JSON.parse(String(init?.body));
        expect(JSON.stringify(request)).not.toContain('"judgments"');
        expect(JSON.stringify(request)).not.toContain('"expected"');
        return Response.json(response!.body, { status: response!.status });
      },
    });
    expect(result.unavailable, item.id).toBe(false);
    expect(suite.compare?.(result.value, item.expected), item.id).toBe(true);
    expect(calls, item.id).toBe(item.requests.length);
    rows.push({
      id: item.id,
      split: item.split,
      input: item.input,
      inputHash: "0".repeat(64),
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
  const assessment = summarizeCallAdvice(rows);
  expect(assessment.targetsMet).toBe(true);
  expect(assessment.metrics.heldoutCount).toBe(120);
  expect(assessment.metrics.falseAcceptanceCount).toBe(0);
  expect(assessment.metrics.usefulCorrect).toBe(90);
  const wrong = structuredClone(rows);
  const declined = wrong.find(
    (row) =>
      row.split === "heldout" &&
      (row.expected as { label: string }).label === "merchant_declined",
  )!;
  declined.outcome = { label: "merchant_accepted" };
  declined.passed = false;
  expect(summarizeCallAdvice(wrong).targetsMet).toBe(false);
});
it("reports the approved80% useful-label threshold without requiring100% semantic accuracy", () => {
  const corpus = loadCallOutcomeCorpus();
  const raw = corpus.heldout;
  const rows = raw.map(
    (item, index) =>
      ({
        id: item.id,
        split: "heldout",
        input: item.input,
        inputHash: "0".repeat(64),
        expected: item.expected,
        baseline: null,
        requests: [],
        status: "complete",
        outcome: { label: index < 18 ? "uncertain" : item.expected.label },
        passed: index >= 18,
        reason: null,
        attemptIds: [],
        latencyMs: 0,
        latencyKind: "fixture",
        usage: null,
        costUsd: null,
        sourceRunId: "fixture",
      }) as EvaluationCaseRecord,
  );
  const result = summarizeCallAdvice(rows);
  expect(result.targetsMet).toBe(true);
  expect(result.metrics.usefulCorrect).toBe(72);
  expect(result.metrics.usefulnessDenominator).toBe(90);
  rows[18]!.outcome = { label: "uncertain" };
  rows[18]!.passed = false;
  expect(summarizeCallAdvice(rows).targetsMet).toBe(false);
});
it("CALL-06 real CLI import/list has zero non-Jev transport without credentials", () => {
  const code =
    'globalThis.fetch=()=>{throw new Error("network forbidden during list")};const{jevMain}=await import("./scripts/eval/jev.ts");process.exitCode=await jevMain(["--list"]);';
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--input-type=module",
      "-e",
      code,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        TYPESAFE_API_KEY: "",
        SUPABASE_SERVICE_KEY: "",
        TWILIO_AUTH_TOKEN: "",
        PAYPAL_CLIENT_SECRET: "",
      },
    },
  );
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout).toContain("call-outcome");
});
