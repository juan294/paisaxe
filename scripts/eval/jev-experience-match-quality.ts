import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  experienceMatchSuite,
  parseExperienceMatchSnapshot,
  checkMatchInvariants,
  summarizeExperienceMatch,
} from "./jev-experience-match";
import {
  prepareExperienceMatch,
  rankExperienceMatches,
} from "../../src/lib/booking/match-experiences";
import {
  JEV_MODEL,
  JEV_INTERACTIVE_DEADLINE_MS,
  type JevJsonValue,
  type JevState,
} from "../../src/lib/jev/contracts";
import type { MatchRequest } from "../../src/types/experience-match";
import {
  hashJev,
  type EvaluationSuite,
  type EvaluationCaseRecord,
} from "../lib/jev-evaluation";

const referenceSchema = z
  .object({
    supportedIds: z.array(z.string().min(1)),
    unsupportedIds: z.array(z.string().min(1)),
    unknownIds: z.array(z.string().min(1)),
    rationale: z.string().min(1),
  })
  .strict();
const qualitySchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.literal("experience-match-quality-v1"),
    provenance: z.literal("authored_synthetic_not_real_offers"),
    clock: z.iso.datetime(),
    cases: z
      .array(
        z
          .object({
            id: z.string().min(1),
            input: z.unknown(),
            reference: referenceSchema,
            rubric: z.string().min(1),
          })
          .strict(),
      )
      .length(40),
  })
  .strict();

/** Labels/rubrics are validated separately and never become question state. */
export function validateMatchQualityCorpus(raw: unknown) {
  const englishSchema = qualitySchema.extend({
    id: z.literal("experience-match-quality-en-v1"),
    provenance: z.string().min(1),
  });
  const parsed = z.union([qualitySchema, englishSchema]).parse(raw);
  const cases = parsed.cases.map((item) => {
    const input = parseExperienceMatchSnapshot(item.input);
    const ids = input.catalog.map((row) => row.experience.id);
    const references = [
      ...item.reference.supportedIds,
      ...item.reference.unsupportedIds,
      ...item.reference.unknownIds,
    ];
    if (
      new Set(ids).size !== ids.length ||
      new Set(references).size !== references.length ||
      references.length !== ids.length ||
      references.some((id) => !ids.includes(id))
    )
      throw new Error(
        `${item.id}: reference sets must partition the exact catalog IDs`,
      );
    const prepared = prepareExperienceMatch(
      input.request as MatchRequest,
      input.catalog,
    );
    if (
      checkMatchInvariants(input, rankExperienceMatches(prepared, null)).length
    )
      throw new Error(`${item.id}: invalid deterministic fact projection`);
    return { ...item, input };
  });
  if (
    new Set(cases.map((item) => item.id)).size !== 40 ||
    new Set(cases.map((item) => hashJev(item.input))).size !== 40
  )
    throw new Error("Quality benchmark requires40unique case IDs and inputs");
  return { ...parsed, cases };
}

export function loadMatchQualityCorpus(locale: "es" | "en" = "es") {
  const path = fileURLToPath(
    new URL(locale === "en" ? "./fixtures/jev/experience-match-quality-en.json" : "./fixtures/jev/experience-match-quality.json", import.meta.url),
  );
  const bytes = readFileSync(path);
  const provenance = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          locale === "en" ? "./fixtures/jev/matching-quality-en-provenance.json" : "./fixtures/jev/matching-quality-provenance.json",
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as { integrity?: { datasetSha256?: string } };
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    provenance.integrity?.datasetSha256
  )
    throw new Error(
      "Frozen quality benchmark identity changed; do not silently reuse its version",
    );
  return validateMatchQualityCorpus(JSON.parse(bytes.toString("utf8")));
}

/** Generation contracts may pass; no automated model/reference score grants blind approval. */
export function summarizeMatchQuality(cases: EvaluationCaseRecord[]) {
  const base = summarizeExperienceMatch(cases);
  const failures = cases.filter(
    (c) =>
      c.status !== "complete" ||
      checkMatchInvariants(c.input, c.outcome).length,
  );
  return {
    targetsMet:
      cases.length === 40 &&
      new Set(cases.map((c) => c.id)).size === 40 &&
      failures.length === 0,
    metrics: {
      ...base.metrics,
      scope: "blind_quality_candidate_generation_only",
      referenceAgreementCount: null,
      referenceAgreementDenominator: null,
      referenceAgreementInterval95: null,
      fixtureAgreementCount: null,
      fixtureAgreementDenominator: null,
      fixtureAgreementInterval95: null,
      blindPreferenceWins: null,
      blindPreferenceTies: null,
      p95LiveLatencyMs: null,
      adoptionReady: false,
      adoptionReadiness: {
        status: "UNMEASURED",
        reason:
          "Candidate generation and semantic reference categories do not supply independent blinded preference judgments or a complete runtime qualification record.",
        requiredTargets: base.metrics.adoptionReadiness.requiredTargets,
      },
      worstCases: failures.map((c) => ({
        id: c.id,
        status: c.status,
        hardInvariantViolations: checkMatchInvariants(c.input, c.outcome),
      })),
      sampleLimit:
        "40 prospectively frozen authored synthetic snapshots. Reference categories are diagnostic, not a total order or blind reviewer decisions. Candidate generation excludes application access, quota, database and proxy latency; it is bounded by the runtime semantic deadline.",
    },
  };
}

export function experienceMatchQualitySuite(locale: "es" | "en" = "es"): EvaluationSuite {
  const corpus = loadMatchQualityCorpus(locale);
  const base = experienceMatchSuite({ timeoutMs: JEV_INTERACTIVE_DEADLINE_MS });
  return {
    ...base,
    id: locale === "en" ? "experience-match-quality-en" : "experience-match-quality",
    assessmentPolicy: "quality-candidate-contracts-pending-blind-v1",
    canQualify: false,
    questionIdentity: {
      parent: base.questionIdentity,
      benchmarkId: corpus.id,
      semanticDeadlineMs: JEV_INTERACTIVE_DEADLINE_MS,
    },
    cases: corpus.cases.map((item) => {
      const prepared = prepareExperienceMatch(
        item.input.request as MatchRequest,
        item.input.catalog,
      );
      const support = Object.fromEntries(
        item.input.catalog.map((row) => [
          row.experience.id,
          item.reference.supportedIds.includes(row.experience.id)
            ? "true"
            : item.reference.unknownIds.includes(row.experience.id)
              ? "uncertain"
              : "false",
        ]),
      );
      const response = prepared.questionSet
        ? {
            model: JEV_MODEL,
            answers: Object.fromEntries(
              prepared.candidates.map((row, index) => [
                `fit_${index}`,
                {
                  type: "noul",
                  noul:
                    support[row.experience.id] === "true"
                      ? 0.99
                      : support[row.experience.id] === "uncertain"
                        ? 0.5
                        : 0.01,
                },
              ]),
            ),
            usage: { input_tokens: 100, output_tokens: 0 },
          }
        : null;
      return {
        id: item.id,
        split: "heldout",
        input: item.input as unknown as JevState,
        expected: {
          reference: item.input,
          candidateSupport: support,
          semanticReference: item.reference,
          rubric: item.rubric,
        } as unknown as JevJsonValue,
        baseline: rankExperienceMatches(
          prepared,
          null,
        ) as unknown as JevJsonValue,
        requests: prepared.questionSet
          ? [{ questionSet: prepared.questionSet, state: prepared.state! }]
          : [],
        fixtureResponses: response
          ? [{ status: 200, body: response as JevJsonValue }]
          : [],
      };
    }),
    compare(actual, expected) {
      const reference = z
        .object({ reference: z.unknown() })
        .parse(expected).reference;
      return checkMatchInvariants(reference, actual).length === 0;
    },
    assess: summarizeMatchQuality,
  };
}
