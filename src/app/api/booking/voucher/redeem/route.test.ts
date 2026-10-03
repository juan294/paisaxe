// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";
import { hashVoucherCode } from "@/lib/booking/vouchers";

const deps = vi.hoisted(() => ({
  flagOn: true,
  user: { id: "user-1" } as { id: string } | null,
  admin: null as unknown,
  allowed: true,
}));

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/lib/feature-flags-server", () => ({
  isFeatureFlagEnabled: vi.fn(async (key: string) => key === "experience_booking" && deps.flagOn),
}));
vi.mock("@/lib/supabase-auth", () => ({
  getUserFromRequest: vi.fn(async () => deps.user),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(() => deps.admin),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: deps.allowed,
    limit: 10,
    remaining: deps.allowed ? 9 : 0,
    resetAt: Date.now() + 60_000,
    retryAfter: 60,
  })),
}));

const { POST } = await import("./route");
const { checkRateLimit } = await import("@/lib/rate-limit");

const CODE = "ITCODE2026";

function redeem(body: unknown = { code: CODE }) {
  return POST(
    new NextRequest("http://localhost/api/booking/voucher/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify(body),
    })
  );
}

const okRow = (overrides: Record<string, unknown> = {}) => ({
  status: "new",
  redemption_id: "r1",
  voice_pass: "granted",
  voice_pass_until: "2026-12-02T10:00:00+00:00",
  chat_turns_used: 0,
  chat_turns_limit: 60,
  booking_attempts_used: 0,
  booking_attempts_limit: 10,
  ...overrides,
});

let fake: BookingSupabaseFake;

beforeEach(() => {
  deps.flagOn = true;
  deps.user = { id: "user-1" };
  deps.allowed = true;
  fake = createBookingSupabaseFake();
  deps.admin = fake.client;
  vi.stubEnv("VERCEL_ENV", "production");
  logger.error.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("POST /api/booking/voucher/redeem", () => {
  it("is 404 with the flag off", async () => {
    deps.flagOn = false;
    expect((await redeem()).status).toBe(404);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("is 404 on a Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await redeem()).status).toBe(404);
  });

  it("is 429 when the per-IP limit is spent, keyed on the client IP", async () => {
    deps.allowed = false;
    const response = await redeem();
    expect(response.status).toBe(429);
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      "voucher-redeem:203.0.113.7",
      expect.objectContaining({ maxRequests: 10 })
    );
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("is 401 anon_required without a user", async () => {
    deps.user = null;
    const response = await redeem();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "anon_required" });
  });

  it.each([
    ["an unknown code", { status: "invalid" }, "invalid"],
    ["an expired voucher", { status: "expired" }, "expired"],
    ["a voucher at its cap", { status: "exhausted" }, "exhausted"],
  ])("is 403 for %s with the reason", async (_label, row, reason) => {
    fake.onRpc("redeem_voucher", { data: row });
    const response = await redeem();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason });
  });

  it("is 403 invalid for a malformed body without calling the database", async () => {
    const response = await redeem({ nope: true });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: "invalid" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("redeems: returns ok, the pass expiry and the limits snapshot", async () => {
    fake.onRpc("redeem_voucher", { data: okRow() });

    const response = await redeem({ code: " itcode2026 " });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      voicePassUntil: "2026-12-02T10:00:00.000Z",
      limits: { chatTurns: { used: 0, limit: 60 }, bookingAttempts: { used: 0, limit: 10 } },
    });
    expect(fake.rpc).toHaveBeenCalledWith(
      "redeem_voucher",
      expect.objectContaining({ p_code_hash: hashVoucherCode(CODE), p_user_id: "user-1" })
    );
  });

  it("serves a returning user at the cap (existing redemption) as ok", async () => {
    fake.onRpc("redeem_voucher", { data: okRow({ status: "existing", voice_pass: "duplicate", chat_turns_used: 12 }) });
    const response = await redeem();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, limits: { chatTurns: { used: 12 } } });
  });

  it("asks for a fresh 24-hour pass from the current clock, so re-redeeming after 24 hours renews it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (const now of ["2026-12-01T10:00:00.000Z", "2026-12-02T11:00:00.000Z", "2026-12-14T09:00:00.000Z"]) {
      vi.setSystemTime(new Date(now));
      fake.onRpc("redeem_voucher", { data: okRow() });
      await redeem();
      expect(fake.rpc).toHaveBeenLastCalledWith(
        "redeem_voucher",
        expect.objectContaining({
          p_now: now,
          p_pass_until: new Date(new Date(now).getTime() + 24 * 3_600_000).toISOString(),
        })
      );
    }
  });

  it("is 500 and logs [VOUCHER_GRANT_FAILED] when the RPC fails, without the code", async () => {
    fake.onRpc("redeem_voucher", { error: { message: "violates foreign key", code: "23503" } });

    const response = await redeem();

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[VOUCHER_GRANT_FAILED]", expect.objectContaining({ userId: "user-1" }));
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(CODE);
  });
});
