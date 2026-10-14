import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRequestBudget, rateLimitResponse, REQUEST_BUDGETS } from "./request-rate-limit";
import { resetRateLimit, normalizeIpForRateLimit } from "./rate-limit";

describe("request budgets", () => {
  beforeEach(() => { vi.useFakeTimers(); resetRateLimit(); });
  afterEach(() => vi.useRealTimers());

  it("POST and DELETE share a mutation budget; distinct users and read routes stay independent, then the window recovers", async () => {
    for (let i = 0; i < 30; i++) expect((await checkRequestBudget(i % 2 ? "POST /api/favorites" : "DELETE /api/favorites", "alice")).allowed).toBe(true);
    const denied = await checkRequestBudget("POST /api/favorites", "alice");
    expect(denied.allowed).toBe(false);
    const response = rateLimitResponse({ error: "Try again" }, denied);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ error: "Try again" });
    expect((await checkRequestBudget("POST /api/favorites", "bob")).allowed).toBe(true);
    expect((await checkRequestBudget("GET /api/favorites", "alice")).allowed).toBe(true);
    vi.advanceTimersByTime(60_001);
    expect((await checkRequestBudget("DELETE /api/favorites", "alice")).allowed).toBe(true);
  });

  it("shared save-favorite cap cannot be bypassed by rotating caller identities", async () => {
    for (let i = 0; i < 180; i++) expect((await checkRequestBudget("POST /api/mcp/save-favorite", `caller-${i}`)).allowed).toBe(true);
    expect((await checkRequestBudget("POST /api/mcp/save-favorite", "fresh-caller")).allowed).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect((await checkRequestBudget("POST /api/mcp/save-favorite", "fresh-caller")).allowed).toBe(true);
  });

  it("IPv6 aliases share their caller budget; a distinct prefix stays independent", async () => {
    const prefix = normalizeIpForRateLimit("2001:db8:1:2::1");
    for (let i = 0; i < 30; i++) await checkRequestBudget("POST /api/mcp/save-favorite", prefix);
    expect((await checkRequestBudget("POST /api/mcp/save-favorite", normalizeIpForRateLimit("2001:0db8:0001:0002::abcd"))).allowed).toBe(false);
    expect((await checkRequestBudget("POST /api/mcp/save-favorite", normalizeIpForRateLimit("2001:db8:1:3::1"))).allowed).toBe(true);
  });

  it("cheap cached reads and constant callback acknowledgement have explicit exemptions", () => {
    expect(REQUEST_BUDGETS["GET /api/feature-flags"].exempt).toContain("cached");
    expect(REQUEST_BUDGETS["GET /api/stories"].exempt).toContain("Cached");
    expect(REQUEST_BUDGETS["POST /api/mcp/make-booking/status"].exempt).toContain("no I/O");
  });
});
