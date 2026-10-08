import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createServer, type Server } from "node:http";
import {
  LOCAL_API_URL, LOCAL_ANON_KEY, LOCAL_SERVICE_ROLE_KEY, isLocalSupabaseReachable,
  psql, warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable) warnLocalSupabaseUnreachable("feature-flag-consumers.postgrest-integration.test.ts");
const CANARY = "phase3-consumer-private-canary";
const UNKNOWN = "phase3-consumer-unknown";
const DISPLAY_TITLE = "Reviewed public maintenance title";
const DISPLAY_MESSAGE = "Reviewed public maintenance message";
let originals: { id: string; enabled: boolean; config: unknown; config_is_null: boolean }[] = [];
let server: Server | undefined;
let origin = "";
const originalFetch = globalThis.fetch;

describe.skipIf(!reachable)("Public feature-flag consumers with real local database", () => {
  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", LOCAL_API_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", LOCAL_ANON_KEY);
    vi.stubEnv("SUPABASE_SERVICE_KEY", LOCAL_SERVICE_ROLE_KEY);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
    originals = JSON.parse(psql("SELECT jsonb_agg(jsonb_build_object('id',id,'enabled',enabled,'config',config,'config_is_null',config IS NULL))::text FROM public.feature_flags;"));
    psql(`UPDATE public.feature_flags SET config=COALESCE(config,'{}'::jsonb)||jsonb_build_object('new_private_key','${CANARY}');
      UPDATE public.feature_flags SET config=config||jsonb_build_object('title','${DISPLAY_TITLE}','message','${DISPLAY_MESSAGE}','show_tagline',false) WHERE flag_key='maintenance_mode' AND environment='development';
      INSERT INTO public.feature_flags(flag_key,label,environment,config) VALUES('${UNKNOWN}','Contract','development',jsonb_build_object('private_prompt','${CANARY}'));`);
    const { GET } = await import("@/app/api/feature-flags/route");
    // The harness supplies HTTP routing only. GET, its public Supabase client,
    // PostgREST, database policies and the consumer hook remain real.
    server = createServer(async (req, res) => {
      try {
        if (req.url !== "/api/feature-flags") { res.writeHead(404).end(); return; }
        const response = await GET();
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
      } catch { res.writeHead(500).end(); }
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing owned HTTP listener");
    origin = `http://127.0.0.1:${address.port}`;
    // Node fetch has no browser document base URL. Normalize relative URLs;
    // every request still crosses the actual owned HTTP listener.
    globalThis.fetch = (input, init) => originalFetch(
      typeof input === "string" && input.startsWith("/") ? new URL(input, origin) : input, init,
    );
  });
  afterAll(async () => {
    cleanup();
    globalThis.fetch = originalFetch;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    }
    psql(`BEGIN; DELETE FROM public.feature_flags WHERE flag_key='${UNKNOWN}';
      ${originals.map(row => `UPDATE public.feature_flags SET enabled=${row.enabled},config=${row.config_is_null ? "NULL" : `'${JSON.stringify(row.config).replaceAll("'", "''")}'::jsonb`} WHERE id='${row.id}';`).join("\n")}
      COMMIT;`);
    vi.unstubAllEnvs();
  });

  it("real API excludes private keys in every known/new flag and preserves approved maintenance fields", async () => {
    const response = await originalFetch(`${origin}/api/feature-flags`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
    const text = await response.text();
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain("new_private_key");
    const { data } = JSON.parse(text);
    expect(data.find((flag: { flagKey: string }) => flag.flagKey === UNKNOWN).config).toEqual({});
    expect(data.find((flag: { flagKey: string }) => flag.flagKey === "maintenance_mode").config).toEqual({ title: DISPLAY_TITLE, message: DISPLAY_MESSAGE, show_tagline: false });
  });

  it("the actual shared hook cache contains only projected config on initial load and reuse", async () => {
    const { FeatureFlagsProvider, useFeatureFlags } = await import("@/hooks/use-feature-flags");
    const wrapper = ({ children }: { children: ReactNode }) => createElement(FeatureFlagsProvider, null, children);
    const first = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(first.result.current.isReady).toBe(true));
    expect(first.result.current.flags.length).toBeGreaterThan(1);
    expect(JSON.stringify(first.result.current.flags)).not.toContain(CANARY);
    const initial = first.result.current.flags;
    first.unmount();
    const cached = renderHook(() => useFeatureFlags(), { wrapper });
    expect(cached.result.current.isReady).toBe(true);
    expect(cached.result.current.flags).toEqual(initial);
    expect(JSON.stringify(cached.result.current.flags)).not.toContain("new_private_key");
    cached.unmount();
  });

  it("server enabled reads and the real maintenance UI preserve public behavior without serializing private config", async () => {
    const { getAllFeatureFlagsServer, isFeatureFlagEnabled } = await import("@/lib/feature-flags-server");
    const enabled = JSON.parse(psql("SELECT jsonb_object_agg(flag_key,enabled)::text FROM public.feature_flags WHERE environment='development';"));
    expect(await getAllFeatureFlagsServer()).toEqual(enabled);
    expect(await isFeatureFlagEnabled("maintenance_mode")).toBe(enabled.maintenance_mode);
    const { default: ComingSoonPage } = await import("@/app/coming-soon/page");
    const html = renderToStaticMarkup(await ComingSoonPage());
    expect(html).toContain(DISPLAY_TITLE);
    expect(html).toContain(DISPLAY_MESSAGE);
    expect(html).not.toContain("Look. Ask. Discover.");
    expect(html).not.toContain(CANARY);
    expect(html).not.toContain("new_private_key");
  });

  it("the actual backend admin adapter retains and edits private canonical prompts without approving them", async () => {
    const { createAdminClient } = await import("@/lib/supabase-admin");
    const admin = createAdminClient();
    const approvalsBefore = psql("SELECT coalesce(jsonb_agg(row_to_json(k) ORDER BY flag_key,config_key),'[]')::text FROM public.feature_flag_public_config_keys k;");
    const before = await admin.from("feature_flags").select("config").eq("flag_key", UNKNOWN).eq("environment", "development").single();
    expect(before.error).toBeNull();
    expect(before.data!.config.private_prompt).toBe(CANARY);
    const changed = `${CANARY}-edited`;
    const update = await admin.from("feature_flags").update({ config: { private_prompt: changed } }).eq("flag_key", UNKNOWN).eq("environment", "development").select("config").single();
    expect(update.error).toBeNull();
    expect(update.data!.config).toEqual({ private_prompt: changed });
    const reread = await admin.from("feature_flags").select("config").eq("flag_key", UNKNOWN).eq("environment", "development").single();
    expect(reread.error).toBeNull();
    expect(reread.data!.config).toEqual({ private_prompt: changed });
    const response = await originalFetch(`${origin}/api/feature-flags`);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(CANARY);
    const publicRead = await originalFetch(`${LOCAL_API_URL}/rest/v1/feature_flags_public?select=config&flag_key=eq.${UNKNOWN}`, { headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${LOCAL_ANON_KEY}` } });
    expect(publicRead.status).toBe(200);
    expect(await publicRead.json()).toEqual([{ config: {} }]);
    expect(psql("SELECT coalesce(jsonb_agg(row_to_json(k) ORDER BY flag_key,config_key),'[]')::text FROM public.feature_flag_public_config_keys k;")).toBe(approvalsBefore);
  });
});
