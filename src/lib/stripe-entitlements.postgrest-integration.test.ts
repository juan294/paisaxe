// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { POST } from "@/app/api/webhooks/stripe/route";
import { isLocalSupabaseReachable, localServiceClient, psql, spawnLocalPsql, LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
const reachable = await isLocalSupabaseReachable();
if (!reachable) warnLocalSupabaseUnreachable("stripe-entitlements.postgrest-integration.test.ts");
const secret = "whsec_phase4_local_synthetic";
let user: string;
const prefix = "phase4-entitlement-";
async function deliver(type: string, object: unknown, eventId = prefix + randomUUID(), created = 1) {
  const payload = JSON.stringify({ created, id: eventId, object: "event", type, livemode: false, data: { object } });
  return POST(new NextRequest("http://127.0.0.1/api/webhooks/stripe", { method: "POST", body: payload,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret }) } }));
}
async function grant(payment: string, eventId?: string) {
  return deliver("checkout.session.completed", { object: "checkout.session", payment_status: "paid", amount_total: 1500, currency: "eur", payment_intent: payment, metadata: { user_id: user, purchase_type: "day_pass" } }, eventId);
}
describe.skipIf(!reachable)("Stripe entitlement lifecycle against real local database", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", LOCAL_API_URL);
    vi.stubEnv("SUPABASE_SERVICE_KEY", LOCAL_SERVICE_ROLE_KEY);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_phase4_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    user = randomUUID();
    psql(`INSERT INTO auth.users(id,email) VALUES('${user}','${user}@phase4.test'); INSERT INTO public.user_profiles(user_id,email) VALUES('${user}','${user}@phase4.test') ON CONFLICT DO NOTHING;`);
  });
  afterEach(() => {
    psql(`DELETE FROM public.voice_purchases WHERE user_id='${user}'; DELETE FROM public.stripe_webhook_events WHERE user_id='${user}' OR event_id LIKE '${prefix}%'; DELETE FROM public.stripe_entitlement_payments WHERE payment_intent LIKE 'pi_phase4_%'; DELETE FROM public.user_profiles WHERE user_id='${user}'; DELETE FROM auth.users WHERE id='${user}';`);
    vi.unstubAllEnvs();
  });
  it("a full successful refund revokes previously granted access", async () => {
    const payment = "pi_phase4_" + randomUUID();
    expect((await grant(payment)).status).toBe(200);
    const response = await deliver("charge.refunded", { object: "charge", id: "ch_" + randomUUID(), payment_intent: payment, amount: 1500, amount_captured: 1500, amount_refunded: 1500, currency: "eur", status: "succeeded", refunds: { object: "list", has_more: false, data: [{ object: "refund", id: "re_" + randomUUID(), payment_intent: payment, amount: 1500, currency: "eur", status: "succeeded" }] } });
    expect(response.status).toBe(200);
    expect(await access()).toBe(false);
  });
  async function access(expectedPurchaseId?: string) {
    const purchase = await localServiceClient().rpc("get_active_voice_purchase", {p_user_id:user});
    expect(purchase.error).toBeNull();
    const value = await localServiceClient().rpc("has_active_voice_access", { p_user_id: user });
    expect(value.error).toBeNull();
    expect((purchase.data ?? []).length > 0).toBe(value.data);
    if(expectedPurchaseId) expect(purchase.data?.[0]?.id).toBe(expectedPurchaseId);
    return value.data;
  }
  function charge(payment: string, refunds: { id: string; amount: number; status: string }[], captured = 1500) {
    return { object: "charge", id: "ch_" + payment, payment_intent: { id: payment }, amount: 9999,
      amount_captured: captured, currency: "eur", refunds: { object: "list", has_more: false,
        data: refunds.map(r => ({ object: "refund", payment_intent: { id: payment }, currency: "eur", ...r })) } };
  }
  async function dispute(payment: string, id: string, status: string) {
    return deliver(status === "won" || status === "lost" ? "charge.dispute.closed" : "charge.dispute.created",
      { object: "dispute", id, payment_intent: { id: payment }, charge: "ch_" + payment, status });
  }
  it("distinct successful physical refunds accumulate once against captured amount", async () => {
    const payment = "pi_phase4_" + randomUUID(); await grant(payment);
    const first = { id: "re_" + randomUUID(), amount: 150, status: "succeeded" };
    await deliver("charge.refunded", charge(payment, [first], 350)); expect(await access()).toBe(true);
    await deliver("charge.refunded", charge(payment, [first], 350)); expect(await access()).toBe(true);
    const second = { id: "re_" + randomUUID(), amount: 200, status: "pending" };
    await deliver("charge.refunded", charge(payment, [first, second], 350)); expect(await access()).toBe(true);
    await deliver("charge.refunded", charge(payment, [first, { ...second, status: "succeeded" }], 350)); expect(await access()).toBe(false);
    await deliver("charge.refunded", charge(payment, [first, { ...second, status: "failed" }], 350)); expect(await access()).toBe(false);
  });
  it.each(["won", "lost"])("terminal %s dispute before grant dominates delayed open", async status => {
    const payment = "pi_phase4_" + randomUUID(); const id = "dp_" + randomUUID();
    expect((await dispute(payment, id, status)).status).toBe(200);
    await dispute(payment, id, "needs_response"); await grant(payment);
    expect(await access()).toBe(status === "won");
    expect(psql(`SELECT matched FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`)).toBe("t");
  });
  it.each(["won", "lost"])("terminal %s dominates an already observed open with a newer timestamp", async status => {
    const payment="pi_phase4_"+randomUUID(), id="dp_"+randomUUID(); await grant(payment);
    await deliver("charge.dispute.created",{id,payment_intent:payment,status:"needs_response"},undefined,20);
    await deliver("charge.dispute.closed",{id,payment_intent:payment,status},undefined,10);
    expect(psql(`SELECT entitlement_state FROM public.voice_purchases WHERE payment_provider_id='${payment}';`)).toBe(status==="won"?"active":"revoked");
    expect(await access()).toBe(status==="won");
  });
  it("a first-seen global physical fact collision cannot mutate another payment's fact", async () => {
    const first="pi_phase4_"+randomUUID(), second="pi_phase4_"+randomUUID(), refund="re_"+randomUUID();
    await grant(first); await grant(second);
    const writer=spawnLocalPsql(); let output=""; writer.stdout.on("data",chunk=>{output+=chunk.toString();});
    const closed=new Promise<number|null>(resolve=>writer.once("close",resolve));
    writer.stdin.write(`BEGIN; INSERT INTO public.stripe_entitlement_facts(kind,object_id,payment_intent,charge_id,amount,currency,status) VALUES('refund','${refund}','${first}','ch_first',10,'eur','pending'); SELECT 'phase4-race-ready';\n`);
    let pending: PromiseLike<{data: unknown; error: unknown}> | undefined;
    try {
      await expect.poll(()=>output.includes("phase4-race-ready"),{timeout:3000}).toBe(true);
      pending=localServiceClient().rpc("process_stripe_entitlement_event",{p_event_id:prefix+randomUUID(),p_event_type:"refund.updated",p_payment_intent:second,p_facts:[{kind:"refund",id:refund,charge_id:"ch_second",amount:20,currency:"usd",status:"succeeded"}],p_grant:null});
      const resultPromise=Promise.resolve(pending);
      await expect.poll(()=>psql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%process_stripe_entitlement_event%');"),{timeout:3000}).toBe("t");
      writer.stdin.end("COMMIT;\n"); expect(await closed).toBe(0);
      const result=await resultPromise; expect(result.error).toBeNull(); expect.soft(result.data).toBe("reconciliation_required");
      expect(JSON.parse(psql(`SELECT json_object_agg(payment_provider_id,entitlement_state) FROM public.voice_purchases WHERE payment_provider_id IN ('${first}','${second}');`))).toEqual({[first]:"active",[second]:"suspended"});
      expect(JSON.parse(psql(`SELECT json_build_object('payment',payment_intent,'amount',amount,'currency',currency,'charge',charge_id,'status',status) FROM public.stripe_entitlement_facts WHERE kind='refund' AND object_id='${refund}';`))).toEqual({payment:first,amount:10,currency:"eur",charge:"ch_first",status:"pending"});
    } finally { if(writer.exitCode===null)writer.stdin.end("ROLLBACK;\n"); await closed; if(pending)await pending; }
  });
  it("won disputes clear only their own reason without extending expiry", async () => {
    const payment = "pi_phase4_" + randomUUID(); await grant(payment);
    const expiry = psql(`SELECT expires_at FROM public.voice_purchases WHERE payment_provider_id='${payment}';`);
    const first = "dp_" + randomUUID(), second = "dp_" + randomUUID();
    await dispute(payment, first, "needs_response"); await dispute(payment, second, "under_review"); expect(await access()).toBe(false);
    await dispute(payment, first, "won"); expect(await access()).toBe(false);
    await dispute(payment, second, "won"); expect(await access()).toBe(true);
    expect(psql(`SELECT expires_at FROM public.voice_purchases WHERE payment_provider_id='${payment}';`)).toBe(expiry);
    await deliver("charge.refunded", charge(payment, [{ id: "re_" + randomUUID(), amount: 1500, status: "succeeded" }]));
    await dispute(payment, first, "won"); expect(await access()).toBe(false);
  });
  it("refund tombstone matches a later grant; independent paid and voucher passes survive", async () => {
    const payment = "pi_phase4_" + randomUUID();
    const payload = charge(payment, [{ id: "re_" + randomUUID(), amount: 1500, status: "succeeded" }]);
    const event = prefix + randomUUID();
    expect(await (await deliver("charge.refunded", payload, event)).json()).toMatchObject({ status: "unmatched" });
    await grant(payment); expect(await access()).toBe(false);
    expect(await (await deliver("charge.refunded", payload, event)).json()).toMatchObject({ status: "duplicate" });
    const other = "pi_phase4_" + randomUUID(); await grant(other);
    psql(`UPDATE public.voice_purchases SET expires_at=now()+interval '1 hour' WHERE payment_provider_id='${other}';`);
    expect(await access(psql(`SELECT id FROM public.voice_purchases WHERE payment_provider_id='${other}';`))).toBe(true);
    psql(`UPDATE public.voice_purchases SET expires_at=now()-interval '1 minute' WHERE payment_provider_id='${other}'; INSERT INTO public.voice_purchases(user_id,purchase_type,payment_provider_id,expires_at,amount_paid) VALUES('${user}','voucher_pass','voucher:${randomUUID()}',now()+interval '1 hour',0);`);
    expect(await access(psql(`SELECT id FROM public.voice_purchases WHERE user_id='${user}' AND purchase_type='voucher_pass';`))).toBe(true);
  });
  it("a concurrent full refund and grant converge without renewing or exposing access", async () => {
    const payment="pi_phase4_"+randomUUID();
    const results=await Promise.all([grant(payment),deliver("charge.refunded",charge(payment,[{id:"re_"+randomUUID(),amount:1500,status:"succeeded"}]))]);
    expect(results.map(r=>r.status)).toEqual([200,200]); expect(await access()).toBe(false);
    await dispute(payment,"dp_"+payment,"lost"); await dispute(payment,"dp_other_"+payment,"won"); expect(await access()).toBe(false);
  });
  it("expired reinstatement remains expired and concurrent distinct grants converge", async () => {
    const payment = "pi_phase4_" + randomUUID();
    const results = await Promise.all([grant(payment), grant(payment), dispute(payment, "dp_" + payment, "needs_response")]);
    expect(results.map(r => r.status)).toEqual([200, 200, 200]);
    expect(psql(`SELECT count(*) FROM public.voice_purchases WHERE payment_provider_id='${payment}';`)).toBe("1");
    expect(await access()).toBe(false);
    psql(`UPDATE public.voice_purchases SET expires_at=now()-interval '1 minute' WHERE payment_provider_id='${payment}';`);
    await dispute(payment, "dp_" + payment, "won"); expect(await access()).toBe(false);
  });
  it("a real INSERT failure rolls audit and payment ledger back, then identical retry succeeds", async () => {
    const payment = "pi_phase4_" + randomUUID(), event = prefix + randomUUID();
    // Audit user_id has no FK; the real purchase INSERT does. Remove only
    // this test's fresh profile to fail after the audit claim without catalog DDL.
    psql(`DELETE FROM public.user_profiles WHERE user_id='${user}';`);
    try {
      expect((await grant(payment, event)).status).toBe(500);
      expect(psql(`SELECT count(*) FROM public.stripe_webhook_events WHERE event_id='${event}';`)).toBe("0");
      expect(psql(`SELECT count(*) FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`)).toBe("0");
    } finally { psql(`INSERT INTO public.user_profiles(user_id,email) VALUES('${user}','${user}@phase4.test');`); }
    expect((await grant(payment, event)).status).toBe(200); expect(await access()).toBe(true);
  });
  it("rejects null reconciliation arrays instead of silently clearing reasons", async () => {
    const payment="pi_phase4_"+randomUUID(); await grant(payment);
    const result=await localServiceClient().rpc("reconcile_stripe_entitlement",{p_payment_intent:payment,p_expected_reasons:[],p_resolved_reasons:null,p_evidence_reference:"local-review:null-array"});
    expect(result.error).not.toBeNull();
  });
  it("incomplete or conflicting evidence is explicitly retained for reconciliation", async () => {
    const payment = "pi_phase4_" + randomUUID(); await grant(payment);
    const payload = charge(payment, [{ id: "re_" + randomUUID(), amount: 10, status: "succeeded" }]);
    payload.refunds.has_more = true;
    expect(await (await deliver("charge.refunded", payload)).json()).toMatchObject({ status: "reconciliation_required" });
    expect(await access()).toBe(false);
    expect(psql(`SELECT reconciliation_reasons::text FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`)).toContain("incomplete_refund_pagination");
    payload.refunds.has_more = false; payload.refunds.data[0].amount = 20;
    await deliver("charge.refunded", payload);
    expect(psql(`SELECT reconciliation_reasons::text FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`)).toContain("conflicting_refund:");
    const reasons = JSON.parse(psql(`SELECT to_json(reconciliation_reasons) FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`));
    const stale = await localServiceClient().rpc("reconcile_stripe_entitlement", {p_payment_intent:payment,p_expected_reasons:[],p_resolved_reasons:[],p_evidence_reference:"local-review:stale"}); expect(stale.error).not.toBeNull();
    const resolved = await localServiceClient().rpc("reconcile_stripe_entitlement", {p_payment_intent:payment,p_expected_reasons:reasons,p_resolved_reasons:reasons,p_evidence_reference:"local-review:physical-refund-confirmed-original-amount"});
    expect(resolved.error).toBeNull(); expect(resolved.data).toBe("active"); expect(await access()).toBe(true);
  });

  async function reconcile(payment: string) {
    const reasons=JSON.parse(psql(`SELECT to_json(reconciliation_reasons) FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`));
    return localServiceClient().rpc("reconcile_stripe_entitlement",{p_payment_intent:payment,p_expected_reasons:reasons,p_resolved_reasons:reasons,p_evidence_reference:"local-review:authoritative-existing-facts"});
  }
  it.each(["refund","lost","open"])("operator review cannot clear known %s reasons or renew expiry",async reason=>{
    const payment="pi_phase4_"+randomUUID(); await grant(payment);
    const expiry=psql(`SELECT expires_at FROM public.voice_purchases WHERE payment_provider_id='${payment}';`);
    if(reason==="refund")await deliver("charge.refunded",charge(payment,[{id:"re_"+randomUUID(),amount:1500,status:"succeeded"}]));
    else await dispute(payment,"dp_block_"+payment,reason==="lost"?"lost":"needs_response");
    await dispute(payment,"dp_review_"+payment,"warning_closed");
    const review=await reconcile(payment); expect(review.error).toBeNull(); expect(review.data).toBe(reason==="open"?"suspended":"revoked");
    expect(await access()).toBe(false); expect(psql(`SELECT expires_at FROM public.voice_purchases WHERE payment_provider_id='${payment}';`)).toBe(expiry);
  });
  it.each(["user_id","expires_at","amount_paid","purchase_type"])("null %s grant rejects without changing existing state or audit",async key=>{
    const payment="pi_phase4_"+randomUUID(); await grant(payment); const event=prefix+randomUUID();
    const before=psql(`SELECT row_to_json(vp) FROM public.voice_purchases vp WHERE payment_provider_id='${payment}';`);
    const ledger=psql(`SELECT row_to_json(p) FROM public.stripe_entitlement_payments p WHERE payment_intent='${payment}';`);
    const invalid={user_id:user,expires_at:new Date(Date.now()+86400000).toISOString(),amount_paid:1500,purchase_type:"day_pass",[key]:null};
    const result=await localServiceClient().rpc("process_stripe_entitlement_event",{p_event_id:event,p_event_type:"checkout.session.completed",p_payment_intent:payment,p_facts:[],p_grant:invalid});
    expect(result.error).not.toBeNull(); expect(psql(`SELECT count(*) FROM public.stripe_webhook_events WHERE event_id='${event}';`)).toBe("0");
    expect(psql(`SELECT row_to_json(vp) FROM public.voice_purchases vp WHERE payment_provider_id='${payment}';`)).toBe(before);
    expect(psql(`SELECT row_to_json(p) FROM public.stripe_entitlement_payments p WHERE payment_intent='${payment}';`)).toBe(ledger);
  });
  it.each(["failed","canceled"])("succeeded then %s refund remains revoked with explicit conflict disclosure",async status=>{
    const payment="pi_phase4_"+randomUUID(), refund={id:"re_"+randomUUID(),amount:1500,status:"succeeded"}; await grant(payment);
    await deliver("charge.refunded",charge(payment,[refund])); await deliver("charge.refunded",charge(payment,[{...refund,status}]));
    expect(await access()).toBe(false); expect(psql(`SELECT reconciliation_reasons::text FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`)).toContain("conflicting_refund_status:"+refund.id);
  });
  it("an older complete snapshot cannot clear a newer incomplete charge reason",async()=>{
    const payment="pi_phase4_"+randomUUID(); await grant(payment);
    const payload=charge(payment,[{id:"re_"+randomUUID(),amount:10,status:"succeeded"}]);
    payload.refunds.has_more=true; await deliver("charge.refunded",payload,undefined,20);
    payload.refunds.has_more=false; await deliver("charge.refunded",payload,undefined,10);
    expect(await access()).toBe(false);
    expect(psql(`SELECT reconciliation_reasons::text FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`)).toContain("incomplete_refund_pagination:");
  });
  it("a complete charge snapshot clears only its pagination reason",async()=>{
    const payment="pi_phase4_"+randomUUID(); await grant(payment);
    const payload=charge(payment,[{id:"re_"+randomUUID(),amount:10,status:"succeeded"}]); payload.refunds.has_more=true;
    await deliver("charge.refunded",payload); await dispute(payment,"dp_review_"+payment,"warning_closed");
    payload.refunds.has_more=false; await deliver("charge.refunded",payload);
    const reasons=psql(`SELECT reconciliation_reasons::text FROM public.stripe_entitlement_payments WHERE payment_intent='${payment}';`);
    expect(reasons).not.toContain("incomplete_refund_pagination"); expect(reasons).toContain("unsupported_dispute:"); expect(await access()).toBe(false);
  });
  it("missing captured charge cannot be reviewed away; corrected charge and reviewed evidence recover",async()=>{
    const payment="pi_phase4_"+randomUUID(), refund="re_"+randomUUID(); await grant(payment);
    await deliver("refund.updated",{id:refund,payment_intent:payment,charge:"ch_"+payment,amount:10,currency:"eur",status:"succeeded"});
    expect(await access()).toBe(false); expect((await reconcile(payment)).error).not.toBeNull();
    await deliver("charge.refunded",charge(payment,[{id:refund,amount:10,status:"succeeded"}]));
    const reviewed=await reconcile(payment); expect(reviewed.error).toBeNull(); expect(reviewed.data).toBe("active"); expect(await access()).toBe(true);
  });
  it("an incoming older successful refund dominates a newer pending snapshot",async()=>{
    const payment="pi_phase4_"+randomUUID(), refund={id:"re_"+randomUUID(),amount:1500,status:"pending"};
    await deliver("charge.refunded",charge(payment,[refund]),undefined,20);
    await deliver("charge.refunded",charge(payment,[{...refund,status:"succeeded"}]),undefined,10);
    await grant(payment); expect(await access()).toBe(false);
    expect(psql(`SELECT status FROM public.stripe_entitlement_facts WHERE kind='refund' AND object_id='${refund.id}';`)).toBe("succeeded");
  });

});
