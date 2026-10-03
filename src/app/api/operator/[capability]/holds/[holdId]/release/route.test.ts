// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY, capabilityRouteState, routeRequest } from "@/test/booking-capability-route";
import type { OperatorAccess } from "@/lib/booking/links";

const state = vi.hoisted(() => ({ access: null as unknown }));

vi.mock("@/lib/booking/links", async () => {
  const { CAPABILITY: valid } = await import("@/test/booking-capability-route");
  return {
    bookingLink: vi.fn(),
    verifyOperatorCapability: vi.fn(async (_client: unknown, capability: string) => (capability === valid ? state.access : null)),
  };
});
vi.mock("@/lib/rate-limit", async () => (await import("@/test/booking-capability-route")).rateLimitMock());
vi.mock("@/lib/supabase-admin", async () => (await import("@/test/booking-capability-route")).adminMock());
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/booking/operator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/booking/operator")>()),
  releaseOperatorHold: vi.fn(),
}));

const { POST } = await import("./route");
const { releaseOperatorHold } = await import("@/lib/booking/operator");
const { verifyOperatorCapability } = await import("@/lib/booking/links");
const { logger } = await import("@/lib/logger");

const HOLD = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TOKEN = CAPABILITY.split(".")[1];
const access: OperatorAccess = {
  id: "11111111-2222-4333-8444-555555555555",
  merchantId: "m1",
  label: "Operador demo",
  linkVersion: 1,
  expiresAt: "2099-01-01T00:00:00Z",
};

const release = (capability = CAPABILITY, holdId = HOLD) =>
  POST(routeRequest(`/api/operator/${capability}/holds/${holdId}/release`, { method: "POST" }), {
    params: Promise.resolve({ capability, holdId }),
  });

function logged(): string {
  return JSON.stringify([vi.mocked(logger.info).mock.calls, vi.mocked(logger.error).mock.calls]);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.access = access;
  capabilityRouteState.allowed = true;
});

describe("POST /api/operator/[capability]/holds/[holdId]/release", () => {
  it("releases the merchant's live hold and logs the hold id only", async () => {
    vi.mocked(releaseOperatorHold).mockResolvedValue("released");

    const response = await release();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ released: true });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(releaseOperatorHold).toHaveBeenCalledWith(capabilityRouteState.admin, "m1", HOLD);
    expect(logger.info).toHaveBeenCalledWith("[OPERATOR_HOLD_RELEASED]", { holdId: HOLD });
    expect(logged()).not.toContain(TOKEN);
  });

  it("answers 409 for a hold that is expired, consumed or already released", async () => {
    vi.mocked(releaseOperatorHold).mockResolvedValue("not_live");

    const response = await release();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "hold_not_live" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("404s another merchant's or an unknown hold", async () => {
    vi.mocked(releaseOperatorHold).mockResolvedValue("not_found");

    const response = await release();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("404s a capability that does not verify without touching the hold", async () => {
    expect((await release("x.y")).status).toBe(404);
    expect(releaseOperatorHold).not.toHaveBeenCalled();
  });

  it("429s over the per-IP limit before reading the capability", async () => {
    capabilityRouteState.allowed = false;

    expect((await release()).status).toBe(429);
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
    expect(releaseOperatorHold).not.toHaveBeenCalled();
  });

  it("500s on a database error, logging the hold id and never the capability", async () => {
    vi.mocked(releaseOperatorHold).mockRejectedValue(new Error("db down"));

    const response = await release();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(logger.error).toHaveBeenCalledWith("[OPERATOR_HOLD_RELEASE_FAILED]", { holdId: HOLD, error: "db down" });
    expect(logged()).not.toContain(TOKEN);
  });
});
