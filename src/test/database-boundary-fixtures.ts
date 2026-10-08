import { randomUUID } from "node:crypto";
export interface BoundaryFixture {
    table: string;
    payload: Record<string, unknown>;
    keys: string[];
    patch: Record<string, unknown>;
}
/** Valid synthetic rows in FK insertion order. Real PostgREST owns their DML. */
export function databaseBoundaryFixtures(user: string, story: string, prefix: string): BoundaryFixture[] {
    const ids = Object.fromEntries(["merchant", "experience", "draft", "quote", "hold", "booking", "pending", "account", "post", "voucher"].map(key => [key, randomUUID()]));
    const future = new Date(Date.now() + 86400000).toISOString();
    const rows: BoundaryFixture[] = [];
    const add = (table: string, payload: Record<string, unknown>, patch: Record<string, unknown>, keys = ["id"]) => { if (keys.includes("id") && !payload.id)
        payload.id = randomUUID(); rows.push({ table, payload, keys, patch }); };
    add("merchants", { id: ids.merchant, slug: `${prefix}merchant`, name: "Synthetic contract merchant", is_fixture: true }, { name: "Updated synthetic merchant" });
    add("experiences", { id: ids.experience, merchant_id: ids.merchant, slug: `${prefix}experience`, title: "Synthetic experience", price_cents: 1000, deposit_cents: 100, max_party: 4, capacity_per_slot: 8, slot_rule: { weekdays: [1, 2, 3, 4, 5, 6, 7], start_times: ["10:00"] } }, { title: "Updated synthetic experience" });
    add("experience_facts", { experience_id: ids.experience, key: "pets_allowed", value: "unknown" }, { detail: "Synthetic detail" }, ["experience_id", "key"]);
    add("booking_drafts", { id: ids.draft, user_id: user, status: "abandoned" }, { budget_cents: 2000 });
    add("quotes", { id: ids.quote, draft_id: ids.draft, user_id: user, experience_id: ids.experience, version: 1, slot_date: "2088-01-01", slot_time: "10:00", party_size: 1, total_cents: 1000, deposit_cents: 100, cancellation_window_hours: 24, expires_at: future }, { expires_at: future });
    add("holds", { id: ids.hold, quote_id: ids.quote, experience_id: ids.experience, slot_date: "2088-01-01", slot_time: "10:00", party_size: 1, expires_at: future }, { expires_at: future });
    add("bookings", { id: ids.booking, reference: `${prefix}booking`, user_id: user, quote_id: ids.quote, hold_id: ids.hold, experience_id: ids.experience, slot_date: "2088-01-01", slot_time: "10:00", party_size: 1, total_cents: 1000, deposit_cents: 100, cancellation_window_hours: 24, status: "pending_payment" }, { link_version: 2 });
    add("pending_bookings", { id: ids.pending, idempotency_key: `${prefix}pending`, conversation_id: `${prefix}conversation`, venue_name: "Synthetic venue", venue_phone: "+34999999999", customer_name: "Synthetic customer", customer_phone: "+34666666666", party_size: 1, booking_date: "2088-01-01", booking_time: "10:00", status: "pending" }, { special_requests: "Synthetic request" });
    add("payments", { booking_id: ids.booking, amount_cents: 100, status: "created", phone_call_id: ids.pending }, { last_error: "Synthetic transport failure" });
    add("booking_sms_jobs", { booking_id: ids.pending, event_key: `${prefix}sms`, to_phone: "+34666666666", message: "Synthetic message", status: "pending" }, { message: "Updated synthetic message" });
    add("elevenlabs_webhook_events", { booking_id: ids.pending, event_key: `${prefix}elevenlabs` }, { event_key: `${prefix}elevenlabs` });
    add("translate_webhook_events", { story_id: story, event_key: `${prefix}translate`, status: "completed" }, { last_error: "Synthetic error" });
    add("stripe_webhook_events", { event_id: `${prefix}stripe` }, { event_id: `${prefix}stripe` });
    add("paypal_webhook_events", { event_id: `${prefix}paypal`, event_type: "CONTRACT.SYNTHETIC", payload: { synthetic: true } }, { last_error: "Synthetic error" });
    add("admin_audit_log", { action: `${prefix}audit`, admin_email: "synthetic@example.test" }, { resource: "synthetic-resource" });
    add("anthropic_usage", { model: "synthetic-contract", source: prefix }, { input_tokens: 1 });
    add("voice_saved_places", { conversation_id: prefix, place_name: "Synthetic place" }, { notes: "Synthetic note" });
    add("booking_daily_call_counters", { counter_date: "2088-03-14", call_count: 0 }, { call_count: 1 }, ["counter_date"]);
    add("cron_job_locks", { lock_key: prefix, lock_token: randomUUID(), lease_expires_at: future }, { lease_expires_at: future }, ["lock_key"]);
    add("github_traffic_daily", { date: "2088-03-14", views: 0 }, { views: 1 }, ["date"]);
    add("github_traffic_paths", { path: `/${prefix}` }, { count: 1 });
    add("github_traffic_referrers", { referrer: prefix }, { count: 1 });
    add("marketing_accounts", { id: ids.account, platform: "x", account_name: prefix, credentials: null }, { account_handle: "synthetic" });
    add("marketing_posts", { id: ids.post, account_id: ids.account, platform: "x", content: "Synthetic content" }, { content: "Updated synthetic content" });
    add("marketing_agent_logs", { agent_name: prefix, action: "synthetic", status: "success", post_id: ids.post }, { details: { synthetic: true } });
    add("marketing_content_bank", { platform: "all", content_type: "story_prompt", content: "Synthetic content" }, { content: "Updated synthetic content" });
    add("marketing_schedule", { platform: "x", day_of_week: 6, time_utc: "23:59" }, { is_active: false });
    add("operator_access", { merchant_id: ids.merchant, label: prefix, expires_at: future }, { label: `${prefix}updated` });
    add("platform_costs", { service_id: prefix, service_name: "Synthetic", category: "infrastructure", cost_usd: 0, billing_period_start: "2088-03-01", billing_period_end: "2088-03-31" }, { cost_usd: 1 });
    add("vouchers", { id: ids.voucher, code_hash: "b".repeat(64), label: prefix, expires_at: future, grants_voice_pass: false }, { label: `${prefix}updated` });
    add("voucher_redemptions", { voucher_id: ids.voucher, user_id: user }, { chat_turns_used: 1 });
    add("webhook_config", { key: prefix, value: "synthetic" }, { value: "updated-synthetic" }, ["key"]);
    add("feature_flag_public_config_keys", { flag_key: prefix, config_key: "display" }, { config_key: "display" }, ["flag_key", "config_key"]);
    return rows;
}
export function boundarySelector(fixture: BoundaryFixture): string {
    return `${fixture.table}?${fixture.keys.map(key => `${key}=eq.${encodeURIComponent(String(fixture.payload[key]))}`).join("&")}`;
}
