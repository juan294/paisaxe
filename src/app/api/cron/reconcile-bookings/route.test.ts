// @vitest-environment node
/**
 * Auth, lease and status mapping of the reconciliation cron. The work itself
 * runs against the live local stack in
 * src/lib/booking/reconcile.postgrest-integration.test.ts (including the real
 * lease preventing an overlapping run).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ validateAdminAuth: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ verifyVercelCron: vi.fn(), verifyWebhookSecret: vi.fn() }));
vi.mock("@/lib/csrf", () => ({ validateCsrfForAdminFallback: vi.fn() }));
vi.mock("@/lib/booking/reconcile", () => ({ reconcileBookings: vi.fn() }));

import { GET, POST } from "./route";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { validateCsrfForAdminFallback } from "@/lib/csrf";
import { reconcileBookings, type ReconcileSummary } from "@/lib/booking/reconcile";

const URL = "http://localhost/api/cron/reconcile-bookings";
const rpc = vi.fn();
const client = { rpc };

function summary(overrides: Partial<ReconcileSummary> = {}): ReconcileSummary {
  return {
    expiredHolds: 0,
    abandonedDrafts: 0,
    eventsReplayed: 0,
    eventsUnmatched: 0,
    confirmed: 0,
    expired: 0,
    stillPending: 0,
    flaggedForAttention: 0,
    refundsRequested: 0,
    refunded: 0,
    refundFailed: 0,
    staleAttention: 0,
    invoicesCancelled: 0,
    errors: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
  rpc.mockImplementation((fn: string) =>
    Promise.resolve(fn === "try_acquire_cron_job_lock" ? { data: "lease-token", error: null } : { data: true, error: null })
  );
  vi.mocked(reconcileBookings).mockResolvedValue(summary({ confirmed: 2 }));
});

describe("GET /api/cron/reconcile-bookings", () => {
  it("answers 401 without the Vercel cron secret and does no work", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(false);

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(401);
    expect(reconcileBookings).not.toHaveBeenCalled();
  });

  it("takes the lease, reconciles, logs [CRON_SUCCESS] with the counts and releases the lease", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", confirmed: 2 });
    expect(rpc).toHaveBeenCalledWith("try_acquire_cron_job_lock", { p_lock_key: "reconcile-bookings", p_lease_seconds: expect.any(Number) });
    expect(reconcileBookings).toHaveBeenCalledWith(client);
    expect(logger.info).toHaveBeenCalledWith("[CRON_SUCCESS]", expect.objectContaining({ job: "reconcile-bookings", confirmed: 2 }));
    expect(rpc).toHaveBeenCalledWith("release_cron_job_lock", { p_lock_key: "reconcile-bookings", p_lock_token: "lease-token" });
  });

  it("skips with 409 while another run holds the lease", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    rpc.mockResolvedValue({ data: null, error: null });

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(409);
    expect(reconcileBookings).not.toHaveBeenCalled();
  });

  it("answers 500 with [CRON_FAILURE] when the lease cannot be read", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(500);
    expect(reconcileBookings).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[CRON_FAILURE]", expect.objectContaining({ job: "reconcile-bookings" }));
  });

  it("answers 500 with [CRON_FAILURE] when reconciliation throws (PayPal unreachable), and still releases the lease", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    vi.mocked(reconcileBookings).mockRejectedValue(new Error("PayPal getOrder could not be reached"));

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[CRON_FAILURE]", expect.objectContaining({ job: "reconcile-bookings", error: "PayPal getOrder could not be reached" }));
    expect(rpc).toHaveBeenCalledWith("release_cron_job_lock", expect.anything());
  });

  it("answers 500 with [CRON_FAILURE] when any item failed", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    vi.mocked(reconcileBookings).mockResolvedValue(summary({ errors: 1, confirmed: 1 }));

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ errors: 1, confirmed: 1 });
    expect(logger.error).toHaveBeenCalledWith("[CRON_FAILURE]", expect.objectContaining({ job: "reconcile-bookings", errors: 1 }));
    expect(logger.info).not.toHaveBeenCalledWith("[CRON_SUCCESS]", expect.anything());
  });
});

describe("POST /api/cron/reconcile-bookings", () => {
  it("runs with the webhook secret", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(true);

    const response = await POST(new NextRequest(URL, { method: "POST" }));

    expect(response.status).toBe(200);
    expect(validateAdminAuth).not.toHaveBeenCalled();
  });

  it("returns the admin auth error without the secret or a session", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as unknown as Awaited<ReturnType<typeof validateAdminAuth>>);

    const response = await POST(new NextRequest(URL, { method: "POST" }));

    expect(response.status).toBe(401);
    expect(reconcileBookings).not.toHaveBeenCalled();
  });

  it("requires CSRF on the admin-session fallback", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true } as unknown as Awaited<ReturnType<typeof validateAdminAuth>>);
    vi.mocked(validateCsrfForAdminFallback).mockReturnValue(false);

    const response = await POST(new NextRequest(URL, { method: "POST" }));

    expect(response.status).toBe(403);
    expect(reconcileBookings).not.toHaveBeenCalled();
  });

  it("runs on the admin-session fallback with a valid CSRF token, and logs the fallback", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true } as unknown as Awaited<ReturnType<typeof validateAdminAuth>>);
    vi.mocked(validateCsrfForAdminFallback).mockReturnValue(true);

    const response = await POST(new NextRequest(URL, { method: "POST" }));

    expect(response.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith("[CRON_AUTH_FALLBACK]", expect.anything());
  });
});
