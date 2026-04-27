import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Capture the cookies config passed to createServerClient
let capturedCookiesConfig: {
  getAll: () => { name: string; value: string }[];
  setAll?: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => void;
} | null = null;

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, options: { cookies: typeof capturedCookiesConfig }) => {
      capturedCookiesConfig = options.cookies;
      return { auth: { getUser: mockGetUser } };
    }
  ),
}));

import {
  refreshAuthSession,
  isTokenNearExpiry,
  hasSupabaseAuthCookies,
  AUTH_REFRESH_TIMEOUT_MS,
} from "./auth-refresh";

// ── helpers ────────────────────────────────────────────────────────────────────

/** Build a minimal valid JWT payload with the given exp (unix seconds). */
function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: expSeconds, sub: "user-1" }));
  return `${header}.${payload}.signature`;
}

function makeRequest(
  url: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const req = new NextRequest(url);
  Object.entries(cookies).forEach(([name, value]) => req.cookies.set(name, value));
  return req;
}

// ── isTokenNearExpiry ──────────────────────────────────────────────────────────

describe("isTokenNearExpiry", () => {
  it("returns true when token is undefined", () => {
    expect(isTokenNearExpiry(undefined)).toBe(true);
  });

  it("returns true when token is empty string", () => {
    expect(isTokenNearExpiry("")).toBe(true);
  });

  it("returns true for a malformed token", () => {
    expect(isTokenNearExpiry("not.a.jwt")).toBe(true);
  });

  it("returns true when token expires within default threshold (300s)", () => {
    const soon = Math.floor(Date.now() / 1000) + 100; // 100 s from now
    expect(isTokenNearExpiry(makeJwt(soon))).toBe(true);
  });

  it("returns false when token expires well beyond the threshold", () => {
    const future = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    expect(isTokenNearExpiry(makeJwt(future))).toBe(false);
  });

  it("returns true when token is already expired", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(isTokenNearExpiry(makeJwt(past))).toBe(true);
  });

  it("respects a custom threshold", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    // 7200s threshold — 1-hour token is still within that window
    expect(isTokenNearExpiry(makeJwt(future), 7200)).toBe(true);
  });
});

// ── hasSupabaseAuthCookies ─────────────────────────────────────────────────────

describe("hasSupabaseAuthCookies", () => {
  const supabaseUrl = "https://abcdef.supabase.co";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when no cookies are present", () => {
    const req = makeRequest("https://paisaxe.es/");
    expect(hasSupabaseAuthCookies(req)).toBe(false);
  });

  it("returns true when the exact auth-token cookie is present", () => {
    const req = makeRequest("https://paisaxe.es/", {
      "sb-abcdef-auth-token": "somevalue",
    });
    expect(hasSupabaseAuthCookies(req)).toBe(true);
  });

  it("returns true when a chunked auth-token cookie is present", () => {
    const req = makeRequest("https://paisaxe.es/", {
      "sb-abcdef-auth-token.0": "chunk0",
    });
    expect(hasSupabaseAuthCookies(req)).toBe(true);
  });

  it("returns false when only unrelated cookies are present", () => {
    const req = makeRequest("https://paisaxe.es/", {
      theme: "dark",
      lang: "es",
    });
    expect(hasSupabaseAuthCookies(req)).toBe(false);
  });

  it("returns false when NEXT_PUBLIC_SUPABASE_URL is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const req = makeRequest("https://paisaxe.es/", {
      "sb-abcdef-auth-token": "val",
    });
    expect(hasSupabaseAuthCookies(req)).toBe(false);
  });
});

// ── refreshAuthSession ─────────────────────────────────────────────────────────

describe("refreshAuthSession", () => {
  const supabaseUrl = "https://abcdef.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig"; // starts with eyJ

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseKey);
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    capturedCookiesConfig = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("returns a response without calling getUser when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const req = makeRequest("https://paisaxe.es/dashboard");
    const res = await refreshAuthSession(req);
    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns a response without calling getUser when key is not a JWT (dummy / CI key)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "dummy-not-a-jwt");
    const req = makeRequest("https://paisaxe.es/");
    const res = await refreshAuthSession(req);
    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("skips getUser for anonymous visitors with no auth cookies", async () => {
    const req = makeRequest("https://paisaxe.es/");
    const res = await refreshAuthSession(req);
    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("skips getUser when session token is still fresh (more than 300s remaining)", async () => {
    const projectRef = "abcdef";
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const freshJwt = makeJwt(futureExp);
    const sessionValue = encodeURIComponent(JSON.stringify({ access_token: freshJwt }));
    const req = makeRequest("https://paisaxe.es/dashboard", {
      [`sb-${projectRef}-auth-token`]: sessionValue,
    });
    const res = await refreshAuthSession(req);
    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("calls getUser when session token is near expiry", async () => {
    const projectRef = "abcdef";
    const nearExp = Math.floor(Date.now() / 1000) + 60; // 60s → within 300s threshold
    const nearJwt = makeJwt(nearExp);
    const sessionValue = encodeURIComponent(JSON.stringify({ access_token: nearJwt }));
    const req = makeRequest("https://paisaxe.es/dashboard", {
      [`sb-${projectRef}-auth-token`]: sessionValue,
    });
    await refreshAuthSession(req);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("continues without error when Supabase times out (timeout path)", async () => {
    vi.useFakeTimers();

    const projectRef = "abcdef";
    const nearExp = Math.floor(Date.now() / 1000) + 60;
    const nearJwt = makeJwt(nearExp);
    const sessionValue = encodeURIComponent(JSON.stringify({ access_token: nearJwt }));
    const req = makeRequest("https://paisaxe.es/dashboard", {
      [`sb-${projectRef}-auth-token`]: sessionValue,
    });

    // Make getUser hang indefinitely
    mockGetUser.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const promise = refreshAuthSession(req);
    // Advance clock past the timeout
    await vi.advanceTimersByTimeAsync(AUTH_REFRESH_TIMEOUT_MS + 100);

    const res = await promise;
    // Should still return a response (not throw)
    expect(res.status).toBe(200);
  });

  it("returns a response even when getUser rejects unexpectedly", async () => {
    const projectRef = "abcdef";
    const nearExp = Math.floor(Date.now() / 1000) + 60;
    const nearJwt = makeJwt(nearExp);
    const sessionValue = encodeURIComponent(JSON.stringify({ access_token: nearJwt }));
    const req = makeRequest("https://paisaxe.es/dashboard", {
      [`sb-${projectRef}-auth-token`]: sessionValue,
    });

    mockGetUser.mockRejectedValue(new Error("Network error"));
    const res = await refreshAuthSession(req);
    expect(res.status).toBe(200);
  });
});
