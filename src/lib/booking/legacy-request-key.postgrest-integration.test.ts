// @vitest-environment node
// Issue #1032: historical migration 053 drifted from production. Migration 131
// reconciles the fresh-reset and 1.9.0 deployed shapes of pending_bookings and
// holds legacy calls without a request key out of retention for good.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isPhoneConfirmationCall } from "@/lib/booking/phone-config";
import { isLocalSupabaseReachable, localServiceClient, psql, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
vi.setConfig({ testTimeout: 30000, hookTimeout: 20000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable)
    warnLocalSupabaseUnreachable("legacy-request-key.postgrest-integration.test.ts");
const PREFIX = "legacy-request-key-";
const LEGACY = "b0131000-0000-4000-8000-000000000001";
const LEGACY_PENDING = "b0131000-0000-4000-8000-000000000002";
const LEGACY_REVIEW = "b0131000-0000-4000-8000-000000000003";
const KEYED = "b0131000-0000-4000-8000-000000000004";
const IDS = [LEGACY, LEGACY_PENDING, LEGACY_REVIEW, KEYED];
// Old anchors and an old as-of keep every redaction call away from rows other
// suites seed with recent anchors.
const ANCHOR = "2025-01-01T00:00:00Z";
const AS_OF = "2025-06-01T00:00:00Z";
const migrations = join(process.cwd(), "supabase/migrations");
const MIGRATION = readFileSync(join(migrations, "131_legacy_request_key_retention_hold.sql"), "utf8");
const RETENTION_128 = readFileSync(join(migrations, "128_booking_retention.sql"), "utf8");
const sql = (s: string) => `'${s.replaceAll("'", "''")}'`;
function extract(source: string, start: string, end: string) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    if (from < 0 || to < 0)
        throw new Error(`128 definition not found: ${start}`);
    return source.slice(from, to + end.length).replace(/^CREATE (VIEW|FUNCTION)/, "CREATE OR REPLACE $1");
}
// The schema as it stood after 128-130 on a fresh reset: no request-key guard,
// the 128 view and redaction function, and the edited 053 NOT NULL key.
const BEFORE_131 = [
    "DROP TRIGGER IF EXISTS a_pending_booking_request_key_guard ON public.pending_bookings;",
    "DROP FUNCTION IF EXISTS public.guard_pending_booking_request_key();",
    extract(RETENTION_128, "CREATE VIEW public.booking_retention_eligibility", "FROM public.pending_bookings b;"),
    extract(RETENTION_128, "CREATE FUNCTION public.redact_expired_bookings(", "END $$;"),
].join("\n");
const FRESH_BEFORE_131 = `${BEFORE_131}\nALTER TABLE public.pending_bookings ALTER COLUMN idempotency_key SET NOT NULL;`;
// Production after the one-time 1.9.0 compatibility repair
// (docs/release/1.9.0-historical-schema-reconciliation.sql): original 053
// conversation constraint and lookup index, nullable key, legacy NULL rows that
// predate the 128 terminal columns.
const LEGACY_BEFORE_131 = `${BEFORE_131}
ALTER TABLE public.pending_bookings ALTER COLUMN idempotency_key DROP NOT NULL;
DROP INDEX public.idx_pending_bookings_conversation_id;
CREATE INDEX idx_pending_bookings_conversation_id ON public.pending_bookings USING btree (conversation_id);
ALTER TABLE public.pending_bookings ADD CONSTRAINT pending_bookings_conversation_id_key UNIQUE (conversation_id);
SET LOCAL session_replication_role = replica;
INSERT INTO public.pending_bookings (id,idempotency_key,conversation_id,venue_name,venue_phone,customer_name,customer_phone,party_size,booking_date,booking_time,status,created_at,updated_at) VALUES
  ('${LEGACY}',NULL,'${PREFIX}conversation-1','Private venue','+34999999999','Private customer','+34666666666',2,'2026-01-01','12:00','confirmed','2026-04-01T10:00:00Z','2026-04-01T10:05:00Z'),
  ('${LEGACY_PENDING}',NULL,'${PREFIX}conversation-2','Private venue','+34999999999','Private customer','+34666666666',2,'2026-01-01','12:00','pending','2026-04-02T10:00:00Z','2026-04-02T10:05:00Z');
SET LOCAL session_replication_role = origin;
CREATE TEMP TABLE legacy_before ON COMMIT DROP AS SELECT id, to_jsonb(b) AS original FROM public.pending_bookings b WHERE id IN ('${LEGACY}','${LEGACY_PENDING}');`;
const CATALOG = `jsonb_build_object(
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attname) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.pending_bookings'::regclass AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(conname||' '||pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.pending_bookings'::regclass),
  'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='pending_bookings'),
  'triggers',(SELECT jsonb_agg(tgname||' '||tgenabled::text||' '||pg_get_triggerdef(oid) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='public.pending_bookings'::regclass AND NOT tgisinternal),
  'view',pg_get_viewdef('public.booking_retention_eligibility'::regclass),
  'functions',(SELECT jsonb_agg(p.oid::regprocedure::text||' '||p.prosecdef||' '||array_to_string(p.proconfig,',')||' '||md5(p.prosrc) ORDER BY 1) FROM pg_proc p WHERE p.oid IN ('public.guard_pending_booking_request_key()'::regprocedure,'public.redact_expired_bookings(timestamptz,integer,boolean)'::regprocedure)),
  'privileges',(SELECT jsonb_agg(r||' '||has_function_privilege(r,'public.redact_expired_bookings(timestamptz,integer,boolean)','EXECUTE')||' '||has_table_privilege(r,'public.booking_retention_eligibility','SELECT') ORDER BY r) FROM unnest(ARRAY['anon','authenticated','service_role']) r))`;
const DISPOSITIONS = `(SELECT jsonb_object_agg(id,disposition) FROM public.booking_retention_eligibility WHERE id IN ('${LEGACY}','${LEGACY_PENDING}'))`;
// Write probes record the SQLSTATE each forbidden write raises.
const WRITE_PROBES = `CREATE TEMP TABLE probe(name text, code text) ON COMMIT DROP;
DO $p$ BEGIN INSERT INTO public.pending_bookings (idempotency_key,venue_name,venue_phone,customer_name,customer_phone,party_size,booking_date,booking_time) VALUES ('${PREFIX}duplicate','v','+34999999999','c','+34666666666',1,'2088-01-01','10:00'),('${PREFIX}duplicate','v','+34999999999','c','+34666666666',1,'2088-01-01','10:00'); INSERT INTO probe VALUES ('duplicate','none'); EXCEPTION WHEN OTHERS THEN INSERT INTO probe VALUES ('duplicate',SQLSTATE); END $p$;
DO $p$ BEGIN INSERT INTO public.pending_bookings (idempotency_key,venue_name,venue_phone,customer_name,customer_phone,party_size,booking_date,booking_time) VALUES (NULL,'v','+34999999999','c','+34666666666',1,'2088-01-01','10:00'); INSERT INTO probe VALUES ('null_insert','none'); EXCEPTION WHEN OTHERS THEN INSERT INTO probe VALUES ('null_insert',SQLSTATE); END $p$;
DO $p$ BEGIN UPDATE public.pending_bookings SET idempotency_key='${PREFIX}fabricated' WHERE id='${LEGACY}'; INSERT INTO probe VALUES ('fabricate','none'); EXCEPTION WHEN OTHERS THEN INSERT INTO probe VALUES ('fabricate',SQLERRM); END $p$;`;
const PROBES = `(SELECT jsonb_object_agg(name,code) FROM probe)`;
const LOCK_TIMEOUT = /canceling statement due to lock timeout/;
/**
 * Runs the steps in one transaction that always rolls back, then returns the
 * JSON the final expression produced. A short lock timeout makes this suite
 * give way (and retry) instead of deadlocking a parallel suite's writer.
 */
function rolledBack(steps: string[], result: string, lockSchema = true): Record<string, unknown> {
    const script = ["BEGIN;", "SET LOCAL lock_timeout = '500ms';",
        ...(lockSchema ? ["LOCK TABLE public.pending_bookings, public.booking_retention_eligibility IN ACCESS EXCLUSIVE MODE;"] : []),
        ...steps, `SELECT 'RESULT:'||(${result})::text;`, "ROLLBACK;"].join("\n");
    for (let attempt = 1;; attempt++) {
        try {
            const line = psql(script).split("\n").find(l => l.startsWith("RESULT:"));
            if (!line)
                throw new Error("transaction produced no result");
            return JSON.parse(line.slice("RESULT:".length));
        }
        catch (error) {
            if (attempt >= 20 || !LOCK_TIMEOUT.test(String((error as { stderr?: unknown }).stderr ?? error)))
                throw error;
        }
    }
}
/** Inserts as a pre-131 writer would have: triggers off, terminal anchor as given. */
function seedSql(id: string, key: string | null, status: string, anchor: string | null) {
    return `SET LOCAL session_replication_role=replica; INSERT INTO public.pending_bookings (id,idempotency_key,conversation_id,venue_name,venue_phone,customer_name,customer_phone,party_size,booking_date,booking_time,special_requests,status,terminal_at,terminal_anchor_source) VALUES ('${id}',${key === null ? "NULL" : sql(key)},'${PREFIX}conversation-${id}','Private venue','+34999999999','Private customer','+34666666666',2,'2026-01-01','12:00','Private special request','${status}',${anchor ? sql(anchor) : "NULL"},${anchor ? "'reviewed_history'" : "NULL"}); SET LOCAL session_replication_role=origin;`;
}
function seed(id: string, key: string | null, status: string, anchor: string | null) {
    psql(`BEGIN; ${seedSql(id, key, status, anchor)} COMMIT;`);
}
function cleanup() {
    psql(`DELETE FROM public.pending_bookings WHERE id IN (${IDS.map(sql).join(",")}) OR idempotency_key LIKE '${PREFIX}%';`);
}
function row(id: string) { return JSON.parse(psql(`SELECT row_to_json(p)::text FROM public.pending_bookings p WHERE id='${id}';`)); }
function disposition(id: string) { return psql(`SELECT disposition FROM public.booking_retention_eligibility WHERE id='${id}';`); }
async function redact(dry = false) {
    const result = await localServiceClient().rpc("redact_expired_bookings", { p_as_of: AS_OF, p_batch_limit: 100, p_dry_run: dry });
    expect(result.error).toBeNull();
    return result.data as { eligible: number; redacted: number; held_unknown_anchor: number; held_dependencies: number; held_legacy_null_request_key: number; recovery_action: string };
}
function backdateAnchor(id: string) {
    psql(`UPDATE public.pending_bookings SET terminal_at='${ANCHOR}' WHERE id='${id}';`);
}
describe.skipIf(!reachable)("Legacy NULL request keys: schema reconciliation and retention hold (real PostgREST)", () => {
    beforeEach(cleanup);
    afterAll(cleanup);
    it("fresh reset schema: a second run changes nothing and keeps one canonical request-key shape", () => {
        const result = rolledBack([FRESH_BEFORE_131, MIGRATION, `CREATE TEMP TABLE first_run ON COMMIT DROP AS SELECT ${CATALOG} AS value;`, MIGRATION],
            `jsonb_build_object('first',(SELECT value FROM first_run),'second',${CATALOG})`);
        expect(result.second).toEqual(result.first);
        const catalog = result.first as { columns: { name: string; notnull: boolean; default: string | null }[]; constraints: string[]; indexes: string[]; triggers: string[] };
        expect(catalog.columns.find(c => c.name === "idempotency_key")).toEqual({ name: "idempotency_key", notnull: false, default: null });
        expect(catalog.columns.find(c => c.name === "conversation_id")).toMatchObject({ notnull: false });
        expect(catalog.columns.find(c => c.name === "status")).toMatchObject({ default: "'initiating'::text" });
        expect(catalog.indexes).toContain("CREATE UNIQUE INDEX idx_pending_bookings_idempotency_key ON public.pending_bookings USING btree (idempotency_key)");
        expect(catalog.indexes).toContain("CREATE UNIQUE INDEX idx_pending_bookings_conversation_id ON public.pending_bookings USING btree (conversation_id) WHERE (conversation_id IS NOT NULL)");
        expect(catalog.constraints).not.toContain("pending_bookings_conversation_id_key UNIQUE (conversation_id)");
        expect(catalog.triggers.some(t => t.startsWith("a_pending_booking_request_key_guard O "))).toBe(true);
    });
    it("1.9.0 deployed schema: converges to the fresh-reset catalog, preserves legacy rows and keeps their keys NULL", () => {
        const fresh = rolledBack([FRESH_BEFORE_131, MIGRATION], CATALOG);
        const legacy = rolledBack([LEGACY_BEFORE_131,
            `UPDATE public.pending_bookings SET terminal_at='${ANCHOR}',terminal_anchor_source='reviewed_history' WHERE id='${LEGACY}';`,
            `UPDATE legacy_before l SET original=to_jsonb(b) FROM public.pending_bookings b WHERE b.id=l.id;`,
            `CREATE TEMP TABLE before_dispositions ON COMMIT DROP AS SELECT ${DISPOSITIONS} AS value;`,
            MIGRATION, `CREATE TEMP TABLE first_run ON COMMIT DROP AS SELECT ${CATALOG} AS value;`, MIGRATION, WRITE_PROBES],
            `jsonb_build_object('before',(SELECT value FROM before_dispositions),'after',${DISPOSITIONS},'first',(SELECT value FROM first_run),'second',${CATALOG},
              'preserved',(SELECT bool_and(l.original=to_jsonb(b)) AND count(*)=2 FROM legacy_before l JOIN public.pending_bookings b USING (id)),
              'null_keys',(SELECT count(*) FROM public.pending_bookings WHERE id IN ('${LEGACY}','${LEGACY_PENDING}') AND idempotency_key IS NULL),
              'probes',${PROBES})`);
        // The 128 view releases an anchored NULL-key row; this is the defect.
        expect(legacy.before).toEqual({ [LEGACY]: "eligible_terminal", [LEGACY_PENDING]: "nonterminal_or_reconciliation" });
        expect(legacy.after).toEqual({ [LEGACY]: "legacy_null_request_key", [LEGACY_PENDING]: "legacy_null_request_key" });
        expect(legacy.first).toEqual(fresh);
        expect(legacy.second).toEqual(fresh);
        expect(legacy.preserved).toBe(true);
        expect(legacy.null_keys).toBe(2);
        expect(legacy.probes).toEqual({ duplicate: "23505", null_insert: "23502", fabricate: "pending_booking_request_key_presence_immutable" });
    });
    it("installed schema: request keys are unique and required, and a key can be neither fabricated nor removed", async () => {
        const client = localServiceClient();
        const claim = { venue_name: "Synthetic venue", venue_phone: "+34999999999", customer_name: "Synthetic customer", customer_phone: "+34666666666", party_size: 1, booking_date: "2088-01-01", booking_time: "10:00", status: "initiating" };
        const first = await client.from("pending_bookings").insert({ ...claim, id: KEYED, idempotency_key: `${PREFIX}claim` });
        expect(first.error).toBeNull();
        const duplicate = await client.from("pending_bookings").insert({ ...claim, idempotency_key: `${PREFIX}claim` });
        expect(duplicate.error?.code).toBe("23505");
        const missing = await client.from("pending_bookings").insert({ ...claim, idempotency_key: null });
        expect(missing.error?.code).toBe("23502");
        const removed = await client.from("pending_bookings").update({ idempotency_key: null }).eq("id", KEYED);
        expect(removed.error?.message).toBe("pending_booking_request_key_presence_immutable");
        seed(LEGACY, null, "confirmed", ANCHOR);
        const fabricated = await client.from("pending_bookings").update({ idempotency_key: `${PREFIX}fabricated` }).eq("id", LEGACY);
        expect(fabricated.error?.message).toBe("pending_booking_request_key_presence_immutable");
        expect(row(LEGACY).idempotency_key).toBeNull();
        expect(row(KEYED).idempotency_key).toBe(`${PREFIX}claim`);
    });
    it("an anchored legacy row is held and keeps its PII", async () => {
        seed(LEGACY, null, "confirmed", ANCHOR);
        expect(disposition(LEGACY)).toBe("legacy_null_request_key");
        const dry = await redact(true);
        expect(dry.held_legacy_null_request_key).toBe(1);
        expect(dry.recovery_action).toContain("legacy_null_request_key");
        const result = await redact();
        expect(result.redacted).toBe(0);
        expect(result.held_legacy_null_request_key).toBe(1);
        expect(row(LEGACY)).toMatchObject({ customer_name: "Private customer", customer_phone: "+34666666666", special_requests: "Private special request", pii_redacted_at: null, idempotency_key: null });
    });
    it("the same batch redacts a keyed twin of the held legacy row", () => {
        // Uncommitted, so a parallel suite's redaction run can neither see nor redact the twin.
        const result = rolledBack([seedSql(LEGACY, null, "confirmed", ANCHOR), seedSql(KEYED, `${PREFIX}${KEYED}`, "confirmed", ANCHOR),
            `CREATE TEMP TABLE run ON COMMIT DROP AS SELECT public.redact_expired_bookings('${AS_OF}',100,false) AS value;`],
            `jsonb_build_object('run',(SELECT value FROM run),'rows',(SELECT jsonb_object_agg(id,jsonb_build_object('customer_name',customer_name,'redacted',pii_redacted_at IS NOT NULL)) FROM public.pending_bookings WHERE id IN ('${LEGACY}','${KEYED}')))`, false);
        expect(result.run).toMatchObject({ redacted: 1, held_legacy_null_request_key: 1 });
        expect(result.rows).toEqual({ [KEYED]: { customer_name: "", redacted: true }, [LEGACY]: { customer_name: "Private customer", redacted: false } });
    });
    it("a new terminal transition through the webhook RPC keeps the NULL key, the SMS outbox and the hold", async () => {
        seed(LEGACY_PENDING, null, "pending", null);
        const client = localServiceClient();
        const fetched = await client.from("pending_bookings").select("*").eq("conversation_id", `${PREFIX}conversation-${LEGACY_PENDING}`).maybeSingle();
        expect(fetched.error).toBeNull();
        expect(fetched.data?.idempotency_key).toBeNull();
        expect(isPhoneConfirmationCall(fetched.data)).toBe(false);
        const event = await client.rpc("process_elevenlabs_event_idempotent", { p_event_key: `${PREFIX}event`, p_booking_id: LEGACY_PENDING, p_outcome: "confirmed", p_to_phone: "+34666666666", p_sms_message: "Private SMS" });
        expect(event.error).toBeNull();
        expect(event.data).toBe("processed");
        expect(row(LEGACY_PENDING)).toMatchObject({ status: "confirmed", terminal_anchor_source: "observed_transition", idempotency_key: null });
        const completed = await client.rpc("complete_booking_sms_job", { p_event_key: `${PREFIX}event`, p_provider_sid: "synthetic-sid", p_outcome_message: "Private outcome" });
        expect(completed.error).toBeNull();
        expect(completed.data).toBe(true);
        backdateAnchor(LEGACY_PENDING);
        expect(disposition(LEGACY_PENDING)).toBe("legacy_null_request_key");
        expect((await redact()).redacted).toBe(0);
        expect(row(LEGACY_PENDING)).toMatchObject({ customer_name: "Private customer", outcome_message: "Private outcome", pii_redacted_at: null });
    });
    it("a reviewed manual anchor records evidence but does not release the hold", async () => {
        seed(LEGACY_REVIEW, null, "failed", null);
        expect(disposition(LEGACY_REVIEW)).toBe("legacy_null_request_key");
        const reviewed = await localServiceClient().rpc("review_booking_retention_anchor", { p_booking_id: LEGACY_REVIEW, p_expected_updated_at: row(LEGACY_REVIEW).updated_at, p_evidence_reference: "operator-review:legacy-1032" });
        expect(reviewed.error).toBeNull();
        expect(reviewed.data).toBe(true);
        expect(row(LEGACY_REVIEW)).toMatchObject({ terminal_anchor_source: "reviewed_observation", terminal_anchor_reference: "operator-review:legacy-1032" });
        backdateAnchor(LEGACY_REVIEW);
        expect(disposition(LEGACY_REVIEW)).toBe("legacy_null_request_key");
        expect((await redact()).redacted).toBe(0);
        expect(row(LEGACY_REVIEW)).toMatchObject({ customer_name: "Private customer", pii_redacted_at: null });
    });
});
