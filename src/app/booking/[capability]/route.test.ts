// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ preview: false, booking: null as unknown }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock("@/lib/booking/surface", () => ({ isPreviewDeployment: vi.fn(() => deps.preview) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn(() => ({ admin: true })) }));
vi.mock("@/lib/booking/links", () => ({ verifyBookingCapability: vi.fn(async () => deps.booking) }));

const { GET } = await import("./route");
const { verifyBookingCapability } = await import("@/lib/booking/links");

const CAPABILITY = "11111111-2222-4333-8444-555555555555.tok";
const get = () =>
  GET(new NextRequest(`http://localhost/booking/${CAPABILITY}`), { params: Promise.resolve({ capability: CAPABILITY }) });

beforeEach(() => {
  vi.clearAllMocks();
  deps.preview = false;
  deps.booking = {
    id: "11111111-2222-4333-8444-555555555555",
    reference: "RS-ABC123",
    status: "pending_payment",
    slotDate: "2026-11-21",
    slotTime: "10:00",
    partySize: 4,
    totalCents: 12000,
    depositCents: 3000,
    balanceCents: 9000,
    currency: "EUR",
    userId: "user-1",
    linkVersion: 1,
  };
});

describe("GET /booking/[capability] (placeholder until Phase 4)", () => {
  it("returns the booking the capability opens, without user or link internals", async () => {
    const response = await get();

    expect(verifyBookingCapability).toHaveBeenCalledWith({ admin: true }, CAPABILITY);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reference: "RS-ABC123",
      status: "pending_payment",
      date: "2026-11-21",
      time: "10:00",
      partySize: 4,
      totalCents: 12000,
      depositCents: 3000,
      balanceCents: 9000,
      currency: "EUR",
    });
  });

  it("sets the capability-route headers (F05)", async () => {
    const response = await get();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("is 404 for an invalid capability", async () => {
    deps.booking = null;
    expect((await get()).status).toBe(404);
  });

  it("is 404 on a Preview deployment, without reading the database", async () => {
    deps.preview = true;
    expect((await get()).status).toBe(404);
    expect(verifyBookingCapability).not.toHaveBeenCalled();
  });
});
