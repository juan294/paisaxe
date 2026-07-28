#!/usr/bin/env tsx
/**
 * Required-probe manifest — loader, validator, and Playwright cross-check.
 *
 * `quality/required-probes.yaml` declares what must pass before a release. That
 * declaration is only worth something if it cannot drift from what actually
 * runs, so this module asserts three things:
 *
 *   1. the manifest is internally coherent (unique ids, known tiers/oracles);
 *   2. its safety rules hold — nothing mutating is allowed to run against a
 *      deployed origin (plan D-B);
 *   3. the Playwright projects select *exactly* the probes the manifest names.
 *
 * (3) is what stops a probe from being silently dropped: deleting a test
 * without editing the manifest fails here, and so does tagging a probe that
 * nobody declared required.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";

const DEFAULT_MANIFEST = join(process.cwd(), "quality", "required-probes.yaml");

export const TIERS = ["deployed-readonly", "local-docker", "local"] as const;
export const SAFETY_CLASSES = ["read-only", "mutating-local"] as const;
export const ORACLES = [
  "http",
  "ui",
  "datastore",
  "cleanup",
  "static",
  "identity",
] as const;

export type Tier = (typeof TIERS)[number];
export type Safety = (typeof SAFETY_CLASSES)[number];
export type Oracle = (typeof ORACLES)[number];

export interface PlaywrightRunner {
  kind: "playwright";
  project: string;
  selector: string;
}

export interface ScriptRunner {
  kind: "script";
  command: string;
}

export interface RequiredProbe {
  id: string;
  title: string;
  owner: string;
  tier: Tier;
  safety: Safety;
  runner: PlaywrightRunner | ScriptRunner;
  oracles: Oracle[];
  notes?: string;
}

export interface RequiredProbeManifest {
  version: number;
  probes: RequiredProbe[];
}

/** Which Playwright project each tier is allowed to run in. */
const PROJECT_FOR_TIER: Record<string, string> = {
  "deployed-readonly": "release-required",
  "local-docker": "release-required-local",
};

export function loadManifest(path: string = DEFAULT_MANIFEST): RequiredProbeManifest {
  return parse(readFileSync(path, "utf8")) as RequiredProbeManifest;
}

export function validateManifest(manifest: RequiredProbeManifest): string[] {
  const errors: string[] = [];

  if (!Array.isArray(manifest?.probes) || manifest.probes.length === 0) {
    return ["Manifest declares no probes — a release with no required probes is a vacuous pass"];
  }

  const seen = new Set<string>();
  for (const probe of manifest.probes) {
    const label = probe.id ?? "<missing id>";

    if (!probe.id) errors.push("A probe is missing its id");
    else if (seen.has(probe.id)) errors.push(`Duplicate probe id: ${probe.id}`);
    else seen.add(probe.id);

    if (!probe.title) errors.push(`${label}: missing title`);
    if (!probe.owner) errors.push(`${label}: missing owner`);

    if (!TIERS.includes(probe.tier)) {
      errors.push(`${label}: unknown tier "${probe.tier}"`);
    }
    if (!SAFETY_CLASSES.includes(probe.safety)) {
      errors.push(`${label}: unknown safety class "${probe.safety}"`);
    }

    if (!Array.isArray(probe.oracles) || probe.oracles.length === 0) {
      errors.push(`${label}: declares no oracles — nothing would count as evidence`);
    } else {
      for (const oracle of probe.oracles) {
        if (!ORACLES.includes(oracle)) {
          errors.push(`${label}: unknown oracle "${oracle}"`);
        }
      }
    }

    // The safety invariant that protects production (plan D-B).
    if (probe.safety === "mutating-local" && probe.tier !== "local-docker") {
      errors.push(
        `${label}: mutating probes may only run in the local-docker tier, not "${probe.tier}"`
      );
    }
    if (probe.tier === "deployed-readonly" && probe.safety !== "read-only") {
      errors.push(`${label}: deployed probes must be read-only`);
    }

    if (probe.runner?.kind === "playwright") {
      const expectedProject = PROJECT_FOR_TIER[probe.tier];
      if (expectedProject && probe.runner.project !== expectedProject) {
        errors.push(
          `${label}: tier ${probe.tier} must run in project "${expectedProject}", not "${probe.runner.project}"`
        );
      }
      if (!probe.runner.selector?.includes("@release-required")) {
        errors.push(`${label}: selector must contain the @release-required tag`);
      }
    } else if (probe.runner?.kind === "script") {
      if (!probe.runner.command) errors.push(`${label}: script runner has no command`);
    } else {
      errors.push(`${label}: unknown runner kind`);
    }
  }

  return errors;
}

export function playwrightProbes(manifest: RequiredProbeManifest): RequiredProbe[] {
  return manifest.probes.filter((probe) => probe.runner.kind === "playwright");
}

/**
 * Exact set comparison between what the manifest declares and what Playwright
 * would actually run. Subset agreement is not enough in either direction.
 */
export function compareSelection(
  manifest: RequiredProbeManifest,
  selectedTitlesByProject: Record<string, string[]>
): string[] {
  const errors: string[] = [];
  const byProject = new Map<string, Set<string>>();

  for (const probe of playwrightProbes(manifest)) {
    const runner = probe.runner as PlaywrightRunner;
    const titles = byProject.get(runner.project) ?? new Set<string>();
    titles.add(runner.selector);
    byProject.set(runner.project, titles);
  }

  for (const [project, declared] of byProject) {
    const selected = new Set(selectedTitlesByProject[project] ?? []);

    for (const selector of declared) {
      const match = [...selected].some((title) => title.startsWith(selector));
      if (!match) {
        errors.push(
          `${project}: manifest requires "${selector}" but Playwright selects no such test`
        );
      }
    }

    for (const title of selected) {
      const match = [...declared].some((selector) => title.startsWith(selector));
      if (!match) {
        errors.push(
          `${project}: Playwright selects "${title}" but no probe in the manifest declares it`
        );
      }
    }
  }

  return errors;
}

interface PlaywrightListSuite {
  title?: string;
  suites?: PlaywrightListSuite[];
  specs?: { title: string }[];
}

/** Flattens `playwright test --list --reporter=json` down to spec titles. */
export function collectSpecTitles(suites: PlaywrightListSuite[] = []): string[] {
  const titles: string[] = [];
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) titles.push(spec.title);
    titles.push(...collectSpecTitles(suite.suites));
  }
  return titles;
}

export function listSelectedTitles(project: string): string[] {
  const output = execFileSync(
    "npx",
    ["playwright", "test", "--list", "--reporter=json", `--project=${project}`],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      // Listing must not boot a web server or probe a deployment.
      env: { ...process.env, RELEASE_TARGET_URL: "" },
      maxBuffer: 32 * 1024 * 1024,
    }
  );

  return collectSpecTitles(
    (JSON.parse(output) as { suites?: PlaywrightListSuite[] }).suites
  );
}

function runCli(): void {
  const manifest = loadManifest();
  const errors = validateManifest(manifest);

  if (errors.length === 0) {
    const projects = new Set(
      playwrightProbes(manifest).map((probe) => (probe.runner as PlaywrightRunner).project)
    );
    const selected: Record<string, string[]> = {};
    for (const project of projects) {
      selected[project] = listSelectedTitles(project);
    }
    errors.push(...compareSelection(manifest, selected));
  }

  if (errors.length > 0) {
    console.error("✗ Required-probe manifest errors:\n");
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }

  console.log(
    `✓ ${manifest.probes.length} required probes declared; Playwright selection matches exactly`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
