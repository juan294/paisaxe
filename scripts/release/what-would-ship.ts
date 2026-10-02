#!/usr/bin/env tsx
/**
 * "What would ship" — release-checklist.md step 2 / operations.md pre-launch
 * checklist step 5.
 *
 * Paisaxe historically squash-merged `develop` into `main`. Those old release
 * commits remain outside `develop` ancestry even after release promotion moves
 * to merge commits. A plain `git log <last-tag>..develop` therefore still
 * includes already shipped history when the last tag names a historical
 * squash release (DO-M8, #835).
 *
 * The fix remains useful across both topologies: releases are identified by
 * *tree* hash, not commit SHA, and the release tag's annotation
 * records that tree (see release-checklist.md step 8: `git tag -a "v<version>"
 * -m "Release v<version> (tree <hash>)"`). That tree hash necessarily also
 * appears as some commit's tree on `develop` — the commit that was the
 * candidate for that release. Diffing from *that* commit onward yields the
 * real "what's new since the last release" answer.
 *
 * Falls back explicitly to `git merge-base main develop` (and says so) when
 * no release tag exists yet, or its tree can't be resolved on `develop` — an
 * in-flight or aborted first release must never silently show nothing.
 */
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

export interface ShipBoundaryResult {
  boundary: string;
  source: "last-release" | "merge-base";
}

export function extractTreeFromTagMessage(message: string): string | undefined {
  const match = message.match(/[0-9a-f]{40}/);
  return match?.[0];
}

export function findDevelopCommitForTree({
  tree,
  readDevelopLog,
}: {
  tree: string;
  readDevelopLog: () => string;
}): string | undefined {
  const log = readDevelopLog();
  for (const line of log.split("\n")) {
    const [commit, commitTree] = line.trim().split(/\s+/);
    if (commitTree === tree) return commit;
  }
  return undefined;
}

export interface ResolveShipBoundaryDeps {
  findLastReleaseTag: () => string | undefined;
  readTagMessage: (tag: string) => string;
  readDevelopLog: () => string;
  findMergeBase: () => string;
}

export function resolveShipBoundary(deps: ResolveShipBoundaryDeps): ShipBoundaryResult {
  const lastTag = deps.findLastReleaseTag();
  if (lastTag) {
    const tree = extractTreeFromTagMessage(deps.readTagMessage(lastTag));
    if (tree) {
      const commit = findDevelopCommitForTree({
        tree,
        readDevelopLog: deps.readDevelopLog,
      });
      if (commit) return { boundary: commit, source: "last-release" };
    }
  }
  return { boundary: deps.findMergeBase(), source: "merge-base" };
}

function git(args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function findLastReleaseTagWithGit(): string | undefined {
  try {
    return git(["describe", "--tags", "--match", "v*", "--abbrev=0", "main"]);
  } catch {
    return undefined;
  }
}

function readTagMessageWithGit(tag: string): string {
  return git(["tag", "-l", "-n1", tag]);
}

function readDevelopLogWithGit(): string {
  return git(["log", "develop", "--format=%H %T"]);
}

function findMergeBaseWithGit(): string {
  return git(["merge-base", "main", "develop"]);
}

export function runCli(): number {
  const { boundary, source } = resolveShipBoundary({
    findLastReleaseTag: findLastReleaseTagWithGit,
    readTagMessage: readTagMessageWithGit,
    readDevelopLog: readDevelopLogWithGit,
    findMergeBase: findMergeBaseWithGit,
  });

  if (source === "merge-base") {
    console.log(
      "No resolvable prior release tag found on develop's history — falling back to " +
        "the main/develop merge-base. This is expected before the first release, or " +
        "while a release is in flight.\n"
    );
  } else {
    console.log(`Bounding to the last release's candidate commit on develop: ${boundary}\n`);
  }

  console.log(`Commits since then (${boundary}..develop):`);
  console.log(git(["log", `${boundary}..develop`, "--oneline"]) || "(none)");

  console.log("\nFile-level shape of what would ship (main vs develop):");
  console.log(git(["diff", "--stat", "main", "develop"]));

  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
