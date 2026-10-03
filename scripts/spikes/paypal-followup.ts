/**
 * Phase 0 follow-up (review findings P0-07, P0-08, P0-09, P0-12): record from PayPal's own
 * API what the two sandbox runs left behind, so the evidence does not rest on unrecorded
 * console checks.
 *
 * Run: npx tsx scripts/spikes/paypal-followup.ts
 * Output: scripts/spikes/paypal-followup-evidence.json (ids, statuses, timestamps; no secrets)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const SANDBOX_HOST = "api-m.sandbox.paypal.com";
const apiBase = (process.env.PAYPAL_API_BASE?.trim() || `https://${SANDBOX_HOST}`).replace(/\/$/, "");
const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
if (new URL(apiBase).hostname !== SANDBOX_HOST) throw new Error(`refusing to run against ${apiBase}`);
if (!clientId || !clientSecret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in .env.local");

interface WebhookEvent {
  id: string;
  event_type: string;
  create_time: string;
  resource: { id?: string };
}

async function main(): Promise<void> {
  const tokenResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tokenBody = (await tokenResponse.json()) as { access_token?: string; expires_in?: number };
  if (!tokenBody.access_token) throw new Error(`token request failed: ${tokenResponse.status}`);
  const headers = { Authorization: `Bearer ${tokenBody.access_token}` };

  const runs = ["return", "server-capture"].map((mode) => ({
    mode,
    orderId: (JSON.parse(readFileSync(resolve(`scripts/spikes/paypal-evidence-${mode}.json`), "utf8")) as { orderId: string }).orderId,
  }));

  const orders = [];
  for (const run of runs) {
    const response = await fetch(`${apiBase}/v2/checkout/orders/${run.orderId}`, { headers });
    if (!response.ok) throw new Error(`getOrder ${run.orderId} failed: ${response.status}`);
    const order = (await response.json()) as {
      status: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string; amount: { value: string } }> } }>;
    };
    const captures = (order.purchase_units ?? []).flatMap((unit) => unit.payments?.captures ?? []);
    orders.push({
      mode: run.mode,
      orderId: run.orderId,
      orderStatus: order.status,
      captureCount: captures.length,
      captures: captures.map((capture) => ({ id: capture.id, status: capture.status, value: capture.amount.value })),
    });
  }

  const eventsResponse = await fetch(`${apiBase}/v1/notifications/webhooks-events?page_size=50`, { headers });
  if (!eventsResponse.ok) throw new Error(`webhook events query failed: ${eventsResponse.status}`);
  const eventsBody = (await eventsResponse.json()) as { events?: WebhookEvent[] };
  const events = (eventsBody.events ?? [])
    .map((event) => ({ id: event.id, type: event.event_type, createTime: event.create_time, resourceId: event.resource.id ?? null }))
    .sort((a, b) => a.createTime.localeCompare(b.createTime));

  const evidence = {
    recordedAt: new Date().toISOString(),
    apiBase,
    accessTokenExpiresInSeconds: tokenBody.expires_in ?? null,
    orders,
    webhookEventsGeneratedByPayPal: events,
    note: "webhookEventsGeneratedByPayPal is PayPal's own event log for the app, read after both runs; an event missing here was not generated, as opposed to generated but not delivered.",
  };
  const out = resolve("scripts/spikes/paypal-followup-evidence.json");
  writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ ...evidence, webhookEventsGeneratedByPayPal: events.map((e) => `${e.createTime} ${e.type} ${e.resourceId}`) }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
