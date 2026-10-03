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
 *
 * POSTs carrying a PayPal-Request-Id are idempotent per endpoint: a repeat replays the
 * first response exactly, as PayPal does. API calls need a Bearer token this mock issued.
 * Errors carry name, message, debug_id and details[].issue, plus a paypal-debug-id header.
 *
 * Knobs: approve(orderId), complete(orderId) (a capture that happened but whose response
 * was lost), setCaptureFailure("timeout" | "declined" | "none"), setRecaptureMode,
 * setRefundStatus, setVerification, setTokenExpiresIn and injectNext (a one-shot canned
 * response for the next matching request).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
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
}

export interface MockCapture {
  id: string;
  orderId: string;
  status: string;
  amount: WireMoney | null;
  customId: string | null;
}

export interface MockRefund {
  id: string;
  captureId: string;
  status: string;
  amount: WireMoney | null;
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
}

export interface PaypalMock {
  baseUrl: string;
  requests: RecordedRequest[];
  orders: Map<string, MockOrder>;
  captures: Map<string, MockCapture>;
  refunds: Map<string, MockRefund>;
  /** Recorded requests matching a method and a path (exact string or pattern). */
  requestsTo(method: string, path: string | RegExp): RecordedRequest[];
  /** The buyer approved the order at PayPal. */
  approve(orderId: string): void;
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
  close(): Promise<void>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

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
  let baseUrl = "";

  const nextId = (prefix: string) => `${prefix}${String(++sequence).padStart(13, "0")}`;
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

  function orderWire(order: MockOrder): Record<string, unknown> {
    const capture = order.captureId ? captures.get(order.captureId) : undefined;
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
          ...(capture ? { payments: { captures: [captureWire(capture)] } } : {}),
        },
      ],
      links,
    };
  }

  function captureOrder(order: MockOrder, status: string): MockCapture {
    const capture: MockCapture = {
      id: nextId("CAP"),
      orderId: order.id,
      status,
      amount: order.amount,
      customId: order.customId,
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

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const rawBody = await readBody(request);
    const method = request.method ?? "GET";
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
    const body = parseJson(rawBody);
    requests.push({ method, path, headers, rawBody, body });

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
    if (method === "GET" && (match = path.match(/^\/v2\/payments\/captures\/([^/]+)$/))) {
      return handleGetCapture(match[1], response);
    }
    if (method === "POST" && (match = path.match(/^\/v2\/payments\/captures\/([^/]+)\/refund$/))) {
      return handleRefund(match[1], request, body, response);
    }
    if (method === "GET" && (match = path.match(/^\/v2\/payments\/refunds\/([^/]+)$/))) {
      return handleGetRefund(match[1], response);
    }
    if (method === "POST" && path === "/v1/notifications/verify-webhook-signature") {
      return send(response, 200, { verification_status: verification });
    }
    sendError(response, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
  }

  const server = createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500).end();
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
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
    requestsTo: (method, path) => requests.filter((entry) => entry.method === method && matches(path, entry.path)),
    approve(orderId) {
      const order = requireOrder(orderId);
      if (order.status !== "CREATED" && order.status !== "PAYER_ACTION_REQUIRED") {
        throw new Error(`paypal mock: cannot approve order ${orderId} in status ${order.status}`);
      }
      order.status = "APPROVED";
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
    close: () =>
      new Promise<void>((done) => {
        for (const response of hanging) response.destroy();
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
