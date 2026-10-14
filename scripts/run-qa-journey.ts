import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { collectJourneyRun } from "./lib/qa-journey";
import { isMain } from "./lib/is-main";
import { config } from "dotenv";

/** Include intended uncommitted inputs without changing the user's index. */
function candidateTree(): string {
  const temporary = mkdtempSync(join(tmpdir(), "qa-candidate-"));
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, "index") };
  const git = (...args: string[]) => execFileSync("git", args, { env, encoding: "utf8" }).trim();
  try {
    git("read-tree", "HEAD");
    git("add", "-A");
    return git("write-tree");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

export async function runQaJourney(): Promise<void> {
  config({ path: ".env.local", quiet: true });
  const port = process.env.PLAYWRIGHT_PORT ?? "3100";
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid PLAYWRIGHT_PORT");
  const target = `http://localhost:${port}`;
  const identity = {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    tree: candidateTree(),
  };
  const cronSecret = process.env.CRON_SECRET?.trim() || randomBytes(24).toString("hex");
  const directory = resolve(process.env.QA_JOURNEY_EVIDENCE_DIR || join("logs", `qa-journey-${Date.now()}-${process.pid}`));
  const result = await collectJourneyRun({
    directory, target, identity, cronSecret, enabled: process.env.ENABLE_JOURNEY_TESTS !== "false",
    command: [process.execPath, "node_modules/@playwright/test/cli.js", "test", "qa-journey.spec.ts", "--project=qa-journey", "--reporter=json"],
    startCommand: [process.execPath, "node_modules/tsx/dist/cli.mjs", "scripts/run-qa-journey.ts", "--serve"],
    artifactRoot: process.cwd(),
    env: { ...process.env, CRON_SECRET: cronSecret, VERCEL_GIT_COMMIT_SHA: identity.commit, BUILD_TREE_HASH: identity.tree, PLAYWRIGHT_TEST_ORIGIN: target },
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.failures ? 1 : 0;
}

/** Stamp only a completed build whose source inputs stayed unchanged. */
function serveCandidate(): void {
  const tree = process.env.BUILD_TREE_HASH;
  if (!tree || candidateTree() !== tree) throw new Error("Candidate changed before build.");
  const built = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (built.status !== 0) throw new Error(`Production build failed (${built.status}).`);
  if (candidateTree() !== tree) throw new Error("Candidate changed during build; rebuild before testing.");
  const assets: Record<string, string> = {};
  for (const path of readdirSync(".next/static", { recursive: true, encoding: "utf8" })) {
    if (path.endsWith(".js")) assets[`/_next/static/${path}`] = createHash("sha256").update(readFileSync(join(".next/static", path))).digest("hex");
  }
  writeFileSync(".next/qa-journey-candidate.json", JSON.stringify({
    commit: process.env.VERCEL_GIT_COMMIT_SHA, tree,
    buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), assets,
  }));
  const started = spawnSync("npm", ["run", "start", "--", "--port", process.env.PLAYWRIGHT_PORT || "3100"], { stdio: "inherit" });
  process.exitCode = started.status ?? 1;
}

if (isMain(import.meta.url)) (process.argv.includes("--serve") ? Promise.resolve().then(serveCandidate) : runQaJourney()).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
