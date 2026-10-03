import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures/base-test";
import { assertLocalDatastore } from "../scripts/release/probe-guards";

/**
 * Release artifact smoke — the production build of the exact release
 * candidate, served on loopback against a task-owned local Supabase stack.
 *
 * Replaces the Vercel Preview smoke as the required release-PR context
 * (`Release artifact smoke`, .github/workflows/preview-smoke.yml). It proves
 * the candidate's own production build boots, reports the candidate identity,
 * is healthy against a real database and hydrates. It makes no claim about
 * the Vercel runtime or live providers; those stay in the post-deploy probes
 * of docs/runbooks/release-checklist.md.
 *
 * Selected only by the `release-artifact-smoke` Playwright project.
 */

interface CandidateManifest {
  candidateSha: string;
  treeSha: string;
  buildId: string;
  files: { path: string; bytes: number; sha256: string }[];
}

// Fail closed, never skip: an unidentified candidate is a failed context.
async function candidate(): Promise<{ manifest: CandidateManifest; cronSecret: string }> {
  const manifestPath = process.env.RELEASE_ARTIFACT_MANIFEST?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!manifestPath || !cronSecret) {
    throw new Error(
      "RELEASE_ARTIFACT_MANIFEST and CRON_SECRET are required: the smoke cannot " +
        "verify a candidate whose build identity it was never given."
    );
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CandidateManifest;
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { encoding: "utf8" }).trim();
  expect(manifest.candidateSha, "manifest must name the checked-out candidate").toBe(git("rev-parse", "HEAD"));
  expect(manifest.treeSha, "manifest must name the checked-out tree").toBe(git("rev-parse", "HEAD^{tree}"));
  return { manifest, cronSecret };
}

test.beforeAll(() => {
  assertLocalDatastore(process.env.NEXT_PUBLIC_SUPABASE_URL);
});

test("production build reports the candidate identity and is healthy against the local datastore", async ({
  request,
}) => {
  const { manifest, cronSecret } = await candidate();

  const health = await request.get("/api/health", {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  expect(health.status()).toBe(200);
  const body = await health.json();
  expect(body.status).toBe("healthy");
  expect(body.build).toEqual({
    commit: manifest.candidateSha,
    tree: manifest.treeSha.slice(0, 12),
  });

  const database = await request.get("/api/health/db");
  expect(database.status()).toBe(200);
  const probe = await database.json();
  expect(probe.success).toBe(true);
  expect(probe.tablesAccessible).toBe(true);

  // Privileged surfaces stay closed to an anonymous caller.
  expect([401, 403]).toContain((await request.get("/api/admin/agent-reports")).status());
});

test("homepage redirects, serves the built client bundle byte-for-byte and hydrates", async ({
  page,
  request,
}) => {
  const { manifest } = await candidate();

  await page.goto("/");
  await page.waitForURL("**/immersive");

  const sources = await page
    .locator("script[src]")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("src") ?? ""));
  const built = (source: string) =>
    manifest.files.find((file) => file.path === `.next/${source.slice("/_next/".length)}`);
  const served = sources.find((source) => source.startsWith("/_next/static/") && built(source));
  expect(served, "the page must reference a client asset recorded in the build manifest").toBeTruthy();

  const asset = await request.get(served as string);
  expect(asset.status()).toBe(200);
  const bytes = await asset.body();
  const recorded = built(served as string);
  expect(bytes.length).toBe(recorded?.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(recorded?.sha256);

  // Same hydration oracle as the CSP canary in e2e/smoke.spec.ts.
  await page.goto("/favorites");
  await expect(
    page.getByRole("link", { name: /explore stories|explorar historias/i })
  ).toBeVisible({ timeout: 10_000 });
});
