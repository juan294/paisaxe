// @vitest-environment node
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { once } from "node:events";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_DB_CONTAINER, isLocalSupabaseReachable, psql, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable)
    warnLocalSupabaseUnreachable("pg-net.postgrest-integration.test.ts");
const storage = LOCAL_DB_CONTAINER.replace("supabase_db_", "supabase_storage_");
const nonce = randomUUID();
const state = `/tmp/paisaxe-pgnet-${nonce}.json`;
const pidFile = `/tmp/paisaxe-pgnet-${nonce}.pid`;
const port = randomInt(15000, 19000);
const base = `http://${storage}:${port}`;
const SECRET = `local-pgnet-canary-${nonce}`;
const STORY = "b0050000-0000-4000-8000-000000000001";
const FLAG = `pgnet-contract-${nonce}`;
const EVENT = `pgnet-contract:${nonce}`;
let receiver: ChildProcess | undefined;
let config: {
    key: string;
    value: string;
}[] = [];
interface Delivery {
    url: string;
    secret: string | undefined;
    type: string | undefined;
    body: Record<string, unknown>;
}
const inStorage = (code: string) => execFileSync("docker", ["exec", storage, "node", "-e", code], { encoding: "utf8" }).trim();
function deliveries(): Delivery[] { return JSON.parse(inStorage(`console.log(require('fs').readFileSync(${JSON.stringify(state)},'utf8'))`)); }
function clear() { inStorage(`require('fs').writeFileSync(${JSON.stringify(state)},'[]')`); }
async function received(path: string) { await vi.waitFor(() => expect(deliveries().some(r => r.url === path)).toBe(true), { timeout: 10000, interval: 100 }); return deliveries().filter(r => r.url === path); }
function configure(url: string) { psql(`UPDATE public.webhook_config SET value='${url}' WHERE key='base_url'; UPDATE public.webhook_config SET value='${SECRET}' WHERE key='secret';`); }
async function captureSql(sql: string) {
    const child = spawn("docker", ["exec", LOCAL_DB_CONTAINER, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql]);
    let output = "";
    let diagnostic = "";
    child.stdout.on("data", c => output += c.toString());
    child.stderr.on("data", c => diagnostic += c.toString());
    const [code] = await once(child, "exit");
    expect(code, diagnostic).toBe(0);
    return { output, diagnostic };
}
async function transaction(sql: string, commit: boolean) {
    const child = spawn("docker", ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"]);
    let output = "";
    let errors = "";
    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { errors += chunk.toString(); });
    child.stdin.write(`BEGIN; ${sql}; SELECT 'pgnet-fixture-ready';\n`);
    try {
        await vi.waitFor(() => { expect(child.exitCode, errors).toBeNull(); expect(output).toContain("pgnet-fixture-ready"); }, { timeout: 10000, interval: 50 });
        // A real transaction stays open while the receiver remains empty.
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(deliveries()).toEqual([]);
        child.stdin.end(`${commit ? "COMMIT" : "ROLLBACK"};\n`);
        const [code] = await once(child, "exit");
        expect(code, errors).toBe(0);
        return [...errors.matchAll(/request_id=(\d+)/g)].map(match=>match[1]);
    }
    finally {
        if (child.exitCode === null) {
            child.stdin.end("ROLLBACK;\n");
            child.kill();
        }
    }
}
describe.skipIf(!reachable)("Installed pg_net JSONB transport and transaction boundary", () => {
    beforeAll(async () => {
        // Exact receiver process lives in the existing storage container: no extra
        // container, host listener, external network, provider request or image pull.
        const code = `const fs=require('fs');fs.writeFileSync(${JSON.stringify(state)},'[]');fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));require('http').createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const rows=JSON.parse(fs.readFileSync(${JSON.stringify(state)},'utf8'));rows.push({url:req.url,secret:req.headers['x-webhook-secret'],type:req.headers['content-type'],body:JSON.parse(raw)});fs.writeFileSync(${JSON.stringify(state)},JSON.stringify(rows));res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');});}).listen(${port},'0.0.0.0',()=>console.log('pgnet-ready-${nonce}'));`;
        receiver = spawn("docker", ["exec", "-i", storage, "node", "-e", code]);
        let output = "";
        receiver.stdout!.on("data", c => output += c.toString());
        await vi.waitFor(() => { expect(receiver!.exitCode).toBeNull(); expect(output).toContain(`pgnet-ready-${nonce}`); }, { timeout: 10000, interval: 50 });
        config = JSON.parse(psql("SELECT jsonb_agg(jsonb_build_object('key',key,'value',value))::text FROM public.webhook_config WHERE key IN ('base_url','secret');"));
        configure("");
        psql(`INSERT INTO public.feature_flags(flag_key,label,environment) VALUES('${FLAG}','Contract','development'); INSERT INTO public.stories(id,slug,title,category,is_active,curation_status) VALUES('${STORY}','pgnet-contract-${nonce}','Contract','nature',true,'needs_curation');`);
        configure(base);
        clear();
    });
    beforeEach(() => { configure(""); psql(`UPDATE public.stories SET curation_status='needs_curation',metadata='{}'::jsonb WHERE id='${STORY}'; DELETE FROM public.translate_webhook_events WHERE story_id='${STORY}';`); configure(base); clear(); });
    afterAll(() => {
        configure("");
        psql(`DELETE FROM public.stories WHERE id='${STORY}';DELETE FROM public.feature_flags WHERE flag_key='${FLAG}';`);
        for (const row of config)
            psql(`UPDATE public.webhook_config SET value='${row.value.replaceAll("'", "''")}' WHERE key='${row.key}';`);
        if (receiver) {
            inStorage(`const fs=require('fs');const p=Number(fs.readFileSync(${JSON.stringify(pidFile)},'utf8'));if(!fs.readFileSync('/proc/'+p+'/cmdline','utf8').includes(${JSON.stringify(nonce)}))throw Error('receiver identity mismatch');process.kill(p,'SIGTERM');fs.unlinkSync(${JSON.stringify(pidFile)});fs.unlinkSync(${JSON.stringify(state)});`);
            receiver.kill();
        }
    });
    it("catalog exposes JSONB request body, not a text overload", () => {
        expect(psql("SELECT string_agg(pg_get_function_identity_arguments(oid),'|') FROM pg_proc WHERE pronamespace='net'::regnamespace AND proname='http_post';")).toBe("url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer");
    });
    it.each(["notify", "translation", "retry"])("%s delivers authenticated JSON only after COMMIT", async (path) => {
        const sql = path === "notify" ? `UPDATE public.feature_flags SET label='Committed' WHERE flag_key='${FLAG}'` : path === "translation" ? `UPDATE public.stories SET curation_status='approved' WHERE id='${STORY}'` : `INSERT INTO public.translate_webhook_events(event_key,story_id,status,next_retry_at) VALUES('${EVENT}','${STORY}','failed',now()); SELECT public.fail_stale_story_translations(now()-interval '5 minutes',5)`;
        const requestIds=await transaction(sql, true);
        expect(requestIds.length).toBeGreaterThan(0);
        const rows = await received(path === "notify" ? "/api/webhooks/supabase" : "/api/webhooks/translate");
        await vi.waitFor(()=>expect(psql(`SELECT count(*) FROM net._http_response WHERE id IN (${requestIds.join(",")}) AND status_code=200 AND error_msg IS NULL;`)).toBe(String(requestIds.length)),{timeout:10000,interval:100});
        process.stdout.write(`[pg_net] real delivery receipt ${JSON.stringify({path,request_ids:requestIds,status_code:200})}\n`);
        for (const delivery of rows) {
            expect(delivery.secret).toBe(SECRET);
            expect(delivery.type).toBe("application/json");
            expect(typeof delivery.body).toBe("object");
        }
        if (path === "notify")
            expect(rows.at(-1)!.body).toMatchObject({ table_name: "feature_flags", operation: "UPDATE" });
        else
            expect(rows.at(-1)!.body.eventKey).toBe(path === "retry" ? EVENT : `${STORY}:default:all`);
    });
    it.each(["notify", "translation", "retry"])("%s ROLLBACK sends no request", async (path) => {
        const sql = path === "notify" ? `UPDATE public.feature_flags SET label='Rolled back' WHERE flag_key='${FLAG}'` : path === "translation" ? `UPDATE public.stories SET curation_status='approved' WHERE id='${STORY}'` : `INSERT INTO public.translate_webhook_events(event_key,story_id,status,next_retry_at) VALUES('${EVENT}','${STORY}','failed',now()); SELECT public.fail_stale_story_translations(now()-interval '5 minutes',5)`;
        await transaction(sql, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(deliveries()).toEqual([]);
    });
    it("malformed URL diagnostics never disclose URL canaries and original updates persist", async () => {
        const canary = `private-url-canary-${nonce}`;
        configure(`http://[${canary}`);
        const result = await captureSql(`UPDATE public.stories SET curation_status='approved' WHERE id='${STORY}'; UPDATE public.feature_flags SET label='Malformed URL preserved update' WHERE flag_key='${FLAG}';`);
        expect(result.output).toContain("UPDATE 1");
        expect(result.diagnostic).not.toContain(canary);
        expect(result.diagnostic).toMatch(/SQLSTATE|sqlstate/);
        expect(psql(`SELECT curation_status FROM public.stories WHERE id='${STORY}';`)).toBe("approved");
    });
    it("synchronous malformed URL failure preserves the durable approval job for corrected retry", async () => {
        configure(`http://[private-url-canary-${nonce}`);
        await captureSql(`UPDATE public.stories SET curation_status='approved' WHERE id='${STORY}';`);
        expect(psql(`SELECT curation_status FROM public.stories WHERE id='${STORY}';`)).toBe("approved");
        expect(psql(`SELECT status FROM public.translate_webhook_events WHERE story_id='${STORY}';`)).toBe("pending");
        configure(base);
        clear();
        psql("SELECT public.fail_stale_story_translations(now()-interval '5 minutes',5);");
        expect((await received("/api/webhooks/translate"))[0].body.eventKey).toBe(`${STORY}:default:all`);
    });
    it("missing configuration preserves the original update and durable queue; corrected retry delivers", async () => {
        configure("");
        psql(`UPDATE public.stories SET curation_status='approved' WHERE id='${STORY}';`);
        expect(psql(`SELECT status FROM public.translate_webhook_events WHERE story_id='${STORY}';`)).toBe("pending");
        expect(deliveries()).toEqual([]);
        configure(base);
        clear();
        psql("SELECT public.fail_stale_story_translations(now()-interval '5 minutes',5);");
        expect((await received("/api/webhooks/translate"))[0].body.eventKey).toBe(`${STORY}:default:all`);
    });
});
