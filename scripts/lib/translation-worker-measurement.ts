import { z } from "zod";

const thresholds = {
  sustainedQueueSeconds: 3600,
  fullTranslationP95Seconds: 600,
  batchWallSeconds: 45,
  approvalsPerFiveMinutes: 20,
  nonSpanishLocaleCount: 5,
} as const;

const definitions = {
  sustainedQueueSeconds: "longest_continuous_depth_above_50_seconds",
  fullTranslationP95Seconds: "approval_to_all_required_locales_p95_seconds",
  batchWallSeconds: "three_job_batch_wall_seconds",
  approvalsPerFiveMinutes: "max_distinct_approved_stories_per_rolling_300_seconds",
  nonSpanishLocaleCount: "configured_non_spanish_locale_count",
} as const;

type MetricName = keyof typeof thresholds;
type Assessment = {
  status: "unmeasured" | "below_threshold" | "triggered";
  reason: string;
  value?: number;
  evidence?: string;
};

const windowSchema = z.object({
  source: z.literal("production"),
  window: z.object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    representative: z.literal(true),
    rationale: z.string().trim().min(1),
  }).refine((value) => Date.parse(value.end) > Date.parse(value.start)),
  metrics: z.record(z.string(), z.unknown()),
});
const aggregateSchema = z.object({
  value: z.number().finite().nonnegative(),
  sampleCount: z.number().int().positive(),
  complete: z.literal(true),
  evidence: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  regular: z.boolean().optional(),
  routine: z.boolean().optional(),
});

/** Classify reviewed aggregates. This does not collect or authenticate telemetry. */
export function assessTranslationWorkerMeasurements(input: unknown) {
  const parsed = windowSchema.safeParse(input);
  const metrics = {} as Record<MetricName, Assessment>;
  for (const name of Object.keys(thresholds) as MetricName[]) {
    const aggregate = aggregateSchema.safeParse(parsed.success ? parsed.data.metrics[name] : null);
    if (!parsed.success || !aggregate.success || aggregate.data.definition !== definitions[name]) {
      metrics[name] = { status: "unmeasured", reason: "Missing complete production aggregate or representative window" };
      continue;
    }
    const value = aggregate.data;
    const frequency = name === "batchWallSeconds" ? value.regular
      : name === "approvalsPerFiveMinutes" ? value.routine : true;
    const isCount = name === "nonSpanishLocaleCount" || name === "approvalsPerFiveMinutes";
    if (frequency === undefined || (isCount && !Number.isInteger(value.value))) {
      metrics[name] = { status: "unmeasured", reason: "Missing frequency interpretation or invalid count" };
      continue;
    }
    const triggered = value.value > thresholds[name] && frequency;
    metrics[name] = {
      status: triggered ? "triggered" : "below_threshold",
      reason: triggered ? "ADR 0021 threshold exceeded" : "ADR 0021 trigger not met in the reviewed window",
      value: value.value,
      evidence: value.evidence,
    };
  }
  const results = Object.values(metrics);
  const decision = results.some((metric) => metric.status === "triggered") ? "architecture_review_required"
    : results.some((metric) => metric.status === "unmeasured") ? "collect_evidence" : "retain_inline";
  return { decision, metrics };
}

if (process.argv[1]?.endsWith("translation-worker-measurement.ts")) {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const result = assessTranslationWorkerMeasurements(input.trim() ? JSON.parse(input) : null);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}
