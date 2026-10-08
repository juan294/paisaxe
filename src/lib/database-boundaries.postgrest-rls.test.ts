// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { databaseRpcFixtures } from "@/test/database-rpc-fixtures";
import { databaseBoundaryFixtures, boundarySelector, type BoundaryFixture } from "@/test/database-boundary-fixtures";
import { createClient } from "@supabase/supabase-js";
import { LOCAL_API_URL, LOCAL_ANON_KEY, LOCAL_SERVICE_ROLE_KEY, LOCAL_REST_URL, isLocalSupabaseReachable, localServiceClient, psql, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
vi.setConfig({ testTimeout: 20000, hookTimeout: 30000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable)
    warnLocalSupabaseUnreachable("database-boundaries.postgrest-rls.test.ts");
const PRIVATE_TABLES = ["admin_audit_log", "anthropic_usage", "booking_daily_call_counters", "booking_drafts", "booking_sms_jobs", "bookings", "cron_job_locks", "elevenlabs_webhook_events", "experience_facts", "experiences", "github_traffic_daily", "github_traffic_paths", "github_traffic_referrers", "holds", "marketing_accounts", "marketing_agent_logs", "marketing_content_bank", "marketing_posts", "marketing_schedule", "merchants", "operator_access", "payments", "paypal_webhook_events", "pending_bookings", "platform_costs", "quotes", "stripe_webhook_events", "translate_webhook_events", "voice_saved_places", "vouchers", "voucher_redemptions", "webhook_config", "feature_flag_public_config_keys"];
const RLS_TABLES = new Set(["github_traffic_daily", "github_traffic_paths", "github_traffic_referrers", "marketing_accounts", "marketing_agent_logs", "marketing_content_bank", "marketing_posts", "marketing_schedule", "platform_costs", "webhook_config"]);
const PUBLIC_TABLES = ["chunks", "feature_flags", "images", "stories", "story_suggestions", "user_favorites", "user_profiles", "voice_purchases"];
const fixtures: BoundaryFixture[] = [];
const ids: string[] = [];
const tokens: Record<string, string> = { anon: LOCAL_ANON_KEY, service_role: LOCAL_SERVICE_ROLE_KEY };
const PREFIX = "boundary-contract-";
const CHUNK = randomUUID();
const EMBEDDING = `[${[1, ...Array(511).fill(0)].join(",")}]`;
const SUGGESTION = randomUUID();
let dailyCounter: string | undefined;
const STORY = "b0040000-0000-4000-8000-000000000001";
async function request(path: string, role: string, method = "GET", body?: unknown) { return fetch(`${LOCAL_REST_URL}/${path}`, { method, headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${tokens[role]}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
async function permissionDenied(res: Response) { expect(res.status).toBeOneOf([401, 403]); const body = await res.json(); expect(body.code).toBe("42501"); expect(body.message).toMatch(/permission denied|row-level security/i); }
describe.skipIf(!reachable)("Declared database authorization matrix (real PostgREST)", () => {
    beforeAll(async () => {
        for (const role of ["owner", "nonowner"]) {
            const email = `${PREFIX}${role}@example.test`;
            const password = "Local-contract-password-349!";
            const { data, error } = await localServiceClient().auth.admin.createUser({ email, password, email_confirm: true });
            expect(error).toBeNull();
            ids.push(data.user!.id);
            const client = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } });
            const signed = await client.auth.signInWithPassword({ email, password });
            expect(signed.error).toBeNull();
            tokens[role] = signed.data.session!.access_token;
        }
        expect(psql("SELECT value FROM public.webhook_config WHERE key='base_url';")).toBe("");
        psql(`INSERT INTO public.stories(id,slug,title,description,image_path,category,is_active,curation_status) VALUES('${STORY}','${PREFIX}story','Contract story','Contract content','https://example.test/story.jpg','nature',true,'approved');`);
        const chunk = await request("chunks", "service_role", "POST", { id: CHUNK, content: "Synthetic contract chunk", source_pdf: PREFIX, embedding: EMBEDDING });
        expect(chunk.status).toBe(201);
        dailyCounter = psql("SELECT row_to_json(c)::text FROM public.booking_daily_call_counters c WHERE counter_date=CURRENT_DATE;");
        psql(`INSERT INTO public.story_suggestions(id,user_id,place_name) VALUES('${SUGGESTION}','${ids[0]}','${PREFIX}suggestion');`);
        for (const fixture of databaseBoundaryFixtures(ids[0], STORY, PREFIX)) {
            const res = await request(fixture.table, "service_role", "POST", fixture.payload);
            expect(res.status, `${fixture.table}: ${await res.clone().text()}`).toBe(201);
            expect(await res.json()).toHaveLength(1);
            fixtures.push(fixture);
        }
    });
    afterAll(async () => {
        psql(`DELETE FROM public.chunks WHERE id='${CHUNK}';`);
        for (const fixture of [...fixtures].reverse()) {
            const res = await request(boundarySelector(fixture), "service_role", "DELETE");
            expect(res.status, fixture.table).toBe(200);
            expect(await res.json(), fixture.table).toHaveLength(1);
        }
        psql(`DELETE FROM public.stripe_webhook_events WHERE event_id LIKE '${PREFIX}%'; DELETE FROM public.cron_job_locks WHERE lock_key LIKE '${PREFIX}%'; UPDATE public.story_suggestions SET converted_story_id=NULL WHERE id='${SUGGESTION}'; DELETE FROM public.stories WHERE slug LIKE '${PREFIX}%'; DELETE FROM public.story_suggestions WHERE id='${SUGGESTION}' OR place_name LIKE '${PREFIX}%'; ${dailyCounter === undefined ? "" : `DELETE FROM public.booking_daily_call_counters WHERE counter_date=CURRENT_DATE; ${dailyCounter ? `INSERT INTO public.booking_daily_call_counters SELECT * FROM json_populate_record(NULL::public.booking_daily_call_counters,'${dailyCounter.replaceAll("'", "''")}');` : ""}`}`);
        psql(`DELETE FROM public.stories WHERE id='${STORY}'; DELETE FROM public.admin_audit_log WHERE action LIKE '${PREFIX}%'; DELETE FROM public.feature_flags WHERE flag_key LIKE '${PREFIX}%';`);
        for (const id of ids) {
            const result = await localServiceClient().auth.admin.deleteUser(id);
            expect(result.error).toBeNull();
        }
    });
    it("every installed public table has an explicitly reviewed role contract", () => {
        const tables = psql("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;").split("\n");
        expect(tables).toEqual([...PRIVATE_TABLES, ...PUBLIC_TABLES].sort());
    });
    const fixtureFor = (table: string) => { const fixture = fixtures.find(f => f.table === table); expect(fixture, table).toBeDefined(); return fixture!; };
    for (const table of PRIVATE_TABLES) {
        for (const role of ["anon", "owner", "nonowner"]) {
            it(`${role} cannot read private ${table}`, async () => { const res = await request(`${boundarySelector(fixtureFor(table))}&select=*`, role); if (RLS_TABLES.has(table)) {
                expect(res.status).toBe(200);
                expect(await res.json()).toEqual([]);
            }
            else
                await permissionDenied(res); });
            it(`${role} cannot insert private ${table}`, async () => { await permissionDenied(await request(table, role, "POST", fixtureFor(table).payload)); });
            it(`${role} cannot update private ${table}`, async () => { const res = await request(boundarySelector(fixtureFor(table)), role, "PATCH", fixtureFor(table).patch); if (RLS_TABLES.has(table)) {
                expect(res.status).toBe(200);
                expect(await res.json()).toEqual([]);
            }
            else
                await permissionDenied(res); });
            it(`${role} cannot delete private ${table}`, async () => { const res = await request(boundarySelector(fixtureFor(table)), role, "DELETE"); if (RLS_TABLES.has(table)) {
                expect(res.status).toBe(200);
                expect(await res.json()).toEqual([]);
            }
            else
                await permissionDenied(res); });
        }
        it(`service_role can read ${table} through the real adapter`, async () => { const res = await request(`${boundarySelector(fixtureFor(table))}&select=*`, "service_role"); expect(res.status).toBe(200); expect(await res.json(), table).toHaveLength(1); });
        it(`service_role actually updates ${table}`, async () => { const fixture = fixtureFor(table); const res = await request(boundarySelector(fixture), "service_role", "PATCH", fixture.patch); expect(res.status, table).toBe(200); const changed = (await res.json())[0]; for (const [key, value] of Object.entries(fixture.patch)) {
            if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))
                expect(Date.parse(changed[key])).toBe(Date.parse(value));
            else
                expect(changed[key]).toEqual(value);
        } });
        it(`service_role holds exact DML authority on ${table} separately from RLS`, () => { expect(psql(`SELECT bool_and(has_table_privilege('service_role','public.${table}',privilege)) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) privilege;`)).toBe("t"); });
    }
    it("service-role flag insert/update/delete succeeds while private config stays unreadable to clients", async () => {
        const key = `${PREFIX}flag`;
        const inserted = await request("feature_flags", "service_role", "POST", { flag_key: key, label: "Contract", environment: "development", config: { secret_canary: "private-config" } });
        expect(inserted.status).toBe(201);
        const changed = await request(`feature_flags?flag_key=eq.${key}`, "service_role", "PATCH", { enabled: true });
        expect(changed.status).toBe(200);
        expect((await changed.json())[0].enabled).toBe(true);
        for (const role of ["anon", "owner", "nonowner"]) {
            await permissionDenied(await request(`feature_flags?select=config&flag_key=eq.${key}`, role));
            const view = await request(`feature_flags_public?select=config&flag_key=eq.${key}`, role);
            expect(view.status).toBe(200);
            expect((await view.json())[0].config).toEqual({});
        }
        const deleted = await request(`feature_flags?flag_key=eq.${key}`, "service_role", "DELETE");
        expect(deleted.status).toBe(200);
        expect(await deleted.json()).toHaveLength(1);
    });
    for (const role of ["anon", "owner", "nonowner"]) {
        for (const method of ["POST", "PATCH", "DELETE"]) {
            it(`${role} cannot ${method} through feature_flags_public or change canonical flags`, async () => {
                const key = `${PREFIX}view-${role}-${method.toLowerCase()}`;
                const insertKey = `${key}-insert`;
                const selector = `feature_flags?flag_key=in.(${key},${insertKey})`;
                const canonical = {
                    flag_key: key, enabled: false, label: "Canonical service update",
                    environment: "development", config: { secret_canary: "private-view-write-control" },
                };
                try {
                    const inserted = await request("feature_flags", "service_role", "POST", { ...canonical, label: "Canonical service insert" });
                    expect(inserted.status).toBe(201);
                    expect(await inserted.json()).toHaveLength(1);
                    const updated = await request(`feature_flags?flag_key=eq.${key}`, "service_role", "PATCH", { label: canonical.label });
                    expect(updated.status).toBe(200);
                    expect((await updated.json())[0]).toMatchObject(canonical);

                    for (const readRole of [role, "service_role"]) {
                        const view = await request(`feature_flags_public?flag_key=eq.${key}&select=flag_key,enabled,label,config`, readRole);
                        expect(view.status).toBe(200);
                        expect(await view.json()).toEqual([{ flag_key: key, enabled: false, label: canonical.label, config: {} }]);
                    }
                    const write = await request(method === "POST" ? "feature_flags_public" : `feature_flags_public?flag_key=eq.${key}`, role, method,
                        method === "POST" ? { flag_key: insertKey, enabled: true, label: "Unauthorized view insert", environment: "development" }
                            : method === "PATCH" ? { enabled: true, label: "Unauthorized view update" } : undefined);
                    const preserved = await request(`${selector}&select=flag_key,enabled,label,environment,config`, "service_role");
                    expect(preserved.status).toBe(200);
                    expect.soft(await preserved.json()).toEqual([canonical]);
                    await permissionDenied(write);
                } finally {
                    const cleaned = await request(selector, "service_role", "DELETE");
                    expect(cleaned.status).toBe(200);
                    const remaining = await request(`${selector}&select=flag_key`, "service_role");
                    expect(remaining.status).toBe(200);
                    expect(await remaining.json()).toEqual([]);
                }
            });
        }
    }
    it("owner favorite writes/read/delete succeed; nonowner cannot read or delete it, nor insert for the owner", async () => {
        const inserted = await request("user_favorites", "owner", "POST", { user_id: ids[0], story_id: STORY });
        expect(inserted.status).toBe(201);
        const id = (await inserted.json())[0].id;
        const own = await request(`user_favorites?id=eq.${id}`, "owner");
        expect(own.status).toBe(200);
        expect(await own.json()).toHaveLength(1);
        const other = await request(`user_favorites?id=eq.${id}`, "nonowner");
        expect(other.status).toBe(200);
        expect(await other.json()).toEqual([]);
        const deletion = await request(`user_favorites?id=eq.${id}`, "nonowner", "DELETE");
        expect(deletion.status).toBe(200);
        expect(await deletion.json()).toEqual([]);
        await permissionDenied(await request("user_favorites", "nonowner", "POST", { user_id: ids[0], story_id: STORY }));
        const deleted = await request(`user_favorites?id=eq.${id}`, "owner", "DELETE");
        expect(deleted.status).toBe(200);
        expect(await deleted.json()).toHaveLength(1);
    });
    it("profile and suggestion owner boundaries preserve authenticated positive controls", async () => {
        for (const [table, key, value] of [["user_profiles", "user_id", ids[0]], ["story_suggestions", "id", SUGGESTION]]) {
            const own = await request(`${table}?${key}=eq.${value}`, "owner");
            expect(own.status).toBe(200);
            expect(await own.json()).toHaveLength(1);
            const other = await request(`${table}?${key}=eq.${value}`, "nonowner");
            expect(other.status).toBe(200);
            expect(await other.json()).toEqual([]);
        }
        const suggestion = await request("story_suggestions", "owner", "POST", { user_id: ids[0], place_name: `${PREFIX}owner-suggestion` });
        expect(suggestion.status).toBe(201);
        expect(await suggestion.json()).toHaveLength(1);
        await permissionDenied(await request("story_suggestions", "nonowner", "POST", { user_id: ids[0], place_name: `${PREFIX}spoof` }));
        const anonymous = await fetch(`${LOCAL_REST_URL}/story_suggestions`, { method: "POST", headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${LOCAL_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ user_id: null, place_name: `${PREFIX}anonymous-suggestion` }) });
        expect(anonymous.status).toBe(201);
        const confirmation = await request(`story_suggestions?place_name=eq.${PREFIX}anonymous-suggestion`, "service_role");
        expect(confirmation.status).toBe(200);
        expect(await confirmation.json()).toHaveLength(1);
    });
    it("profile role escalation and suggestion admin mutations are forbidden through real HTTP",async()=>{
      const forbiddenWrite=async(res:Response)=>{if(res.status===200)expect(await res.json()).toEqual([]);else await permissionDenied(res);};
      for(const role of ["anon","owner","nonowner"]){
        await forbiddenWrite(await request(`user_profiles?user_id=eq.${ids[0]}`,role,"PATCH",{role:"admin"}));
        await forbiddenWrite(await request(`user_profiles?user_id=eq.${ids[0]}`,role,"DELETE"));
        await permissionDenied(await request("user_profiles",role,"POST",{user_id:ids[0],email:"synthetic-escalation@example.test",role:"admin"}));
        await forbiddenWrite(await request(`story_suggestions?id=eq.${SUGGESTION}`,role,"PATCH",{admin_notes:"unauthorized synthetic note",status:"converted"}));
        await forbiddenWrite(await request(`story_suggestions?id=eq.${SUGGESTION}`,role,"DELETE"));
      }
      const profile=await request(`user_profiles?user_id=eq.${ids[0]}`,"service_role");expect((await profile.json())[0].role).toBe("user");
      const update=await request(`user_profiles?user_id=eq.${ids[0]}`,"service_role","PATCH",{email:"synthetic-profile-positive@example.test"});expect(update.status).toBe(200);expect((await update.json())[0]).toMatchObject({email:"synthetic-profile-positive@example.test",role:"user"});
    });
    const rpcs = databaseRpcFixtures(fixtures, () => ids[0], STORY, PREFIX, SUGGESTION);
    it("every installed non-trigger SECURITY DEFINER RPC has reviewed arguments and all four HTTP role controls", () => {
        const installed = psql("SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef AND p.prorettype<>'trigger'::regtype ORDER BY 1;").split("\n");
        expect(installed.sort()).toEqual(rpcs.map(r => r.signature).sort());
        for (const fixture of rpcs) {
            const keys = Object.keys(fixture.args()).sort();
            const actual = JSON.parse(psql(`SELECT COALESCE(to_json(proargnames[1:pronargs]),'[]'::json)::text FROM pg_proc WHERE oid='public.${fixture.signature}'::regprocedure;`));
            expect(keys, fixture.signature).toEqual(actual.sort());
            expect(psql(`SELECT has_function_privilege('service_role','public.${fixture.signature}','EXECUTE') AND NOT has_function_privilege('anon','public.${fixture.signature}','EXECUTE') AND NOT has_function_privilege('authenticated','public.${fixture.signature}','EXECUTE');`)).toBe("t");
        }
    });
    for (const fixture of rpcs) {
        const name = fixture.signature.split("(")[0];
        for (const role of ["anon", "owner", "nonowner"]) {
            it(`${role} cannot invoke private ${fixture.signature}`, async () => { await permissionDenied(await request(`rpc/${name}`, role, "POST", fixture.args())); });
        }
        it(`service_role actually invokes ${fixture.signature} with valid fixtures`, async () => {
            fixture.prepare?.();
            const res = await request(`rpc/${name}`, "service_role", "POST", fixture.args());
            expect(res.status, `${fixture.signature}: ${await res.clone().text()}`).toBeOneOf([200, 204]);
            fixture.verify(res.status === 204 ? null : await res.json());
            if (name === "grant_day_pass_idempotent") {
                for (const role of ["owner", "nonowner"]) {
                    const purchase = await request(`voice_purchases?payment_provider_id=eq.${PREFIX}pass`, role);
                    expect(purchase.status).toBe(200);
                    expect(await purchase.json()).toHaveLength(role === "owner" ? 1 : 0);
                }
                await permissionDenied(await request("voice_purchases", "owner", "POST", { user_id: ids[0], purchase_type: "day_pass", payment_provider_id: `${PREFIX}spoof-pass`, expires_at: new Date(Date.now() + 86400000).toISOString(), amount_paid: 100 }));
            }
        });
    }
    it("seeds an owner favorite as a positive control for public invoker counts",async()=>{
      const res=await request("user_favorites","owner","POST",{user_id:ids[0],story_id:STORY});expect(res.status).toBe(201);expect(await res.json()).toHaveLength(1);
    });
    const publicRpcs = [
        { signature: "match_chunks(vector,double precision,integer)", name: "match_chunks", args: () => ({ query_embedding: EMBEDDING, match_threshold: 0.99, match_count: 5 }), verify: (value: unknown) => expect(value).toEqual(expect.arrayContaining([expect.objectContaining({ id: CHUNK, content: "Synthetic contract chunk" })])) },
        { signature: "get_story_favorite_count(uuid)", name: "get_story_favorite_count", args: () => ({ p_story_id: STORY }), verify: (value: unknown, role: string) => expect(Number(value)).toBe(role === "owner" || role === "service_role" ? 1 : 0) },
        { signature: "has_active_voice_access(uuid)", name: "has_active_voice_access", args: () => ({ p_user_id: ids[0] }), verify: (value: unknown, role: string) => expect(value).toBe(role === "owner" || role === "service_role") },
        { signature: "get_active_voice_purchase(uuid)", name: "get_active_voice_purchase", args: () => ({ p_user_id: ids[0] }), verify: (value: unknown, role: string) => expect(value).toEqual(role === "owner" || role === "service_role" ? [expect.objectContaining({ purchase_type: "day_pass" })] : []) },
    ];
    it("all non-trigger application RPCs are classified, including invoker ownership filters", () => {
        const installed = psql("SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prorettype<>'trigger'::regtype AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e');").split("\n").sort();
        expect(installed).toEqual([...rpcs, ...publicRpcs].map(r => r.signature).sort());
    });
    for (const fixture of publicRpcs) {
        for (const role of ["anon", "owner", "nonowner", "service_role"]) {
            it(`${role} invokes public ${fixture.signature} with invoker ownership enforced`, async () => {
                const res = await request(`rpc/${fixture.name}`, role, "POST", fixture.args());
                expect(res.status, await res.clone().text()).toBe(200);
                fixture.verify(await res.json(), role);
            });
        }
    }
    for (const role of ["anon", "owner", "nonowner"]) {
        it(`${role} cannot inspect retention eligibility view`, async () => { await permissionDenied(await request("booking_retention_eligibility?select=*", role)); });
    }
    it("future tables created by each actual public-table owner inherit no public client privileges", () => {
        const owners = psql("SELECT DISTINCT pg_get_userbyid(relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1;").split("\n");
        for (const owner of owners) {
            const name = "zz_future_private_contract";
            try {
                psql(`SET ROLE "${owner.replaceAll('"', '""')}"; CREATE TABLE public.${name}(id uuid PRIMARY KEY, secret text); RESET ROLE;`);
                expect(psql(`SELECT has_table_privilege('anon','public.${name}','SELECT') OR has_table_privilege('authenticated','public.${name}','SELECT');`)).toBe("f");
            }
            finally {
                psql(`DROP TABLE IF EXISTS public.${name};`);
            }
        }
    });
});
