// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { LOCAL_API_URL, LOCAL_ANON_KEY, LOCAL_DB_CONTAINER, isLocalSupabaseReachable, psql, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
import { localDockerEnvironment } from "../../scripts/run-contracts.mjs";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable) warnLocalSupabaseUnreachable("feature-flag-realtime.postgrest-integration.test.ts");
const CANARY = "phase3-realtime-private-canary";
const client = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } });
let addedPublication = false;
let original: { enabled: boolean; config: unknown; config_is_null: boolean } | undefined;

function refreshOwnedPublication() {
  const projectId = /^supabase_db_(paisaxe-contracts-[a-f0-9]{12})$/.exec(LOCAL_DB_CONTAINER)?.[1];
  const nonce = /^paisaxe-contracts:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}):[a-f0-9]{64}$/.exec(process.env.SUPABASE_LOCAL_DB_MARKER ?? "")?.[1];
  if (!projectId || !nonce || !process.env.SUPABASE_LOCAL_DB_URL) throw new Error("Realtime refresh requires a task-owned native database");
  const api = new URL(LOCAL_API_URL);
  if (api.protocol !== "http:" || api.hostname !== "127.0.0.1" || api.username || api.password || api.pathname !== "/" || api.search || api.hash || Number(api.port) < 1024 || api.port === "54321") throw new Error("Realtime refresh requires a task loopback endpoint");
  // The native helper verifies the actual database marker in this connection.
  expect(psql("SELECT 1;")).toBe("1");
  const env = { ...localDockerEnvironment(), NODE_ENV: "test" as const };
  const name = `supabase_realtime_${projectId}`;
  const docker = (args: string[]) => {
    try { return execFileSync("docker", args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 }); }
    catch { throw new Error("Owned Realtime fixture command failed"); }
  };
  const inspect = (args: string[]) => {
    try { return JSON.parse(docker(args))[0]; }
    catch { throw new Error("Owned Realtime fixture inspect failed"); }
  };
  const container = inspect(["inspect", name]);
  if (!/^[a-f0-9]{64}$/.test(container?.Id) || container.Name !== `/${name}` || container.State?.Running !== true || container.Config?.Labels?.["com.supabase.cli.project"] !== projectId || JSON.stringify(Object.keys(container.NetworkSettings?.Networks ?? {})) !== JSON.stringify([projectId])) throw new Error("Realtime task container identity mismatch");
  const network = inspect(["network", "inspect", projectId]);
  if (network?.Internal !== true || network.Name !== projectId || network.Labels?.["com.paisaxe.contracts.nonce"] !== nonce || network.Containers?.[container.Id]?.Name !== name || container.NetworkSettings.Networks[projectId].NetworkID !== network.Id) throw new Error("Realtime task internal network identity mismatch");
  // v2.140.10 only notices an idle publication's new tables every 60 seconds.
  // Send its existing refresh message, then read state as a same-sender mailbox
  // barrier. This prepares the WAL slot before our sole positive-control write.
  // https://github.com/supabase/realtime/blob/v2.140.10/lib/extensions/postgres_cdc_rls/replication_poller.ex#L236-L277
  const refresh = `case Registry.lookup(Extensions.PostgresCdcRls.ReplicationPoller.Registry, "realtime-dev") do [{pid, _}] -> send(pid, :check_oids); state = :sys.get_state(pid); if map_size(state.oids) > 0 and state.publication == "supabase_realtime" and state.slot_name == "supabase_realtime_replication_slot_", do: IO.puts("publication_refreshed"), else: raise("publication_not_ready"); [] -> raise("poller_absent") end`;
  expect(docker(["exec", container.Id, "/app/bin/realtime", "rpc", refresh]).trim()).toBe("publication_refreshed");
}

describe.skipIf(!reachable)("Public realtime column privileges (actual local websocket)", () => {
  beforeAll(() => {
    // Application flags are not currently published. Temporarily publish only
    // this owned fixture table to prove the real column-privilege boundary;
    // restore the original schema before the required runner's cleanup digest.
    const published = psql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='feature_flags';");
    if (published === "0") { psql("ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_flags;"); addedPublication = true; }
    original = JSON.parse(psql("SELECT row_to_json(f)::text FROM (SELECT enabled,config,config IS NULL AS config_is_null FROM public.feature_flags WHERE flag_key='maintenance_mode' AND environment='development') f;"));
    psql(`UPDATE public.feature_flags SET config=coalesce(config,'{}'::jsonb)||jsonb_build_object('new_private_key','${CANARY}') WHERE flag_key='maintenance_mode' AND environment='development';`);
    expect(psql("SELECT config->>'new_private_key' FROM public.feature_flags WHERE flag_key='maintenance_mode' AND environment='development';")).toBe(CANARY);
  });
  afterAll(async () => {
    await client.removeAllChannels();
    if (addedPublication) psql("ALTER PUBLICATION supabase_realtime DROP TABLE public.feature_flags;");
    if (original) psql(`UPDATE public.feature_flags SET enabled=${original.enabled},config=${original.config_is_null ? "NULL" : `'${JSON.stringify(original.config).replaceAll("'", "''")}'::jsonb`} WHERE flag_key='maintenance_mode' AND environment='development';`);
  });
  it("delivers anon enabled changes without exposing private canonical config", async () => {
    const events: unknown[] = [];
    const systemMessages: { extension?: string; status?: string }[] = [];
    let ready!: () => void;
    const readyPromise = new Promise<void>(resolve => { ready = resolve; });
    let delivered!: (event: Record<string, unknown>) => void;
    const eventPromise = new Promise<Record<string, unknown>>(resolve => { delivered = resolve; });
    const channel = client.channel("phase3-public-config-canary")
      .on("system", {}, payload => {
        systemMessages.push({ extension: payload.extension, status: payload.status });
        if (payload.extension === "postgres_changes" && payload.status === "ok") ready();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "feature_flags", filter: "flag_key=eq.maintenance_mode" }, payload => {
        events.push(payload);
        if (payload.new.environment === "development") delivered(payload.new);
      });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Realtime subscription positive control timed out")), 10_000);
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new Error(`Realtime subscription failed: ${status}`)); }
      });
    });
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([readyPromise, new Promise<never>((_, reject) => {
        readyTimer = setTimeout(() => reject(new Error(`Realtime replication readiness timed out: ${JSON.stringify(systemMessages)}`)), 10_000);
      })]);
    } finally { if (readyTimer) clearTimeout(readyTimer); }
    refreshOwnedPublication();
    expect(psql("SELECT count(*) FROM pg_catalog.pg_replication_slots WHERE slot_name='supabase_realtime_replication_slot_' AND plugin='wal2json' AND database=current_database() AND temporary AND active;"), "Postgres Changes must have its active WAL slot before the one-shot update").toBe("1");
    const changed = !original!.enabled;
    psql(`UPDATE public.feature_flags SET enabled=${changed} WHERE flag_key='maintenance_mode' AND environment='development';`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const event = await Promise.race([eventPromise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Realtime enabled-change positive control timed out")), 10_000); })]);
      expect(event.enabled).toBe(changed);
      expect(JSON.stringify(events)).not.toContain(CANARY);
      expect(JSON.stringify(events)).not.toContain("new_private_key");
    } finally { if (timer) clearTimeout(timer); }
  });
});
