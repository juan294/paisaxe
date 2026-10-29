import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { BookingTurnInput } from "../../src/lib/booking/agent";
import {
  deterministicIntake,
  enumerateIntakeCandidates,
} from "../../src/lib/booking/intake-candidates";
import {
  eligibleIntakeTurn,
  interpretBookingIntake,
} from "../../src/lib/booking/intake";
import {
  buildIntakeRequest,
  INTAKE_NOUlS,
  INTAKE_QUESTION_VERSION,
} from "../../src/lib/booking/intake-questions";
import {
  JEV_POLICY_VERSION,
  JEV_EVALUATION_DEADLINE_MS,
  type JevJsonValue,
  type JevState,
} from "../../src/lib/jev/contracts";
import type { JevOptions } from "../../src/lib/jev/client";
import {
  hashJev,
  jevWilsonInterval,
  type EvaluationCaseRecord,
  type EvaluationSuite,
} from "../lib/jev-evaluation";
import { bookingIntakeHttpFixture } from "../lib/booking-intake-http-fixture";
export { bookingIntakeHttpFixture } from "../lib/booking-intake-http-fixture";
export interface BookingIntakeFixtureInput {
  message: string;
  now: string;
  locale?: string;
  draft?: Record<string, unknown>;
  history?: { role: "user" | "assistant"; content: string }[];
  bookings?: number;
  replay?: boolean;
}
export function intakeFixtureTurn(
  input: BookingIntakeFixtureInput,
): Pick<
  BookingTurnInput,
  "locale" | "draft" | "history" | "bookings" | "acceptedBooking"
> {
  const draft = {
    id: "fixture",
    userId: "fixture",
    status: "open",
    partySize: null,
    slotDate: null,
    slotTime: null,
    budgetCents: null,
    constraints: {},
    ...input.draft,
  } as BookingTurnInput["draft"];
  return {
    locale: input.locale ?? "es",
    draft,
    history: input.history ?? [],
    bookings: Array.from({ length: input.bookings ?? 0 }, () => ({}) as never),
    acceptedBooking: null,
  };
}
export function loadBookingIntakeCorpus() {
  const corpus = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("./fixtures/jev/booking-intake.json", import.meta.url),
      ),
      "utf8",
    ),
  );
  const item = z.object({
    id: z.string(),
    input: z
      .object({ message: z.string(), now: z.iso.datetime() })
      .passthrough(),
    expected: z
      .object({ status: z.enum(["accepted", "fallback"]) })
      .passthrough(),
  });
  z.object({
    schemaVersion: z.literal(1),
    clock: z.iso.datetime(),
    catalog: z.string(),
    tuning: z.array(item).length(40),
    heldout: z.array(item).length(120),
    scenarios: z.array(z.unknown()).length(30),
  })
    .strict()
    .parse(corpus);
  if (
    corpus.heldout.filter(
      (c: { expected: { status: string } }) => c.expected.status === "accepted",
    ).length !== 60
  )
    throw new Error("Frozen heldout requires60eligible and60fallback");
  return corpus as {
    schemaVersion: 1;
    clock: string;
    catalog: string;
    tuning: {
      id: string;
      input: BookingIntakeFixtureInput;
      expected: JevJsonValue;
    }[];
    heldout: {
      id: string;
      input: BookingIntakeFixtureInput;
      expected: JevJsonValue;
    }[];
    scenarios: unknown[];
  };
}
/** Authored canned judgments belong only to HTTP fixture responses, never inference state. */
export function validateBookingIntakeJudgments(
  raw: unknown,
  corpus: ReturnType<typeof loadBookingIntakeCorpus>,
) {
  const labels = z.enum(["true", "false", "uncertain"]);
  const schema = z
    .object({
      schemaVersion: z.literal(1),
      provenance: z.literal("synthetic_fixture_only"),
      policy: z.literal("noul-labels-v1"),
      judgments: z.array(
        z
          .object({
            caseId: z.string().min(1),
            inputHash: z.string().regex(/^[a-f0-9]{64}$/),
            answers: z
              .record(z.string(), labels)
              .refine((value) => Object.keys(value).length > 0),
            rationale: z.string().min(1),
          })
          .strict(),
      ),
    })
    .strict();
  const parsed = schema.parse(raw);
  const output = new Map<string, Record<string, z.infer<typeof labels>>>();
  for (const entry of parsed.judgments) {
    const item = [...corpus.tuning, ...corpus.heldout].find(
      (c) => c.id === entry.caseId,
    );
    if (!item || output.has(entry.caseId))
      throw new Error("Fixture judgment requires a unique existing case ID.");
    if (hashJev(item.input) !== entry.inputHash)
      throw new Error(
        "Fixture judgment input hash mismatch; author a new judgment for the changed input.",
      );
    if (
      Object.keys(entry.answers).some(
        (key) => !Object.hasOwn(INTAKE_NOUlS, key),
      )
    )
      throw new Error("Fixture judgment refers to an unknown Noul question.");
    output.set(entry.caseId, entry.answers);
  }
  return output;
}
export function bookingIntakeSuite(
  options: Pick<JevOptions, "timeoutMs"> = {},
): EvaluationSuite {
  const corpus = loadBookingIntakeCorpus();
  const judgments = validateBookingIntakeJudgments(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "./fixtures/jev/booking-intake-judgments.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ),
    corpus,
  );
  return {
    id: "booking-intake",
    task: "booking_intake",
    questionVersion: INTAKE_QUESTION_VERSION,
    policyVersion: JEV_POLICY_VERSION,
    questionIdentity: {
      ...INTAKE_NOUlS,
      executionProfile: {
        timeoutMs: Math.min(
          options.timeoutMs ?? JEV_EVALUATION_DEADLINE_MS,
          JEV_EVALUATION_DEADLINE_MS,
        ),
      },
    },
    assessmentPolicy: "booking-intake-heldout-semantic-80-v1",
    canQualify: false,
    assess: (cases) => assessBookingIntake(cases, corpus),
    qualification: "experimental_unqualified",
    cases: [
      ...corpus.tuning.map((c) => ({ ...c, split: "tuning" })),
      ...corpus.heldout.map((c) => ({ ...c, split: "heldout" })),
    ].map((c) => {
      const parsed = enumerateIntakeCandidates(
        c.input.message,
        new Date(c.input.now),
      );
      const eligible = eligibleIntakeTurn(
        intakeFixtureTurn(c.input),
        c.input.replay ?? false,
      );
      const request =
        eligible && parsed.status === "candidates"
          ? buildIntakeRequest(parsed)
          : null;
      const literal = eligible
        ? deterministicIntake(c.input.message, new Date(c.input.now))
        : { status: "fallback", reason: "ineligible_turn" };
      return {
        id: c.id,
        split: c.split,
        input: c.input as unknown as JevState,
        expected: c.expected,
        baseline: {
          kind: "deterministic_literal",
          value: literal,
        } as unknown as JevJsonValue,
        requests: request ? [request] : [],
        fixtureResponses: request
          ? [bookingIntakeHttpFixture(request, judgments.get(c.id))]
          : [],
      };
    }),
    async evaluate(raw, { fetch }) {
      const input = raw as unknown as BookingIntakeFixtureInput;
      if (!eligibleIntakeTurn(intakeFixtureTurn(input), input.replay ?? false))
        return {
          value: { status: "fallback", reason: "ineligible_turn" },
          unavailable: false,
        };
      const result = await interpretBookingIntake(input.message, {
        now: new Date(input.now),
        context: {
          mode: "evaluation",
          task: "booking_intake",
          authorized: true,
        },
        ...options,
        fetch,
      });
      return {
        value:
          result.status === "accepted"
            ? ({
                status: result.status,
                criteria: result.criteria,
              } as unknown as JevJsonValue)
            : {
                status: result.status,
                ...("reason" in result ? { reason: result.reason } : {}),
              },
        unavailable:
          result.status === "aborted" ||
          (result.status === "fallback" &&
            OPERATIONAL_REASONS.has(result.reason)),
        reason:
          result.status === "aborted"
            ? "aborted"
            : result.status === "fallback" &&
                OPERATIONAL_REASONS.has(result.reason)
              ? result.reason
              : undefined,
      };
    },
    compare: sameIntakeOutcome,
  };
}
function sort(value: unknown): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, sort(v)]),
      )
    : value;
}

const OPERATIONAL_REASONS = new Set([
  "provider_error",
  "deadline",
  "rate_limited",
  "invalid_response",
  "not_configured",
  "invalid_config",
  "disabled",
  "aborted",
]);
function sameIntakeOutcome(
  actual: JevJsonValue,
  expected: JevJsonValue,
): boolean {
  const a = actual as { status?: string; criteria?: unknown },
    e = expected as { status?: string; criteria?: unknown };
  return (
    a?.status === e?.status &&
    (e.status !== "accepted" ||
      JSON.stringify(a.criteria) === JSON.stringify(e.criteria) ||
      JSON.stringify(sort(a.criteria)) === JSON.stringify(sort(e.criteria)))
  );
}
const assessedOutcome = z.discriminatedUnion("status", [
  z.object({ status: z.literal("accepted"), criteria: z.unknown() }).strict(),
  z
    .object({ status: z.literal("fallback"), reason: z.string().min(1) })
    .strict(),
]);
/** Apply the published semantic80% threshold only; paired runtime performance remains unmeasured. */
function assessBookingIntake(
  cases: EvaluationCaseRecord[],
  corpus: ReturnType<typeof loadBookingIntakeCorpus>,
) {
  const references = [
      ...corpus.tuning.map((c) => ({ ...c, split: "tuning" })),
      ...corpus.heldout.map((c) => ({ ...c, split: "heldout" })),
    ],
    byId = new Map(references.map((c) => [c.id, c]));
  const shape =
    cases.length === 160 &&
    new Set(cases.map((c) => c.id)).size === 160 &&
    cases.every((c) => {
      const reference = byId.get(c.id);
      return (
        reference &&
        c.split === reference.split &&
        hashJev(c.input) === hashJev(reference.input) &&
        hashJev(c.expected) === hashJev(reference.expected)
      );
    });
  const tuning = cases.filter((c) => c.split === "tuning"),
    heldout = cases.filter((c) => c.split === "heldout");
  const expected = (c: EvaluationCaseRecord) =>
    byId.get(c.id)?.expected as { status?: string } | undefined;
  const actual = (c: EvaluationCaseRecord) =>
    c.outcome as { status?: string; reason?: string } | null;
  const operational = cases.filter(
    (c) =>
      c.status !== "complete" ||
      actual(c)?.status === "aborted" ||
      (actual(c)?.status === "fallback" &&
        OPERATIONAL_REASONS.has(actual(c)?.reason ?? "")),
  );
  const malformed = cases.filter(
    (c) => !assessedOutcome.safeParse(c.outcome).success,
  );
  const accepted = cases.filter((c) => actual(c)?.status === "accepted");
  const falseAccepted = accepted.filter(
      (c) => expected(c)?.status !== "accepted",
    ),
    wrongCriteria = accepted.filter(
      (c) =>
        expected(c)?.status === "accepted" &&
        !sameIntakeOutcome(c.outcome, byId.get(c.id)!.expected),
    );
  const eligible = heldout.filter((c) => expected(c)?.status === "accepted"),
    fallback = heldout.filter((c) => expected(c)?.status === "fallback");
  const correctAccepted = eligible.filter(
    (c) =>
      c.status === "complete" &&
      sameIntakeOutcome(c.outcome, byId.get(c.id)!.expected),
  ).length;
  const correctFallback = fallback.filter(
    (c) =>
      c.status === "complete" &&
      actual(c)?.status === "fallback" &&
      !OPERATIONAL_REASONS.has(actual(c)?.reason ?? ""),
  ).length;
  const eligibleAbstentions = eligible.filter(
    (c) =>
      c.status === "complete" &&
      actual(c)?.status === "fallback" &&
      !OPERATIONAL_REASONS.has(actual(c)?.reason ?? ""),
  ).length;
  return {
    targetsMet:
      shape &&
      operational.length === 0 &&
      malformed.length === 0 &&
      eligible.length === 60 &&
      fallback.length === 60 &&
      correctAccepted >= 48 &&
      correctFallback === 60 &&
      falseAccepted.length === 0 &&
      wrongCriteria.length === 0,
    metrics: {
      suppliedCount: cases.length,
      tuningCount: tuning.length,
      tuningCorrectCount: tuning.filter(
        (c) =>
          c.status === "complete" &&
          byId.has(c.id) &&
          sameIntakeOutcome(c.outcome, byId.get(c.id)!.expected),
      ).length,
      heldoutCount: heldout.length,
      heldoutEligibleCount: eligible.length,
      heldoutCorrectAcceptedCount: correctAccepted,
      heldoutEligibleAbstentionCount: eligibleAbstentions,
      heldoutEligibleAcceptanceRate: correctAccepted / 60,
      heldoutEligibleAcceptanceInterval95: jevWilsonInterval(
        correctAccepted,
        60,
      ),
      heldoutFallbackCount: fallback.length,
      heldoutFallbackCorrectCount: correctFallback,
      falseAcceptedCountAcrossAll160: falseAccepted.length,
      incorrectAcceptedCriteriaCountAcrossAll160: wrongCriteria.length,
      invalidOutcomeOrActionCount: malformed.length,
      operationalOrIncompleteCount: operational.length,
      providerErrorCount: cases.filter(
        (c) =>
          actual(c)?.status === "fallback" &&
          OPERATIONAL_REASONS.has(actual(c)?.reason ?? ""),
      ).length,
      missingOrUnknownCount: cases.filter(
        (c) => c.status === "missing" || c.status === "unknown_completion",
      ).length,
      completeReferenceSet: shape,
      targets: {
        minimumCorrectEligibleHeldout: 48,
        eligibleHeldoutDenominator: 60,
        requiredCorrectFallbackHeldout: 60,
        maximumFalseAcceptedAcrossAll160: 0,
        maximumIncorrectCriteriaAcrossAll160: 0,
      },
      adoptionReady: false,
      pairedPerformanceStatus: "UNMEASURED",
      qualificationScope:
        "semantic_intake_assessment_only_not_runtime_activation",
      sampleLimit:
        "40 tuning and120 independently frozen heldout cases. Tuning is not part of the80% denominator. Semantic abstentions stay failed per-case; any operational or missing result makes assessment incomplete. Paired Claude performance and production behavior are unmeasured.",
    },
  };
}
