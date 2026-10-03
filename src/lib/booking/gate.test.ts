// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

const deps = vi.hoisted(() => ({
  flagOn: true,
  user: { id: "user-1" } as { id: string } | null,
  admin: null as unknown,
}));

vi.mock("@/lib/feature-flags-server", () => ({
  isFeatureFlagEnabled: vi.fn(async (key: string) => key === "experience_booking" && deps.flagOn),
}));
vi.mock("@/lib/supabase-auth", () => ({
  getUserFromRequest: vi.fn(async () => deps.user),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(() => deps.admin),
}));

const { requireBookingAccess, requireBookingSurface } = await import("./gate");
const { isPreviewDeployment } = await import("./surface");

const NOW = new Date("2026-12-01T10:00:00Z");
const request = () => new NextRequest("http://localhost/api/booking/chat/stream", { method: "POST" });
const redemptionRow = {
  id: "r1",
  voucher_id: "v1",
  chat_turns_used: 2,
  booking_attempts_used: 0,
  vouchers: { chat_turns_limit: 60, booking_attempts_limit: 10 },
};

let fake: BookingSupabaseFake;

beforeEach(() => {
  deps.flagOn = true;
  deps.user = { id: "user-1" };
  fake = createBookingSupabaseFake();
  deps.admin = fake.client;
  vi.stubEnv("VERCEL_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function expectNotFound(result: unknown) {
  expect(result).toBeInstanceOf(NextResponse);
  expect((result as NextResponse).status).toBe(404);
}

describe("requireBookingSurface", () => {
  it("is open with the flag on outside a Preview", async () => {
    expect(await requireBookingSurface()).toBeNull();
  });

  it("is 404 with the flag off", async () => {
    deps.flagOn = false;
    await expectNotFound(await requireBookingSurface());
  });

  it("is 404 on a Preview even with the flag on (production flags and data)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expectNotFound(await requireBookingSurface());
  });
});

describe("requireBookingAccess (F10)", () => {
  it("returns the user and the active redemption", async () => {
    const query = fake.onTable("voucher_redemptions", { data: redemptionRow });

    const result = await requireBookingAccess(request(), NOW);

    expect(result).toEqual({
      userId: "user-1",
      redemption: {
        id: "r1",
        voucherId: "v1",
        limits: { chatTurns: { used: 2, limit: 60 }, bookingAttempts: { used: 0, limit: 10 } },
      },
    });
    expect(query.gt).toHaveBeenCalledWith("vouchers.expires_at", NOW.toISOString());
  });

  it("is 404 with the flag off, even with a valid redemption", async () => {
    deps.flagOn = false;
    fake.onTable("voucher_redemptions", { data: redemptionRow });
    await expectNotFound(await requireBookingAccess(request(), NOW));
  });

  it("is 404 on a Preview, even with a valid redemption", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    fake.onTable("voucher_redemptions", { data: redemptionRow });
    await expectNotFound(await requireBookingAccess(request(), NOW));
  });

  it("is 404 without a user", async () => {
    deps.user = null;
    fake.onTable("voucher_redemptions", { data: redemptionRow });
    await expectNotFound(await requireBookingAccess(request(), NOW));
  });

  it("is 404 without a redemption of an unexpired, unrevoked voucher", async () => {
    fake.onTable("voucher_redemptions", { data: null });
    await expectNotFound(await requireBookingAccess(request(), NOW));
  });
});

describe("isPreviewDeployment", () => {
  it("is true only for VERCEL_ENV=preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isPreviewDeployment()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isPreviewDeployment()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "");
    expect(isPreviewDeployment()).toBe(false);
  });
});
