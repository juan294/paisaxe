// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ result: null as unknown }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock("@/lib/booking/gate", () => ({
  requireBookingAccess: vi.fn(async () => gate.result),
}));

const { GET } = await import("./route");

const request = () => new NextRequest("http://localhost/api/booking/access");

describe("GET /api/booking/access", () => {
  it("reports active access with the remaining limits", async () => {
    const limits = { chatTurns: { used: 2, limit: 60 }, bookingAttempts: { used: 0, limit: 10 } };
    gate.result = { userId: "user-1", redemption: { id: "r1", voucherId: "v1", limits } };

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: true, limits });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("passes the gate's 404 through unchanged", async () => {
    gate.result = NextResponse.json({ error: "Not found" }, { status: 404 });
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
