import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { askJev, type JevOptions } from "../../src/lib/jev/client";
import {
  JEV_MODEL,
  JEV_POLICY_VERSION,
  JEV_POSITIVE_THRESHOLD,
  type JevJsonValue,
  type JevState,
} from "../../src/lib/jev/contracts";
import {
  prepareExperienceMatch,
  rankExperienceMatches,
  MATCH_QUESTION_VERSION,
} from "../../src/lib/booking/match-experiences";
import type { SearchResult } from "../../src/lib/booking/availability";
import type {
  MatchRequest,
  MatchCatalogOption,
} from "../../src/types/experience-match";
import { visitorConstraintsSchema } from "../../src/lib/booking/facts";
import {
  hashJev,
  jevWilsonInterval,
  type EvaluationSuite,
  type EvaluationCaseRecord,
} from "../lib/jev-evaluation";
const nonempty = z.string().min(1),
  integer = z.number().int().nonnegative();
const slot = z
  .object({ date: z.iso.date(), startTime: z.string(), available: integer })
  .strict();
const catalogRow = z
  .object({
    experience: z
      .object({
        id: nonempty,
        merchantId: nonempty,
        slug: nonempty,
        title: nonempty,
        description: z.string().nullable(),
        currency: nonempty,
        priceCents: integer,
        depositCents: integer,
        maxParty: z.number().int().positive(),
        capacityPerSlot: integer,
        slotRule: z
          .object({
            weekdays: z.array(z.number().int()),
            startTimes: z.array(z.string()),
          })
          .strict(),
        durationMinutes: integer.nullable(),
        facts: z.array(
          z
            .object({
              key: z.enum([
                "step_free",
                "min_age",
                "languages",
                "public_transport",
                "pets_allowed",
                "equipment_included",
              ]),
              value: z.enum(["yes", "no", "unknown"]),
              detail: z.string().nullable(),
              data: z.record(z.string(), z.unknown()),
              confirmedByProvider: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict(),
    verdicts: z.array(
      z
        .object({
          key: z.enum([
            "step_free",
            "public_transport",
            "pets",
            "min_age",
            "language",
          ]),
          verdict: z.enum(["supported", "unsupported", "unknown"]),
          detail: z.string().nullable(),
          confirmedByProvider: z.boolean(),
        })
        .strict(),
    ),
    suitability: z.enum(["suitable", "unconfirmed", "rejected"]),
    reasons: z.array(
      z.enum([
        "over_budget",
        "party_too_large",
        "constraint_unsupported",
        "no_availability",
      ]),
    ),
    slots: z.array(slot),
    alternatives: z.array(slot),
  })
  .strict();
const snapshotSchema = z
  .object({
    request: z
      .object({
        locale: z.literal("es"),
        preference: z.string().min(1).max(240),
        date: z.iso.date().optional(),
        partySize: z.number().int().min(1).max(12).optional(),
        budgetCents: integer.max(10_000_000).optional(),
        constraints: visitorConstraintsSchema.optional(),
      })
      .strict(),
    catalog: z.array(catalogRow),
  })
  .strict();
const referenceSchema = z
  .object({
    status: z.enum(["matched", "no_results"]),
    suggestionIds: z.array(z.string()).max(3),
    invariants: z.array(nonempty).min(1),
  })
  .strict();
const caseSchema = z
  .object({
    id: nonempty,
    input: snapshotSchema,
    expected: referenceSchema,
    judgments: z.record(z.string(), z.enum(["true", "false", "uncertain"])),
    rubric: nonempty,
  })
  .strict();
const corpusSchema = z
  .object({
    schemaVersion: z.literal(1),
    provenance: z.literal("synthetic_fixture_only"),
    clock: z.iso.datetime(),
    cases: z.array(caseSchema).length(40),
  })
  .strict();
/** Reuse the unchanged strict supplied-snapshot contract in independent offline suites. */
export function parseExperienceMatchSnapshot(input: unknown) {
  return snapshotSchema.parse(input);
}
export function loadExperienceMatchCorpus() {
  const corpus = corpusSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("./fixtures/jev/experience-match.json", import.meta.url),
        ),
        "utf8",
      ),
    ),
  );
  if (new Set(corpus.cases.map((c) => c.id)).size !== 40)
    throw new Error("Matching fixture requires40unique case IDs.");
  for (const item of corpus.cases) {
    const ids = item.input.catalog.map((r) => r.experience.id);
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !Object.hasOwn(item.judgments, id)) ||
      Object.keys(item.judgments).some((id) => !ids.includes(id))
    )
      throw new Error(
        `${item.id}: unique catalog IDs and one outer judgment per supplied ID required.`,
      );
    if (
      item.expected.suggestionIds.some((id) => !ids.includes(id)) ||
      new Set(item.expected.suggestionIds).size !==
        item.expected.suggestionIds.length
    )
      throw new Error(`${item.id}: invalid reference suggestion IDs.`);
  }
  return corpus;
}
/** Independent public-fact projection; never call a model or reclassify provider verdicts. */
function authoritativeOption(row: SearchResult): MatchCatalogOption {
  const e = row.experience;
  return {
    experience: {
      id: e.id,
      title: e.title,
      description: e.description,
      currency: e.currency,
      priceCents: e.priceCents,
      depositCents: e.depositCents,
      maxParty: e.maxParty,
      durationMinutes: e.durationMinutes,
      facts: e.facts,
    },
    suitability: row.suitability,
    verdicts: row.verdicts,
    reasons: row.reasons,
    slots: row.slots,
    alternatives: row.alternatives,
  };
}
const resultShape = z
  .object({
    status: z.enum(["matched", "degraded", "no_results"]),
    catalog: z.array(z.unknown()),
    suggestions: z.array(z.unknown()),
    examinedCount: integer,
    truncated: z.boolean(),
    remaining: integer,
    reason: z.string().optional(),
    offlineDiagnostics: z
      .object({
        scope: z.literal("offline_candidate_support_only"),
        questionVersion: z.literal(MATCH_QUESTION_VERSION),
        candidates: z
          .array(
            z
              .object({
                experienceId: nonempty,
                probability: z.number().min(0).max(1),
                positive: z.boolean(),
              })
              .strict(),
          )
          .max(10),
      })
      .strict()
      .optional(),
  })
  .strict();
const suggestionShape = z
  .object({
    experience: z.object({ id: z.string() }).passthrough(),
    styleFit: z.enum(["estimated", "not_established"]),
    suitability: z.enum(["suitable", "unconfirmed", "rejected"]),
  })
  .passthrough();
export function checkMatchInvariants(
  input: unknown,
  result: unknown,
): string[] {
  const snapshot = snapshotSchema.safeParse(input),
    out = resultShape.safeParse(result);
  if (!snapshot.success || !out.success) return ["invalid_snapshot_or_result"];
  const { catalog } = snapshot.data,
    a = out.data,
    violations: string[] = [],
    expected = catalog.map(authoritativeOption),
    eligible = catalog.filter((r) => r.suitability !== "rejected").slice(0, 10);
  const diagnostics = a.offlineDiagnostics;
  if (a.status === "matched") {
    if (!diagnostics) violations.push("missing_candidate_support_diagnostics");
    else if (
      hashJev(
        diagnostics.candidates.map((candidate) => candidate.experienceId),
      ) !== hashJev(eligible.map((row) => row.experience.id))
    )
      violations.push("candidate_support_ids_changed");
  } else if (diagnostics?.candidates.length) {
    violations.push("unexpected_candidate_support_diagnostics");
  }
  if (
    diagnostics?.candidates.some(
      (candidate) =>
        candidate.positive !== candidate.probability >= JEV_POSITIVE_THRESHOLD,
    )
  )
    violations.push("candidate_support_positive_inconsistent");
  if (hashJev(a.catalog) !== hashJev(expected))
    violations.push("catalog_hard_facts_changed");
  if (a.suggestions.length > 3) violations.push("suggestion_cap_exceeded");
  if (
    a.truncated !==
    catalog.filter((r) => r.suitability !== "rejected").length > 10
  )
    violations.push("truncation_changed");
  if (a.examinedCount !== (a.status === "matched" ? eligible.length : 0))
    violations.push("examined_count_changed");
  const ids: string[] = [];
  let partition = -1;
  for (const value of a.suggestions) {
    const suggestion = suggestionShape.safeParse(value);
    if (!suggestion.success) {
      violations.push("invalid_suggestion");
      continue;
    }
    const { styleFit, ...option } = suggestion.data;
    const original = eligible.find(
      (r) => r.experience.id === option.experience.id,
    );
    ids.push(option.experience.id);
    if (!original) {
      violations.push("suggestion_outside_eligible_cap");
      continue;
    }
    if (hashJev(option) !== hashJev(authoritativeOption(original)))
      violations.push("suggestion_hard_facts_changed");
    const current =
      option.suitability === "suitable"
        ? 0
        : option.suitability === "unconfirmed"
          ? 1
          : 2;
    if (current < partition) violations.push("suitability_partition_changed");
    partition = current;
    if (a.status === "degraded" && styleFit !== "not_established")
      violations.push("degraded_fit_must_be_unknown");
  }
  if (eligible.length && !a.suggestions.length)
    violations.push("empty_catalog_success");
  if (
    a.status === "degraded" &&
    hashJev(ids) !==
      hashJev(eligible.slice(0, 3).map((row) => row.experience.id))
  )
    violations.push("degraded_shortlist_changed");
  if (new Set(ids).size !== ids.length)
    violations.push("duplicate_suggestions");
  if (
    !eligible.length !== (a.status === "no_results") ||
    (!eligible.length && a.suggestions.length)
  )
    violations.push("no_results_changed");
  return [...new Set(violations)];
}
function agrees(actual: unknown, expected: unknown): boolean {
  const a = resultShape.safeParse(actual),
    e = referenceSchema.passthrough().safeParse(expected);
  return (
    a.success &&
    e.success &&
    a.data.status === e.data.status &&
    hashJev(
      a.data.suggestions.map(
        (s) => suggestionShape.safeParse(s).data?.experience.id ?? null,
      ),
    ) === hashJev(e.data.suggestionIds)
  );
}
export function summarizeExperienceMatch(cases: EvaluationCaseRecord[]) {
  const fixtureOnly =
    cases.length > 0 && cases.every((c) => c.latencyKind === "fixture");
  const freshOnly =
    cases.length > 0 && cases.every((c) => c.latencyKind === "fresh");
  const candidateSupportDiagnostics = cases.flatMap((c) => {
    const parsed = resultShape.safeParse(c.outcome);
    const reference = z
      .record(z.string(), z.enum(["true", "false", "uncertain"]))
      .safeParse(
        (c.expected as { candidateSupport?: unknown } | null)?.candidateSupport,
      );
    return parsed.success &&
      checkMatchInvariants(c.input, c.outcome).length === 0
      ? (parsed.data.offlineDiagnostics?.candidates ?? []).map((candidate) => ({
          caseId: c.id,
          ...candidate,
          reference: reference.success
            ? (reference.data[candidate.experienceId] ?? "unlabelled")
            : "unlabelled",
        }))
      : [];
  });
  const complete = cases.filter((c) => c.status === "complete"),
    agreements = complete.filter((c) => agrees(c.outcome, c.expected)).length,
    hardPass = complete.filter(
      (c) => checkMatchInvariants(c.input, c.outcome).length === 0,
    ).length;
  return {
    targetsMet:
      cases.length === 40 &&
      new Set(cases.map((c) => c.id)).size === 40 &&
      agreements === 40 &&
      hardPass === 40,
    metrics: {
      scope: "frozen_hard_filtered_shortlist_comparison",
      caseCount: cases.length,
      judgmentSource: fixtureOnly
        ? "synthetic_fixture"
        : freshOnly
          ? "fresh_live"
          : "mixed_or_replayed",
      referenceAgreementCount: agreements,
      referenceAgreementDenominator: 40,
      referenceAgreementInterval95: jevWilsonInterval(agreements, 40),
      fixtureAgreementCount: fixtureOnly ? agreements : null,
      fixtureAgreementDenominator: fixtureOnly ? 40 : null,
      fixtureAgreementInterval95: fixtureOnly
        ? jevWilsonInterval(agreements, 40)
        : null,
      hardInvariantPassCount: hardPass,
      hardInvariantDenominator: 40,
      hardInvariantInterval95: jevWilsonInterval(hardPass, 40),
      degradedCount: complete.filter(
        (c) => (c.outcome as { status?: string } | null)?.status === "degraded",
      ).length,
      unavailableCount: cases.filter((c) => c.status === "unavailable").length,
      missingCount: cases.filter(
        (c) => c.status === "missing" || c.status === "unknown_completion",
      ).length,
      blindPreferenceWins: null,
      blindPreferenceTies: null,
      p95LiveLatencyMs: null,
      candidateSupportDiagnostics,
      positiveReferenceJudgedCount: candidateSupportDiagnostics.filter(
        (c) => c.reference === "true",
      ).length,
      positiveReferenceRecoveredCount: candidateSupportDiagnostics.filter(
        (c) => c.reference === "true" && c.positive,
      ).length,
      negativeReferencePromotedCount: candidateSupportDiagnostics.filter(
        (c) => c.reference === "false" && c.positive,
      ).length,
      liveMeasurementStatus: freshOnly
        ? "FRESH_SEMANTIC_MEASUREMENT_ONLY"
        : "UNMEASURED",
      adoptionReady: false,
      adoptionReadiness: {
        status: "UNMEASURED",
        reason: fixtureOnly
          ? "Canned judgments exercise contracts only; this run is not a blinded live preference comparison."
          : freshOnly
            ? "Fresh live judgments measure reference agreement and candidate support only. Independent blinded preference wins and application latency qualification remain unmeasured."
            : "Mixed, imported or replayed judgments do not establish a fresh paired blinded preference comparison.",
        requiredTargets: {
          minimumBlindWins: 24,
          blindComparisonDenominator: 40,
          tiesCountAsWins: false,
          minimumHardInvariantRate: 1,
          maximumAddedP95SemanticLatencyMs: 1200,
        },
      },
      worstCases: cases
        .filter(
          (c) =>
            c.status !== "complete" ||
            !agrees(c.outcome, c.expected) ||
            checkMatchInvariants(c.input, c.outcome).length > 0,
        )
        .map((c) => ({
          id: c.id,
          status: c.status,
          fixtureAgreement: agrees(c.outcome, c.expected),
          hardInvariantViolations: checkMatchInvariants(c.input, c.outcome),
        })),
      sampleLimit:
        "40 independently authored frozen Spanish preference/shortlist snapshots. Reference agreement and candidate support are distinct from blinded preference wins; identical baseline and candidate orders cannot establish an ordering win. No catalog search, quota, user interaction or DB mutation is exercised by this offline snapshot suite.",
    },
  };
}
export function experienceMatchSuite(
  options: Pick<JevOptions, "timeoutMs"> = {},
): EvaluationSuite {
  const corpus = loadExperienceMatchCorpus();
  return {
    id: "experience-match",
    task: "experience_match",
    questionVersion: MATCH_QUESTION_VERSION,
    policyVersion: JEV_POLICY_VERSION,
    questionIdentity: {
      version: MATCH_QUESTION_VERSION,
      projection: "bounded-question-local-candidate-top10-v2",
      ranking: "stable-positive-noul-within-suitability-partitions-v1",
    },
    qualification: "experimental_unqualified",
    assessmentPolicy: "matching-reference-and-candidate-support-v2",
    canQualify: false,
    cases: corpus.cases.map((item) => {
      const p = prepareExperienceMatch(item.input.request, item.input.catalog);
      const body = p.questionSet
        ? {
            model: JEV_MODEL,
            answers: Object.fromEntries(
              p.candidates.map((candidate, index) => {
                const v = item.judgments[candidate.experience.id];
                return [
                  `fit_${index}`,
                  {
                    type: "noul",
                    noul: v === "true" ? 0.99 : v === "uncertain" ? 0.5 : 0.01,
                  },
                ];
              }),
            ),
            usage: { input_tokens: 100, output_tokens: 0 },
          }
        : null;
      return {
        id: item.id,
        split: "heldout",
        input: item.input as unknown as JevState,
        expected: {
          ...item.expected,
          candidateSupport: item.judgments,
          rubric: item.rubric,
          reference: item.input,
        } as unknown as JevJsonValue,
        baseline: rankExperienceMatches(p, null) as unknown as JevJsonValue,
        requests: p.questionSet
          ? [{ state: p.state!, questionSet: p.questionSet }]
          : [],
        fixtureResponses: body
          ? [{ status: 200, body: body as JevJsonValue }]
          : [],
      };
    }),
    async evaluate(input, { fetch }) {
      const snapshot = parseExperienceMatchSnapshot(input);
      const p = prepareExperienceMatch(
        snapshot.request as MatchRequest,
        snapshot.catalog,
      );
      const judgment = p.questionSet
        ? await askJev(
            p.questionSet,
            p.state!,
            { mode: "evaluation", task: "experience_match", authorized: true },
            undefined,
            { ...options, fetch },
          )
        : null;
      return {
        value: {
          ...rankExperienceMatches(p, judgment),
          offlineDiagnostics: {
            scope: "offline_candidate_support_only",
            questionVersion: MATCH_QUESTION_VERSION,
            candidates:
              judgment?.status === "answered"
                ? p.candidates.map((candidate, index) => {
                    const answer = judgment.answers[`fit_${index}`];
                    const probability =
                      answer?.type === "noul" ? answer.noul : NaN;
                    return {
                      experienceId: candidate.experience.id,
                      probability,
                      positive: probability >= JEV_POSITIVE_THRESHOLD,
                    };
                  })
                : [],
          },
        } as unknown as JevJsonValue,
        unavailable: judgment?.status === "unavailable",
        reason:
          judgment?.status === "unavailable" ? judgment.reason : undefined,
      };
    },
    compare(actual, expected) {
      const reference = (expected as { reference?: JevJsonValue }).reference;
      return (
        agrees(actual, expected) &&
        checkMatchInvariants(reference, actual).length === 0
      );
    },
    assess: summarizeExperienceMatch,
  };
}
