import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import Stripe from "stripe";
import { injectSessionCookies } from "./fixtures/auth";
import { requireLocalBookingEnv, localServiceClient, csrfHeaders } from "./fixtures/booking-local";

test("real paid auth/access/session journey, revocation, support and provider recovery", async ({ page, context, baseURL }) => {
  if (!process.env.PAID_VOICE_LOCAL_NONCE || !baseURL) throw Error("Use scripts/run-paid-voice-local.mjs with an owned task stack");
  const env = requireLocalBookingEnv(), admin = localServiceClient(env);
  const tag = "phase4-" + randomBytes(6).toString("hex");
  const email = tag + "@paisaxe.dev", password = randomBytes(20).toString("hex");
  const auth = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let user: string | undefined, session: Session;
  const payments: string[] = [], events: string[] = [];
  let originalFlag: {data: Record<string, unknown> | null} | undefined;
  let primaryFailure: unknown;
  try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull(); user = created.data.user!.id;
  const signed = await auth.auth.signInWithPassword({ email, password });
  expect(signed.error).toBeNull(); session = signed.data.session!;
  const flag = await admin.from("feature_flags").select("*").eq("flag_key", "visitor_voice_agent").eq("environment", "development").maybeSingle();
  expect(flag.error).toBeNull(); originalFlag = flag;
  const sdkVersion = JSON.parse(readFileSync("node_modules/@elevenlabs/react/package.json", "utf8")).version as string;
  let websocketConnections = 0, initiationMessages = 0;
  let expectedStoryTitle = "";
  let sendTranscript: (() => void) | undefined;
  const sdkContexts: {title: string; locale: string; language: string; authenticated: boolean}[] = [];
  const external: string[] = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)) return route.continue();
    external.push(url.hostname); return route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, socket => {
    const url = new URL(socket.url());
    if (["localhost", "127.0.0.1"].includes(url.hostname)) { socket.connectToServer(); return; }
    if (url.protocol !== "wss:" || url.hostname !== "api.elevenlabs.io" || url.port !== "" || url.pathname !== "/v1/convai/conversation" || url.searchParams.get("conversation_id") !== process.env.PAID_VOICE_LOCAL_NONCE || [...url.searchParams.keys()].sort().join(",") !== "conversation_id,source,version" || url.searchParams.get("source") !== "react_sdk" || url.searchParams.get("version") !== sdkVersion) {
      external.push("ws:" + url.hostname); socket.close(); return;
    }
    // Provider boundary only. The installed browser SDK and WebAudio stay real.
    websocketConnections++;
    socket.onMessage(message => {
      if (typeof message !== "string") return;
      const payload = JSON.parse(message);
      if (payload.type === "conversation_initiation_client_data") {
        initiationMessages++;
        sdkContexts.push({title:payload.dynamic_variables?.story_title, locale:payload.dynamic_variables?.user_locale, language:payload.conversation_config_override?.agent?.language, authenticated:payload.dynamic_variables?.user_access_token === session.access_token});
        socket.send(JSON.stringify({ type: "conversation_initiation_metadata", conversation_initiation_metadata_event: { conversation_id: process.env.PAID_VOICE_LOCAL_NONCE, agent_output_audio_format: "pcm_16000", user_input_audio_format: "pcm_16000" } }));
        sendTranscript = () => socket.send(JSON.stringify({ type: "agent_response", agent_response_event: { event_id: 1, agent_response: "Local provider boundary connected" } }));
      }
    });
  });
  const counts = () => JSON.parse(readFileSync(process.env.PAID_VOICE_PROVIDER_COUNTS!, "utf8")) as { requests: number; accepted: number; rejected: number; invalid: number };
  const webhook = async (type: string, object: unknown) => {
    const id = "evt_" + tag + "_" + events.length; events.push(id);
    const payload = JSON.stringify({ id, object: "event", type, created: 1, livemode: false, data: { object } });
    const response = await context.request.post(baseURL + "/api/webhooks/stripe", { data: payload, headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_phase4_local_synthetic" }) } });
    expect(response.status(), await response.text()).toBe(200);
  };
  const grant = async () => {
    const payment = "pi_" + tag + "_" + payments.length; payments.push(payment);
    await webhook("checkout.session.completed", { object: "checkout.session", payment_status: "paid", amount_total: 1500, currency: "eur", payment_intent: { id: payment }, metadata: { user_id: user, purchase_type: "day_pass" } });
    return payment;
  };
  const issuance = () => context.request.post(baseURL + "/api/voice-session", { data: { agentKey: "pelayo" }, headers: csrfHeaders(baseURL, { Authorization: "Bearer " + session.access_token }) });
  const openChat = async () => {
    await page.goto("/immersive?story=release-probe-local-story");
    await expect(page.getByTestId("story-title").first()).toBeVisible();
    expectedStoryTitle = (await page.getByTestId("story-title").first().innerText()).trim();
    await page.getByTestId("ask-button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  };
    expect((await admin.from("feature_flags").upsert({ flag_key: "visitor_voice_agent", environment: "development", enabled: true, label: "Local paid voice proof", config: {} }, { onConflict: "flag_key,environment" })).error).toBeNull();
    const anonymous = await context.request.post(baseURL + "/api/voice-session", { data: { agentKey: "pelayo" }, headers: csrfHeaders(baseURL) });
    expect(anonymous.status()).toBe(401); expect(counts().requests).toBe(0);
    const expiredPayment = await grant();
    expect((await admin.from("voice_purchases").update({expires_at:new Date(Date.now()-60000).toISOString()}).eq("payment_provider_id",expiredPayment)).error).toBeNull();
    await page.goto("/"); await injectSessionCookies(page, `sb-${new URL(env.supabaseUrl).hostname.split(".")[0]}-auth-token`, session);
    await openChat(); await expect(page.getByText("Your voice pass has expired. You can purchase a new pass to continue using voice.")).toBeVisible();
    expect((await issuance()).status()).toBe(403); expect(counts().requests).toBe(0);
    const payment = await grant();
    await openChat();
    await expect(page.getByRole("button", { name: "Talk to me", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Talk to me", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
    expect(sendTranscript).toBeDefined(); sendTranscript!();
    await expect(page.getByRole("log")).toContainText("Pelayo: Local provider boundary connected");
    expect(sdkContexts).toEqual([{title:expectedStoryTitle,locale:"en",language:"en",authenticated:true}]);
    expect(counts()).toMatchObject({ accepted: 1, invalid: 0 }); expect(websocketConnections).toBe(1); expect(initiationMessages).toBe(1);
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await webhook("charge.dispute.created", { id: "dp_" + tag, payment_intent: payment, status: "needs_response" });
    const beforeSuspended = counts().requests;
    expect((await issuance()).status()).toBe(403); expect(counts().requests).toBe(beforeSuspended);
    await page.getByRole("button", { name: "Talk to me", exact: true }).click();
    await expect(page.getByRole("button", { name: "Talk to me", exact: true })).toHaveCount(0);
    expect(counts().requests).toBe(beforeSuspended);
    await expect(page.getByText(/Voice access is suspended/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "mailto:support@paisaxe.es");
    await expect(page.getByRole("dialog").locator('a[href^="/pricing"]')).toHaveCount(0);
    await webhook("charge.dispute.closed", { id: "dp_" + tag, payment_intent: payment, status: "won" });
    const expiry = await admin.from("voice_purchases").select("expires_at").eq("payment_provider_id", payment).single(); expect(expiry.error).toBeNull();
    await webhook("charge.refunded", { id: "ch_" + tag, payment_intent: payment, amount_captured: 1500, currency: "eur", refunds: { has_more: false, data: [{ id: "re_" + tag, charge: "ch_" + tag, payment_intent: payment, status: "succeeded", amount: 1500, currency: "eur" }] } });
    expect((await issuance()).status()).toBe(403); expect(counts().requests).toBe(beforeSuspended);
    await openChat(); await expect(page.getByText(/This voice pass was revoked/)).toBeVisible();
    const other = await grant();
    expect((await admin.from("voice_purchases").update({expires_at:new Date(Date.now()+3600000).toISOString()}).eq("payment_provider_id",other)).error).toBeNull();
    expect((await issuance()).status()).toBe(200); expect(counts().accepted).toBe(2);
    expect((await admin.from("voice_purchases").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("payment_provider_id", other)).error).toBeNull();
    expect((await issuance()).status()).toBe(403); expect(counts().accepted).toBe(2);
    // Re-enable only the independent pass; refund remains revoked and expiry
    // on the refunded purchase remains byte-for-byte the original grant.
    expect((await admin.from("voice_purchases").update({ expires_at: new Date(Date.now() + 3600000).toISOString() }).eq("payment_provider_id", other)).error).toBeNull();
    expect((await admin.from("voice_purchases").select("expires_at").eq("payment_provider_id", payment).single()).data?.expires_at).toBe(expiry.data!.expires_at);
    writeFileSync(process.env.PAID_VOICE_PROVIDER_MODE!, "reject");
    await openChat(); await page.getByRole("button", { name: "Talk to me", exact: true }).click();
    await expect(page.getByRole("textbox")).toBeVisible(); expect(counts().rejected).toBe(1);
    writeFileSync(process.env.PAID_VOICE_PROVIDER_MODE!, "accept");
    await page.getByRole("button", { name: "Talk", exact: true }).click();
    await page.getByRole("button", { name: "Talk to me", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
    expect(sendTranscript).toBeDefined(); sendTranscript!();
    await expect(page.getByRole("log")).toContainText("Pelayo: Local provider boundary connected");
    expect(sdkContexts).toHaveLength(2);
    expect(sdkContexts[1]).toEqual({title:expectedStoryTitle,locale:"en",language:"en",authenticated:true});
    expect(counts()).toMatchObject({ accepted: 3, rejected: 1, invalid: 0 }); expect(initiationMessages).toBe(2);
    expect(external.filter(host => /elevenlabs|stripe|anthropic|jsdelivr/.test(host))).toEqual([]);
  } catch (error) {
    primaryFailure = error; throw error;
  } finally {
    const failures: unknown[] = [];
    const cleanup = async (action: () => unknown | Promise<unknown>) => { try { await action(); } catch (error) { failures.push(error); } };
    await cleanup(() => writeFileSync(process.env.PAID_VOICE_PROVIDER_MODE!, "accept"));
    await cleanup(() => page.goto("about:blank"));
    if (originalFlag) await cleanup(async () => {
      const result = originalFlag!.data ? await admin.from("feature_flags").upsert(originalFlag!.data, {onConflict:"flag_key,environment"}) : await admin.from("feature_flags").delete().eq("flag_key","visitor_voice_agent").eq("environment","development");
      expect(result.error).toBeNull();
    });
    if (events.length) await cleanup(async () => { expect((await admin.from("stripe_webhook_events").delete().in("event_id",events)).error).toBeNull(); });
    if (payments.length) await cleanup(async () => { expect((await admin.from("stripe_entitlement_payments").delete().in("payment_intent",payments)).error).toBeNull(); });
    if (user) {
      await cleanup(async () => { expect((await admin.auth.admin.deleteUser(user!)).error).toBeNull(); });
      await cleanup(async () => { const result=await admin.from("voice_purchases").select("id").eq("user_id",user!); expect(result.error).toBeNull(); expect(result.data).toEqual([]); });
    }
    await cleanup(async () => { expect((await auth.auth.signOut()).error).toBeNull(); });
    if (failures.length) {
      const errors = primaryFailure ? [primaryFailure,...failures] : failures;
      throw Object.assign(new Error("Paid voice cleanup failed; every action attempted: " + errors.map(String).join("\n")), {errors});
    }
  }
});
