import type { EvaluationRun } from "./jev-evaluation";
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
export const quoteJevShellArg = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'";
const pretty = (value: unknown) => escape(JSON.stringify(value, null, 2));
/** Curated summary deliberately excludes raw inputs, expectations and provider bodies. */
export function summarizeJevRun(run: EvaluationRun) {
  return { schemaVersion: 2, runId: run.runId, evidenceKind: run.evidenceKind, identity: { ...run.identity, questionIdentity: undefined }, qualification: run.qualification,
    complete: run.complete, targetsMet:run.targetsMet, pass:run.pass, qualified:run.qualified, metrics:run.metrics, suppliedCount: run.cases.length, completedCount: run.cases.filter(c => c.status === "complete").length, missingCount: run.missingCount,
    failedCount: run.failedCount, budget: run.budget, cases: run.cases.map(c => ({ id: c.id, split: c.split, inputHash: c.inputHash, status: c.status, passed: c.passed, latencyKind: c.latencyKind, latencyMs: c.latencyMs })) };
}
export function renderJevReport(run: EvaluationRun): string {
  const cells = run.cases.map(item => {
    const attempts = run.attempts.filter(e => e.caseId === item.id);
    const mode = run.evidenceKind === "live" ? "live" : "fixture";
    const retry = `npm run eval:jev -- ${mode} --suite ${quoteJevShellArg(run.identity.suiteId)} --case ${quoteJevShellArg(item.id)}${mode === "live" ? ` --max-requests ${Math.max(1, item.requests.length)} --max-spend-usd ${(Math.max(1, item.requests.length) * 0.003).toFixed(6)}` : ""}`;
    return `<section><h2>${escape(item.id)} · ${escape(item.status)}</h2><p>Split: ${escape(item.split)} · Expected comparison: ${item.passed === null ? "unavailable" : item.passed ? "pass" : "failed"} · Timing: ${escape(item.latencyKind)} ${item.latencyMs === null ? "unmeasured" : `${escape(item.latencyMs.toFixed(1))} ms`}</p>
<p>${escape(item.reason ?? "")}</p><details><summary>Input, expected label, baseline and outcome</summary><pre>${pretty({ input: item.input, expected: item.expected, baseline: item.baseline, outcome: item.outcome })}</pre></details>
<details><summary>Exact supplied requests, judgments/distributions and provider failures</summary><pre>${pretty(attempts)}</pre></details>
${item.status !== "complete" || item.passed === false ? `<p>Repeat this read-only synthetic case; live mode additionally requires explicit authorization and approved caps:</p><pre>${escape(retry)}</pre>` : ""}</section>`;
  }).join("\n");
  const unknownIds = run.attempts.filter(e => e.event === "reserved" && !run.attempts.some(c => c.event === "completed" && c.attemptId === e.attemptId)).map(e => e.attemptId);
  const mode = run.evidenceKind === "live" ? "live" : "fixture";
  const resume = run.evidenceKind === "imported" ? `npm run eval:jev -- fixture --suite ${quoteJevShellArg(run.identity.suiteId)}` :
    `npm run eval:jev -- ${mode} --suite ${quoteJevShellArg(run.identity.suiteId)} --resume ${quoteJevShellArg(run.directory)}${mode === "live" ? ` --max-requests ${Math.max(1, run.budget.totalRequests + 1)} --max-spend-usd ${(run.budget.settledUsd + run.budget.reservedUsd + 0.003).toFixed(6)}` : ""}${unknownIds.length ? ` --retry-unknown ${quoteJevShellArg(unknownIds.join(","))}` : ""}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Jev decision inspection</title><style>body{font:16px system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#172024;background:#fafaf7}h1,h2{line-height:1.2}section{border-top:1px solid #ccd4d1;padding:1rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef2ef;padding:1rem}summary{cursor:pointer;padding:.5rem 0}dt{font-weight:600}</style></head><body>
<h1>Jev decision inspection</h1><p>Judgments concern only the provided state and evidence.</p><p>Evidence: <strong>${escape(run.evidenceKind)}</strong>${run.importedFrom ? ` (imported claim from ${escape(run.importedFrom)}; provider authenticity unverified)` : ""}. Qualification: ${run.qualified?"qualified for this supplied suite only":escape(run.qualification)}. This report cannot enable runtime tasks or authorize booking, settlement or corpus approval.</p>
<p><strong>complete:${run.complete}</strong> · targetsMet:${run.targetsMet} · pass:${run.pass} · qualified:${run.qualified} · ${run.cases.length} supplied cases · ${run.cases.filter(c => c.status === "complete").length} completed · ${run.failedCount} failed/unavailable · ${run.missingCount} missing/unknown completion. Failed and missing cases remain in denominators.</p>
<p>Model ${escape(run.identity.model)} · question version ${escape(run.identity.questionVersion)} · policy ${escape(run.identity.policyVersion)}. Fixture/replayed/imported latency is not fresh live latency. Unknown usage retains the full reservation and is unmeasured.</p>
<details><summary>Source, question and case identity</summary><pre>${pretty(run.identity)}</pre></details><h2>Suite metrics and predefined targets</h2><pre>${pretty(run.metrics)}</pre><p>Execution completeness does not mean every semantic label is correct. All abstentions and mislabels remain in the denominator; transport failures make execution incomplete. Fixture/imported runs cannot qualify real model behavior.</p><h2>Budget accounting</h2><pre>${pretty(run.budget)}</pre>
${!run.pass ? `<p>${run.evidenceKind === "imported" ? "Imported records cannot be resumed; start a new fixture run." : "Resume creates a new run and preserves prior reservations; live mode requires cumulative authorized caps."} Unknown completion is never automatically retried; inspect and explicitly select attempt IDs first. The suggested ceilings must be within the owner's authorization.</p><pre>${escape(resume)}</pre>` : ""}
${cells}</body></html>`;
}
