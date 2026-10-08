import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const external = vi.hoisted(() => ({ stripeCreate: vi.fn() }));
vi.mock("stripe", () => ({ default: class Stripe { checkout = { sessions: { create: external.stripeCreate } }; } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
import * as favorites from "@/app/api/favorites/route";
import * as voiceAccess from "@/app/api/voice-access/route";
import * as suggestions from "@/app/api/suggestions/route";
import * as checkout from "@/app/api/checkout/embedded/route";
import * as saveFavorite from "@/app/api/mcp/save-favorite/route";
import * as weather from "@/app/api/mcp/weather/route";
import * as places from "@/app/api/mcp/places/route";
import { getRateLimitStore, resetRateLimit } from "./rate-limit";

const validToken = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"route-user","exp":4102444800}').toString("base64url")}.fixture`;
const storyId = "00000000-0000-4000-8000-000000000001";
const transport = vi.fn();
let now: number;
function request(path: string, method: string, body?: object, auth = true, ip = "2001:db8:1:2::1") {
  return new NextRequest(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": ip, ...(auth ? { Authorization: `Bearer ${validToken}`, "x-mcp-secret": "fixture-secret" } : { Authorization: "Bearer invalid" }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function sideEffects() { return transport.mock.calls.filter(([url]) => String(url).includes("/rest/")).length + external.stripeCreate.mock.calls.length; }

beforeEach(() => {
  now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.fixture");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "fixture-service");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_fixture");
  vi.stubEnv("MCP_API_SECRET", "fixture-secret");
  vi.stubEnv("OPENWEATHERMAP_API_KEY", "fixture-weather");
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "fixture-places");
  resetRateLimit(); transport.mockReset(); external.stripeCreate.mockReset();
  external.stripeCreate.mockResolvedValue({ client_secret: "fixture-client-secret" });
  transport.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const headers = new Headers(init?.headers);
    if (url.includes("/auth/v1/user")) return headers.get("authorization") === `Bearer ${validToken}` ? Response.json({ id: "route-user", aud: "authenticated", email: "fixture@example.test" }) : Response.json({ message: "Invalid JWT" }, { status: 401 });
    if (url.includes("/rest/")) {
      if (url.includes("voice_purchases")) return Response.json(null);
      if (headers.get("accept")?.includes("object")) return Response.json({ id: "fixture-suggestion", place_name: "Oviedo", status: "pending", created_at: "2026-01-01T00:00:00Z" });
      return Response.json([]);
    }
    if (url.includes("openweathermap.org")) return Response.json({ name: "Oviedo", main: { temp: 15, feels_like: 14, humidity: 70 }, weather: [], wind: { speed: 1 } });
    if (url.includes("places.googleapis.com")) return Response.json({ places: [] });
    throw new Error(`Unexpected third-party transport ${url}`);
  });
  vi.stubGlobal("fetch", transport);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const methods = [
  { path: "/api/favorites", method: "GET", handler: favorites.GET, cap: 60 },
  { path: "/api/favorites", method: "POST", handler: favorites.POST, cap: 30, body: { storyIds: [storyId] } },
  { path: `/api/favorites?storyId=${storyId}`, method: "DELETE", handler: favorites.DELETE, cap: 30 },
  { path: "/api/voice-access", method: "GET", handler: voiceAccess.GET, cap: 60 },
  { path: "/api/suggestions", method: "GET", handler: suggestions.GET, cap: 60 },
  { path: "/api/checkout/embedded", method: "POST", handler: checkout.POST, cap: 10, body: {} },
  { path: "/api/mcp/save-favorite", method: "POST", handler: saveFavorite.POST, cap: 30, body: { placeName: "Oviedo", conversationId: "fixture-conversation" } },
];
describe("real routes enforce their new budgets", () => {
  it.each(methods)("$method $path rejects auth without charge, denies at boundary with no side effect and recovers after expiry", async ({ path, method, handler, cap, body }) => {
    const unauthorized = await handler(request(path, method, body, false));
    expect(unauthorized.status).toBe(401); expect(getRateLimitStore().size).toBe(0); expect(sideEffects()).toBe(0);
    for (let i = 0; i < cap; i++) expect((await handler(request(path, method, body))).status).toBe(200);
    const before = sideEffects(); const denied = await handler(request(path, method, body));
    expect(denied.status).toBe(429); expect(denied.headers.get("Retry-After")).toBe("60"); expect(sideEffects()).toBe(before);
    now += 60_001;
    expect((await handler(request(path, method, body))).status).toBe(200); expect(sideEffects()).toBe(before + 1);
  });
});

const ipRoutes = [
  { name: "weather", cap: 30, call: (ip: string, post = false) => post ? weather.POST(request("/api/mcp/weather", "POST", { city: "Oviedo" }, true, ip)) : weather.GET(request("/api/mcp/weather?city=Oviedo", "GET", undefined, true, ip)) },
  { name: "places", cap: 20, call: (ip: string, post = false) => post ? places.POST(request("/api/mcp/places", "POST", { query: "sidra" }, true, ip)) : places.GET(request("/api/mcp/places?query=sidra", "GET", undefined, true, ip)) },
  { name: "suggestions", cap: 1, call: (ip: string) => suggestions.POST(new NextRequest("http://localhost/api/suggestions", { method: "POST", headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": ip }, body: JSON.stringify({ placeName: "Oviedo" }) })) },
];
describe("actual IP consumers normalize IPv6", () => {
  it.each(ipRoutes)("$name aliases share /64 across verbs; distinct prefix and expired window recover", async ({ call, cap }) => {
    for (let i = 0; i < cap; i++) expect((await call("2001:db8:1:2::1")).ok).toBe(true);
    const before = transport.mock.calls.length;
    const denied = await call("2001:0db8:0001:0002::abcd", true);
    expect(denied.status).toBe(429); expect(denied.headers.get("Retry-After")).toBe("60"); expect(transport.mock.calls).toHaveLength(before);
    expect((await call("2001:db8:1:3::1")).ok).toBe(true);
    now += 60_001;
    expect((await call("2001:db8:1:2::abcd")).ok).toBe(true);
  });
});
