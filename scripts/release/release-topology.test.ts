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
