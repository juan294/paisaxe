import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

const releaseAuthorities = [
  "CLAUDE.md",
  ".claude/commands/release.md",
  ".claude/skills/deploy/SKILL.md",
  "docs/runbooks/release-checklist.md",
];

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("release merge topology", () => {
  it.each(releaseAuthorities)("rejects squash promotion in %s", (path) => {
    expect(read(path)).not.toMatch(/\bgh\s+pr\s+merge\s+--squash\b/);
  });

  it.each(releaseAuthorities)("requires merge-commit promotion in %s", (path) => {
    expect(read(path)).toMatch(/\bgh\s+pr\s+merge\s+--merge\b/);
  });
});

describe("standing release rulings (ADR-0024 decisions 11 and 12)", () => {
  const checklist = read("docs/runbooks/release-checklist.md");
  const claude = read("CLAUDE.md");

  it("documents the release PR Preview as the only permitted Preview", () => {
    expect(checklist).toMatch(/Release PR Preview exception/);
    expect(checklist).toMatch(/No other\s+Preview is created/);
  });

  it("keeps the required probes read-only and separates the production acceptance step", () => {
    expect(checklist).toMatch(/## 5b\. Production acceptance step \(owner-authorized/);
    expect(checklist).toMatch(/fixture data only/);
    expect(checklist).toMatch(/required probes[^.]*strictly read-only/);
  });

  it("forbids other Previews in CLAUDE.md", () => {
    expect(claude).toMatch(/Do not create Preview deployments either/);
    expect(claude).not.toMatch(/Preview deploy\w*[^.\n]{0,40}develop[^.\n]{0,20}\b(fine|ok|allowed|permitted)\b/i);
  });

  it("points CLAUDE.md at both rulings", () => {
    expect(claude).toMatch(/only permitted\s+Preview \(section 3\)/);
    expect(claude).toMatch(/acceptance step \(section 5b\)/);
  });
});
