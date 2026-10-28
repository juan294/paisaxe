// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  bookingIntakeSuite,
  loadBookingIntakeCorpus,
} from "./jev-booking-intake";
import { runEvaluation } from "../lib/jev-evaluation";
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
