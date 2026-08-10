#!/usr/bin/env tsx
/**
 * Release candidate identity — Wave A, Phase 2.
 *
 * The repo permits squash merges only, so the commit SHA that CI tested never
 * reaches `main`. The *tree* does: `strict: true` branch protection forces the
 * PR branch to be up to date before merging, so the squashed commit on `main`
 * carries the same tree as the tested head. Release evidence therefore
 * identifies a candidate by tree hash, not commit SHA (plan D-A).
 *
 * Usage:
 *   candidate-identity.ts --tree <ref>
 *       Prints `git rev-parse <ref>^{tree}`.
 *
 *   candidate-identity.ts --verify --expected <tree> --url <deployed-url>
 *       Fetches <deployed-url>/api/health, reads the commit the deployment
 *       reports, resolves that commit's tree locally, and exits non-zero unless
 *       it equals <tree>.
 *
 * Requires CRON_SECRET in the environment: /api/health discloses its build
 * identity only to an authorized caller (SE-M1 — the endpoint is public, the
 * repo is private).
 *
 * Fail-closed: a deployment that reports no identity, an unreachable or
 * malformed /api/health, or a commit git cannot resolve all exit non-zero. An
 * unverifiable deployment is never treated as a verified one.
 *
 * Read-only. It never mutates the deployed environment (plan D-B).
 */
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const HEALTH_PATH = "/api/health";
const FETCH_TIMEOUT_MS = 45_000;
const UNKNOWN_IDENTITY = "unknown";
const FULL_HASH_PATTERN = /^[0-9a-f]{40}$/i;

export interface HealthProbeResult {
  status: number;
  body: unknown;
}

/** Resolves a git ref to a hash. Throws when the ref is unknown locally. */
export type TreeResolver = (ref: string) => string;
export type HealthFetcher = (url: string) => Promise<HealthProbeResult>;

export interface VerifyDeps {
  resolveTree: TreeResolver;
  fetchHealth: HealthFetcher;
}

export interface VerifyOptions {
  expectedTree: string;
  url: string;
}

export interface VerifyResult {
  deployedCommit: string;
  deployedTree: string;
  expectedTree: string;
}

export function healthUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = HEALTH_PATH;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Resolves the tree hash a ref points at, via git. */
export function resolveTreeWithGit(ref: string): string {
  const output = execFileSync("git", ["rev-parse", `${ref}^{tree}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.trim();
}

/**
 * /api/health returns its build identity only to a caller holding CRON_SECRET —
 * the endpoint is public and the repo is private, so the deployed commit is not
 * disclosed to anonymous callers (SE-M1). Without the secret this script cannot
 * verify anything, so it refuses up front rather than reporting a false "no
 * identity" verdict against a deployment that is in fact reporting one.
 */
export function releaseIdentityHeaders(): Record<string, string> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    throw new Error(
      "CRON_SECRET is not set locally. /api/health discloses its build identity " +
        "only to an authorized caller, so verification cannot proceed without it."
    );
  }

  // Preview deployments sit behind Vercel protection; the same bypass header
  // scripts/check-health-readiness.mjs uses applies here.
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return {
    authorization: `Bearer ${cronSecret}`,
    ...(bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {}),
  };
}

export async function fetchHealthOverHttp(
  url: string
): Promise<HealthProbeResult> {
  const response = await fetch(url, {
    headers: releaseIdentityHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `${url} did not return JSON (HTTP ${response.status}): ${text.slice(0, 200)}`
    );
  }

  return { status: response.status, body };
}

/**
 * Reads the commit a deployment reports. Throws — rather than returning a
 * sentinel — whenever the identity is absent or "unknown", so callers cannot
 * accidentally treat an unidentified build as verified.
 */
export function extractDeployedCommit(probe: HealthProbeResult): string {
  if (probe.status !== 200) {
    throw new Error(`/api/health returned HTTP ${probe.status}, expected 200`);
  }

  const build = (probe.body as { build?: unknown } | null)?.build;
  if (typeof build !== "object" || build === null) {
    throw new Error(
      "Deployment reports no build identity (/api/health has no `build` object). " +
        "Either it predates release-identity reporting, or the CRON_SECRET used " +
        "here does not match the one deployed. Not verified either way."
    );
  }

  const commit = (build as { commit?: unknown }).commit;
  if (typeof commit !== "string" || commit.trim() === "") {
    throw new Error("Deployment reports no build.commit");
  }
  if (commit === UNKNOWN_IDENTITY) {
    throw new Error(
      'Deployment reports build.commit "unknown" — it was built without git metadata and cannot be verified.'
    );
  }

  return commit;
}

export async function verifyCandidateIdentity(
  options: VerifyOptions,
  deps: VerifyDeps
): Promise<VerifyResult> {
  const expectedTree = options.expectedTree.trim();
  if (!FULL_HASH_PATTERN.test(expectedTree)) {
    throw new Error(
      `--expected must be a full 40-character tree hash, got "${options.expectedTree}". ` +
        "Produce one with: candidate-identity.ts --tree <ref>"
    );
  }

  const probe = await deps.fetchHealth(healthUrl(options.url));
  const deployedCommit = extractDeployedCommit(probe);

  let deployedTree: string;
  try {
    deployedTree = deps.resolveTree(deployedCommit);
  } catch {
    throw new Error(
      `Cannot resolve the tree of deployed commit ${deployedCommit} locally. ` +
        "Fetch it first (git fetch --all) — an unresolvable commit is not a verified one."
    );
  }

  if (deployedTree !== expectedTree) {
    throw new Error(
      `Deployed tree does not match the candidate.\n` +
        `  expected: ${expectedTree}\n` +
        `  deployed: ${deployedTree} (commit ${deployedCommit})`
    );
  }

  return { deployedCommit, deployedTree, expectedTree };
}

function usage(): string {
  return [
    "Usage:",
    "  candidate-identity.ts --tree <ref>",
    "  candidate-identity.ts --verify --expected <tree> --url <deployed-url>",
  ].join("\n");
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value\n\n${usage()}`);
  }
  return value;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = argv.slice(2);

  try {
    if (args.includes("--verify")) {
      const expectedTree = readFlag(args, "--expected");
      const url = readFlag(args, "--url");
      if (!expectedTree || !url) {
        throw new Error(`--verify requires --expected and --url\n\n${usage()}`);
      }

      const result = await verifyCandidateIdentity(
        { expectedTree, url },
        { resolveTree: resolveTreeWithGit, fetchHealth: fetchHealthOverHttp }
      );
      console.log(
        `✓ ${url} is serving the candidate\n` +
          `  commit: ${result.deployedCommit}\n` +
          `  tree:   ${result.deployedTree}`
      );
      return 0;
    }

    const ref = readFlag(args, "--tree");
    if (!ref) {
      throw new Error(usage());
    }
    console.log(resolveTreeWithGit(ref));
    return 0;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv).then((code) => {
    process.exitCode = code;
  });
}
