import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ cookies: [] as Array<{ name: string; value: string }> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => state.cookies, set: vi.fn() }) }));
import { GET as getFavorites } from "@/app/api/favorites/route";
import { getRateLimitStore, resetRateLimit } from "./rate-limit";
import { getSupabaseClient, getUserFromRequest } from "./supabase-auth";

function token(sub: string) {
  return `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
}

// Only the third-party HTTP boundary is replaced. The real SSR client and
// server helper must carry the selected identity through Auth AND PostgREST.
describe("real Supabase SSR request identity", () => {
  const transport = vi.fn();
  const bearerToken = token("bearer-user");
  const cookieToken = token("cookie-user");
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.fixture");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon");
    state.cookies = [{ name: "sb-supabase-auth-token", value: "base64-" + Buffer.from(JSON.stringify({ access_token: cookieToken, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "cookie-user" } })).toString("base64url") }];
    resetRateLimit();
    transport.mockReset();
    transport.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      const id = authorization === `Bearer ${bearerToken}` ? "bearer-user" : authorization === `Bearer ${cookieToken}` ? "cookie-user" : null;
      if (!id) return Response.json({ message: "invalid JWT" }, { status: 401 });
      if (url.includes("/auth/v1/user")) return Response.json({ id, aud: "authenticated", role: "authenticated" });
      if (url.includes("/rest/v1/user_favorites")) return Response.json([{ user_id: id, story_id: `${id}-story` }]);
      throw new Error(`Unexpected transport ${url}`);
    });
    vi.stubGlobal("fetch", transport);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each(["bearer", "cookie"])("%s selects only that user's rows, including a conflicting cookie", async (kind) => {
    const request = new NextRequest("http://localhost/api/favorites", { headers: kind === "bearer" ? { Authorization: `Bearer ${bearerToken}` } : {} });
    const user = await getUserFromRequest(request);
    expect(user?.id).toBe(`${kind}-user`);
    const client = await getSupabaseClient(request);
    const { data, error } = await client.from("user_favorites").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: `${kind}-user`, story_id: `${kind}-user-story` }]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("invalid explicit bearer cannot fall back to a valid cookie or perform row I/O", async () => {
    const request = new NextRequest("http://localhost/api/favorites", { headers: { Authorization: "Bearer invalid" } });
    expect(await getUserFromRequest(request)).toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toContain("/auth/v1/user");
  });
  it("rejected auth spends no route budget and a later valid request succeeds", async () => {
    const denied = await getFavorites(new NextRequest("http://localhost/api/favorites", { headers: { Authorization: "Bearer invalid" } }));
    expect(denied.status).toBe(401);
    expect(getRateLimitStore().size).toBe(0);
    expect(transport).toHaveBeenCalledTimes(1);
    const valid = await getFavorites(new NextRequest("http://localhost/api/favorites", { headers: { Authorization: `Bearer ${bearerToken}` } }));
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual(["bearer-user-story"]);
    expect(getRateLimitStore().get("favorites-read:bearer-user")?.timestamps).toHaveLength(1);
  });

  it("whitespace Supabase configuration performs zero upstream calls then corrected configuration works", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " \n ");
    const request = new NextRequest("http://localhost/api/favorites", { headers: { Authorization: `Bearer ${bearerToken}` } });
    await expect(getUserFromRequest(request)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " http://supabase.fixture ");
    expect((await getUserFromRequest(request))?.id).toBe("bearer-user");
  });

});
