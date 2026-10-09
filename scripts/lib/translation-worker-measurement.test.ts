import { describe, expect, it } from "vitest";
import { assessTranslationWorkerMeasurements } from "./translation-worker-measurement";

function evidence(value: number, extra = {}) {
  return { value, sampleCount: 100, complete: true, evidence: "sha256:retained-export", definition: "Reviewed aggregate over the named complete window", ...extra };
}
function measured() {
  return {
    source: "production",
    window: { start: "2026-09-30T00:00:00Z", end: "2026-10-07T00:00:00Z", representative: true, rationale: "Complete normal and bulk approval activity" },
    metrics: {
      sustainedQueueSeconds: evidence(3600, { definition: "longest_continuous_depth_above_50_seconds" }),
      fullTranslationP95Seconds: evidence(600, { definition: "approval_to_all_required_locales_p95_seconds" }),
      batchWallSeconds: evidence(45, { regular: true, definition: "three_job_batch_wall_seconds" }),
      approvalsPerFiveMinutes: evidence(20, { routine: true, definition: "max_distinct_approved_stories_per_rolling_300_seconds" }),
      nonSpanishLocaleCount: evidence(5, { definition: "configured_non_spanish_locale_count" }),
    },
  };
}

describe("translation worker measurement assessment", () => {
  it.each([undefined, null, {}, { metrics: {} }])("keeps absent evidence unmeasured (%j)", (input) => {
    const result = assessTranslationWorkerMeasurements(input);
    expect(result.decision).toBe("collect_evidence");
    expect(Object.values(result.metrics).every((m) => m.status === "unmeasured")).toBe(true);
  });

  it("distinguishes measured equality from strictly exceeded ADR thresholds", () => {
    const result = assessTranslationWorkerMeasurements(measured());
    expect(result.decision).toBe("retain_inline");
    expect(Object.values(result.metrics).every((m) => m.status === "below_threshold")).toBe(true);
  });

  it.each([
    ["sustainedQueueSeconds", 3601], ["fullTranslationP95Seconds", 601],
    ["batchWallSeconds", 46], ["approvalsPerFiveMinutes", 21], ["nonSpanishLocaleCount", 6],
  ] as const)("requests architecture review for a qualified %s trigger", (metric, value) => {
    const input = measured();input.metrics[metric].value = value;
    const result = assessTranslationWorkerMeasurements(input);
    expect(result.metrics[metric].status).toBe("triggered");
    expect(result.decision).toBe("architecture_review_required");
  });

  it("does not turn one slow batch or isolated approval burst into regular traffic", () => {
    const input = measured();Object.assign(input.metrics.batchWallSeconds, { value: 50, regular: false });
    Object.assign(input.metrics.approvalsPerFiveMinutes, { value: 30, routine: false });
    expect(assessTranslationWorkerMeasurements(input).decision).toBe("retain_inline");
  });

  it.each(["synthetic", "source", undefined])("does not qualify workload from %s provenance", (source) => {
    const input = { ...measured(), source };
    expect(assessTranslationWorkerMeasurements(input).decision).toBe("collect_evidence");
  });

  it.each([
    { value: null }, { value: -1 }, { value: Number.NaN }, { value: "0" },
    { sampleCount: 0 }, { sampleCount: 1.5 }, { complete: false },
    { evidence: "" }, { definition: "" },
  ])("discloses invalid/incomplete aggregate fields (%j)", (fields) => {
    const input = measured();Object.assign(input.metrics.fullTranslationP95Seconds, fields);
    const result = assessTranslationWorkerMeasurements(input);
    expect(result.metrics.fullTranslationP95Seconds.status).toBe("unmeasured");
    expect(result.decision).toBe("collect_evidence");
  });

  it.each(["regular", "routine"])("requires an explicit %s interpretation", (field) => {
    const input = measured();const metric = field === "regular" ? "batchWallSeconds" : "approvalsPerFiveMinutes";
    Reflect.deleteProperty(input.metrics[metric], field);
    expect(assessTranslationWorkerMeasurements(input).metrics[metric].status).toBe("unmeasured");
  });

  it.each([
    { representative: false }, { rationale: "" }, { start: "invalid" },
    { start: "2026-10-08T00:00:00Z" }, { end: "invalid" },
  ])("does not label an invalid or unrepresentative window below threshold (%j)", (fields) => {
    const input = measured();Object.assign(input.window, fields);
    expect(assessTranslationWorkerMeasurements(input).decision).toBe("collect_evidence");
  });

  it.each([
    ["sustainedQueueSeconds", "oldest_pending_age_seconds"],
    ["fullTranslationP95Seconds", "enqueue_to_job_completion_p95_seconds"],
    ["batchWallSeconds", "configured_job_timeout_seconds"],
    ["approvalsPerFiveMinutes", "requested_bulk_approval_count"],
    ["nonSpanishLocaleCount", "locales_present_in_one_story"],
  ] as const)("rejects a proxy for %s", (metric, definition) => {
    const input = measured();input.metrics[metric].definition = definition;
    const result = assessTranslationWorkerMeasurements(input);
    expect(result.metrics[metric].status).toBe("unmeasured");
    expect(result.decision).toBe("collect_evidence");
  });

  it("retains a known trigger even when another signal is missing", () => {
    const input = measured();input.metrics.sustainedQueueSeconds.value = 3601;
    Reflect.deleteProperty(input.metrics, "fullTranslationP95Seconds");
    const result = assessTranslationWorkerMeasurements(input);
    expect(result.decision).toBe("architecture_review_required");
    expect(result.metrics.fullTranslationP95Seconds.status).toBe("unmeasured");
  });
});
