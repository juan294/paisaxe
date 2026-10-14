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

describe("standing release rulings (no Vercel Previews; ADR-0024 decision 12)", () => {
  const checklist = read("docs/runbooks/release-checklist.md");
  const claude = read("CLAUDE.md");

  it("documents that no Vercel Preview is built and the release-PR exception is retired (2026-10-07)", () => {
    expect(checklist).toMatch(/No Vercel Previews/);
    expect(checklist).toMatch(/builds production only/);
    expect(checklist).toMatch(/exception of 2026-10-02 \(ADR-0024 decision 11\) is retired/);
    expect(checklist).toMatch(/Required contexts: `Lint & Typecheck`, `Test`, `Build`, `Playwright E2E`,\s+`Release artifact smoke`/);
  });

  it("keeps the required probes read-only and separates the production acceptance step", () => {
    expect(checklist).toMatch(/## 5b\. Production acceptance step \(owner-authorized/);
    expect(checklist).toMatch(/fixture data only/);
    expect(checklist).toMatch(/required probes[^.]*strictly read-only/);
  });

  it("forbids every Preview in CLAUDE.md", () => {
    expect(claude).toMatch(/Never create Preview deployments/);
    expect(claude).not.toMatch(/Preview deploy\w*[^.\n]{0,40}develop[^.\n]{0,20}\b(fine|ok|allowed|permitted)\b/i);
  });

  it("points CLAUDE.md at both rulings", () => {
    expect(claude).toMatch(/no Vercel Preview is ever built \(section 3;/);
    expect(claude).toMatch(/acceptance step\s+\(section 5b\)/);
  });
});
