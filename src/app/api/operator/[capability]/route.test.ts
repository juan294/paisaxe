// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY, capabilityParams, capabilityRouteState, routeRequest } from "@/test/booking-capability-route";
import type { OperatorAccess } from "@/lib/booking/links";
import type { OperatorView } from "@/lib/booking/operator";

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
  loadOperatorView: vi.fn(),
}));

const { GET } = await import("./route");
const { loadOperatorView } = await import("@/lib/booking/operator");
const { verifyOperatorCapability } = await import("@/lib/booking/links");
const { logger } = await import("@/lib/logger");

const access: OperatorAccess = {
  id: "11111111-2222-4333-8444-555555555555",
  merchantId: "m1",
  label: "Operador demo",
  linkVersion: 1,
  expiresAt: "2099-01-01T00:00:00Z",
};
const view = { merchant: { name: "Rutas del Sella (demo, ficticio)", isFixture: true }, bookings: [] } as unknown as OperatorView;
const get = (capability = CAPABILITY) => GET(routeRequest(`/api/operator/${capability}`), capabilityParams(capability));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  state.access = access;
  capabilityRouteState.allowed = true;
  vi.mocked(loadOperatorView).mockResolvedValue(view);
});

describe("GET /api/operator/[capability]", () => {
  it("returns the merchant's view with the capability headers", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(view);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(loadOperatorView).toHaveBeenCalledWith(capabilityRouteState.admin, access);
  });

  it("404s a capability that does not verify (bad, unknown or expired), with no data", async () => {
    const response = await get("x.y");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(loadOperatorView).not.toHaveBeenCalled();
  });

  it("404s every operator link on a Preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    expect((await get()).status).toBe(404);
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
  });

  it("429s over the per-IP limit before reading the capability", async () => {
    capabilityRouteState.allowed = false;

    const response = await get();

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
  });

  it("500s when the view cannot load, logging without the capability", async () => {
    vi.mocked(loadOperatorView).mockRejectedValue(new Error("db down"));

    const response = await get();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(logger.error).toHaveBeenCalledWith("[OPERATOR_VIEW_FAILED]", { error: "db down" });
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(CAPABILITY.split(".")[1]);
  });
});
