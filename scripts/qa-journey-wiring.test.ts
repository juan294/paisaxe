// @vitest-environment node
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

describe("QA wrapper journey accounting", () => {
  it.each(["startup_failed", "invalid_report", "tests_failed", "passed", "disabled"])("carries %s into durable metrics and failure accounting", status => {
    const root = mkdtempSync(join(tmpdir(), "qa-wiring-"));
    try {
      const script = readFileSync(resolve("scripts/qa-agent.sh"), "utf8");
      const block = script.slice(script.indexOf('CURRENT_PHASE="phase 2 browser journey tests"'), script.indexOf("# PHASE 3: Test User Cleanup"));
      const accounting = script.slice(script.indexOf('TOTAL_FAILURES=$(('), script.indexOf("# PHASE 6: Test Gap Analysis"));
      const prompt = script.slice(script.indexOf('PROMPT_TEXT=$(cat <<PROMPT'), script.indexOf('run_scheduled_analysis "$REPORT_FILE"'));
      const cleanup = script.slice(script.indexOf("cleanup() {"), script.indexOf("write_abnormal_exit_report() {"));
      const ending = script.slice(script.indexOf("# Cleanup handled by trap"));
      const record = { status, passed: status === "passed" ? 2 : 0, failed: status === "tests_failed" ? 2 : 0, flaky: 0, skipped: 0, failures: status === "passed" ? 0 : status === "tests_failed" ? 2 : 1, exitCode: status === "passed" ? 0 : 1, logPath: join(root, "retained.log"), action: "Inspect retained diagnostics and rerun" };
      const invocation = spawnSync("bash", ["-c", [
        "set -euo pipefail",
        "log_info(){ :; }; log_warn(){ :; }; log_error(){ :; }; log_success(){ :; }",
        "create_journey_failure_issue(){ printf 'ISSUE=%s\\n' \"$1\"; }",
        "npx(){ printf '%s' \"$FIXTURE_RESULT\"; return \"$FIXTURE_EXIT\"; }",
        "SERVER_PID=''; FAILED_TESTS=0; HEALTH_CHECKS_FAILED=0; ENABLE_GITHUB_ISSUES=true; ENABLE_GAP_ANALYSIS=false; AGENT_PROMPT=fixture; SHARED_CONTEXT_READ=''; SHARED_CONTEXT=''; SHARED_CONTEXT_WRITE=''",
        'METRICS_FILE="$PROJECT_DIR/llm-metrics"; HEALTH_METRICS_FILE="$PROJECT_DIR/health-metrics"; GAP_METRICS_FILE="$PROJECT_DIR/gap-metrics"; REPORT_FILE="$PROJECT_DIR/report.md"; : > "$METRICS_FILE"; : > "$HEALTH_METRICS_FILE"; : > "$GAP_METRICS_FILE"; : > "$PROJECT_DIR/retained.log"',
        cleanup, "trap cleanup EXIT", block,
        'printf "\\nSTATE=%s FAILURES=%s\\n" "${JOURNEY_STATUS:-missing}" "${JOURNEY_FAILURES:-missing}"',
        'cat "$JOURNEY_METRICS_FILE"', accounting, prompt,
        'printf "PROMPT=%s\\nTOTAL=%s\\n" "$PROMPT_TEXT" "$TOTAL_FAILURES"', ending,
      ].join("\n")], { encoding: "utf8", env: { ...process.env, PROJECT_DIR: root, LOG_FILE: join(root, "qa.log"), JOURNEY_METRICS_FILE: join(root, "metrics"), ENABLE_JOURNEY_TESTS: status === "disabled" ? "false" : "true", FIXTURE_RESULT: JSON.stringify(record), FIXTURE_EXIT: status === "passed" ? "0" : "1" } });
      const output = invocation.stdout;
      expect(invocation.status, invocation.stderr).toBe(status === "passed" ? 0 : 1);
      expect(output).toContain(`STATE=${status} FAILURES=${record.failures}`);
      expect(output).toContain(status);
      if (status !== "disabled") expect(output).toContain(record.logPath);
      expect(output).toContain(`TOTAL=${record.failures}`);
      expect(output).toContain(`Journey verification status: ${status}`);
      if (status !== "passed") expect(output).toContain(`ISSUE=Browser Journey Tests (${status})`);
      expect(() => readFileSync(join(root, "metrics"))).toThrow();
      expect(readFileSync(record.logPath, "utf8")).toBe("");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
