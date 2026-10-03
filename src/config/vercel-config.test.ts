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

  it("builds production and pull-request deployments while ignoring ordinary previews", () => {
    expect(vercelConfig.ignoreCommand).toBe(
      'test "$VERCEL_ENV" != "production" && test -z "$VERCEL_GIT_PULL_REQUEST_ID"',
    );
  });

  it("declares exactly one region", () => {
    expect(Array.isArray(vercelConfig.regions)).toBe(true);
    expect(vercelConfig.regions as unknown[]).toHaveLength(1);
  });

  it("uses fra1 (Frankfurt) — closest supported Vercel region to Supabase Zurich", () => {
    expect(vercelConfig.regions).toEqual(["fra1"]);
  });
});
