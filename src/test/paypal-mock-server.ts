/**
 * A local stand-in for the PayPal sandbox REST API (PayPal hackathon plan, Phase 4),
 * used by the adapter tests and the webhook route test.
 *
 * A small node:http server on 127.0.0.1 that speaks PayPal's snake_case wire format,
 * keeps orders, captures and refunds in memory and records every request. Point
 * PAYPAL_API_BASE at `mock.baseUrl` (loopback is accepted outside production by
 * src/lib/paypal/env.ts).
 *
 * Endpoints:
 *   POST /v1/oauth2/token                        Basic auth, grant_type=client_credentials
 *   POST /v2/checkout/orders                     PAYER_ACTION_REQUIRED with a payer-action link
 *                                                (CREATED with an approve link when the body has
 *                                                no payment_source.paypal)
 *   GET  /v2/checkout/orders/:id
 *   POST /v2/checkout/orders/:id/capture         APPROVED -> COMPLETED with one capture;
 *                                                COMPLETED -> 422 ORDER_ALREADY_CAPTURED (or 201
 *                                                with the existing capture, see setRecaptureMode);
 *                                                not approved -> 422 ORDER_NOT_APPROVED
 *   GET  /v2/payments/captures/:id               with supplementary_data.related_ids.order_id
 *   POST /v2/payments/captures/:id/refund
 *   GET  /v2/payments/refunds/:id
 *   POST /v1/notifications/verify-webhook-signature
 *   POST /v2/invoicing/invoices                  DRAFT invoice (Phase 8a); the full invoice with
 *                                                Prefer: return=representation, else a self link
 *   POST /v2/invoicing/invoices/:id/send         DRAFT -> SENT, 200 with the payer-view link;
 *                                                not DRAFT -> 422 INVALID_INVOICE_STATUS (assumed name)
 *   POST /v2/invoicing/invoices/:id/cancel       SENT | UNPAID | PAYMENT_PENDING -> CANCELLED, 204 with no
 *                                                body; any other status -> 422 (issue name assumed)
 *   GET  /v2/invoicing/invoices/:id              amount, due_amount, payments.paid_amount and
 *                                                detail.metadata.recipient_view_url once sent
 *   GET  /v1/reporting/transactions              Transaction Search (APIMatic plan, Phase 2): a T0006
 *                                                entry per capture and a T1107 entry per refund
 *                                                (paypal_reference_id = the capture, negative amount),
 *                                                within start_date/end_date, paged by page_size/page;
 *                                                see setLedgerRefreshedAt and setTransactionSearchDenied
 *
 * Authorize / capture / void (Phase 8b, decision R7), for orders created with intent AUTHORIZE:
 *   POST /v2/checkout/orders/:id/authorize       APPROVED -> COMPLETED with one authorization (CREATED);
 *                                                already authorized -> 422 ORDER_ALREADY_AUTHORIZED;
 *                                                not approved -> 422 ORDER_NOT_APPROVED. A capture of an
 *                                                AUTHORIZE order -> 422 ACTION_DOES_NOT_MATCH_INTENT
 *   GET  /v2/payments/authorizations/:id
 *   POST /v2/payments/authorizations/:id/capture  CREATED -> CAPTURED with one capture (also listed on the
 *                                                order); CAPTURED -> 422 AUTHORIZATION_ALREADY_CAPTURED;
 *                                                VOIDED -> 422 AUTHORIZATION_VOIDED; EXPIRED -> 422
 *                                                AUTHORIZATION_EXPIRED. Honours setCaptureFailure
 *   POST /v2/payments/authorizations/:id/void     CREATED -> VOIDED (200 with the authorization);
 *                                                VOIDED -> 422 PREVIOUSLY_VOIDED; CAPTURED -> 422
 *                                                PREVIOUSLY_CAPTURED; EXPIRED -> 422 AUTHORIZATION_EXPIRED
 * The 422 issue names for authorizations follow PayPal's Payments v2 documentation as
 * understood when this was written; Phase 0 did not observe them in the sandbox.
 *
 * POSTs carrying a PayPal-Request-Id are idempotent per endpoint: a repeat replays the
 * first response exactly, as PayPal does. API calls need a Bearer token this mock issued.
 * Errors carry name, message, debug_id and details[].issue, plus a paypal-debug-id header.
 *
 * Knobs: approve(orderId, payerEmail?) (an approved or completed order carries payer.email_address),
 * payInvoice(invoiceId, {amountCents, pending}) (the buyer pays an invoice in full, in part, or
 * with a payment PayPal has not settled), complete(orderId) (a capture that happened but whose response
 * was lost), setCaptureFailure("timeout" | "declined" | "none"), setRecaptureMode,
 * setRefundStatus, setVerification, setTokenExpiresIn and injectNext (a one-shot canned
 * response for the next matching request), plus setAuthorizationStatus (for example EXPIRED)
 * and completeAuthorization (an authorization capture whose response was lost).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
  /** The query string, parsed. */
  query: URLSearchParams;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  rawBody: string;
  /** The parsed JSON body, or null when the body is empty or not JSON. */
  body: unknown;
}

interface WireMoney {
  currency_code: string;
  value: string;
}

export interface MockOrder {
  id: string;
  status: string;
  intent: string;
  amount: WireMoney | null;
  customId: string | null;
  description: string | null;
  experienceContext: Record<string, unknown> | null;
  captureId: string | null;
  /** Set when the buyer approves (payer.email_address on the wire). */
  payerEmail: string | null;
  /** Set once an AUTHORIZE order is authorized. */
  authorizationId?: string | null;
}

export interface MockInvoice {
  id: string;
  status: string;
  currency: string;
  /** The invoice total in cents (sum of the items). */
  amountCents: number;
  /** Paid and settled, in cents. */
  paidCents: number;
  recipientEmail: string;
  dueDate: string | null;
  reference: string | null;
  /** The request body as received. */
  body: Record<string, unknown>;
}

export interface MockAuthorization {
  id: string;
  orderId: string;
  status: string;
  amount: WireMoney | null;
  customId: string | null;
  expirationTime: string;
  captureId: string | null;
}

export interface MockCapture {
  id: string;
  orderId: string;
  status: string;
  amount: WireMoney | null;
  customId: string | null;
  /** When PayPal recorded it (Transaction Search). */
  createdAt: Date;
}

export interface MockRefund {
  id: string;
  captureId: string;
  status: string;
  amount: WireMoney | null;
  createdAt: Date;
}

/**
 * "timeout": capture requests hang without being applied until the mock closes.
 * "declined": the capture is recorded with status DECLINED (HTTP 201, order COMPLETED).
 * This shape is an assumption; Phase 0 never observed a declined capture.
 */
export type CaptureFailure = "timeout" | "declined" | "none";

export interface InjectedResponse {
  method: string;
  /** Exact path, or a pattern tested against the path. */
  path: string | RegExp;
  status: number;
  /** An object is sent as JSON; a string is sent as is. */
  body?: unknown;
  headers?: Record<string, string>;
}

export interface PaypalMockOptions {
  /** When set, the token endpoint answers 401 invalid_client for other credentials. */
  clientId?: string;
  clientSecret?: string;
  /** Fixed port on 127.0.0.1, for a server started before the mock (scripts/booking/postman-local.ts). Default: any free port. */
  port?: number;
  /**
   * Inserted into every order, capture and refund id (letters and digits). A mock that is
   * restarted against a database that keeps its rows needs one, or its ids repeat. Default: none.
   */
  idSalt?: string;
}

export interface PaypalMock {
  baseUrl: string;
  requests: RecordedRequest[];
  orders: Map<string, MockOrder>;
  captures: Map<string, MockCapture>;
  refunds: Map<string, MockRefund>;
  invoices: Map<string, MockInvoice>;
  authorizations: Map<string, MockAuthorization>;
  /** Recorded requests matching a method and a path (exact string or pattern). */
  requestsTo(method: string, path: string | RegExp): RecordedRequest[];
  /** The buyer approved the order at PayPal, as `payerEmail` (default DEFAULT_PAYER_EMAIL). */
  approve(orderId: string, payerEmail?: string): void;
  /**
   * The recipient pays a sent invoice: `amountCents` (default: everything due). A settled
   * full payment makes it PAID with nothing due; a smaller one PARTIALLY_PAID; a `pending`
   * payment (not settled by PayPal yet) PAYMENT_PENDING with the amount still due.
   */
  payInvoice(invoiceId: string, payment?: { amountCents?: number; pending?: boolean }): MockInvoice;
  /** PayPal captured the order but the capture response never reached us. Returns the capture. */
  complete(orderId: string): MockCapture;
  setCaptureFailure(kind: CaptureFailure): void;
  /** What a capture of an already completed order with a new request id returns. Default "422". */
  setRecaptureMode(mode: "422" | "201"): void;
  /** Sets the status of every existing refund and of the refunds created from now on. Default COMPLETED. */
  setRefundStatus(status: string): void;
  /** Default SUCCESS. */
  setVerification(status: "SUCCESS" | "FAILURE"): void;
  /** expires_in of tokens issued from now on. Default 32400. */
  setTokenExpiresIn(seconds: number): void;
  injectNext(response: InjectedResponse): void;
  /** Sets an authorization's status, for example EXPIRED or VOIDED. */
  setAuthorizationStatus(authorizationId: string, status: string): void;
  /** PayPal captured the authorization but the response never reached us. Returns the capture. */
  completeAuthorization(authorizationId: string): MockCapture;
  /**
   * Transaction Search lag: movements after `at` are not listed yet, and `at` is reported as
   * last_refreshed_datetime. Null (default): everything is listed, refreshed now.
   */
  setLedgerRefreshedAt(at: Date | null): void;
  /** Transaction Search answers 403 NOT_AUTHORIZED, as for an app without the permission. */
  setTransactionSearchDenied(denied: boolean): void;
  close(): Promise<void>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** The sandbox buyer's email when a test does not choose one. */
export const DEFAULT_PAYER_EMAIL = "sb-buyer@personal.example.com";

/** Cents as PayPal's value string ("90.00"). */
function centsValue(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** PayPal's value string as cents, or null when unreadable. */
function valueCents(value: unknown): number | null {
  const match = typeof value === "string" ? /^(\d+)(?:\.(\d{1,2}))?$/.exec(value) : null;
  return match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : null;
}

function matches(pattern: string | RegExp, path: string): boolean {
  return typeof pattern === "string" ? pattern === path : pattern.test(path);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function startPaypalMock(options: PaypalMockOptions = {}): Promise<PaypalMock> {
  const requests: RecordedRequest[] = [];
  const orders = new Map<string, MockOrder>();
  const captures = new Map<string, MockCapture>();
  const refunds = new Map<string, MockRefund>();
  const invoices = new Map<string, MockInvoice>();
  const authorizations = new Map<string, MockAuthorization>();
  const tokens = new Set<string>();
  const replays = new Map<string, { status: number; body: unknown }>();
  const injected: InjectedResponse[] = [];
  const hanging = new Set<ServerResponse>();

  let sequence = 0;
  let captureFailure: CaptureFailure = "none";
  let recaptureMode: "422" | "201" = "422";
  let refundStatus = "COMPLETED";
  let verification: "SUCCESS" | "FAILURE" = "SUCCESS";
  let tokenExpiresIn = 32_400;
  let ledgerRefreshedAt: Date | null = null;
  let transactionSearchDenied = false;
  let baseUrl = "";

  const idSalt = options.idSalt ?? "";
  if (!/^[A-Za-z0-9]*$/.test(idSalt)) throw new Error("paypal mock: idSalt must be letters and digits");
  const nextId = (prefix: string) => `${prefix}${idSalt}${String(++sequence).padStart(13, "0")}`;
  const debugId = () => `mockdebug${++sequence}`;

  function send(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    response.writeHead(status, { ...JSON_HEADERS, "paypal-debug-id": debugId(), ...headers }).end(text);
  }

  function sendError(response: ServerResponse, status: number, name: string, issue: string): void {
    const id = debugId();
    send(
      response,
      status,
      { name, message: `${name}: ${issue}`, debug_id: id, details: [{ issue, description: `mock ${issue}` }] },
      { "paypal-debug-id": id },
    );
  }

  function captureWire(capture: MockCapture): Record<string, unknown> {
    return {
      id: capture.id,
      status: capture.status,
      ...(capture.amount ? { amount: capture.amount } : {}),
      ...(capture.customId ? { custom_id: capture.customId } : {}),
      final_capture: true,
    };
  }

  function authorizationWire(authorization: MockAuthorization): Record<string, unknown> {
    return {
      id: authorization.id,
      status: authorization.status,
      ...(authorization.amount ? { amount: authorization.amount } : {}),
      ...(authorization.customId ? { custom_id: authorization.customId } : {}),
      expiration_time: authorization.expirationTime,
      supplementary_data: { related_ids: { order_id: authorization.orderId } },
    };
  }

  function orderWire(order: MockOrder): Record<string, unknown> {
    const capture = order.captureId ? captures.get(order.captureId) : undefined;
    const authorization = order.authorizationId ? authorizations.get(order.authorizationId) : undefined;
    const payments: Record<string, unknown> = {
      ...(authorization ? { authorizations: [authorizationWire(authorization)] } : {}),
      ...(capture ? { captures: [captureWire(capture)] } : {}),
    };
    const approvalRel = order.experienceContext ? "payer-action" : "approve";
    const links: Array<Record<string, string>> = [
      { href: `${baseUrl}/v2/checkout/orders/${order.id}`, rel: "self", method: "GET" },
    ];
    if (order.status === "CREATED" || order.status === "PAYER_ACTION_REQUIRED") {
      links.push({ href: `https://www.sandbox.paypal.com/checkoutnow?token=${order.id}`, rel: approvalRel, method: "GET" });
    }
    return {
      id: order.id,
      intent: order.intent,
      status: order.status,
      purchase_units: [
        {
          reference_id: "default",
          ...(order.amount ? { amount: order.amount } : {}),
          ...(order.customId ? { custom_id: order.customId } : {}),
          ...(order.description ? { description: order.description } : {}),
          ...(Object.keys(payments).length > 0 ? { payments } : {}),
        },
      ],
      ...(order.payerEmail ? { payer: { email_address: order.payerEmail, payer_id: "MOCKPAYER01" } } : {}),
      links,
    };
  }

  function invoiceWire(invoice: MockInvoice): Record<string, unknown> {
    const money = (cents: number) => ({ currency_code: invoice.currency, value: centsValue(cents) });
    const sent = invoice.status !== "DRAFT";
    const detail = asRecord(invoice.body.detail);
    return {
      ...invoice.body,
      id: invoice.id,
      status: invoice.status,
      detail: {
        ...detail,
        invoice_number: invoice.id.slice(-6),
        metadata: {
          create_time: "2026-10-04T10:00:00Z",
          invoicer_view_url: `https://www.sandbox.paypal.com/invoice/details/${invoice.id}`,
          ...(sent ? { recipient_view_url: `https://www.sandbox.paypal.com/invoice/p/#${invoice.id}` } : {}),
        },
      },
      amount: money(invoice.amountCents),
      // A pending payment is not settled: it counts neither as paid nor against what is due.
      due_amount: money(invoice.amountCents - invoice.paidCents),
      ...(invoice.paidCents > 0
        ? {
            payments: {
              paid_amount: money(invoice.paidCents),
              transactions: [{ payment_id: `PAY-${invoice.id}`, method: "PAYPAL", amount: money(invoice.paidCents) }],
            },
          }
        : {}),
      links: [{ href: `${baseUrl}/v2/invoicing/invoices/${invoice.id}`, rel: "self", method: "GET" }],
    };
  }

  function captureOrder(order: MockOrder, status: string): MockCapture {
    const capture: MockCapture = {
      id: nextId("CAP"),
      orderId: order.id,
      status,
      amount: order.amount,
      customId: order.customId,
      createdAt: new Date(),
    };
    captures.set(capture.id, capture);
    order.status = "COMPLETED";
    order.captureId = capture.id;
    return capture;
  }

  /**
   * Replays the stored response when this request id was already seen on this endpoint.
   * Otherwise returns the key under which to remember this response (null without a request id).
   */
  function replay(scope: string, request: IncomingMessage, response: ServerResponse): { replayed: boolean; key: string | null } {
    const requestId = request.headers["paypal-request-id"];
    if (typeof requestId !== "string" || !requestId) return { replayed: false, key: null };
    const key = `${scope} ${requestId}`;
    const previous = replays.get(key);
    if (previous) send(response, previous.status, previous.body);
    return { replayed: previous !== undefined, key };
  }

  function remember(key: string | null, status: number, body: unknown): void {
    if (key) replays.set(key, { status, body });
  }

  function authorized(request: IncomingMessage): boolean {
    const header = request.headers.authorization ?? "";
    return header.startsWith("Bearer ") && tokens.has(header.slice("Bearer ".length));
  }

  function handleToken(request: IncomingMessage, rawBody: string, response: ServerResponse): void {
    const header = request.headers.authorization ?? "";
    const decoded = header.startsWith("Basic ") ? Buffer.from(header.slice(6), "base64").toString("utf8") : "";
    const [id, secret] = [decoded.slice(0, decoded.indexOf(":")), decoded.slice(decoded.indexOf(":") + 1)];
    const wrongCredentials =
      !decoded.includes(":") ||
      (options.clientId !== undefined && id !== options.clientId) ||
      (options.clientSecret !== undefined && secret !== options.clientSecret);
    if (wrongCredentials) {
      send(response, 401, { error: "invalid_client", error_description: "Client Authentication failed" });
      return;
    }
    if (new URLSearchParams(rawBody).get("grant_type") !== "client_credentials") {
      send(response, 400, { error: "unsupported_grant_type", error_description: "unsupported grant_type" });
      return;
    }
    const token = `A21AA.mock-token-${++sequence}`;
    tokens.add(token);
    send(response, 200, {
      scope: "https://uri.paypal.com/services/payments/payment",
      access_token: token,
      token_type: "Bearer",
      app_id: "APP-MOCK",
      expires_in: tokenExpiresIn,
      nonce: `nonce-${sequence}`,
    });
  }

  function handleCreateOrder(request: IncomingMessage, body: unknown, response: ServerResponse): void {
    const { replayed, key } = replay("create-order", request, response);
    if (replayed) return;
    const input = asRecord(body);
    const unit = asRecord(Array.isArray(input.purchase_units) ? input.purchase_units[0] : undefined);
    const amount = asRecord(unit.amount);
    if (typeof amount.value !== "string" || typeof amount.currency_code !== "string") {
      sendError(response, 400, "INVALID_REQUEST", "MISSING_REQUIRED_PARAMETER");
      return;
    }
    const experienceContext = asRecord(asRecord(asRecord(input.payment_source).paypal).experience_context);
    const hasPaypalSource = asRecord(input.payment_source).paypal !== undefined;
    const order: MockOrder = {
      id: nextId("ORDER"),
      status: hasPaypalSource ? "PAYER_ACTION_REQUIRED" : "CREATED",
      intent: typeof input.intent === "string" ? input.intent : "CAPTURE",
      amount: { currency_code: amount.currency_code, value: amount.value },
      customId: typeof unit.custom_id === "string" ? unit.custom_id : null,
      description: typeof unit.description === "string" ? unit.description : null,
      experienceContext: hasPaypalSource ? experienceContext : null,
      captureId: null,
      payerEmail: null,
    };
    orders.set(order.id, order);
    const wire = orderWire(order);
    remember(key, 201, wire);
    send(response, 201, wire);
  }

  function handleCapture(orderId: string, request: IncomingMessage, response: ServerResponse): void {
    const order = orders.get(orderId);
    if (!order) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    const { replayed, key } = replay(`capture ${orderId}`, request, response);
    if (replayed) return;
    if (order.intent === "AUTHORIZE") {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "ACTION_DOES_NOT_MATCH_INTENT");
      return;
    }
    if (order.status === "COMPLETED") {
      if (recaptureMode === "201") {
        const wire = orderWire(order);
        remember(key, 201, wire);
        send(response, 201, wire);
      } else {
        sendError(response, 422, "UNPROCESSABLE_ENTITY", "ORDER_ALREADY_CAPTURED");
      }
      return;
    }
    if (order.status !== "APPROVED") {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "ORDER_NOT_APPROVED");
      return;
    }
    if (captureFailure === "timeout") {
      hanging.add(response);
      response.on("close", () => hanging.delete(response));
      return;
    }
    captureOrder(order, captureFailure === "declined" ? "DECLINED" : "COMPLETED");
    const wire = orderWire(order);
    remember(key, 201, wire);
    send(response, 201, wire);
  }

  function handleGetCapture(captureId: string, response: ServerResponse): void {
    const capture = captures.get(captureId);
    if (!capture) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    send(response, 200, {
      ...captureWire(capture),
      supplementary_data: { related_ids: { order_id: capture.orderId } },
    });
  }

  function handleRefund(captureId: string, request: IncomingMessage, body: unknown, response: ServerResponse): void {
    const capture = captures.get(captureId);
    if (!capture) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    const { replayed, key } = replay(`refund ${captureId}`, request, response);
    if (replayed) return;
    if (capture.status === "REFUNDED") {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "CAPTURE_FULLY_REFUNDED");
      return;
    }
    const amount = asRecord(asRecord(body).amount);
    const refund: MockRefund = {
      id: nextId("REF"),
      captureId,
      status: refundStatus,
      amount:
        typeof amount.value === "string" && typeof amount.currency_code === "string"
          ? { currency_code: amount.currency_code, value: amount.value }
          : capture.amount,
      createdAt: new Date(),
    };
    refunds.set(refund.id, refund);
    if (refund.status === "COMPLETED") capture.status = "REFUNDED";
    const wire = { id: refund.id, status: refund.status, ...(refund.amount ? { amount: refund.amount } : {}) };
    remember(key, 201, wire);
    send(response, 201, wire);
  }

  function handleGetRefund(refundId: string, response: ServerResponse): void {
    const refund = refunds.get(refundId);
    if (!refund) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    send(response, 200, { id: refund.id, status: refund.status, ...(refund.amount ? { amount: refund.amount } : {}) });
  }

  function handleCreateInvoice(request: IncomingMessage, body: unknown, response: ServerResponse): void {
    const { replayed, key } = replay("create-invoice", request, response);
    if (replayed) return;
    const input = asRecord(body);
    const detail = asRecord(input.detail);
    const recipient = asRecord(asRecord(Array.isArray(input.primary_recipients) ? input.primary_recipients[0] : undefined).billing_info);
    const items = Array.isArray(input.items) ? input.items.map(asRecord) : [];
    const amounts = items.map((item) => (valueCents(asRecord(item.unit_amount).value) ?? Number.NaN) * Number(item.quantity));
    if (
      typeof detail.currency_code !== "string" ||
      typeof recipient.email_address !== "string" ||
      items.length === 0 ||
      amounts.some((amount) => !Number.isInteger(amount) || amount <= 0)
    ) {
      sendError(response, 400, "INVALID_REQUEST", "MISSING_REQUIRED_PARAMETER");
      return;
    }
    const invoice: MockInvoice = {
      id: nextId("INV2-"),
      status: "DRAFT",
      currency: detail.currency_code,
      amountCents: amounts.reduce((sum, amount) => sum + amount, 0),
      paidCents: 0,
      recipientEmail: recipient.email_address,
      dueDate: typeof asRecord(detail.payment_term).due_date === "string" ? (asRecord(detail.payment_term).due_date as string) : null,
      reference: typeof detail.reference === "string" ? detail.reference : null,
      body: input,
    };
    invoices.set(invoice.id, invoice);
    const representation = String(request.headers.prefer ?? "").includes("return=representation");
    const wire = representation
      ? invoiceWire(invoice)
      : { rel: "self", href: `${baseUrl}/v2/invoicing/invoices/${invoice.id}`, method: "GET" };
    remember(key, 201, wire);
    send(response, 201, wire);
  }

  function handleAuthorize(orderId: string, request: IncomingMessage, response: ServerResponse): void {
    const order = orders.get(orderId);
    if (!order) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    const { replayed, key } = replay(`authorize ${orderId}`, request, response);
    if (replayed) return;
    if (order.intent !== "AUTHORIZE") {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "ACTION_DOES_NOT_MATCH_INTENT");
      return;
    }
    if (order.authorizationId) {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "ORDER_ALREADY_AUTHORIZED");
      return;
    }
    if (order.status !== "APPROVED") {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "ORDER_NOT_APPROVED");
      return;
    }
    const authorization: MockAuthorization = {
      id: nextId("AUTH"),
      orderId: order.id,
      status: "CREATED",
      amount: order.amount,
      customId: order.customId,
      expirationTime: new Date(Date.now() + 29 * 24 * 3_600_000).toISOString(),
      captureId: null,
    };
    authorizations.set(authorization.id, authorization);
    order.authorizationId = authorization.id;
    order.status = "COMPLETED";
    const wire = orderWire(order);
    remember(key, 201, wire);
    send(response, 201, wire);
  }

  function handleSendInvoice(invoiceId: string, request: IncomingMessage, response: ServerResponse): void {
    const invoice = invoices.get(invoiceId);
    if (!invoice) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    const { replayed, key } = replay(`send-invoice ${invoiceId}`, request, response);
    if (replayed) return;
    if (invoice.status !== "DRAFT") {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "INVALID_INVOICE_STATUS");
      return;
    }
    invoice.status = "SENT";
    const wire = { href: `https://www.sandbox.paypal.com/invoice/p/#${invoice.id}`, rel: "payer-view", method: "GET" };
    remember(key, 200, wire);
    send(response, 200, wire);
  }

  function captureAuthorizationNow(authorization: MockAuthorization, status: string): MockCapture {
    const capture: MockCapture = {
      id: nextId("CAP"),
      orderId: authorization.orderId,
      status,
      amount: authorization.amount,
      customId: authorization.customId,
      createdAt: new Date(),
    };
    captures.set(capture.id, capture);
    authorization.status = "CAPTURED";
    authorization.captureId = capture.id;
    const order = orders.get(authorization.orderId);
    if (order) order.captureId = capture.id;
    return capture;
  }

  const AUTHORIZATION_CAPTURE_REFUSALS: Record<string, string> = {
    CAPTURED: "AUTHORIZATION_ALREADY_CAPTURED",
    VOIDED: "AUTHORIZATION_VOIDED",
    EXPIRED: "AUTHORIZATION_EXPIRED",
  };

  function handleCaptureAuthorization(authorizationId: string, request: IncomingMessage, response: ServerResponse): void {
    const authorization = authorizations.get(authorizationId);
    if (!authorization) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    const { replayed, key } = replay(`capture-authorization ${authorizationId}`, request, response);
    if (replayed) return;
    const refusal = AUTHORIZATION_CAPTURE_REFUSALS[authorization.status];
    if (refusal) {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", refusal);
      return;
    }
    if (captureFailure === "timeout") {
      hanging.add(response);
      response.on("close", () => hanging.delete(response));
      return;
    }
    const capture = captureAuthorizationNow(authorization, captureFailure === "declined" ? "DECLINED" : "COMPLETED");
    const wire = { ...captureWire(capture), supplementary_data: { related_ids: { order_id: capture.orderId, authorization_id: authorizationId } } };
    remember(key, 201, wire);
    send(response, 201, wire);
  }

  const VOID_REFUSALS: Record<string, string> = {
    VOIDED: "PREVIOUSLY_VOIDED",
    CAPTURED: "PREVIOUSLY_CAPTURED",
    EXPIRED: "AUTHORIZATION_EXPIRED",
  };

  function handleVoid(authorizationId: string, request: IncomingMessage, response: ServerResponse): void {
    const authorization = authorizations.get(authorizationId);
    if (!authorization) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    const { replayed, key } = replay(`void ${authorizationId}`, request, response);
    if (replayed) return;
    const refusal = VOID_REFUSALS[authorization.status];
    if (refusal) {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", refusal);
      return;
    }
    authorization.status = "VOIDED";
    const wire = authorizationWire(authorization);
    remember(key, 200, wire);
    send(response, 200, wire);
  }

  function handleCancelInvoice(invoiceId: string, response: ServerResponse): void {
    const invoice = invoices.get(invoiceId);
    if (!invoice) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return;
    }
    if (!["SENT", "UNPAID", "PAYMENT_PENDING"].includes(invoice.status)) {
      sendError(response, 422, "UNPROCESSABLE_ENTITY", "INVALID_INVOICE_STATUS");
      return;
    }
    invoice.status = "CANCELLED";
    response.writeHead(204, { "paypal-debug-id": debugId() }).end();
  }

  /** PayPal's Transaction Search date format: 2026-10-08T10:00:00+0000. */
  function ledgerDate(date: Date): string {
    return `${date.toISOString().slice(0, 19)}+0000`;
  }

  /** PayPal's transaction status letter; a fully refunded capture is V ("fully reversed", the SDK's TransactionInformation). */
  const LEDGER_STATUS: Record<string, string> = { REFUNDED: "V", COMPLETED: "S", PARTIALLY_REFUNDED: "S", PENDING: "P" };
  const ledgerStatus = (status: string): string => LEDGER_STATUS[status] ?? "D";

  function handleTransactionSearch(url: URL, response: ServerResponse): void {
    if (transactionSearchDenied) {
      // As observed in the sandbox on 2026-10-08 (debug id f636297435446).
      sendError(response, 403, "NOT_AUTHORIZED", "NOT_AUTHORIZED");
      return;
    }
    const start = Date.parse(url.searchParams.get("start_date") ?? "");
    const end = Date.parse(url.searchParams.get("end_date") ?? "");
    if (Number.isNaN(start) || Number.isNaN(end) || end < start || end - start > 31 * 24 * 3_600_000) {
      sendError(response, 400, "INVALID_REQUEST", "INVALID_DATE_RANGE");
      return;
    }
    const refreshed = ledgerRefreshedAt ?? new Date();
    const listed = (at: Date) => at.getTime() >= start && at.getTime() <= end && at.getTime() <= refreshed.getTime();
    const movements = [
      ...[...captures.values()].map((capture) => ({
        at: capture.createdAt,
        info: {
          transaction_id: capture.id,
          transaction_event_code: "T0006",
          transaction_status: ledgerStatus(capture.status),
          ...(capture.amount ? { transaction_amount: capture.amount } : {}),
          ...(capture.customId ? { custom_field: capture.customId } : {}),
        },
      })),
      ...[...refunds.values()].map((refund) => {
        const customId = captures.get(refund.captureId)?.customId;
        return {
          at: refund.createdAt,
          info: {
            transaction_id: refund.id,
            paypal_reference_id: refund.captureId,
            paypal_reference_id_type: "TXN",
            transaction_event_code: "T1107",
            transaction_status: ledgerStatus(refund.status),
            ...(refund.amount ? { transaction_amount: { ...refund.amount, value: `-${refund.amount.value}` } } : {}),
            ...(customId ? { custom_field: customId } : {}),
          },
        };
      }),
    ]
      .filter((movement) => listed(movement.at))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("page_size") ?? 100) || 100, 1), 500);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1) || 1, 1);
    send(response, 200, {
      transaction_details: movements.slice((page - 1) * pageSize, page * pageSize).map((movement) => ({
        transaction_info: {
          ...movement.info,
          transaction_initiation_date: ledgerDate(movement.at),
          transaction_updated_date: ledgerDate(movement.at),
        },
      })),
      account_number: "MOCKMERCHANT",
      start_date: ledgerDate(new Date(start)),
      end_date: ledgerDate(new Date(end)),
      last_refreshed_datetime: ledgerDate(refreshed),
      page,
      total_items: movements.length,
      total_pages: Math.max(1, Math.ceil(movements.length / pageSize)),
    });
  }

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const rawBody = await readBody(request);
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
    const body = parseJson(rawBody);
    requests.push({ method, path, query: url.searchParams, headers, rawBody, body });

    const injectedIndex = injected.findIndex((entry) => entry.method === method && matches(entry.path, path));
    if (injectedIndex >= 0) {
      const [entry] = injected.splice(injectedIndex, 1);
      send(response, entry.status, entry.body ?? "", entry.headers);
      return;
    }

    if (method === "POST" && path === "/v1/oauth2/token") return handleToken(request, rawBody, response);
    if (!authorized(request)) {
      sendError(response, 401, "AUTHENTICATION_FAILURE", "INVALID_TOKEN");
      return;
    }

    let match: RegExpMatchArray | null;
    if (method === "POST" && path === "/v2/checkout/orders") return handleCreateOrder(request, body, response);
    if (method === "GET" && (match = path.match(/^\/v2\/checkout\/orders\/([^/]+)$/))) {
      const order = orders.get(match[1]);
      if (!order) return sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return send(response, 200, orderWire(order));
    }
    if (method === "POST" && (match = path.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/))) {
      return handleCapture(match[1], request, response);
    }
    if (method === "POST" && (match = path.match(/^\/v2\/checkout\/orders\/([^/]+)\/authorize$/))) {
      return handleAuthorize(match[1], request, response);
    }
    if (method === "GET" && (match = path.match(/^\/v2\/payments\/authorizations\/([^/]+)$/))) {
      const authorization = authorizations.get(match[1]);
      if (!authorization) return sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return send(response, 200, authorizationWire(authorization));
    }
    if (method === "POST" && (match = path.match(/^\/v2\/payments\/authorizations\/([^/]+)\/capture$/))) {
      return handleCaptureAuthorization(match[1], request, response);
    }
    if (method === "POST" && (match = path.match(/^\/v2\/payments\/authorizations\/([^/]+)\/void$/))) {
      return handleVoid(match[1], request, response);
    }
    if (method === "GET" && (match = path.match(/^\/v2\/payments\/captures\/([^/]+)$/))) {
      return handleGetCapture(match[1], response);
    }
    if (method === "POST" && (match = path.match(/^\/v2\/payments\/captures\/([^/]+)\/refund$/))) {
      return handleRefund(match[1], request, body, response);
    }
    if (method === "GET" && (match = path.match(/^\/v2\/payments\/refunds\/([^/]+)$/))) {
      return handleGetRefund(match[1], response);
    }
    if (method === "GET" && path === "/v1/reporting/transactions") return handleTransactionSearch(url, response);
    if (method === "POST" && path === "/v1/notifications/verify-webhook-signature") {
      return send(response, 200, { verification_status: verification });
    }
    if (method === "POST" && path === "/v2/invoicing/invoices") return handleCreateInvoice(request, body, response);
    if (method === "POST" && (match = path.match(/^\/v2\/invoicing\/invoices\/([^/]+)\/send$/))) {
      return handleSendInvoice(match[1], request, response);
    }
    if (method === "POST" && (match = path.match(/^\/v2\/invoicing\/invoices\/([^/]+)\/cancel$/))) {
      return handleCancelInvoice(decodeURIComponent(match[1]), response);
    }
    if (method === "GET" && (match = path.match(/^\/v2\/invoicing\/invoices\/([^/]+)$/))) {
      const invoice = invoices.get(match[1]);
      if (!invoice) return sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
      return send(response, 200, invoiceWire(invoice));
    }
    sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
  }

  const server = createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500).end();
    });
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.off("error", fail);
      done();
    });
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  function requireOrder(orderId: string): MockOrder {
    const order = orders.get(orderId);
    if (!order) throw new Error(`paypal mock: no order ${orderId}`);
    return order;
  }

  return {
    baseUrl,
    requests,
    orders,
    captures,
    refunds,
    invoices,
    authorizations,
    requestsTo: (method, path) => requests.filter((entry) => entry.method === method && matches(path, entry.path)),
    approve(orderId, payerEmail = DEFAULT_PAYER_EMAIL) {
      const order = requireOrder(orderId);
      if (order.status !== "CREATED" && order.status !== "PAYER_ACTION_REQUIRED") {
        throw new Error(`paypal mock: cannot approve order ${orderId} in status ${order.status}`);
      }
      order.status = "APPROVED";
      order.payerEmail = payerEmail;
    },
    payInvoice(invoiceId, payment = {}) {
      const invoice = invoices.get(invoiceId);
      if (!invoice) throw new Error(`paypal mock: no invoice ${invoiceId}`);
      if (invoice.status === "DRAFT" || invoice.status === "PAID") {
        throw new Error(`paypal mock: cannot pay invoice ${invoiceId} in status ${invoice.status}`);
      }
      const due = invoice.amountCents - invoice.paidCents;
      const amount = payment.amountCents ?? due;
      if (payment.pending) {
        invoice.status = "PAYMENT_PENDING";
      } else {
        invoice.paidCents += amount;
        invoice.status = amount >= due ? "PAID" : "PARTIALLY_PAID";
      }
      return invoice;
    },
    complete(orderId) {
      const order = requireOrder(orderId);
      if (order.status !== "APPROVED") throw new Error(`paypal mock: cannot complete order ${orderId} in status ${order.status}`);
      return captureOrder(order, "COMPLETED");
    },
    setCaptureFailure: (kind) => {
      captureFailure = kind;
    },
    setRecaptureMode: (mode) => {
      recaptureMode = mode;
    },
    setRefundStatus(status) {
      refundStatus = status;
      for (const refund of refunds.values()) {
        refund.status = status;
        const capture = captures.get(refund.captureId);
        if (capture && status === "COMPLETED") capture.status = "REFUNDED";
      }
    },
    setVerification: (status) => {
      verification = status;
    },
    setTokenExpiresIn: (seconds) => {
      tokenExpiresIn = seconds;
    },
    injectNext: (response) => {
      injected.push(response);
    },
    setAuthorizationStatus(authorizationId, status) {
      const authorization = authorizations.get(authorizationId);
      if (!authorization) throw new Error(`paypal mock: no authorization ${authorizationId}`);
      authorization.status = status;
    },
    completeAuthorization(authorizationId) {
      const authorization = authorizations.get(authorizationId);
      if (!authorization || authorization.status !== "CREATED") {
        throw new Error(`paypal mock: cannot capture authorization ${authorizationId}`);
      }
      return captureAuthorizationNow(authorization, "COMPLETED");
    },
    setLedgerRefreshedAt: (at) => {
      ledgerRefreshedAt = at;
    },
    setTransactionSearchDenied: (denied) => {
      transactionSearchDenied = denied;
    },
    close: () =>
      new Promise<void>((done) => {
        for (const response of hanging) response.destroy();
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
