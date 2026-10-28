import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { NOTHING_LEFT, requireLocalBookingEnv } from "./fixtures/booking-local";

/** Route integration with actual local Supabase and synthetic SDK HTTP.
 * The subprocess supplies server-only/Next request stores. It never calls a live model.
 * The existing full browser booking-roundtrip separately covers the visitor UI/proxy.
 */
test("@local-docker booking intake: thirty complete route scenarios in three arms, fallback and cancellation recovery", async ({}, testInfo) => {
  test.setTimeout(600_000);
  requireLocalBookingEnv();
  expect(process.env.SUPABASE_LOCAL_DB_MARKER, "task-owned database marker").toMatch(/^paisaxe-contracts:/);
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(process.env.SUPABASE_LOCAL_API_URL);
  const result = await promisify(execFile)(process.execPath, ["--import", "tsx", "--conditions=react-server", "e2e/fixtures/jev-booking-driver.ts"], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" }, timeout: 570_000, maxBuffer: 16 * 1024 * 1024,
  });
  const marker = result.stdout.split("\n").find(line => line.startsWith("JEV_BOOKING_RESULT "));
  expect(marker, "driver must publish its saved evidence path").toBeTruthy();
  const summary = JSON.parse(marker!.slice("JEV_BOOKING_RESULT ".length));
  await testInfo.attach("local-route-comparison", { body: readFileSync(summary.reportPath), contentType: "application/json" });
  expect(summary.complete).toBe(true);
  expect(summary.completedArms).toBe(90);
  expect(summary.cleanup).toEqual(NOTHING_LEFT);
});
