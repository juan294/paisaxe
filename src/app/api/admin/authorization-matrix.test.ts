import { requiredValue } from "@/test/required-value";
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { invalidateRoleCache, validateAdminAuth } from "@/lib/admin-auth";

const boundary = vi.hoisted(() => ({
  getUser: vi.fn(), profile: vi.fn(), operation: vi.fn(), constructAdmin: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({getAll: () => [], set: vi.fn()})) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({
  auth: { getUser: boundary.getUser },
  from: () => ({select: () => ({eq: () => ({single: boundary.profile})})}),
})) }));
// Third-party SDK construction is the boundary. Rejected requests must never
// construct a service-role client or reach a database/provider operation.
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => {
  boundary.constructAdmin(...args);
  return {from: boundary.operation, rpc: boundary.operation, auth: {admin: {getUserById: boundary.operation}}};
} }));
vi.mock("@/lib/logger", () => ({logger: {error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn()}}));

type Route = Record<string, (request: NextRequest, context: {params: Promise<{id: string; key: string}>}) => Promise<Response>>;
const routes = [
  "agents/run",
  "tunnel",
  "agent-config",
  "agent-reports",
  "agents-summary",
  "analytics",
  "costs-analytics/[id]",
  "costs-analytics",
  "elevenlabs-analytics",
  "feature-flags/[key]",
  "marketing/agent",
  "marketing/dashboard",
  "marketing/posts",
  "marketing/schedule",
  "stories/[id]/content-images",
  "stories/[id]/image",
  "stories/[id]/image-source",
  "stories/[id]/image-review",
  "stories/[id]",
  "stories/[id]/status",
  "stories/[id]/translations",
  "stories/approve-all",
  "stories/bulk-delete",
  "stories/bulk-status",
  "stripe-analytics",
  "suggestions/[id]",
  "suggestions",
  "voice-session"
];
const modules = import.meta.glob("./**/route.ts") as Record<string, () => Promise<Route>>;
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const userId = "phase10-admin-matrix";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("SUPABASE_SERVICE_KEY", "synthetic-service-key");
  invalidateRoleCache(userId);
  boundary.getUser.mockResolvedValue({data: {user: {id: userId}}, error: null});
  boundary.profile.mockResolvedValue({data: {role: "admin"}, error: null});
  boundary.operation.mockImplementation(() => { throw new Error("Rejected request reached protected operation"); });
});

for (const route of routes) {
  describe(route, async () => {
    const load = requiredValue(modules[`./${route}/route.ts`], "src/app/api/admin/authorization-matrix.test.ts:70 modules[`./${route}/route.ts`]");
    const handlers = await load();
    for (const method of methods.filter(method => typeof handlers[method] === "function")) {
      function invoke() {
        return requiredValue(handlers[method], "src/app/api/admin/authorization-matrix.test.ts:73 handlers[method]")(new NextRequest(`http://localhost/api/admin/${route}`, {
          method, headers: {"x-request-id": "phase10-matrix"},
          ...(!["GET", "HEAD"].includes(method) ? {body: "{}"} : {}),
        }), {params: Promise.resolve({id: "550e8400-e29b-41d4-a716-446655440000", key: "voice_enabled"})});
      }
      for (const [state, status, message] of [
        ["anonymous", 401, "Authentication required"],
        ["nonadmin", 403, "Admin access required"],
        ["profile failure", 500, "Authentication failed"],
        ["auth exception", 500, "Authentication failed"],
      ] as const) {
        it(`${method}: ${state} rejects before any protected side effect`, async () => {
          if (state === "anonymous") boundary.getUser.mockResolvedValue({data: {user: null}, error: null});
          if (state === "nonadmin") boundary.profile.mockResolvedValue({data: {role: "member"}, error: null});
          if (state === "profile failure") boundary.profile.mockResolvedValue({data: null, error: {code: "XX000", message: "unavailable"}});
          if (state === "auth exception") boundary.getUser.mockRejectedValue(new Error("unavailable"));
          const response = await invoke();
          expect(response.status).toBe(status);
          expect(await response.json()).toEqual({error: message});
          expect(boundary.constructAdmin).not.toHaveBeenCalled();
          expect(boundary.operation).not.toHaveBeenCalled();
        });
      }
      if (!["GET", "HEAD"].includes(method)) {
        it(`${method}: revocation blocks the next mutation despite a warm admin role`, async () => {
          expect(await validateAdminAuth()).toEqual({valid: true, userId});
          boundary.profile.mockResolvedValue({data: {role: "member"}, error: null});
          const response = await invoke();
          expect(response.status).toBe(403);
          expect(await response.json()).toEqual({error: "Admin access required"});
          expect(boundary.profile).toHaveBeenCalledTimes(2);
          expect(boundary.constructAdmin).not.toHaveBeenCalled();
          expect(boundary.operation).not.toHaveBeenCalled();
        });
      }
    }
  });
}

describe("authorized boundary preserves client and body semantics", () => {
  it("malformed database mutation keeps its original400 envelope", async () => {
    const { PUT } = await import("./feature-flags/[key]/route");
    const response = await PUT(new NextRequest("http://localhost/api/admin/feature-flags/voice_enabled", {method: "PUT", body: "{}"}), {params: Promise.resolve({key: "voice_enabled"})});
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: "Must provide enabled (boolean) or config (object)"});
    expect(boundary.constructAdmin).not.toHaveBeenCalled();
    expect(boundary.operation).not.toHaveBeenCalled();
  });

  it("service client construction failure retains the route500 envelope", async () => {
    boundary.constructAdmin.mockImplementationOnce(() => {throw new Error("Client unavailable");});
    const { PUT } = await import("./feature-flags/[key]/route");
    const response = await PUT(new NextRequest("http://localhost/api/admin/feature-flags/voice_enabled", {method: "PUT", body: '{"enabled":true}'}), {params: Promise.resolve({key: "voice_enabled"})});
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: "Internal server error"});
    expect(boundary.operation).not.toHaveBeenCalled();
  });

  it("provider-only malformed input needs no service key and never calls the provider", async () => {
    vi.stubEnv("SUPABASE_SERVICE_KEY", undefined);
    const fetchBoundary = vi.spyOn(globalThis, "fetch");
    try {
      const { POST } = await import("./voice-session/route");
      const response = await POST(new NextRequest("http://localhost/api/admin/voice-session", {method: "POST", body: "{}"}));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({error: "Invalid agent"});
      expect(boundary.constructAdmin).not.toHaveBeenCalled();
      expect(fetchBoundary).not.toHaveBeenCalled();
    } finally { fetchBoundary.mockRestore(); }
  });
});
