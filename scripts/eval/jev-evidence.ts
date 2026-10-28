import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  checkEvidence,
  prepareEvidence,
  EVIDENCE_NOULS,
  EVIDENCE_CHOICES,
  EVIDENCE_QUESTION_VERSION,
  evidenceSnapshotSchema,
} from "../../src/lib/jev/evidence";
import {
  JEV_MODEL,
  JEV_POLICY_VERSION,
  type JevJsonValue,
  type JevState,
} from "../../src/lib/jev/contracts";
import {
  jevWilsonInterval,
  type EvaluationSuite,
  type EvaluationCaseRecord,
} from "../lib/jev-evaluation";
const labels = ["supported", "contradicted", "not_established"] as const;
const truth = z.enum(labels),
  judgment = z.enum(["true", "false", "uncertain"]);
const caseSchema = z
  .object({
    id: z.string().min(1),
    input: evidenceSnapshotSchema,
    expected: z
      .object({ label: truth, invariants: z.array(z.string().min(1)).min(1) })
      .strict(),
    rubric: z.string().min(1),
    judgments: z
      .object({
        support: judgment,
        contradiction: judgment,
        current_availability: judgment,
        support_evidence: z.string(),
        contradiction_evidence: z.string(),
      })
      .strict(),
  })
  .strict();
const corpusSchema = z
  .object({
    schemaVersion: z.literal(1),
    provenance: z.literal("synthetic_fixture_only"),
    tuning: z.array(caseSchema).length(6),
    heldout: z.array(caseSchema).length(24),
  })
  .strict();
export function loadEvidenceCorpus() {
  const corpus = corpusSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("./fixtures/jev/evidence.json", import.meta.url)),
        "utf8",
      ),
    ),
  );
  const all = [...corpus.tuning, ...corpus.heldout];
  if (new Set(all.map((c) => c.id)).size !== 30)
    throw new Error("Evidence cases require30distinct IDs.");
  for (const label of labels)
    if (
      corpus.heldout.filter((c) => c.expected.label === label).length !== 8 ||
      corpus.tuning.filter((c) => c.expected.label === label).length !== 2
    )
      throw new Error(
        "Evidence references require8heldout and2tuning cases per label.",
      );
  for (const item of all) {
    const prepared = prepareEvidence(item.input);
    if (prepared.status !== "ready" || item.input.claims.length !== 1)
      throw new Error(
        `${item.id}: benchmark requires one structurally valid claim: ${prepared.report.errors.join("; ")}`,
      );
    const cited = item.input.claims[0]!.citedPassageIds;
    if (
      !cited.includes(item.judgments.support_evidence) ||
      !cited.includes(item.judgments.contradiction_evidence)
    )
      throw new Error(`${item.id}: fixture choice outside cited subset.`);
  }
  return corpus;
}
export function summarizeEvidence(cases: EvaluationCaseRecord[]) {
  const heldout = cases.filter((c) => c.split === "heldout"),
    tuning = cases.filter((c) => c.split === "tuning");
  const expected = (row: EvaluationCaseRecord) =>
    (row.expected as { label: string }).label;
  const claim = (row: EvaluationCaseRecord) =>
    (
      row.outcome as {
        claims?: { label: string; unavailableKind?: string }[];
      } | null
    )?.claims?.[0];
  const actual = (row: EvaluationCaseRecord) =>
    row.status === "complete"
      ? (claim(row)?.label ?? "unavailable")
      : "unavailable";
  const perLabel = Object.fromEntries(
    labels.map((label) => {
      const tp = heldout.filter(
          (r) => expected(r) === label && actual(r) === label,
        ).length,
        fp = heldout.filter(
          (r) => expected(r) !== label && actual(r) === label,
        ).length,
        fn = heldout.filter(
          (r) => expected(r) === label && actual(r) !== label,
        ).length;
      return [
        label,
        {
          truePositive: tp,
          falsePositive: fp,
          falseNegative: fn,
          precision: tp + fp ? tp / (tp + fp) : 0,
          recall: tp + fn ? tp / (tp + fn) : 0,
          f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : 0,
          recallInterval95: jevWilsonInterval(tp, tp + fn),
        },
      ];
    }),
  );
  const falseSupportCount = perLabel.supported!.falsePositive,
    supportRecall = perLabel.supported!.recall,
    macroF1 =
      labels.reduce((sum, label) => sum + perLabel[label]!.f1, 0) /
      labels.length;
  const referenceShape =
    heldout.length === 24 &&
    labels.every(
      (label) => heldout.filter((r) => expected(r) === label).length === 8,
    );
  const confusion: Record<string, number> = {};
  for (const row of heldout) {
    const key = `${expected(row)} -> ${actual(row)}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
  }
  return {
    targetsMet:
      referenceShape &&
      falseSupportCount === 0 &&
      supportRecall >= 0.9 &&
      macroF1 >= 0.9,
    metrics: {
      coverage: "provided_claims_only",
      manifestScope: "supplied_snapshot_passage_manifest_only",
      heldoutCount: heldout.length,
      tuningCount: tuning.length,
      tuningCorrect: tuning.filter((c) => c.passed === true).length,
      falseSupportCount,
      falseSupportDenominator: heldout.filter(
        (r) => expected(r) !== "supported",
      ).length,
      falseSupportInterval95: jevWilsonInterval(
        falseSupportCount,
        heldout.filter((r) => expected(r) !== "supported").length,
      ),
      supportRecall,
      macroF1,
      perLabel,
      semanticAbstentionCount: heldout.filter(
        (r) => r.status === "complete" && actual(r) === "unavailable",
      ).length,
      providerOrStructuralUnavailableCount: heldout.filter(
        (r) => r.status === "unavailable",
      ).length,
      missingCount: heldout.filter(
        (r) => r.status === "missing" || r.status === "unknown_completion",
      ).length,
      confusion,
      worstCases: heldout
        .filter((r) => expected(r) !== actual(r))
        .map((r) => ({
          id: r.id,
          reference: expected(r),
          actual: actual(r),
          reason: r.reason,
        })),
      targets: {
        maximumFalseSupport: 0,
        minimumSupportRecall: 0.9,
        minimumMacroF1: 0.9,
      },
      sampleLimit:
        "24 independently authored synthetic heldout claims,8 per truth label. Wilson intervals describe sample uncertainty; no population guarantee, whole-answer verification or corpus acceptance is established.",
    },
  };
}
export function evidenceSuite(): EvaluationSuite {
  const corpus = loadEvidenceCorpus();
  return {
    id: "evidence",
    task: "evidence",
    questionVersion: EVIDENCE_QUESTION_VERSION,
    policyVersion: JEV_POLICY_VERSION,
    questionIdentity: {
      nouls: EVIDENCE_NOULS,
      choices: EVIDENCE_CHOICES,
      temporalPolicy: "reviewer-scope-same-utc-day-explicit-capacity-v1",
      manifestScope: "supplied_snapshot_passage_manifest_only",
    },
    qualification: "experimental_unqualified",
    assessmentPolicy: "evidence-heldout-v1",
    canQualify: true,
    cases: [
      ...corpus.tuning.map((c) => ({ ...c, split: "tuning" })),
      ...corpus.heldout.map((c) => ({ ...c, split: "heldout" })),
    ].map((item) => {
      const prepared = prepareEvidence(item.input);
      if (prepared.status !== "ready")
        throw new Error(`Invalid evidence fixture ${item.id}`);
      return {
        id: item.id,
        split: item.split,
        input: item.input as unknown as JevState,
        expected: item.expected,
        baseline: null,
        requests: prepared.requests.map((r) => ({
          state: r.state,
          questionSet: r.questionSet,
        })),
        fixtureResponses: prepared.requests.map((r) => ({
          status: 200,
          body: {
            model: JEV_MODEL,
            answers: Object.fromEntries(
              Object.entries(r.questionSet.questions).map(([id, q]) => {
                if (q.type === "noul") {
                  const v =
                    item.judgments[
                      id as "support" | "contradiction" | "current_availability"
                    ];
                  return [
                    id,
                    {
                      type: "noul",
                      noul:
                        v === "true" ? 0.99 : v === "uncertain" ? 0.5 : 0.01,
                    },
                  ];
                }
                const ids = Object.keys(q.criteria),
                  choice =
                    item.judgments[
                      id as "support_evidence" | "contradiction_evidence"
                    ];
                return [
                  id,
                  {
                    type: "choice",
                    choice,
                    confidence: ids.length === 1 ? 1 : 0.99,
                    probabilities: Object.fromEntries(
                      ids.map((k) => [
                        k,
                        k === choice
                          ? ids.length === 1
                            ? 1
                            : 0.99
                          : 0.01 / (ids.length - 1),
                      ]),
                    ),
                  },
                ];
              }),
            ),
            usage: { input_tokens: 100, output_tokens: 0 },
          } as JevJsonValue,
        })),
      };
    }),
    async evaluate(input, { fetch }) {
      const report = await checkEvidence(input, { fetch });
      return {
        value: report as unknown as JevJsonValue,
        unavailable: !report.complete,
        reason: report.complete
          ? undefined
          : report.errors.join("; ") ||
            report.claims.find((c) => c.unavailableKind !== "semantic")
              ?.reason ||
            "incomplete_evidence",
      };
    },
    compare(actual, expected) {
      return (
        (actual as { claims?: { label: string }[] })?.claims?.[0]?.label ===
        (expected as { label: string }).label
      );
    },
    assess: summarizeEvidence,
  };
}
