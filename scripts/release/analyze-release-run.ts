#!/usr/bin/env tsx
/**
 * Release analyzer — Wave A, Phase 4 (template A2).
 *
 * Reads an evidence manifest for a candidate tree and decides whether the
 * release may proceed. Runs locally as part of the release procedure, not as a
 * CI job, so it consumes no CI minutes (plan D-B).
 *
 * Fail-closed by construction: the analyzer only ever *adds* reasons to block.
 * There is no path that turns a blocking condition into a pass, and absent
 * evidence is treated as missing evidence rather than as absence of a problem.
 *
 * Blocking invariants:
 *   D03  at least one probe actually passed — zero passes is never a pass
 *   D04  no required probe is failed, skipped, or absent
 *   D06  candidate_tree == shipped_tree == deployed_tree
 *        every required probe carries the oracle evidence it declared
 *        every probe declaring a cleanup oracle shows cleanup: removed
 *        no unexpired exception covers a required probe (quarantine cannot
 *        excuse requiredness), and no expired exception is left lying around
 *
 * Usage:
 *   analyze-release-run.ts --evidence docs/release/evidence/<tree>.yaml
 *                          [--manifest quality/required-probes.yaml]
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";
import { loadManifest, type RequiredProbeManifest } from "./required-probes";

const FULL_HASH_PATTERN = /^[0-9a-f]{40}$/i;

export type ProbeStatus = "passed" | "failed" | "skipped";

export interface ProbeEvidence {
  id: string;
  status: ProbeStatus;
  oracles?: string[];
  cleanup?: string;
}

export interface ReleaseException {
  probe: string;
  reason?: string;
  expires?: string;
}

export interface EvidenceManifest {
  version?: number;
  candidate_tree?: string;
  shipped_tree?: string;
  deployed_tree?: string;
  deployed_commit?: string;
  target_url?: string;
  generated_at?: string;
  probes?: ProbeEvidence[];
  exceptions?: ReleaseException[];
}

export interface AnalysisResult {
  ok: boolean;
  blockers: string[];
  passedCount: number;
}

export function loadEvidence(path: string): EvidenceManifest {
  return (parse(readFileSync(path, "utf8")) ?? {}) as EvidenceManifest;
}

function checkIdentity(evidence: EvidenceManifest): string[] {
  const blockers: string[] = [];
  const trees = {
    candidate_tree: evidence.candidate_tree,
    shipped_tree: evidence.shipped_tree,
    deployed_tree: evidence.deployed_tree,
  };

  for (const [name, value] of Object.entries(trees)) {
    if (!value) {
      blockers.push(`D06: ${name} is missing — the release is not bound to a candidate`);
    } else if (!FULL_HASH_PATTERN.test(value)) {
      blockers.push(`D06: ${name} is not a tree hash: ${value}`);
    }
  }

  if (blockers.length > 0) return blockers;

  const distinct = new Set(Object.values(trees));
  if (distinct.size !== 1) {
    blockers.push(
      "D06: candidate, shipped and deployed trees disagree — " +
        `candidate=${trees.candidate_tree} shipped=${trees.shipped_tree} deployed=${trees.deployed_tree}`
    );
  }

  return blockers;
}

function checkExceptions(
  evidence: EvidenceManifest,
  requiredIds: Set<string>,
  now: Date
): string[] {
  const blockers: string[] = [];

  for (const exception of evidence.exceptions ?? []) {
    const expiry = exception.expires ? new Date(exception.expires) : undefined;
    const expired = expiry !== undefined && !Number.isNaN(expiry.getTime()) && expiry < now;

    if (exception.expires && (expiry === undefined || Number.isNaN(expiry.getTime()))) {
      blockers.push(`Exception for "${exception.probe}" has an unparseable expiry: ${exception.expires}`);
      continue;
    }

    if (expired) {
      // Stale exceptions must be removed, not left to rot: an expired waiver in
      // a shipped manifest is indistinguishable at a glance from a live one.
      blockers.push(
        `Exception for "${exception.probe}" expired on ${exception.expires} — remove it rather than shipping with it`
      );
      continue;
    }

    if (requiredIds.has(exception.probe)) {
      blockers.push(
        `Exception covers required probe "${exception.probe}" — quarantine cannot excuse a required probe`
      );
    }
  }

  return blockers;
}

export function analyzeRelease(
  evidence: EvidenceManifest,
  manifest: RequiredProbeManifest,
  now: Date = new Date()
): AnalysisResult {
  const blockers: string[] = [];
  const probes = evidence.probes ?? [];
  const byId = new Map(probes.map((probe) => [probe.id, probe]));
  const passedCount = probes.filter((probe) => probe.status === "passed").length;

  // D03 — zero passes is never a pass. A run that executed nothing must not be
  // reported as a clean run.
  if (passedCount === 0) {
    blockers.push("D03: no probe passed — a run with zero passes is not a green run");
  }

  blockers.push(...checkIdentity(evidence));

  const requiredIds = new Set(manifest.probes.map((probe) => probe.id));

  for (const required of manifest.probes) {
    const observed = byId.get(required.id);

    // D04 — required means required: absent, skipped and failed all block.
    if (!observed) {
      blockers.push(`D04: required probe "${required.id}" has no evidence in the manifest`);
      continue;
    }
    if (observed.status !== "passed") {
      blockers.push(`D04: required probe "${required.id}" is ${observed.status}`);
    }

    const collected = new Set(observed.oracles ?? []);
    for (const oracle of required.oracles ?? []) {
      if (!collected.has(oracle)) {
        blockers.push(
          `Required probe "${required.id}" declares the ${oracle} oracle but reports no ${oracle} evidence`
        );
      }
      if (oracle === "cleanup" && observed.cleanup !== "removed") {
        blockers.push(
          `Required probe "${required.id}" left fixture data behind (cleanup: ${observed.cleanup ?? "absent"})`
        );
      }
    }
  }

  blockers.push(...checkExceptions(evidence, requiredIds, now));

  return { ok: blockers.length === 0, blockers, passedCount };
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

export function runCli(argv: string[]): number {
  const args = argv.slice(2);
  const evidencePath = readFlag(args, "--evidence");

  if (!evidencePath) {
    console.error(
      "✗ Usage: analyze-release-run.ts --evidence <path> [--manifest <path>]"
    );
    return 1;
  }

  let result: AnalysisResult;
  try {
    const manifestPath =
      readFlag(args, "--manifest") ?? join(process.cwd(), "quality", "required-probes.yaml");
    result = analyzeRelease(loadEvidence(evidencePath), loadManifest(manifestPath));
  } catch (error) {
    // An unreadable manifest blocks; it never falls through to a pass.
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (!result.ok) {
    console.error(`✗ Release blocked (${result.blockers.length} blocking findings):\n`);
    for (const blocker of result.blockers) console.error(`  ${blocker}`);
    return 1;
  }

  console.log(`✓ Release evidence is complete — ${result.passedCount} probes passed, no blockers`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv);
}
