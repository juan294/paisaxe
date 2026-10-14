// @vitest-environment node
import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseBoundaryFixtures, type BoundaryFixture } from "@/test/database-boundary-fixtures";
import { isLocalSupabaseReachable, localServiceClient, psql, spawnLocalPsql, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
import { lockRow, releaseRowLock, waitForBackendCount } from "@/test/local-supabase-locks";
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable)
    warnLocalSupabaseUnreachable("retention.postgrest-integration.test.ts");
const PREFIX = "retention-contract-";
const A = "b0030000-0000-4000-8000-000000000001";
const B = "b0030000-0000-4000-8000-000000000002";
const NOW = "2026-10-08T12:00:00Z";
const BOUNDARY = "2026-07-10T12:00:00Z";
const sql = (s: string) => `'${s.replaceAll("'", "''")}'`;
let owner: string | undefined;
let linked: BoundaryFixture[] = [];
function cleanup() {
    for (const fixture of [...linked].reverse()) {
        const clauses = fixture.keys.map(k => `${k}=${sql(String(fixture.payload[k]))}`).join(" AND ");
        psql(`DELETE FROM public.${fixture.table} WHERE ${clauses};`);
    }
    linked = [];
    psql(`DELETE FROM public.pending_bookings WHERE idempotency_key LIKE '${PREFIX}%';`);
}
function seed(id = A, status = "confirmed", anchor: string | null = BOUNDARY) {
    psql(`BEGIN; SET LOCAL session_replication_role=replica; INSERT INTO public.pending_bookings (id,idempotency_key,conversation_id,venue_name,venue_phone,customer_name,customer_phone,party_size,booking_date,booking_time,special_requests,status,terminal_at,terminal_anchor_source) VALUES ('${id}','${PREFIX}${id}','${PREFIX}conversation-${id}','Private venue','+34999999999','Private customer','+34666666666',2,'2026-01-01','12:00','Private special request','${status}',${anchor ? sql(anchor) : 'NULL'},${anchor ? "'reviewed_history'" : 'NULL'}); COMMIT;`);
}
async function redact(options: {
    dry?: boolean;
    limit?: number;
    at?: string;
} = {}) {
    const result = await localServiceClient().rpc("redact_expired_bookings", { p_as_of: options.at ?? NOW, p_batch_limit: options.limit ?? 100, p_dry_run: options.dry ?? false });
    expect(result.error).toBeNull();
    return result.data as {
        eligible: number;
        redacted: number;
        held_unknown_anchor: number;
        held_dependencies: number;
        oldest_hold_days: number | null;
        next_cursor: string | null;
        recovery_action: string;
    };
}
function row(id = A) { return JSON.parse(psql(`SELECT row_to_json(p)::text FROM public.pending_bookings p WHERE id='${id}';`)); }
describe.skipIf(!reachable)("Legacy booking retention (real transactions and PostgREST)", () => {
    beforeAll(async () => { cleanup(); const result = await localServiceClient().auth.admin.createUser({ email: `${PREFIX}payments@example.test`, password: "Local-contract-password-349!", email_confirm: true }); expect(result.error).toBeNull(); owner = result.data.user!.id; });
    beforeEach(cleanup);
    afterAll(async () => { cleanup(); if (owner)
        expect((await localServiceClient().auth.admin.deleteUser(owner)).error).toBeNull(); });
    it("redacts exactly at ninety days and preserves replay keys and SMS tombstones", async () => {
        seed();
        psql(`INSERT INTO public.booking_sms_jobs (event_key,booking_id,to_phone,message,status,last_error,provider_sid) VALUES ('${PREFIX}sms','${A}','+34666666666','Private SMS','dead','Private provider error','retained-provider-id'); INSERT INTO public.elevenlabs_webhook_events(event_key,booking_id) VALUES ('${PREFIX}event','${A}');`);
        const before = await redact({ at: "2026-10-08T11:59:59Z" });
        expect(before.redacted).toBe(0);
        expect(row().customer_name).toBe("Private customer");
        const result = await redact();
        expect(result.redacted).toBe(1);
        expect(row()).toMatchObject({ customer_name: "", customer_phone: "", venue_name: "", venue_phone: "", special_requests: null, outcome_message: null, idempotency_key: `${PREFIX}${A}`, conversation_id: `${PREFIX}conversation-${A}`, status: "confirmed" });
        const sms = JSON.parse(psql(`SELECT row_to_json(j)::text FROM public.booking_sms_jobs j WHERE event_key='${PREFIX}sms';`));
        expect(sms).toMatchObject({ to_phone: "", message: "", last_error: null, status: "dead", provider_sid: "retained-provider-id" });
        expect(psql(`SELECT count(*) FROM public.elevenlabs_webhook_events WHERE booking_id='${A}';`)).toBe("1");
        expect((await redact()).redacted).toBe(0);
    });
    it("dry run reports safe counts and changes no personal fields", async () => {
        seed();
        const before = row();
        const result = await redact({ dry: true });
        expect(result.eligible).toBe(1);
        expect(result.redacted).toBe(0);
        expect(row()).toEqual(before);
        expect(JSON.stringify(result)).not.toMatch(/Private|349999|346666/);
    });
    it.each(["initiating", "pending", "orphaned", "reconciliation", "unrecognized"])("holds nonterminal or unknown state %s", async (status) => {
        seed(A, status);
        expect((await redact()).redacted).toBe(0);
        expect(row().customer_name).toBe("Private customer");
    });
    it("unknown legacy anchor stays visible and reviewed observation starts a full new ninety days", async () => {
        seed(A, "failed", null);
        const result = await redact();
        expect(result.held_unknown_anchor).toBeGreaterThanOrEqual(1);
        expect(result.recovery_action).toContain("review_booking_retention_anchor");
        const reviewed = await localServiceClient().rpc("review_booking_retention_anchor", { p_booking_id: A, p_expected_updated_at: row().updated_at, p_evidence_reference: "operator-review:contract-1" });
        expect(reviewed.error).toBeNull();
        expect(reviewed.data).toBe(true);
        const observed = row().terminal_at;
        expect(Date.now() - Date.parse(observed)).toBeLessThan(10000);
        expect((await redact({ at: psql(`SELECT (terminal_at+interval '90 days'-interval '1 microsecond')::text FROM public.pending_bookings WHERE id='${A}';`) })).redacted).toBe(0);
        expect((await redact({ at: psql(`SELECT (terminal_at+interval '90 days')::text FROM public.pending_bookings WHERE id='${A}';`) })).redacted).toBe(1);
    });
    it.each(["pending", "processing", "failed"])("holds outstanding SMS %s", async (status) => {
        seed();
        psql(`INSERT INTO public.booking_sms_jobs(event_key,booking_id,to_phone,message,status) VALUES('${PREFIX}hold','${A}','private','private','${status}');`);
        expect((await redact()).redacted).toBe(0);
        expect(row().customer_name).toBe("Private customer");
    });
    it("records new terminal transitions atomically without trusting an SMS updated_at", async () => {
        seed(A, "pending", null);
        psql(`UPDATE public.pending_bookings SET status='denied' WHERE id='${A}';`);
        const anchor = row().terminal_at;
        expect(anchor).not.toBeNull();
        psql(`UPDATE public.pending_bookings SET outcome_message='new message' WHERE id='${A}';`);
        expect(row().terminal_at).toBe(anchor);
    });
    it("late webhook, SMS enqueue and completion cannot resurrect redacted PII", async () => {
        seed();
        await redact();
        const client = localServiceClient();
        const event = await client.rpc("process_elevenlabs_event_idempotent", { p_event_key: `${PREFIX}late`, p_booking_id: A, p_outcome: "confirmed", p_to_phone: "private phone", p_sms_message: "private message" });
        expect(event.error).toBeNull();
        expect(event.data).toBe("retained");
        const enqueue = await client.rpc("enqueue_booking_sms_job", { p_event_key: `${PREFIX}late-sms`, p_booking_id: A, p_to_phone: "private", p_message: "private" });
        expect(enqueue.error).toBeNull();
        expect(enqueue.data).toBe("retained");
        psql(`UPDATE public.pending_bookings SET customer_name='resurrect',outcome_message='resurrect',status='pending' WHERE id='${A}';`);
        expect(row()).toMatchObject({ customer_name: "", outcome_message: null, status: "confirmed" });
        expect(psql(`SELECT count(*) FROM public.booking_sms_jobs WHERE booking_id='${A}';`)).toBe("0");
    });
    it("skips a locked row, bounds batches and resumes without duplicate redaction", async () => {
        seed();
        seed(B);
        const locker = await lockRow("pending_bookings", A, "retention-contract-lock");
        try {
            expect((await redact({ limit: 1 })).redacted).toBe(1);
            expect(row().pii_redacted_at).toBeNull();
            expect(row(B).pii_redacted_at).not.toBeNull();
        }
        finally {
            releaseRowLock(locker, "retention-contract-lock");
        }
        expect((await redact({ limit: 1 })).redacted).toBe(1);
        expect((await redact()).redacted).toBe(0);
    });
    it("overlapping SMS completion and enqueue acquire parent before SMS without a lock cycle", async () => {
        seed(A, "pending", null);
        const event = `${PREFIX}overlap`;
        psql(`INSERT INTO public.booking_sms_jobs(event_key,booking_id,to_phone,message,status) VALUES('${event}','${A}','private','private','processing');`);
        const names = ["retention-contract-enqueue", "retention-contract-complete"];
        const first = spawnLocalPsql();
        let output = "";
        let errors = "";
        first.stdout.on("data", c => output += c.toString());
        first.stderr.on("data", c => errors += c.toString());
        first.stdin.write(`SET application_name='${names[0]}'; BEGIN; SELECT 1 FROM public.pending_bookings WHERE id='${A}' FOR UPDATE; SELECT 'parent-locked';\n`);
        let second: ReturnType<typeof spawn> | undefined;
        try {
            await vi.waitFor(() => expect(output).toContain("parent-locked"));
            second = spawnLocalPsql(`SET application_name='${names[1]}'; BEGIN; SELECT public.complete_booking_sms_job('${event}','synthetic-sid','completed message'); COMMIT;`);
            let secondErrors = "";
            second.stderr!.on("data", c => secondErrors += c.toString());
            const secondExit = once(second, "exit");
            await waitForBackendCount(`application_name='${names[1]}' AND wait_event_type='Lock'`, 1);
            const firstExit = once(first, "exit");
            first.stdin.end(`SELECT public.enqueue_booking_sms_job('${event}','${A}','private','refreshed message'); COMMIT;\n`);
            const [firstCode] = await firstExit;
            const [secondCode] = await secondExit;
            expect(firstCode, errors).toBe(0);
            expect(secondCode, secondErrors).toBe(0);
            expect(errors + secondErrors).not.toMatch(/deadlock detected/);
            expect(psql(`SELECT status FROM public.booking_sms_jobs WHERE event_key='${event}';`)).toBe("sent");
        }
        finally {
            psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name IN ('${names[0]}','${names[1]}');`);
            first.kill();
            second?.kill();
        }
    });
    async function paymentGraph() {
        const needed = new Set(["merchants", "experiences", "experience_facts", "booking_drafts", "quotes", "holds", "bookings", "payments"]);
        for (const fixture of databaseBoundaryFixtures(owner!, A, PREFIX).filter(f => needed.has(f.table))) {
            if (fixture.table === "bookings") {
                fixture.payload.status = "confirmed";
                fixture.payload.slot_date = "2026-01-01";
            }
            if (fixture.table === "payments") {
                fixture.payload.phone_call_id = A;
                fixture.payload.status = "captured";
                fixture.payload.capture_id = `${PREFIX}capture`;
            }
            const result = await localServiceClient().from(fixture.table).insert(fixture.payload);
            expect(result.error, fixture.table).toBeNull();
            linked.push(fixture);
        }
        return linked.find(f => f.table === "payments")!.payload.id as string;
    }
    it.each(["capture_pending", "refund_pending", "refund_failed"])("retains payment link and PII while linked payment is %s", async (status) => {
        seed();
        const payment = await paymentGraph();
        psql(`UPDATE public.payments SET status='${status}' WHERE id='${payment}';`);
        expect((await redact()).redacted).toBe(0);
        expect(row().customer_name).toBe("Private customer");
        expect(psql(`SELECT disposition FROM public.booking_retention_eligibility WHERE id='${A}';`)).toBe("linked_reconciliation");
    });
    it("settled past payment linkage survives redaction and late reconciliation cannot resurrect PII", async () => {
        seed();
        const payment = await paymentGraph();
        expect((await redact()).redacted).toBe(1);
        expect(psql(`SELECT phone_call_id FROM public.payments WHERE id='${payment}';`)).toBe(A);
        psql(`UPDATE public.payments SET status='refund_pending',compensation_reason='synthetic-reconciliation' WHERE id='${payment}'; UPDATE public.pending_bookings SET customer_name='resurrect',customer_phone='resurrect',status='reconciliation' WHERE id='${A}';`);
        expect(row()).toMatchObject({ customer_name: "", customer_phone: "", status: "confirmed" });
        expect(psql(`SELECT phone_call_id FROM public.payments WHERE id='${payment}';`)).toBe(A);
        expect((await redact()).redacted).toBe(0);
    });
    it("unlinked phone-confirmation keys and unpaid invoices remain visible dependency holds", async () => {
        seed();
        psql(`UPDATE public.pending_bookings SET idempotency_key='phone-confirmation:${PREFIX}unlinked' WHERE id='${A}';`);
        try {
            expect((await redact()).redacted).toBe(0);
            expect(psql(`SELECT disposition FROM public.booking_retention_eligibility WHERE id='${A}';`)).toBe("unlinked_phone_confirmation");
        }
        finally {
            psql(`UPDATE public.pending_bookings SET idempotency_key='${PREFIX}${A}' WHERE id='${A}';`);
        }
        await paymentGraph();
        const booking = linked.find(f => f.table === "bookings")!.payload.id;
        psql(`UPDATE public.bookings SET invoice_id='synthetic-invoice',invoice_status='draft' WHERE id='${booking}';`);
        expect((await redact()).redacted).toBe(0);
        psql(`UPDATE public.bookings SET invoice_status='paid',balance_paid_at=now() WHERE id='${booking}';`);
        expect((await redact()).redacted).toBe(1);
    });
    it("direct SMS mutation retries visibly under parent contention and retained completion stays blank", async () => {
        seed();
        psql(`INSERT INTO public.booking_sms_jobs(event_key,booking_id,to_phone,message,status) VALUES('${PREFIX}late-complete','${A}','private','private','sent');`);
        const locker = await lockRow("pending_bookings", A, "retention-contract-direct-lock");
        try {
            const result = await localServiceClient().from("booking_sms_jobs").update({ message: "private change" }).eq("event_key", `${PREFIX}late-complete`);
            expect(result.error?.code).toBe("55P03");
        }
        finally {
            releaseRowLock(locker, "retention-contract-direct-lock");
        }
        expect((await redact()).redacted).toBe(1);
        const completed = await localServiceClient().rpc("complete_booking_sms_job", { p_event_key: `${PREFIX}late-complete`, p_provider_sid: "retained-sid", p_outcome_message: "private late message" });
        expect(completed.error).toBeNull();
        expect(completed.data).toBe(true);
        expect(row().outcome_message).toBeNull();
        expect(psql(`SELECT message||to_phone||COALESCE(last_error,'') FROM public.booking_sms_jobs WHERE event_key='${PREFIX}late-complete';`)).toBe("");
    });
    it("stale review CAS and invalid parameters cannot advance a legacy retention clock", async () => {
        seed(A, "failed", null);
        const stale = row().updated_at;
        psql(`UPDATE public.pending_bookings SET special_requests='changed' WHERE id='${A}';`);
        const review = await localServiceClient().rpc("review_booking_retention_anchor", { p_booking_id: A, p_expected_updated_at: stale, p_evidence_reference: "contract-review:stale" });
        expect(review.error).toBeNull();
        expect(review.data).toBe(false);
        expect(row().terminal_at).toBeNull();
        for (const limit of [0, 1001]) {
            const result = await localServiceClient().rpc("redact_expired_bookings", { p_as_of: NOW, p_batch_limit: limit, p_dry_run: false });
            expect(result.error?.message).toBe("invalid_retention_parameters");
        }
    });
    it("concurrent batches overlap while each claims a different parent exactly once",async()=>{
      seed();seed(B);
      psql(`CREATE FUNCTION public.zz_retention_batch_overlap() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NEW.pii_redacted_at IS NOT NULL AND OLD.pii_redacted_at IS NULL THEN PERFORM pg_sleep(2); END IF; RETURN NEW; END $$; CREATE TRIGGER zz_retention_batch_overlap BEFORE UPDATE ON public.pending_bookings FOR EACH ROW EXECUTE FUNCTION public.zz_retention_batch_overlap();`);
      let first:ReturnType<typeof redact>|undefined;let second:ReturnType<typeof redact>|undefined;
      try{
        first=redact({limit:1});
        await waitForBackendCount("query LIKE '%redact_expired_bookings%' AND wait_event='PgSleep'",1);
        second=redact({limit:1});
        await waitForBackendCount("query LIKE '%redact_expired_bookings%' AND wait_event='PgSleep'",2);
        const results=await Promise.all([first,second]);expect(results.map(r=>r.redacted)).toEqual([1,1]);
        expect(row().pii_redacted_at).not.toBeNull();expect(row(B).pii_redacted_at).not.toBeNull();expect((await redact()).redacted).toBe(0);
      }finally{
        await Promise.allSettled([first,second].filter((p):p is ReturnType<typeof redact>=>p!==undefined));
        psql("DROP TRIGGER zz_retention_batch_overlap ON public.pending_bookings; DROP FUNCTION public.zz_retention_batch_overlap();");
      }
    });
    it("a failing SMS redaction rolls back the booking and a corrected retry resumes", async () => {
        seed();
        psql(`INSERT INTO public.booking_sms_jobs(event_key,booking_id,to_phone,message,status) VALUES('${PREFIX}rollback','${A}','private','private','sent'); CREATE FUNCTION public.zz_retention_failure() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'retention_contract_failure'; END $$; CREATE TRIGGER zz_retention_failure BEFORE UPDATE ON public.booking_sms_jobs FOR EACH ROW EXECUTE FUNCTION public.zz_retention_failure();`);
        try {
            const result = await localServiceClient().rpc("redact_expired_bookings", { p_as_of: NOW, p_batch_limit: 100, p_dry_run: false });
            expect(result.error?.message).toContain("retention_contract_failure");
            expect(row().customer_name).toBe("Private customer");
        }
        finally {
            psql("DROP TRIGGER zz_retention_failure ON public.booking_sms_jobs; DROP FUNCTION public.zz_retention_failure();");
        }
        expect((await redact()).redacted).toBe(1);
    });
});
