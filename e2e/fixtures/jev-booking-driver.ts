/** Local route integration driver. Run only through the @local-docker spec.
 * Provider replies are synthetic SDK HTTP; Supabase auth/RPC/tools are real.
 * Timing includes the route and retrieval, excludes Next proxy, and is not live quality evidence.
 */
// Next requires its native Node baseline before any transitive framework imports.
import "next/dist/server/node-environment-baseline.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  cleanupBookingRows, createSignedInUser, ensureBookingSurfaceOn, issueVoucher,
  localServiceClient, NOTHING_LEFT, requireLocalBookingEnv, runTag,
  type CreatedRows,
} from "./booking-local";
import { redeemVoucher } from "../../src/lib/booking/vouchers";
import type { BookingEvaluationMode, BookingRouteScenario, BookingRouteTurn } from "../../scripts/lib/booking-eval-harness";

// Cache configuration is captured on app-module import. Each arm uses the same cold-cache retrieval.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.BOOKING_AGENT_REPLAY;
process.env.JEV_ENABLED_TASKS = "booking_intake";
process.env.TYPESAFE_API_KEY = "synthetic-local-only";
process.env.VOYAGE_API_KEY = "synthetic-local-only";
process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1";
const { collectBookingSse } = await import("../../scripts/lib/booking-eval-harness");
const { createBookingHttpFixtureTransport } = await import("../../scripts/lib/booking-eval-http-fixtures");
const { startBookingEvalServer } = await import("../../scripts/lib/booking-eval-server");
const { isPhoneMerchant, phoneConfirmationConfigured } = await import("../../src/lib/booking/phone-config");

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const corpusPath = "scripts/eval/fixtures/jev/booking-intake.json";
const corpusBytes = readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString()) as { clock: string; catalog: string; scenarios: BookingRouteScenario[] };
const env = requireLocalBookingEnv();
assert.ok(process.env.SUPABASE_LOCAL_DB_MARKER?.startsWith("paisaxe-contracts:"), "an owned contracts database marker is required");
assert.equal(env.supabaseUrl, process.env.SUPABASE_LOCAL_API_URL, "the exact owned local API must be selected");
assert.equal(process.env.VERCEL, undefined);
assert.equal(process.env.VERCEL_ENV, undefined);
const admin = localServiceClient(env);
const originalFetch = globalThis.fetch;
const tag = runTag("jev-intake");
const created: CreatedRows = { userIds: [], voucherLabels: [tag], operatorLabels: [] };
const directory = resolve("test-results/jev/phase-3", tag);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const serverErrorsPath = resolve(directory, "server-errors.jsonl");
const rows: Record<string, unknown>[] = [];
let cleanup: unknown = null;
let failure: unknown;
let activeFixture: ReturnType<typeof createBookingHttpFixtureTransport> | undefined;
let fault: "none" | "rate_limit" | "cancel" = "none";
let jevAttempts = 0;
let onJevStart: (() => void) | undefined;
let onJevAbort: (() => void) | undefined;

// Ambient credentials never reach a provider. Only this owned datastore may use real HTTP.
const providerFetch: typeof fetch = async (url, init) => {
  const target = url instanceof Request ? url.url : String(url);
  if (target === "https://api.typesafe.ai/v1/systemone") {
    jevAttempts++;
    onJevStart?.();
    if (fault === "rate_limit") return Response.json({ error: "synthetic_rate_limit" }, { status: 429 });
    if (fault === "cancel") return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal ?? (url instanceof Request ? url.signal : undefined);
      const aborted = () => { onJevAbort?.(); reject(new DOMException("Synthetic request cancelled", "AbortError")); };
      if (signal?.aborted) aborted(); else signal?.addEventListener("abort", aborted, { once: true });
    });
  }
  assert.ok(activeFixture, "provider fixture must be prebound");
  return activeFixture.providerFetch(url, init);
};
globalThis.fetch = async (url, init) => {
  const target = new URL(url instanceof Request ? url.url : String(url));
  if (target.origin === new URL(env.supabaseUrl).origin) return originalFetch(url, init);
  if (["api.anthropic.com", "api.typesafe.ai", "api.voyageai.com"].includes(target.hostname)) return providerFetch(url, init);
  throw new Error(`Unregistered network origin in local intake driver: ${target.origin}`);
};

async function checked<T>(result: { data: T; error: { message: string } | null }): Promise<NonNullable<T>> {
  if (result.error) throw new Error(result.error.message);
  assert.ok(result.data !== null && result.data !== undefined, "local datastore returned no data");
  return result.data;
}
async function user(code: string) {
  const identity = await createSignedInUser(env, admin, tag);
  created.userIds.push(identity.userId);
  const redemption = await redeemVoucher(admin, identity.userId, code);
  assert.equal(redemption.status, "ok");
  return identity;
}
async function snapshot(userId: string) {
  const drafts = await checked(await admin.from("booking_drafts").select("party_size,slot_date,slot_time,budget_cents,constraints,status").eq("user_id", userId));
  const quotes = await checked(await admin.from("quotes").select("id,total_cents,deposit_cents,accepted_at").eq("user_id", userId));
  const bookings = await checked(await admin.from("bookings").select("id").eq("user_id", userId));
  const redemptions = await checked(await admin.from("voucher_redemptions").select("chat_turns_used,booking_attempts_used").eq("user_id", userId));
  const holds = quotes.length ? await checked(await admin.from("holds").select("id").in("quote_id", quotes.map(q => q.id))) : [];
  const payments = bookings.length ? await checked(await admin.from("payments").select("id").in("booking_id", bookings.map(b => b.id))) : [];
  return { drafts, quotes, bookings, redemptions, holds, payments };
}
function noCommitments(state: Awaited<ReturnType<typeof snapshot>>) {
  assert.deepEqual(state.bookings, []); assert.deepEqual(state.holds, []); assert.deepEqual(state.payments, []);
  assert.ok(state.quotes.every(q => q.accepted_at === null));
  assert.ok(state.redemptions.every(r => r.booking_attempts_used === 0));
}
function cards(turn: BookingRouteTurn, kind: string) {
  return turn.events.filter(e => e.type === "card").map(e => e.card as Record<string, unknown>).filter(c => c.kind === kind);
}
function toolStarts(turn: BookingRouteTurn) {
  return turn.events.filter(e => e.type === "tool" && e.status === "start").map(e => e.name);
}
function counters() { return { jev: jevAttempts, claude: activeFixture!.counts.claude, voyage: activeFixture!.counts.voyage }; }
function delta(before: ReturnType<typeof counters>) {
  const after = counters(); return { jev: after.jev - before.jev, claude: after.claude - before.claude, voyage: after.voyage - before.voyage };
}
async function withArm<T>(mode: BookingEvaluationMode, run: (origin: string) => Promise<T>) {
  activeFixture = createBookingHttpFixtureTransport(new Date(corpus.clock));
  const server = await startBookingEvalServer({ mode, now: () => new Date(corpus.clock),
    createModel: async () => new Anthropic({ apiKey: "synthetic-local-only", maxRetries: 1, fetch: providerFetch }),
    jev: { fetch: providerFetch },
    onError: error => {
      const actual = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { name: "NonError", message: String(error), stack: null };
      appendFileSync(serverErrorsPath, JSON.stringify({ time: new Date().toISOString(), mode, error: actual }) + "\n", { mode: 0o600 });
    },
  });
  try { return await run(server.origin); } finally { await server.close(); }
}
async function say(origin: string, token: string, message: string, history: { role: "user" | "assistant"; content: string }[] = [], signal?: AbortSignal) {
  const started = performance.now();
  const response = await originalFetch(`${origin}/api/booking/chat/stream`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ message, history, locale: "es" }), signal,
  });
  const turn = await collectBookingSse(response, started);
  assert.ok(turn.complete, JSON.stringify(turn.events));
  assert.ok(!turn.events.some(e => e.type === "error"));
  return turn;
}
function assertCatalog(offers: Record<string, unknown>[]) {
  const expected = new Map([["Paseo por la senda costera", [12000, 3000]], ["Descenso en canoa", [6000, 1500]], ["Ruta de miradores en 4x4", [20000, 5000]]]);
  for (const offer of offers) {
    const values = expected.get(String(offer.title));
    assert.ok(values, `unknown catalog title ${String(offer.title)}`);
    assert.equal(offer.priceCents, values[0]); assert.equal(offer.depositCents, values[1]);
  }
}
async function completeScenario(mode: BookingEvaluationMode, scenario: BookingRouteScenario, code: string) {
  return withArm(mode, async origin => {
    const identity = await user(code);
    const before = counters();
    const opening = await say(origin, identity.accessToken, scenario.opening);
    const openingCounts = delta(before);
    assert.deepEqual(toolStarts(opening), ["search_experiences"]);
    const initialized = await snapshot(identity.userId);
    noCommitments(initialized); assert.equal(initialized.quotes.length, 0);
    assert.deepEqual(initialized.redemptions.map(r => r.chat_turns_used), [1]);
    assert.deepEqual(initialized.drafts, [{ party_size: null, slot_date: null, slot_time: null, budget_cents: null, constraints: {}, status: "open" }]);
    if (mode === "jev") { assert.equal(openingCounts.jev, 1); assert.equal(openingCounts.claude, 0); }
    else { assert.equal(openingCounts.jev, 0); assert.equal(openingCounts.claude, mode === "baseline" ? 2 : 0); }
    const offers = cards(opening, "offer").flatMap(c => c.options as Record<string, unknown>[]);
    assert.equal(offers.length, 3); assertCatalog(offers);
    if (scenario.opening.includes("sin escaleras")) {
      const verdict = (title: string, key: string) => (offers.find(o => o.title === title)?.verdicts as Record<string, unknown>[]).find(v => v.key === key);
      assert.equal(verdict("Paseo por la senda costera", "step_free")?.verdict, "supported");
      assert.equal(verdict("Descenso en canoa", "step_free")?.verdict, "unsupported");
      assert.deepEqual(verdict("Ruta de miradores en 4x4", "step_free"), { key: "step_free", verdict: "unknown", detail: "El proveedor no ha confirmado la accesibilidad", confirmedByProvider: false });
    }
    const history: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: scenario.opening }, { role: "assistant", content: opening.assistant }];
    const turns = [opening];
    for (const message of scenario.followUps) {
      const turn = await say(origin, identity.accessToken, message, history);
      turns.push(turn); history.push({ role: "user", content: message }, { role: "assistant", content: turn.assistant });
    }
    const quote = turns.flatMap(t => cards(t, "quote")); assert.equal(quote.length, 1);
    const wanted = scenario.expected.quote!;
    for (const [key, value] of Object.entries(wanted)) assert.equal(quote[0]![key === "date" ? "slotDate" : key === "time" ? "slotTime" : key], value);
    assert.equal(quote[0]!.accepted, false);
    const final = await snapshot(identity.userId); noCommitments(final);
    assert.equal(final.quotes.length, 1);
    assert.deepEqual(final.redemptions.map(r => r.chat_turns_used), [turns.length]);
    const allowed = new Set(["search_experiences", "get_quote"]);
    assert.ok(turns.every(t => toolStarts(t).every(tool => allowed.has(String(tool)))));
    const firstQuoteIndex = turns.findIndex(turn => cards(turn, "quote").length > 0);
    assert.ok(firstQuoteIndex >= 0, "an observed quote turn is required for latency and clarification metrics");
    // The opening and the successful quote selection are not clarification turns.
    // Count every intervening completed follow-up that actually failed to produce a quote.
    const clarificationCount = turns.slice(1, firstQuoteIndex).filter(turn => cards(turn, "quote").length === 0).length;
    assert.ok(clarificationCount <= scenario.expected.maxClarifications, "observed clarification count exceeds the frozen scenario limit");
    const timeToQuoteMs = turns.slice(0, firstQuoteIndex).reduce((ms, turn) => ms + turn.fullTurnMs, 0) + (turns[firstQuoteIndex]?.firstQuoteMs ?? NaN);
    assert.ok(Number.isFinite(timeToQuoteMs)); assert.ok(opening.firstCardMs !== null);
    return { scenarioId: scenario.id, mode, complete: true, openingCounts, totalCounts: delta(before), firstCardMs: opening.firstCardMs, timeToQuoteMs, clarificationCount, inputHash: sha(JSON.stringify(scenario)), turns };
  });
}

async function edgeCases(code: string) {
  await withArm("jev", async origin => {
    const identity = await user(code); const before = counters(); fault = "rate_limit";
    const failed = await say(origin, identity.accessToken, "¿Qué experiencias hay para 2 personas el 2026-11-02 hasta 200 euros?");
    assert.equal(delta(before).jev, 1); assert.equal(delta(before).claude, 2);
    assert.deepEqual(toolStarts(failed), ["search_experiences"]);
    const failedState = await snapshot(identity.userId);
    noCommitments(failedState); assert.equal(failedState.quotes.length, 0);
    assert.deepEqual(failedState.redemptions.map(r => r.chat_turns_used), [1]);
    assert.equal(cards(failed, "offer").length, 1, "no partial fast-path offer before fallback");
    fault = "none";
    const recoveredUser = await user(code); const recoveredBefore = counters();
    const recovered = await say(origin, recoveredUser.accessToken, "¿Qué experiencias hay para 2 personas el 2026-11-02 hasta 200 euros?");
    assert.equal(delta(recoveredBefore).jev, 1); assert.equal(delta(recoveredBefore).claude, 0);
    assert.deepEqual(toolStarts(recovered), ["search_experiences"]);
    const petsUser = await user(code);
    const pets = await say(origin, petsUser.accessToken, "¿Qué experiencias hay para 2 personas el 2026-11-03 con perro?");
    const petOptions = cards(pets, "offer").flatMap(c => c.options as Record<string, unknown>[]);
    assert.ok(petOptions.every(o => (o.verdicts as Record<string, unknown>[]).some(v => v.key === "pets" && v.verdict === "unknown" && v.confirmedByProvider === false)));
    const rejectedUser = await user(code);
    const rejectedOpening = "¿Qué experiencias hay para 12 personas el 2026-11-04?";
    const rejected = await say(origin, rejectedUser.accessToken, rejectedOpening);
    const rejectedOptions = cards(rejected, "offer").flatMap(c => c.options as Record<string, unknown>[]);
    assert.equal(rejectedOptions.length, 3, "all-rejected is distinct from an empty catalog");
    assert.ok(rejectedOptions.every(o => o.suitability === "rejected"));
    assert.match(rejected.assistant, /cambiar/i);
    const rejectedRecoveryBefore = counters();
    const rejectedRecovery = await say(origin, rejectedUser.accessToken,
      "Quiero Paseo por la senda costera el 2026-11-04 a las 10:00 para 2 personas.",
      [{ role: "user", content: rejectedOpening }, { role: "assistant", content: rejected.assistant }]);
    assert.equal(delta(rejectedRecoveryBefore).jev, 0, "history preserves the ordinary follow-up path");
    assert.deepEqual(toolStarts(rejectedRecovery), ["search_experiences", "get_quote"]);
    assert.equal(cards(rejectedRecovery, "quote").length, 1);
    assert.equal(cards(rejectedRecovery, "quote")[0]!.partySize, 2);
    assert.equal(cards(rejectedRecovery, "quote")[0]!.totalCents, 12000);
    const rejectedRecoveryState = await snapshot(rejectedUser.userId);
    noCommitments(rejectedRecoveryState); assert.equal(rejectedRecoveryState.quotes.length, 1);
    assert.deepEqual(rejectedRecoveryState.redemptions.map(r => r.chat_turns_used), [2]);
    rows.push({ id: "rate-limit-recovery-unknown-all-rejected-recovery", complete: true, failed, recovered, pets, rejected, rejectedRecovery });
  });
  await withArm("jev", async origin => {
    const identity = await user(code);
    const openingMessage = "¿Qué experiencias hay para 2 personas el 2026-11-07?";
    // This spec owns the isolated stack and must not overlap another mutating booking spec.
    // Restore the exact active flags even if the empty-options assertion/request fails.
    const activeStates = await checked(await admin.from("experiences").select("id,active").order("id"));
    assert.ok(activeStates.some(row => row.active), "empty-catalog recovery needs an initially available catalog");
    const ids = activeStates.map(row => row.id);
    let empty: BookingRouteTurn;
    let restoredStates: typeof activeStates;
    try {
      const disabled = await admin.from("experiences").update({ active: false }).in("id", ids);
      if (disabled.error) throw new Error(disabled.error.message);
      empty = await say(origin, identity.accessToken, openingMessage);
      assert.equal(cards(empty, "offer").length, 1);
      assert.deepEqual(cards(empty, "offer")[0]!.options, [], "empty catalog emits an explicit empty offer");
      assert.match(empty.assistant, /cambiar/i);
      assert.match(empty.assistant, /no hay/i);
      const emptyState = await snapshot(identity.userId);
      noCommitments(emptyState); assert.equal(emptyState.quotes.length, 0);
      assert.deepEqual(emptyState.redemptions.map(r => r.chat_turns_used), [1]);
    } finally {
      for (const active of [false, true]) {
        const restoreIds = activeStates.filter(row => row.active === active).map(row => row.id);
        if (!restoreIds.length) continue;
        const restored = await admin.from("experiences").update({ active }).in("id", restoreIds);
        if (restored.error) throw new Error(`Could not restore task-owned catalog: ${restored.error.message}`);
      }
      restoredStates = await checked(await admin.from("experiences").select("id,active").in("id", ids).order("id"));
      assert.deepEqual(restoredStates, activeStates, "catalog active flags restored and read back exactly");
    }
    const recoveryBefore = counters();
    const recovered = await say(origin, identity.accessToken,
      "Quiero Paseo por la senda costera el 2026-11-07 a las 16:00 para 2 personas.",
      [{ role: "user", content: openingMessage }, { role: "assistant", content: empty!.assistant }]);
    assert.equal(delta(recoveryBefore).jev, 0, "recovery continues through the ordinary agent");
    assert.deepEqual(toolStarts(recovered), ["search_experiences", "get_quote"]);
    const quote = cards(recovered, "quote"); assert.equal(quote.length, 1);
    assert.equal(quote[0]!.experienceTitle, "Paseo por la senda costera");
    assert.equal(quote[0]!.slotDate, "2026-11-07"); assert.equal(quote[0]!.slotTime, "16:00");
    assert.equal(quote[0]!.partySize, 2); assert.equal(quote[0]!.totalCents, 12000); assert.equal(quote[0]!.depositCents, 3000);
    const state = await snapshot(identity.userId); noCommitments(state); assert.equal(state.quotes.length, 1);
    assert.deepEqual(state.redemptions.map(r => r.chat_turns_used), [2]);
    rows.push({ id: "empty-catalog-ordinary-quote-recovery", complete: true, empty: empty!, recovered,
      catalogActiveStateHash: sha(JSON.stringify(activeStates)), restoredActiveStateHash: sha(JSON.stringify(restoredStates!)) });
  });
  await withArm("jev", async origin => {
    const identity = await user(code); const before = counters(); fault = "cancel";
    const started = new Promise<void>(resolve => { onJevStart = resolve; });
    const aborted = new Promise<void>(resolve => { onJevAbort = resolve; });
    const controller = new AbortController();
    const pending = say(origin, identity.accessToken, "¿Qué experiencias hay para 2 personas el 2026-11-05?", [], controller.signal);
    // Attach the rejection observer before cancellation so Node never reports an unhandled rejection.
    const rejected = assert.rejects(pending);
    await Promise.race([started, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Jev never started")), 5000).unref())]);
    controller.abort(); await rejected;
    await Promise.race([aborted, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Jev abort was not propagated")), 5000).unref())]);
    assert.equal(delta(before).jev, 1); assert.equal(delta(before).claude, 0);
    const state = await snapshot(identity.userId); noCommitments(state); assert.equal(state.quotes.length, 0);
    assert.deepEqual(state.redemptions.map(r => r.chat_turns_used), [1]);
    const cancellationCounts = delta(before);
    fault = "none"; onJevStart = undefined; onJevAbort = undefined;
    const recoveredUser = await user(code); const recoveryBefore = counters();
    const recovered = await say(origin, recoveredUser.accessToken, "¿Qué experiencias hay para 2 personas el 2026-11-06?");
    assert.deepEqual(toolStarts(recovered), ["search_experiences"]);
    assert.equal(delta(recoveryBefore).jev, 1); assert.equal(delta(recoveryBefore).claude, 0);
    noCommitments(await snapshot(recoveredUser.userId));
    rows.push({ id: "cancel-inference-and-recover", complete: true, counts: cancellationCounts, recoveryCounts: delta(recoveryBefore), recovered });
  });
}

try {
  assert.equal(process.env.NODE_ENV, "test", "subprocess must explicitly use NODE_ENV=test");
  await ensureBookingSurfaceOn(admin);
  const code = await issueVoucher(admin, tag, 110);
  const rawActiveCatalog = await checked(await admin.from("experiences").select("slug,title,price_cents,deposit_cents,max_party,capacity_per_slot,slot_rule,merchant:merchants(slug,confirmation_mode),experience_facts(key,value,detail,data,confirmed_by_provider)").eq("active", true).order("slug"));
  // Match searchExperiences' actual offerability predicate. Migration126 also seeds
  // an active phone merchant; its row is retained as evidence even while unavailable.
  const phoneOffered = phoneConfirmationConfigured();
  const catalog = rawActiveCatalog.filter(row => phoneOffered || !isPhoneMerchant(row));
  const excludedActiveCatalog = rawActiveCatalog.filter(row => !phoneOffered && isPhoneMerchant(row)).map(row => ({ reason: "phone_confirmation_not_configured", experience: row }));
  const catalogSnapshot = { phoneConfirmationConfigured: phoneOffered, offerabilityRule: "phoneConfirmationConfigured() || !isPhoneMerchant(row)", rawActiveCatalog, offerableCatalog: catalog, excludedActiveCatalog };
  // Persist both eligible and excluded rows before assertions, so drift remains inspectable.
  writeFileSync(resolve(directory, "catalog.json"), JSON.stringify(catalogSnapshot, null, 2));
  assert.equal(phoneOffered, false, "the frozen three-offer comparison requires phone confirmation to be unconfigured");
  assert.deepEqual(catalog.map(row => row.slug), ["descenso-canoa", "paseo-senda-costera", "ruta-miradores-4x4"], "every offerable experience must be one of the three frozen migration116 offers; unknown eligible rows fail");
  const canonical = new Map([
    ["descenso-canoa", { title: "Descenso en canoa", price_cents: 6000, deposit_cents: 1500, max_party: 4 }],
    ["paseo-senda-costera", { title: "Paseo por la senda costera", price_cents: 12000, deposit_cents: 3000, max_party: 6 }],
    ["ruta-miradores-4x4", { title: "Ruta de miradores en 4x4", price_cents: 20000, deposit_cents: 5000, max_party: 6 }],
  ]);
  for (const row of catalog) {
    const expected = canonical.get(row.slug); assert.ok(expected);
    for (const [key, value] of Object.entries(expected)) assert.equal(row[key as keyof typeof expected], value, `frozen offer ${row.slug} ${key}`);
    assert.equal(row.capacity_per_slot, 12);
    assert.deepEqual(row.slot_rule, { weekdays: [1, 2, 3, 4, 5, 6, 7], start_times: ["10:00", "16:00"] });
    const merchant = row.merchant as unknown as { slug: string; confirmation_mode: string } | null;
    assert.equal(merchant?.slug, "demo-rutas-del-sella"); assert.equal(merchant?.confirmation_mode, "instant");
  }
  const modes: BookingEvaluationMode[] = ["baseline", "deterministic", "jev"];
  assert.equal(corpus.scenarios.length, 30);
  for (const [index, scenario] of corpus.scenarios.entries()) {
    for (const mode of [...modes.slice(index % 3), ...modes.slice(0, index % 3)]) rows.push(await completeScenario(mode, scenario, code));
  }
  await edgeCases(code);
} catch (error) { failure = error; }
finally {
  fault = "none"; globalThis.fetch = originalFetch;
  try { cleanup = await cleanupBookingRows(admin, created); assert.deepEqual(cleanup, NOTHING_LEFT); }
  catch (error) { failure ??= error; }
  const report = {
    schemaVersion: 1, complete: !failure, timingMode: "synthetic-provider-http-real-local-route", timingScope: "route", proxyIncluded: false, retrievalCache: "disabled-before-app-import",
    liveQuality: "unmeasured", livePerformance: "UNAVAILABLE", clock: corpus.clock, catalog: corpus.catalog,
    corpusHash: sha(corpusBytes), catalogHash: (() => { try { return sha(readFileSync(resolve(directory, "catalog.json"))); } catch { return null; } })(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceHashes: Object.fromEntries(["e2e/fixtures/jev-booking-driver.ts", "scripts/lib/booking-eval-server.ts", "scripts/lib/booking-eval-http-fixtures.ts"].map(file => [file, sha(readFileSync(file))])),
    scenarioCount: 30, completedArms: rows.filter(r => "scenarioId" in r).length, expectedArms: 90,
    rows, cleanup, serverErrorsPath, failure: failure instanceof Error ? { message: failure.message, stack: failure.stack } : failure ?? null,
  };
  const reportPath = resolve(directory, "report.json"); writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`JEV_BOOKING_RESULT ${JSON.stringify({ complete: report.complete, completedArms: report.completedArms, reportPath, cleanup })}`);
}
if (failure) {
  console.error(`Local booking server diagnostic ledger: ${serverErrorsPath}`);
  throw failure;
}
