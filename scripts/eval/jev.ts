import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { askJev } from "../../src/lib/jev/client";
import type { JevQuestionSet, JevState } from "../../src/lib/jev/contracts";
import { inspectEvaluation, runEvaluation, type EvaluationCase, type EvaluationSuite } from "../lib/jev-evaluation";
import { evidenceSuite } from "./jev-evidence";
import { callOutcomeSuite } from "./jev-call-outcome";
import { bookingIntakeSuite } from "./jev-booking-intake";
import { experienceMatchSuite } from "./jev-experience-match";
import { experienceMatchQualitySuite } from "./jev-experience-match-quality";
import { isMain } from "../lib/is-main";

export const PROVIDER_CONTRACT_QUESTIONS: JevQuestionSet = { version: "provider-contract-v1", questions: {
  confirmed: { type: "noul", instructions: "Does the supplied text explicitly confirm the visit?", criteria: { true: "The visit is explicitly confirmed.", false: "The text gives no explicit confirmation." } },
  cancelled: { type: "noul", instructions: "Does the supplied text explicitly cancel the visit?", criteria: { true: "The visit is explicitly cancelled.", false: "The text gives no explicit cancellation." } },
} };
export function providerContractSuite(): EvaluationSuite {
  const parsed = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/jev/provider-contract.json", import.meta.url)), "utf8"));
  z.object({ schemaVersion: z.literal(1), id: z.string(), split: z.string(), input: z.object({ text: z.string() }), expected: z.object({ confirmed: z.boolean(), cancelled: z.boolean() }), baseline: z.null(), fixtureResponses: z.array(z.object({ status: z.number(), body: z.unknown() })) }).strict().parse(parsed);
  const item = parsed as Omit<EvaluationCase, "requests">;
  return { id: "provider-contract", task: "provider_contract", questionVersion: PROVIDER_CONTRACT_QUESTIONS.version, policyVersion: "jev-conservative-v1",
    questionIdentity: PROVIDER_CONTRACT_QUESTIONS, qualification: "plumbing_only", cases: [{ ...item, requests: [{ state: item.input, questionSet: PROVIDER_CONTRACT_QUESTIONS }] }],
    async evaluate(input: JevState, { fetch }) {
      const answer = await askJev(PROVIDER_CONTRACT_QUESTIONS, input, { mode: "evaluation", task: "provider_contract", authorized: true }, undefined, { fetch });
      if (answer.status === "unavailable") return { value: null, unavailable: true, reason: answer.reason };
      const confirmed = answer.answers.confirmed; const cancelled = answer.answers.cancelled;
      if (!confirmed || confirmed.type !== "noul" || !cancelled || cancelled.type !== "noul") return { value: null, unavailable: true, reason: "invalid_response" };
      if ((confirmed.noul > 0.1 && confirmed.noul < 0.9) || (cancelled.noul > 0.1 && cancelled.noul < 0.9)) return { value: null, unavailable: true, reason: "semantic_abstention" };
      return { value: { confirmed: confirmed.noul >= 0.9, cancelled: cancelled.noul >= 0.9 }, unavailable: false };
    } };
}
/** Integration owner registers bounded domain suites here; importing runs no evaluation. */
export function registeredJevSuites(): EvaluationSuite[] { return [providerContractSuite(), bookingIntakeSuite(), callOutcomeSuite(), evidenceSuite(), experienceMatchSuite(), experienceMatchQualitySuite()]; }
function parseArguments(argv: string[]): { command: string; values: Map<string, string> } {
  const command = argv[0] ?? "--list"; const values = new Map<string, string>();
  const allowed = new Set(["--suite", "--input", "--max-requests", "--max-spend-usd", "--case", "--resume", "--retry-unknown"]);
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index]; const value = argv[index + 1];
    if (!flag || !allowed.has(flag) || !value || value.startsWith("--") || values.has(flag)) throw new Error("Invalid or duplicate argument; use --list, fixture, inspect or capped live.");
    values.set(flag, value);
  }
  return { command, values };
}
export async function jevMain(argv: string[]): Promise<number> {
  try {
    const { command, values } = parseArguments(argv);
    if (command === "--list") { console.log(registeredJevSuites().map(s => `${s.id}: ${s.qualification} (${s.cases.length} cases)`).join("\n")); return 0; }
    if (command === "inspect") {
      const input = values.get("--input"); if (!input) throw new Error("inspect requires --input <record.json>.");
      const run = inspectEvaluation(input); console.log(`evidence: imported\nrecord: ${run.directory}/run.json\nreport: ${run.directory}/report.html\ncomplete:${run.complete}\ntargetsMet:${run.targetsMet}\npass:${run.pass}\nqualified:${run.qualified}`); return run.pass ? 0 : 1;
    }
    if (command !== "fixture" && command !== "live") throw new Error("Unknown operation; use --list, fixture, inspect or capped live.");
    const suite = registeredJevSuites().find(s => s.id === values.get("--suite")); if (!suite) throw new Error("Select a registered --suite; use --list.");
    const run = await runEvaluation(suite, { mode: command, maxRequests: values.has("--max-requests") ? Number(values.get("--max-requests")) : undefined,
      maxSpendUsd: values.has("--max-spend-usd") ? Number(values.get("--max-spend-usd")) : undefined,
      caseId: values.get("--case"), resume: values.get("--resume"), retryUnknown: values.get("--retry-unknown")?.split(",") });
    console.log(`evidence: ${run.evidenceKind}\nrecord: ${run.directory}/run.json\nreport: ${run.directory}/report.html\ncomplete:${run.complete}\ntargetsMet:${run.targetsMet}\npass:${run.pass}\nqualified:${run.qualified}`); return run.pass ? 0 : 1;
  } catch (error) { console.error(error instanceof Error ? error.message : "Jev evaluation failed."); return 1; }
}
if (isMain(import.meta.url)) process.exitCode = await jevMain(process.argv.slice(2));
