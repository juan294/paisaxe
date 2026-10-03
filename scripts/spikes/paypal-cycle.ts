/**
 * Phase 0 spike (docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-0.md):
 * one real PayPal sandbox cycle - create order, buyer approval, capture, idempotent
 * re-capture, refund, and webhooks verified through the API - recorded as evidence
 * for Phase 4. Sandbox only: the base URL must be the sandbox API.
 *
 * Usage:
 *   1. cloudflared tunnel --url http://localhost:8787     (prints https://<x>.trycloudflare.com)
 *   2. In the PayPal developer dashboard, add a webhook on the sandbox app for
 *      <tunnel>/webhook and put its id in PAYPAL_WEBHOOK_ID in .env.local.
 *   3. npx tsx scripts/spikes/paypal-cycle.ts --base-url https://<x>.trycloudflare.com --mode return
 *      npx tsx scripts/spikes/paypal-cycle.ts --base-url https://<x>.trycloudflare.com --mode server-capture
 *
 * mode "return": the buyer approves and comes back; capture happens on the return.
 * mode "server-capture": the buyer approves and CLOSES the tab before returning;
 *   capture happens from the server on the approval webhook (Phase 4, finding F02).
 *
 * Output: scripts/spikes/paypal-evidence-<mode>.json (ids, statuses, event names; no secrets).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const PORT = 8787;
const SANDBOX_HOST = "api-m.sandbox.paypal.com";
const SANDBOX_API = `https://${SANDBOX_HOST}`;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseUrl = arg("base-url")?.replace(/\/$/, "");
const mode = arg("mode") === "server-capture" ? "server-capture" : "return";
const apiBase = (process.env.PAYPAL_API_BASE?.trim() || SANDBOX_API).replace(/\/$/, "");
const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

if (!baseUrl) throw new Error("--base-url <public tunnel url> is required");
if (!clientId || !clientSecret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in .env.local");
if (new URL(apiBase).hostname !== SANDBOX_HOST) throw new Error(`refusing to run against a non-sandbox API: ${apiBase}`);

interface WebhookRecord {
  receivedAtMs: number;
  eventId: string;
  eventType: string;
  resourceId: string | undefined;
  verification: string;
}

const started = Date.now();
const webhooks: WebhookRecord[] = [];
const log: string[] = [];
let returnedOrderId: string | undefined;
let returnedAtMs: number | undefined;

function note(line: string): void {
  const entry = `+${((Date.now() - started) / 1000).toFixed(1)}s ${line}`;
  log.push(entry);
  console.log(entry);
}

let cachedToken: { value: string; expiresAt: number } | undefined;
async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !body.access_token) throw new Error(`token request failed: ${response.status} ${body.error}`);
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 0) * 1000 };
  return cachedToken.value;
}

async function paypal<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<{ status: number; body: T; debugId: string | null }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await token()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  const response = await fetch(`${apiBase}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as T, debugId: response.headers.get("paypal-debug-id") };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleWebhook(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const raw = await readBody(request);
  const event = JSON.parse(raw) as { id: string; event_type: string; resource?: { id?: string } };
  let verification = "not_attempted (PAYPAL_WEBHOOK_ID unset)";
  if (webhookId) {
    const result = await paypal<{ verification_status?: string }>("POST", "/v1/notifications/verify-webhook-signature", {
      auth_algo: request.headers["paypal-auth-algo"],
      cert_url: request.headers["paypal-cert-url"],
      transmission_id: request.headers["paypal-transmission-id"],
      transmission_sig: request.headers["paypal-transmission-sig"],
      transmission_time: request.headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: event,
    });
    verification = result.body.verification_status ?? `http_${result.status}`;
  }
  webhooks.push({
    receivedAtMs: Date.now() - started,
    eventId: event.id,
    eventType: event.event_type,
    resourceId: event.resource?.id,
    verification,
  });
  note(`webhook ${event.event_type} resource=${event.resource?.id} verification=${verification}`);
  response.writeHead(200).end();
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  if (request.method === "POST" && url.pathname === "/webhook") {
    handleWebhook(request, response).catch((error: unknown) => {
      note(`webhook handler error: ${String(error)}`);
      response.writeHead(500).end();
    });
    return;
  }
  if (url.pathname === "/return") {
    returnedOrderId = url.searchParams.get("token") ?? undefined;
    returnedAtMs = Date.now() - started;
    note(`buyer returned with order ${returnedOrderId}`);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end("<h1>Volviste de PayPal (spike). Puedes cerrar esta pestaña.</h1>");
    return;
  }
  if (url.pathname === "/cancel") {
    note("buyer cancelled at PayPal");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end("<h1>Pago cancelado (spike).</h1>");
    return;
  }
  response.writeHead(404).end();
});

async function waitFor(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((done) => setTimeout(done, 1000));
  }
}

interface Order {
  id: string;
  status: string;
  links?: Array<{ rel: string; href: string }>;
  purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }> } }>;
}

async function main(): Promise<void> {
  await new Promise<void>((done) => server.listen(PORT, done));
  note(`listening on ${PORT}; public base ${baseUrl}; mode ${mode}; webhook verification ${webhookId ? "on" : "off"}`);

  const operationKey = randomUUID();
  const created = await paypal<Order>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        { custom_id: "spike-booking-1", description: "Paseo por la senda costera (demo)", amount: { currency_code: "EUR", value: "30.00" } },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: `${baseUrl}/return`,
            cancel_url: `${baseUrl}/cancel`,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            locale: "es-ES",
          },
        },
      },
    },
    operationKey,
  );
  if (created.status >= 300) throw new Error(`create order failed ${created.status} ${JSON.stringify(created.body)}`);
  const orderId = created.body.id;
  const approveUrl = created.body.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  note(`order ${orderId} status ${created.body.status}`);
  console.log(`\nOPEN THIS LINK AND APPROVE AS THE SANDBOX BUYER:\n${approveUrl}\n`);
  if (mode === "server-capture") console.log("After approving, CLOSE the tab before it returns to the tunnel.\n");

  if (mode === "return") {
    await waitFor(() => returnedOrderId === orderId, 15 * 60_000, "buyer return");
  } else {
    await waitFor(
      () => webhooks.some((hook) => hook.eventType === "CHECKOUT.ORDER.APPROVED" && hook.resourceId === orderId),
      15 * 60_000,
      "CHECKOUT.ORDER.APPROVED webhook",
    );
  }

  const beforeCapture = await paypal<Order>("GET", `/v2/checkout/orders/${orderId}`);
  note(`getOrder before capture: ${beforeCapture.body.status}`);

  const capture = await paypal<Order>("POST", `/v2/checkout/orders/${orderId}/capture`, {}, `capture:${operationKey}`);
  const captureRecord = capture.body.purchase_units?.[0]?.payments?.captures?.[0];
  note(`capture http ${capture.status} order ${capture.body.status} capture ${captureRecord?.id} ${captureRecord?.status}`);
  if (capture.status >= 300) note(`capture failed body: ${JSON.stringify(capture.body)} debug ${capture.debugId}`);

  const recapture = await paypal<Order>("POST", `/v2/checkout/orders/${orderId}/capture`, {}, `capture:${operationKey}`);
  const recaptureRecord = recapture.body.purchase_units?.[0]?.payments?.captures?.[0];
  note(`re-capture same request id: http ${recapture.status} capture ${recaptureRecord?.id}`);

  const recaptureNewKey = await paypal<{ name?: string; details?: Array<{ issue?: string }> }>(
    "POST",
    `/v2/checkout/orders/${orderId}/capture`,
    {},
    `capture:${randomUUID()}`,
  );
  note(`re-capture new request id: http ${recaptureNewKey.status} ${recaptureNewKey.body.details?.[0]?.issue ?? recaptureNewKey.body.name ?? ""}`);

  let refund: { status: number; body: { id?: string; status?: string }; debugId: string | null } | undefined;
  let refundLater: { status: number; body: { id?: string; status?: string }; debugId: string | null } | undefined;
  if (captureRecord?.id) {
    refund = await paypal("POST", `/v2/payments/captures/${captureRecord.id}/refund`, { amount: { currency_code: "EUR", value: "30.00" } }, `refund:${operationKey}`);
    note(`refund http ${refund.status} ${refund.body.id} ${refund.body.status}`);
    if (refund.status >= 300) note(`refund failed body: ${JSON.stringify(refund.body)} debug ${refund.debugId}`);
    const captureLater = await paypal<{ status?: string }>("GET", `/v2/payments/captures/${captureRecord.id}`);
    note(`getCapture after refund: ${captureLater.body.status}`);
    if (refund.body.id) {
      refundLater = await paypal("GET", `/v2/payments/refunds/${refund.body.id}`);
      note(`getRefund: ${refundLater.body.status}`);
    }
  }

  note("waiting 90 s for remaining webhooks");
  await new Promise((done) => setTimeout(done, 90_000));
  server.close();

  const approvedHook = webhooks.find((hook) => hook.eventType === "CHECKOUT.ORDER.APPROVED");
  const evidence = {
    recordedAt: new Date().toISOString(),
    mode,
    apiBase,
    orderId,
    createStatus: created.body.status,
    createDebugId: created.debugId,
    returnedAtMs: returnedAtMs ?? null,
    approvalWebhookAtMs: approvedHook?.receivedAtMs ?? null,
    getOrderBeforeCapture: beforeCapture.body.status,
    capture: { http: capture.status, orderStatus: capture.body.status, captureId: captureRecord?.id, captureStatus: captureRecord?.status, amount: captureRecord?.amount },
    recaptureSameRequestId: { http: recapture.status, captureId: recaptureRecord?.id, sameCapture: recaptureRecord?.id === captureRecord?.id },
    recaptureNewRequestId: { http: recaptureNewKey.status, issue: recaptureNewKey.body.details?.[0]?.issue ?? recaptureNewKey.body.name ?? null },
    refund: refund ? { http: refund.status, refundId: refund.body.id, status: refund.body.status } : null,
    refundLater: refundLater ? { status: refundLater.body.status } : null,
    webhooks,
    eventNamesObserved: [...new Set(webhooks.map((hook) => hook.eventType))],
    log,
  };
  const out = resolve(`scripts/spikes/paypal-evidence-${mode}.json`);
  writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
  note(`evidence written to ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  server.close();
  process.exit(1);
});
