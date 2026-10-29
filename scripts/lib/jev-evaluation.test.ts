// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { providerContractSuite } from "../eval/jev";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { askJev } from "../../src/lib/jev/client";
import { JEV_MODEL } from "../../src/lib/jev/contracts";
import { hashJev, readEvaluationRecord, runEvaluation, type EvaluationSuite } from "./jev-evaluation";
const questions = { version: "fixture-v1", questions: { yes: { type: "noul" as const, instructions: "Is confirmation explicit?" } } };
const input = { text: "Confirmado." };
const provider = { model: JEV_MODEL, answers: { yes: { type: "noul", noul: 0.99 } }, usage: { input_tokens: 100, output_tokens: 0 } };
function suite(ids = ["one"]): EvaluationSuite {
  return { id: "provider-contract", task: "provider_contract", questionVersion: "fixture-v1", policyVersion: "test-v1", questionIdentity: questions,
    qualification: "plumbing_only", cases: ids.map(id => ({ id, split: "contract", input, expected: true, baseline: null,
      requests: [{ state: input, questionSet: questions }], fixtureResponses: [{ status: 200, body: provider }] })),
    async evaluate(value, { fetch }) {
      const result = await askJev(questions, value as typeof input, { mode: "evaluation", task: "provider_contract", authorized: true }, undefined, { fetch });
      return result.status === "answered" ? { value: result.answers.yes.noul >= 0.9, unavailable: false } : { value: null, unavailable: true, reason: result.reason };
    } };
}
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "jev-eval-")); vi.stubEnv("TYPESAFE_API_KEY", "fixture-only-key"); vi.stubEnv("JEV_ENABLED_TASKS", ""); vi.stubEnv("CI", ""); vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());

describe("INSPECT-01/02 fixture and bounded runs", () => {
  it("runs actual SDK fixtures without credentials or network and records all identity", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const run = await runEvaluation(suite(), { mode: "fixture", outputRoot: root });
    expect(run.complete).toBe(true); expect(run.evidenceKind).toBe("fixture"); expect(run.cases[0]?.passed).toBe(true);
    expect(run.budget.totalRequests).toBe(0); expect(run.attempts).toHaveLength(2);
    expect(process.env.TYPESAFE_API_KEY).toBe("");
    expect(readFileSync(join(run.directory, "report.html"), "utf8")).toContain("plumbing_only");
    expect(readEvaluationRecord(join(run.directory, "run.json")).identity).toEqual(run.identity);
  });
  it.each([{ maxRequests: 1 }, { maxSpendUsd: 0.1 }, { maxRequests: 0, maxSpendUsd: 0.1 }])("[case %#] rejects incomplete or invalid live caps before HTTP", async limits => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(runEvaluation(suite(), { mode: "live", outputRoot: root, fetch, ...limits })).rejects.toThrow(/caps|positive/i);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["CI", "VERCEL", "VERCEL_ENV"])("refuses live in %s", async variable => {
    vi.stubEnv(variable, "1"); const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(runEvaluation(suite(), { mode: "live", outputRoot: root, fetch, maxRequests: 2, maxSpendUsd: 1 })).rejects.toThrow(/CI|Vercel/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reserves durably before each HTTP and stops before cumulative request cap", async () => {
    let directory = "";
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      const raw = readFileSync(join(directory, "attempts.jsonl"), "utf8");
      expect(raw).toContain('"event":"reserved"');
      return Response.json(provider);
    });
    const run = await runEvaluation(suite(["one", "two", "three"]), { mode: "live", outputRoot: root, fetch, maxRequests: 1, maxSpendUsd: 1, onDirectory: value => { directory = value; } });
    expect(fetch).toHaveBeenCalledTimes(1); expect(run.complete).toBe(false);
    expect(run.cases.map(c => c.status)).toEqual(["complete", "missing", "missing"]);
    expect(run.budget.totalRequests).toBe(1); expect(run.budget.settledUsd).toBeCloseTo(0.0000042);
    const resumed = await runEvaluation(suite(["one", "two", "three"]), { mode: "live", outputRoot: root, fetch: async () => Response.json(provider), maxRequests: 3, maxSpendUsd: 1, resume: run.directory });
    expect(resumed.complete).toBe(true); expect(resumed.cases[0]?.latencyKind).toBe("replayed");
    expect(resumed.budget.totalRequests).toBe(3); expect(resumed.budget.priorRequests).toBe(1); expect(resumed.budget.newRequests).toBe(2);
  });
  it("keeps a provider failure visible while a later case succeeds and restores fixture key", async () => {
    const frozen = suite(["one", "two"]); frozen.cases[0]!.fixtureResponses = [{ status: 529, body: { error: "failure" } }];
    const run = await runEvaluation(frozen, { mode: "fixture", outputRoot: root });
    expect(run.complete).toBe(false); expect(run.cases.map(c => c.status)).toEqual(["unavailable", "complete"]);
    expect(run.cases).toHaveLength(2); expect(process.env.TYPESAFE_API_KEY).toBe("fixture-only-key");
  });
});

describe("INSPECT-03/05 crash, identity and spend accounting", () => {
  it("retains unknown completion and refuses silent resend; explicit selection adds reservation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw new Error("connection lost"); });
    const first = await runEvaluation(suite(), { mode: "live", outputRoot: root, fetch, maxRequests: 2, maxSpendUsd: 1 });
    expect(first.cases[0]?.status).toBe("unknown_completion"); expect(first.budget.reservedUsd).toBeGreaterThan(0);
    const skip = await runEvaluation(suite(), { mode: "live", outputRoot: root, fetch, maxRequests: 2, maxSpendUsd: 1, resume: first.directory });
    expect(fetch).toHaveBeenCalledTimes(1); expect(skip.complete).toBe(false);
    const attemptId = first.attempts[0]!.attemptId;
    const next = await runEvaluation(suite(), { mode: "live", outputRoot: root, fetch: async () => Response.json(provider), maxRequests: 2, maxSpendUsd: 1, resume: skip.directory, retryUnknown: [attemptId] });
    expect(next.complete).toBe(true); expect(next.budget.totalRequests).toBe(2);
    expect(next.budget.reservedUsd).toBe(first.budget.reservedUsd);
  });
  it("retains the full reservation on unknown usage and stops before a too-small spend cap", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => { const r = { ...provider, usage: undefined }; return Response.json(r); });
    const first = await runEvaluation(suite(["one", "two"]), { mode: "live", outputRoot: root, fetch, maxRequests: 2, maxSpendUsd: 0.003 });
    expect(fetch).toHaveBeenCalledTimes(1); expect(first.budget.reservedUsd).toBeCloseTo(65536 * 0.042 / 1_000_000);
    expect(first.cases[1]?.status).toBe("missing"); expect(first.cases[0]?.usage).toBeNull();
  });
  it("counts multiple requests in a single case", async () => {
    const item = suite(); item.cases[0]!.requests.push(item.cases[0]!.requests[0]!);
    item.cases[0]!.fixtureResponses.push({ status: 200, body: provider });
    const evaluate = item.evaluate; item.evaluate = async (value, transport) => { await evaluate(value, transport); return evaluate(value, transport); };
    const run = await runEvaluation(item, { mode: "live", outputRoot: root, fetch: async () => Response.json(provider), maxRequests: 2, maxSpendUsd: 1 });
    expect(run.budget.totalRequests).toBe(2); expect(run.complete).toBe(true);
  });
  it("rejects changed inputs/questions and corrupted ledger on resume", async () => {
    const first = await runEvaluation(suite(), { mode: "fixture", outputRoot: root });
    const changed = suite(); changed.cases[0]!.input = { text: "changed" };
    await expect(runEvaluation(changed, { mode: "fixture", outputRoot: root, resume: first.directory })).rejects.toThrow(/new run/i);
    const questionsChanged = suite(); questionsChanged.questionVersion = "fixture-v2";
    await expect(runEvaluation(questionsChanged, { mode: "fixture", outputRoot: root, resume: first.directory })).rejects.toThrow(/new run/i);
    writeFileSync(join(first.directory, "attempts.jsonl"), "{broken}\n");
    await expect(runEvaluation(suite(), { mode: "fixture", outputRoot: root, resume: first.directory })).rejects.toThrow(/new run/i);
  });
  it("does not send expected labels and rejects a request that changed after freezing", async () => {
    const frozen = suite(); const fetch = vi.fn<typeof globalThis.fetch>(async (_, init) => {
      expect(String(init?.body)).not.toContain('"expected"'); return Response.json(provider);
    });
    const first = await runEvaluation(frozen, { mode: "live", outputRoot: root, fetch, maxRequests: 2, maxSpendUsd: 1 });
    expect(first.complete).toBe(true);
    frozen.cases[0]!.requests[0]!.state = { text: "different" };
    const rejected = await runEvaluation(frozen, { mode: "live", outputRoot: root, fetch, maxRequests: 2, maxSpendUsd: 1 });
    expect(rejected.complete).toBe(false); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("hashing is stable across key order and rejects malformed imports", () => {
    expect(hashJev({ b: 1, a: 2 })).toBe(hashJev({ a: 2, b: 1 }));
    const file = join(root, "invalid.json"); writeFileSync(file, JSON.stringify({ schemaVersion: 1 }));
    expect(() => readEvaluationRecord(file)).toThrow(/incompatible|invalid/i);
  });
});

it("INSPECT-03 recovers a process killed after durable reservation without a completion/case checkpoint", async () => {
  const marker = join(root, "crash-directory");
  const runner = join(process.cwd(), "scripts/lib/jev-evaluation.ts");
  const suites = join(process.cwd(), "scripts/eval/jev.ts");
  const code = `import {writeFileSync} from "node:fs"; import {runEvaluation} from ${JSON.stringify(runner)}; import {providerContractSuite} from ${JSON.stringify(suites)}; await runEvaluation(providerContractSuite(), {mode:"live", outputRoot:${JSON.stringify(root)}, maxRequests:2,maxSpendUsd:1,onDirectory:d=>writeFileSync(${JSON.stringify(marker)},d),fetch:async()=>{process.kill(process.pid,"SIGKILL"); return new Promise(()=>{});}});`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--conditions=react-server", "--input-type=module", "-e", code], { encoding: "utf8", env: { ...process.env, TYPESAFE_API_KEY: "fixture-key", CI: "", VERCEL: "", VERCEL_ENV: "" } });
  expect(child.signal).toBe("SIGKILL");
  const directory = readFileSync(marker, "utf8");
  const snapshot = JSON.parse(readFileSync(join(directory, "run.json"), "utf8"));
  expect(snapshot.cases[0].status).toBe("missing");
  expect(snapshot.attempts).toHaveLength(1);
  const fetch = vi.fn<typeof globalThis.fetch>();
  const resumed = await runEvaluation(providerContractSuite(), { mode: "live", outputRoot: root, resume: directory, maxRequests: 2, maxSpendUsd: 1, fetch });
  expect(fetch).not.toHaveBeenCalled(); expect(resumed.cases[0]?.status).toBe("unknown_completion");
  expect(resumed.budget.totalRequests).toBe(1); expect(resumed.budget.reservedUsd).toBeGreaterThan(0);
});
it.each(["model", "policy", "questions", "cases", "checkpoint"])("INSPECT-03 rejects independent %s corruption", async kind => {
  const first = await runEvaluation(suite(), { mode: "fixture", outputRoot: root });
  const filename = join(first.directory, "run.json");
  if (kind === "cases") writeFileSync(join(first.directory, "cases.jsonl"), "{bad}\n");
  else if (kind === "checkpoint") writeFileSync(join(first.directory, "cases.jsonl"), readFileSync(join(first.directory, "cases.jsonl"), "utf8").split("\n").slice(0, 1).join("\n") + "\n");
  else {
    const value = JSON.parse(readFileSync(filename, "utf8"));
    if (kind === "model") value.identity.model = "jev-latest";
    if (kind === "policy") value.identity.policyVersion = "changed-v2";
    if (kind === "questions") value.identity.questionIdentity = { changed: true };
    writeFileSync(filename, JSON.stringify(value));
  }
  await expect(runEvaluation(suite(), { mode: "fixture", outputRoot: root, resume: first.directory })).rejects.toThrow(/new run/i);
});

it("P2-02 aggregated case usage can exceed one request's context ceiling", async () => {
  const item = suite(); item.cases[0]!.requests.push(item.cases[0]!.requests[0]!);
  const evaluate = item.evaluate; item.evaluate = async (value, transport) => { await evaluate(value, transport); return evaluate(value, transport); };
  const response = { ...provider, usage: { input_tokens: 40000, output_tokens: 0 } };
  const run = await runEvaluation(item, { mode: "live", outputRoot: root, fetch: async () => Response.json(response), maxRequests: 2, maxSpendUsd: 1 });
  expect(run.cases[0]?.usage?.inputTokens).toBe(80000);
  expect(readEvaluationRecord(join(run.directory, "run.json")).complete).toBe(true);
});
it.each(["model", "answers", "usage"])("P2-03 retains reservation for invalid provider %s", async field => {
  const invalid = structuredClone(provider);
  if (field === "model") invalid.model = "jev-latest" as typeof JEV_MODEL;
  if (field === "answers") Object.assign(invalid.answers, { unexpected: { type: "noul", noul: 1 } });
  if (field === "usage") invalid.usage.input_tokens = -1;
  const run = await runEvaluation(suite(), { mode: "live", outputRoot: root, fetch: async () => Response.json(invalid), maxRequests: 1, maxSpendUsd: 1 });
  expect(run.budget.settledUsd).toBe(0); expect(run.budget.reservedUsd).toBeGreaterThan(0);
  expect(readEvaluationRecord(join(run.directory, "run.json")).complete).toBe(false);
});
it.each(["budget", "complete", "counts"])("P2-03 rejects false declared %s in an imported checkpoint", async field => {
  const run = await runEvaluation(suite(), { mode: "fixture", outputRoot: root });
  const filename = join(run.directory, "run.json"); const value = JSON.parse(readFileSync(filename, "utf8"));
  if (field === "budget") value.budget.totalRequests = 42;
  if (field === "complete") value.complete = false;
  if (field === "counts") value.missingCount = 1;
  writeFileSync(filename, JSON.stringify(value));
  expect(() => readEvaluationRecord(filename)).toThrow(/invalid/i);
});

it("v2 separates execution completeness from a predefined aggregate semantic target",async()=>{
 const cases=Array.from({length:100},(_,i)=>({id:`case-${i}`,split:"heldout",input:{correct:i<80},expected:true,baseline:null,requests:[],fixtureResponses:[]}));
 const sample:EvaluationSuite={id:"eighty-percent",task:"call_outcome",questionVersion:"v1",policyVersion:"v1",questionIdentity:{},qualification:"experimental_unqualified",assessmentPolicy:"eighty-percent-v1",canQualify:true,cases,async evaluate(input){return{value:(input as{correct:boolean}).correct,unavailable:false};},assess(rows){const correct=rows.filter(row=>row.passed).length;return{targetsMet:correct/rows.length>=0.8,metrics:{correct,total:rows.length}};}};
 const run=await runEvaluation(sample,{mode:"fixture",outputRoot:root});expect(run.schemaVersion).toBe(2);expect(run.complete).toBe(true);expect(run.targetsMet).toBe(true);expect(run.pass).toBe(true);expect(run.qualified).toBe(false);expect(run.failedCount).toBe(20);
 let position=0; sample.evaluate=async input=>({value:(input as{correct:boolean}).correct,unavailable:position++===99,reason:"provider_error"});const incomplete=await runEvaluation(sample,{mode:"fixture",outputRoot:root});expect(incomplete.complete).toBe(false);expect(incomplete.pass).toBe(false);expect(incomplete.targetsMet).toBe(true);expect(incomplete.cases.filter(c=>c.status==="unavailable")).toHaveLength(1);expect(incomplete.cases).toHaveLength(100);
 const file=join(run.directory,"run.json");const obsolete=JSON.parse(readFileSync(file,"utf8"));obsolete.schemaVersion=1;writeFileSync(file,JSON.stringify(obsolete));expect(()=>readEvaluationRecord(file)).toThrow(/incompatible/i);
},30000);
