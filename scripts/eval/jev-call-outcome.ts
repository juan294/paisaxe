import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  adviseCall,
  prepareCallAdvice,
  CALL_QUESTION_VERSION,
  CALL_NOULS,
  CALL_EVIDENCE,
  type AdvisoryLabel,
  type CallSnapshot,
} from "../lib/jev-call-outcome";
import {
  JEV_MODEL,
  JEV_POLICY_VERSION,
  type JevJsonValue,
  type JevState,
} from "../../src/lib/jev/contracts";
import type {
  EvaluationSuite,
  EvaluationCaseRecord,
} from "../lib/jev-evaluation";
const label = z.enum([
  "merchant_accepted",
  "merchant_declined",
  "no_contact",
  "uncertain",
]);
const expected = z
  .object({
    label,
    evidenceUtteranceIds: z.array(z.string()),
    invariants: z.array(z.string()).min(1),
    fullyEvidenced: z.boolean(),
  })
  .strict();
const caseSchema = z
  .object({
    id: z.string(),
    input: z.unknown(),
    expected,
    judgments: z
      .object({
        noul: z.record(z.string(), z.enum(["true", "false", "uncertain"])),
        evidence: z.record(z.string(), z.array(z.string()).max(1)),
      })
      .strict(),
  })
  .strict();
const corpusSchema = z
  .object({
    schemaVersion: z.literal(1),
    provenance: z.literal("synthetic_fixture_only"),
    tuning: z.array(caseSchema).length(40),
    heldout: z.array(caseSchema).length(120),
  })
  .strict();
export function loadCallOutcomeCorpus() {
  const corpus = corpusSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("./fixtures/jev/call-outcome.json", import.meta.url),
        ),
        "utf8",
      ),
    ),
  );
  const all = [...corpus.tuning, ...corpus.heldout];
  if (new Set(all.map((c) => c.id)).size !== 160)
    throw new Error("Call fixtures require160distinct caseIDs");
  for (const value of label.options)
    if (corpus.heldout.filter((c) => c.expected.label === value).length !== 30)
      throw new Error("Call heldout requires30referencecases per label.");
  if (
    corpus.heldout.filter(
      (c) => c.expected.label !== "uncertain" && c.expected.fullyEvidenced,
    ).length !== 90
  )
    throw new Error(
      "Call usefulness requires90fullyevidenced nonuncertain references.",
    );
  for (const item of all) {
    const input = item.input as CallSnapshot;
    const ids = new Set(input.utterances?.map((turn) => turn.id) ?? []);
    if (
      Object.keys(item.judgments.noul).sort().join() !==
        Object.keys(CALL_NOULS).sort().join() ||
      Object.keys(item.judgments.evidence).sort().join() !==
        Object.keys(CALL_EVIDENCE).sort().join()
    )
      throw new Error("Call fixtures must author every independent question.");
    if (
      Object.values(item.judgments.evidence)
        .flat()
        .some((id) => !ids.has(id)) ||
      item.expected.evidenceUtteranceIds.some((id) => !ids.has(id))
    )
      throw new Error(
        "Call fixture evidence ID is outside its supplied utterances.",
      );
  }
  return corpus;
}
function fixtureResponse(
  input: unknown,
  judgments: z.infer<typeof caseSchema>["judgments"],
) {
  const request = prepareCallAdvice(input);
  if (request.status !== "ready") return null;
  const answers = Object.fromEntries(
    Object.entries(request.questionSet.questions).map(([id, question]) => {
      if (question.type === "noul") {
        const value = judgments.noul[id];
        return [
          id,
          {
            type: "noul",
            noul: value === "true" ? 0.99 : value === "uncertain" ? 0.5 : 0.01,
          },
        ];
      }
      const ids = Object.keys(question.criteria);
      const choice = judgments.evidence[id]?.[0] ?? ids[0]!;
      return [
        id,
        {
          type: "choice",
          choice,
          confidence: 0.99,
          probabilities: Object.fromEntries(
            ids.map((id) => [
              id,
              id === choice
                ? ids.length === 1
                  ? 1
                  : 0.99
                : 0.01 / (ids.length - 1),
            ]),
          ),
        },
      ];
    }),
  );
  return {
    status: 200,
    body: {
      model: JEV_MODEL,
      answers,
      usage: { input_tokens: 100, output_tokens: 0 },
    } as JevJsonValue,
  };
}
function wilson(successes: number, total: number) {
  if (!total) return null;
  const z = 1.96,
    p = successes / total,
    d = 1 + (z * z) / total,
    center = (p + (z * z) / (2 * total)) / d,
    half =
      (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
      d;
  return {
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
    confidence: 0.95,
    total,
  };
}
/** Reference labels and tuning never enter a provider request or the heldout denominator. */
export function summarizeCallAdvice(cases: EvaluationCaseRecord[]) {
  const heldout = cases.filter((c) => c.split === "heldout"),
    tuning = cases.filter((c) => c.split === "tuning");
  const truth = (row: EvaluationCaseRecord) =>
    (row.expected as { label: AdvisoryLabel }).label;
  const actual = (row: EvaluationCaseRecord) =>
    row.status === "complete"
      ? ((row.outcome as { label?: AdvisoryLabel }).label ?? "unavailable")
      : "unavailable";
  const fully = heldout.filter(
    (row) =>
      truth(row) !== "uncertain" &&
      (row.expected as { fullyEvidenced?: boolean }).fullyEvidenced === true,
  );
  const usefulCorrect = fully.filter(
    (row) => actual(row) === truth(row),
  ).length;
  const negatives = heldout.filter((row) => truth(row) !== "merchant_accepted"),
    positives = heldout.filter((row) => truth(row) === "merchant_accepted");
  const falseAcceptanceCount = negatives.filter(
      (row) => actual(row) === "merchant_accepted",
    ).length,
    missedAcceptanceCount = positives.filter(
      (row) => actual(row) !== "merchant_accepted",
    ).length;
  const abstentionCount = heldout.filter(
    (row) => actual(row) === "uncertain",
  ).length;
  const available = heldout.filter((row) => row.status === "complete");
  const perLabelRecall = Object.fromEntries(
    label.options.map((value) => {
      const rows = heldout.filter((row) => truth(row) === value),
        correct = rows.filter((row) => actual(row) === value).length;
      return [
        value,
        {
          correct,
          total: rows.length,
          recall: rows.length ? correct / rows.length : null,
          interval95: wilson(correct, rows.length),
        },
      ];
    }),
  );
  const confusion: Record<string, number> = {};
  for (const row of heldout) {
    const key = `${truth(row)} -> ${actual(row)}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
  }
  const referenceShape =
    heldout.length === 120 &&
    label.options.every(
      (value) => heldout.filter((row) => truth(row) === value).length === 30,
    ) &&
    fully.length === 90;
  const targetsMet =
    referenceShape && falseAcceptanceCount === 0 && usefulCorrect >= 72;
  const metrics = {
    heldoutCount: heldout.length,
    tuningCount: tuning.length,
    tuningCorrect: tuning.filter((c) => c.passed === true).length,
    fullyEvidencedCount: fully.length,
    usefulnessDenominator: fully.length,
    usefulCorrect,
    usefulness: fully.length ? usefulCorrect / fully.length : null,
    usefulnessInterval95: wilson(usefulCorrect, fully.length),
    falseAcceptanceCount,
    falseAcceptanceDenominator: negatives.length,
    falseAcceptanceInterval95: wilson(falseAcceptanceCount, negatives.length),
    missedAcceptanceCount,
    acceptanceDenominator: positives.length,
    abstentionCount,
    abstentionInterval95: wilson(abstentionCount, heldout.length),
    unavailableCount: heldout.filter((c) => c.status === "unavailable").length,
    missingCount: heldout.filter(
      (c) => c.status === "missing" || c.status === "unknown_completion",
    ).length,
    baselineDisagreementCount: available.filter(
      (c) =>
        (c.outcome as { baselineDisagreement?: boolean })
          .baselineDisagreement === true,
    ).length,
    baselineComparableCount: available.filter(
      (c) =>
        (c.outcome as { baselineDisagreement?: boolean })
          .baselineDisagreement !== null,
    ).length,
    perLabelRecall,
    confusion,
    worstCases: heldout
      .filter((row) => actual(row) !== truth(row))
      .map((row) => ({
        id: row.id,
        reference: truth(row),
        actual: actual(row),
      })),
    targets: {
      falseAcceptanceCount: 0,
      minimumUsefulCorrect: 72,
      usefulnessDenominator: 90,
      minimumUsefulness: 0.8,
    },
    qualificationScope: "developer_assistance_only_never_settlement",
    sampleLimit:
      "120 authored synthetic heldout cases;30 per label. Observed zero false acceptance does not establish zero population risk. No customer-traffic, payment or settlement qualification.",
  };
  return { targetsMet, metrics };
}
export function callOutcomeSuite(): EvaluationSuite {
  const corpus = loadCallOutcomeCorpus();
  return {
    id: "call-outcome",
    task: "call_outcome",
    questionVersion: CALL_QUESTION_VERSION,
    policyVersion: JEV_POLICY_VERSION,
    questionIdentity: { nouls: CALL_NOULS, evidence: CALL_EVIDENCE },
    qualification: "experimental_unqualified",
    assessmentPolicy: "call-outcome-heldout-v1",
    canQualify: true,
    cases: [
      ...corpus.tuning.map((c) => ({ ...c, split: "tuning" })),
      ...corpus.heldout.map((c) => ({ ...c, split: "heldout" })),
    ].map((item) => {
      const prepared = prepareCallAdvice(item.input),
        fixture = fixtureResponse(item.input, item.judgments);
      return {
        id: item.id,
        split: item.split,
        input: item.input as JevState,
        expected: item.expected,
        baseline: prepared.baseline,
        requests:
          prepared.status === "ready"
            ? [{ state: prepared.state, questionSet: prepared.questionSet }]
            : [],
        fixtureResponses: fixture ? [fixture] : [],
      };
    }),
    async evaluate(input, { fetch }) {
      const result = await adviseCall(input, { fetch });
      return result.status === "unavailable"
        ? {
            value: { status: "unavailable", reason: result.reason },
            unavailable: true,
            reason: result.reason,
          }
        : {
            value: {
              advisory: true,
              label: result.label,
              evidenceUtteranceIds: result.evidenceUtteranceIds,
              reasons: result.reasons,
              baseline: result.baseline,
              baselineDisagreement: result.baselineDisagreement,
            } as JevJsonValue,
            unavailable: false,
          };
    },
    compare(actual, expected) {
      const a = actual as { label?: string; evidenceUtteranceIds?: string[] },
        e = expected as { label: string; evidenceUtteranceIds: string[] };
      return (
        a.label === e.label &&
        e.evidenceUtteranceIds.every((id) =>
          a.evidenceUtteranceIds?.includes(id),
        )
      );
    },
    assess: summarizeCallAdvice,
  };
}
