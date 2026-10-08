/**
 * The PayPal SDK client, its token cache and the translation of SDK failures
 * into PaypalError (contract sheet: paypal-server-sdk-plan.md, "Client").
 *
 * - One @paypal/paypal-server-sdk Client per configuration, rebuilt when the
 *   configuration changes (tests switch mock servers) and after a 401.
 * - The OAuth token comes from our own cache (getAccessToken), which the SDK
 *   uses through oAuthTokenProvider and webhooks.ts and invoices.ts use
 *   directly. Concurrent callers share one in-flight token request.
 * - Retries follow decision D3 on GET and POST (every SDK POST carries a
 *   PayPal-Request-Id), never on a timeout: 429, 502, 503 and 504, and 500
 *   where the operation does not declare it. A declared status (throwOn, e.g.
 *   captureOrder's 500) is thrown inside the SDK's retry interceptor and never
 *   retried (contract sheet, "The retry quirk").
 * - Every request goes through createPaypalFetch: only PAYPAL_API_BASE is
 *   reachable. The SDK's requests first pass sdkFetch, which maps the SDK's
 *   fixed sandbox origin to PAYPAL_API_BASE and records the status and debug
 *   id of the call's last response, because the SDK's "not JSON" error
 *   carries no status.
 * - Nothing here logs; the Authorization header and secrets never leave the
 *   request.
 */
import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import {
  ApiError,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  type ApiResponse,
  type OAuthToken,
  type RetryConfiguration,
} from "@paypal/paypal-server-sdk";
import { getPaypalConfig, type PaypalConfig } from "./env";
import { PaypalError, PaypalNotConfigured } from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_INTERVAL_S = 0.5;
/** Refresh a token this long before PayPal says it expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const TOKEN_PATH = "/v1/oauth2/token";
/** The origin the SDK sends to with Environment.Sandbox (its getBaseUri). */
const SDK_SANDBOX_ORIGIN = "https://api-m.sandbox.paypal.com";

/** Decision D3; the interval is shortened by tests. */
function retryConfig(retryInterval: number): Partial<RetryConfiguration> {
  return {
    maxNumberOfRetries: 2,
    retryInterval,
    backoffFactor: 2,
    maximumRetryWaitTime: 3,
    // The SDK counts an ApiError thrown for a declared status as a timeout, so
    // this must stay off or a 422 on POST is sent three times (contract sheet).
    retryOnTimeout: false,
    httpStatusCodesToRetry: [429, 500, 502, 503, 504],
    httpMethodsToRetry: ["GET", "POST"],
  };
}

/** The status and debug id of the current call's last response; null while an attempt has none (one per callPaypal). */
interface CallRecord {
  status: number | null;
  debugId: string | null;
}

const callRecords = new AsyncLocalStorage<CallRecord>();

let timeoutMs = DEFAULT_TIMEOUT_MS;
let retryInterval = DEFAULT_RETRY_INTERVAL_S;
/** The client and its controllers (controllers are stateless wrappers over the client). */
export interface PaypalSdk {
  client: Client;
  orders: OrdersController;
  payments: PaymentsController;
}

let sdk: { key: string } & PaypalSdk | null = null;
let token: { key: string; value: string; expiresAt: number } | null = null;
let tokenRequest: { key: string; promise: Promise<{ value: string; expiresAt: number }> } | null = null;

function configKey(config: PaypalConfig): string {
  return `${config.baseUrl}\n${config.clientId}\n${config.clientSecret}`;
}

/** PayPal's error body: details[0].issue and debug_id (or the RFC 6749 `error` of the token endpoint). */
function errorFields(body: unknown): { issue: string | null; debugId: string | null } {
  if (body === null || typeof body !== "object") return { issue: null, debugId: null };
  const fields = body as { details?: Array<{ issue?: unknown }>; debug_id?: unknown; error?: unknown };
  const issue = fields.details?.[0]?.issue ?? fields.error;
  return {
    issue: typeof issue === "string" ? issue : null,
    debugId: typeof fields.debug_id === "string" ? fields.debug_id : null,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** A PaypalError for a non-2xx plain-fetch response whose body was read as `text`. */
export function httpError(operation: string, response: Response, text: string): PaypalError {
  const fields = errorFields(parseJson(text));
  return new PaypalError(`PayPal ${operation} failed with HTTP ${response.status}`, {
    status: response.status,
    issue: fields.issue,
    debugId: fields.debugId ?? response.headers.get("paypal-debug-id"),
  });
}

function withCause(error: PaypalError, cause: unknown): PaypalError {
  error.cause = cause;
  return error;
}

/**
 * A fetch that only reaches the configured origin, forwards `init` (signal
 * included) and drops the cached token when PayPal answers 401.
 */
export function createPaypalFetch(baseUrl: string): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin) {
      throw new PaypalNotConfigured(`refusing a PayPal request outside ${origin}`);
    }
    const response = await fetch(input, init);
    if (response.status === 401 && url.pathname !== TOKEN_PATH) token = null;
    return response;
  };
}

/**
 * The SDK's fetch: sends a request for the SDK's fixed sandbox origin to
 * `baseUrl` (the same origin outside tests) through the guarded fetch,
 * records each response for the current call and drops the client on a 401,
 * so the next call starts with a fresh token in the SDK too.
 */
function sdkFetch(baseUrl: string): typeof fetch {
  const origin = new URL(baseUrl).origin;
  const guarded = createPaypalFetch(baseUrl);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    let target: RequestInfo | URL = input;
    if (url.origin === SDK_SANDBOX_ORIGIN && origin !== SDK_SANDBOX_ORIGIN) {
      const rewritten = `${origin}${url.pathname}${url.search}`;
      target = input instanceof Request ? new Request(rewritten, input) : rewritten;
    }
    const record = callRecords.getStore();
    if (record) Object.assign(record, { status: null, debugId: null });
    const response = await guarded(target, init);
    if (response.status === 401) sdk = null;
    if (record) Object.assign(record, { status: response.status, debugId: response.headers.get("paypal-debug-id") });
    return response;
  };
}

async function requestToken(config: PaypalConfig): Promise<{ value: string; expiresAt: number }> {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  // Recorded by nobody: a token request must not overwrite the status of the call that triggered it.
  const response = await callRecords.exit(() =>
    createPaypalFetch(config.baseUrl)(`${config.baseUrl}${TOKEN_PATH}`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(timeoutMs),
    }),
  ).catch((error: unknown) => {
    throw toPaypalError(error, "token request");
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) throw httpError("token request", response, text);
  const body = (parseJson(text) ?? {}) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new PaypalError("PayPal token response has no access_token", { status: response.status });
  }
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 0;
  return { value: body.access_token, expiresAt: Date.now() + expiresIn * 1000 - TOKEN_REFRESH_MARGIN_MS };
}

async function cachedToken(config: PaypalConfig): Promise<{ value: string; expiresAt: number }> {
  const key = configKey(config);
  if (token && token.key === key && Date.now() < token.expiresAt) return token;
  if (!tokenRequest || tokenRequest.key !== key) {
    const promise = requestToken(config)
      .then((fresh) => {
        token = { key, ...fresh };
        return fresh;
      })
      .finally(() => {
        if (tokenRequest?.promise === promise) tokenRequest = null;
      });
    tokenRequest = { key, promise };
  }
  return tokenRequest.promise;
}

/** A PayPal access token for the current configuration (cached; refreshed 60 s before expiry). */
export async function getAccessToken(): Promise<string> {
  return (await cachedToken(getPaypalConfig())).value;
}

/**
 * The SDK's token source. It must never reject: the SDK would cache the
 * rejection and fail every later call (typescript-authentication). A failure
 * returns an expired token instead, which fails this call and is asked for
 * again on the next one.
 */
function tokenProvider(config: PaypalConfig): () => Promise<OAuthToken> {
  return async () => {
    try {
      const current = await cachedToken(config);
      // Unix seconds; at least one second ahead so a token cached past its margin still serves this call.
      const expiry = Math.max(Math.floor(current.expiresAt / 1000), Math.floor(Date.now() / 1000) + 1);
      return { accessToken: current.value, tokenType: "Bearer", expiry: BigInt(expiry) };
    } catch {
      return { accessToken: "", tokenType: "Bearer", expiry: BigInt(0) };
    }
  };
}

function sdkFor(config: PaypalConfig): PaypalSdk {
  const key = configKey(config);
  if (sdk?.key === key) return sdk;

  const client = new Client({
    environment: Environment.Sandbox,
    timeout: timeoutMs,
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
      oAuthTokenProvider: tokenProvider(config),
    },
    httpClientOptions: { retryConfig: retryConfig(retryInterval) },
    unstable_httpClientOptions: { adapter: "fetch", env: { fetch: sdkFetch(config.baseUrl) } },
  });
  sdk = { key, client, orders: new OrdersController(client), payments: new PaymentsController(client) };
  return sdk;
}

/** The SDK client for the current configuration. Throws PaypalNotConfigured. */
export function getPaypalClient(): Client {
  return sdkFor(getPaypalConfig()).client;
}

/** Converts anything an SDK call or our fetch threw into PaypalError (PaypalNotConfigured passes through). */
function toPaypalError(error: unknown, operation: string, record?: CallRecord): PaypalError | PaypalNotConfigured {
  if (error instanceof PaypalError || error instanceof PaypalNotConfigured) return error;
  // axios wraps what our fetch threw (the host guard) as `cause`.
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof PaypalError || cause instanceof PaypalNotConfigured) return cause;

  if (error instanceof ApiError) {
    const body = error.result ?? (typeof error.body === "string" ? parseJson(error.body) : null);
    const fields = errorFields(body);
    const debugId = fields.debugId ?? error.headers?.["paypal-debug-id"] ?? null;
    return withCause(
      new PaypalError(
        `PayPal ${operation} failed with HTTP ${error.statusCode}${fields.issue ? ` (${fields.issue})` : ""}`,
        { status: error.statusCode, issue: fields.issue, debugId },
      ),
      error,
    );
  }

  // A response arrived but was not an ApiError: its body is not JSON or fails the schema.
  if (record?.status != null) {
    return withCause(
      new PaypalError(`PayPal ${operation} returned an unreadable body (HTTP ${record.status})`, {
        status: record.status,
        debugId: record.debugId,
      }),
      error,
    );
  }

  // The SDK's own refusal to send without a usable token (our provider returned an expired one).
  if (error instanceof Error && /^(OAuth token is expired|Client is not authorized)/.test(error.message)) {
    return withCause(new PaypalError(`PayPal ${operation} failed: could not obtain a token`), error);
  }

  const code = (error as { code?: unknown } | null)?.code;
  const timedOut =
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
  // Timeouts and connection failures learned nothing from PayPal.
  return withCause(new PaypalError(timedOut ? `PayPal ${operation} timed out` : `PayPal ${operation} failed: connection error`), error);
}

/**
 * Runs one SDK operation and returns its value with the HTTP status and debug
 * id PayPal answered with. Every failure is a PaypalError or PaypalNotConfigured.
 */
export async function callPaypal<T>(
  operation: string,
  run: (sdk: PaypalSdk) => Promise<ApiResponse<T>>,
): Promise<{ value: T; status: number; debugId: string | null }> {
  const config = getPaypalConfig();
  // The token first: a token failure is reported here with its own status, and
  // the SDK's provider then finds it cached.
  await cachedToken(config);
  const current = sdkFor(config);
  const record: CallRecord = { status: null, debugId: null };
  try {
    const response = await callRecords.run(record, () => run(current));
    return { value: response.result, status: response.statusCode, debugId: response.headers["paypal-debug-id"] ?? null };
  } catch (error) {
    throw toPaypalError(error, operation, record);
  }
}

/** Plain-fetch errors (webhooks.ts, invoices.ts) mapped like SDK transport failures. */
export function paypalTransportError(error: unknown, operation: string): PaypalError | PaypalNotConfigured {
  return toPaypalError(error, operation);
}

/** The per-call timeout every PayPal request uses, SDK or plain fetch. */
export function paypalTimeoutMs(): number {
  return timeoutMs;
}

/** Forget the client and token; optionally shorten the timeout and the retry interval (tests only). */
export function resetPaypalClientForTests(options: { timeoutMs?: number; retryInterval?: number } = {}): void {
  timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  retryInterval = options.retryInterval ?? DEFAULT_RETRY_INTERVAL_S;
  sdk = null;
  token = null;
  tokenRequest = null;
}
