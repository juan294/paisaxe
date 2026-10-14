import { spawnSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard for issue #239.
// Paisaxe intentionally stays single-region even though Vercel Pro now
// supports multiple regions, because the app depends on a single Supabase
// region and the extra complexity is not justified at current traffic.
describe("vercel.json", () => {
  const vercelConfig = JSON.parse(
    readFileSync(join(process.cwd(), "vercel.json"), "utf-8"),
  ) as { ignoreCommand?: unknown; regions?: unknown; crons?: Array<{ path: string; schedule: string }> };

  // PayPal hackathon plan, Phase 4: reconciliation is what resolves every
  // uncertain payment with nobody present, so it must stay scheduled.
  it("runs booking reconciliation every 5 minutes", () => {
    expect(vercelConfig.crons).toContainEqual({ path: "/api/cron/reconcile-bookings", schedule: "*/5 * * * *" });
  });

  // Vercel skips the build when ignoreCommand exits 0. Previews cost money and
  // nothing needs one (owner, 2026-10-06; `Release artifact smoke` replaced the
  // Preview smoke in main's required checks on 2026-10-07): only production builds.
  describe("ignoreCommand", () => {
    const decide = (env: Record<string, string>): "build" | "skip" => {
      const result = spawnSync("sh", ["-c", vercelConfig.ignoreCommand as string], {
        env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
      });
      return result.status === 0 ? "skip" : "build";
    };

    it("builds production", () => {
      expect(decide({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })).toBe("build");
    });


    it.each([
      ["the release PR from develop (Release artifact smoke replaced the Preview smoke)", { VERCEL_GIT_COMMIT_REF: "develop", VERCEL_GIT_PULL_REQUEST_ID: "1000" }],
      ["a direct develop push", { VERCEL_GIT_COMMIT_REF: "develop" }],
      ["a Dependabot PR", { VERCEL_GIT_COMMIT_REF: "dependabot/npm_and_yarn/develop/stripe-23.0.0", VERCEL_GIT_PULL_REQUEST_ID: "993" }],
      ["a feature PR", { VERCEL_GIT_COMMIT_REF: "feature/x", VERCEL_GIT_PULL_REQUEST_ID: "12" }],
      ["a feature branch push", { VERCEL_GIT_COMMIT_REF: "feature/x" }],
    ])("skips %s", (_name, env) => {
      expect(decide({ VERCEL_ENV: "preview", ...env })).toBe("skip");
    });
  });

  it("declares exactly one region", () => {
    expect(Array.isArray(vercelConfig.regions)).toBe(true);
    expect(vercelConfig.regions as unknown[]).toHaveLength(1);
  });

  it("uses fra1 (Frankfurt) — closest supported Vercel region to Supabase Zurich", () => {
    expect(vercelConfig.regions).toEqual(["fra1"]);
  });
});
