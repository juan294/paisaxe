/**
 * SE-H1 / BE-M9 (#841, #790) regression check: migration 101 revokes anon
 * column-level SELECT on feature_flags.config, but must NOT touch anon's
 * access to feature_flags.enabled — src/lib/proxy/maintenance.ts reads
 * `enabled` for the maintenance_mode flag over PostgREST with the anon key on
 * the maintenance-mode hot path, and silently treats any failure as
 * maintenance-mode-off (fail open, no error surfaced).
 *
 * This test exercises the REAL `isMaintenanceModeEnabled()` function (no
 * fetch mocking) against the live local Supabase stack, so the exact query
 * maintenance.ts issues is verified end to end, not just assumed to still
 * work. It requires a local Supabase Docker stack (`supabase start`) and is
 * skipped automatically when one isn't reachable, matching
 * route.postgrest-rls.test.ts.
 *
 * Deliberately a separate file from maintenance.test.ts, which globally mocks
 * `global.fetch` — this suite must NOT mock fetch, since the entire point is
 * to hit the real PostgREST endpoint.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_ANON_KEY as ANON_KEY,
  LOCAL_API_URL,
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("maintenance.postgrest-integration.test.ts");
}

describe.skipIf(!dbReachable)(
  "SE-H1/BE-M9 regression: isMaintenanceModeEnabled() against live local Supabase",
  () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = {
        ...originalEnv,
        NODE_ENV: "test", // isDev branch: no in-memory caching between assertions
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
        MAINTENANCE_MODE: undefined,
      };
      delete process.env.MAINTENANCE_MODE;
    });

    afterAll(() => {
      process.env = originalEnv;
      psql(
        "UPDATE public.feature_flags SET enabled = false " +
          "WHERE flag_key = 'maintenance_mode' AND environment = 'development';"
      );
    });

    it("returns true when maintenance_mode.enabled is true in the database", async () => {
      psql(
        "UPDATE public.feature_flags SET enabled = true " +
          "WHERE flag_key = 'maintenance_mode' AND environment = 'development';"
      );

      vi.doMock("@/lib/environment", () => ({ getEnvironment: () => "development" }));
      const { isMaintenanceModeEnabled, resetMaintenanceModeCache } = await import(
        "./maintenance"
      );
      resetMaintenanceModeCache();

      await expect(isMaintenanceModeEnabled()).resolves.toBe(true);
    });

    it("returns false when maintenance_mode.enabled is false in the database", async () => {
      psql(
        "UPDATE public.feature_flags SET enabled = false " +
          "WHERE flag_key = 'maintenance_mode' AND environment = 'development';"
      );

      vi.doMock("@/lib/environment", () => ({ getEnvironment: () => "development" }));
      const { isMaintenanceModeEnabled, resetMaintenanceModeCache } = await import(
        "./maintenance"
      );
      resetMaintenanceModeCache();

      await expect(isMaintenanceModeEnabled()).resolves.toBe(false);
    });
  }
);
