/**
 * The PayPal SDK client, its token cache and the translation of SDK failures
 * into PaypalError (contract sheet: pay-pal-server-sdk-plan.md, "Client").
 *
 * - One PayPalServerSdkClient per configuration, rebuilt when the configuration
 *   changes (tests switch mock servers).
 * - The OAuth token comes from our own cache (getAccessToken), which the SDK
 *   uses through oauth2Strategy and webhooks.ts uses directly. Concurrent
 *   callers share one in-flight token request.
 * - Every request goes through createPaypalFetch: only the configured origin
 *   is reachable, and the response status, PayPal debug id and error issue are
 *   recorded per call so a SchemaError (an undeclared or malformed body) still
 *   reports what PayPal answered.
 * - Nothing here logs; the Authorization header and secrets never leave the
 *   request.
 */
import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import {
  PayPalServerSdkClient,
  PayPalServerSdkError,
  ResponseError,
  ServerEnvironment,
  type OAuthToken,
} from "pay-pal-server-sdk";
import { getPaypalConfig, type PaypalConfig } from "./env";
import { PaypalError, PaypalNotConfigured } from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
/** Refresh a token this long before PayPal says it expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const TOKEN_PATH = "/v1/oauth2/token";

/** What the guarded fetch saw for the current call (one per callPaypal). */
interface CallRecord {
  status: number | null;
  debugId: string | null;
  issue: string | null;
}

const callRecords = new AsyncLocalStorage<CallRecord>();

let timeoutMs = DEFAULT_TIMEOUT_MS;
let sdk: { key: string; client: PayPalServerSdkClient } | null = null;
let token: { key: string; value: string; expiresAt: number } | null = null;
let tokenRequest: { key: string; promise: Promise<{ value: string; expiresAt: number }> } | null = null;

function configKey(config: PaypalConfig): string {
  return `${config.baseUrl}\n${config.clientId}\n${config.clientSecret}`;
}

/** PayPal's error body: details[0].issue and debug_id (or the RFC 6749 `error` of the token endpoint). */
function errorFields(text: string): { issue: string | null; debugId: string | null } {
  try {
    const body = JSON.parse(text) as { details?: Array<{ issue?: unknown }>; debug_id?: unknown; error?: unknown };
    const issue = body.details?.[0]?.issue ?? body.error;
    return {
      issue: typeof issue === "string" ? issue : null,
      debugId: typeof body.debug_id === "string" ? body.debug_id : null,
    };
  } catch {
    return { issue: null, debugId: null };
  }
}

/** A PaypalError for a non-2xx plain-fetch response whose body was read as `text`. */
export function httpError(operation: string, response: Response, text: string): PaypalError {
  const fields = errorFields(text);
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
 * included), records each response for the current call and drops the cached
 * token when PayPal answers 401.
 */
export function createPaypalFetch(baseUrl: string): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin) {
      throw new PaypalNotConfigured(`refusing a PayPal request outside ${origin}`);
    }
    const response = await fetch(input, init);
    if (response.status === 401 && url.pathname !== TOKEN_PATH) {
      token = null;
    }
    const record = callRecords.getStore();
    if (record) {
      record.status = response.status;
      record.debugId = response.headers.get("paypal-debug-id");
      if (!response.ok) {
        const fields = errorFields(await response.clone().text());
        record.issue = fields.issue;
        record.debugId = fields.debugId ?? record.debugId;
      }
    }
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
  let body: { access_token?: unknown; expires_in?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = {};
  }
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

/** The SDK client for the current configuration. Throws PaypalNotConfigured. */
export function getPaypalClient(): PayPalServerSdkClient {
  const config = getPaypalConfig();
  const key = configKey(config);
  if (sdk?.key === key) return sdk.client;

  const client = new PayPalServerSdkClient({
    serverEnvironment: ServerEnvironment.Sandbox,
    serverOptions: { default: { sandbox: { baseUrl: config.baseUrl } } },
    timeout: timeoutMs,
    fetch: createPaypalFetch(config.baseUrl),
    oauth2: { clientId: config.clientId, clientSecret: config.clientSecret },
    oauth2Strategy: {
      // The SDK keeps its own copy until 30 s before expiresIn; ours stays authoritative.
      async getToken(): Promise<OAuthToken> {
        const current = await cachedToken(config);
        const expiresIn = Math.max(1, Math.ceil((current.expiresAt - Date.now()) / 1000));
        return { accessToken: current.value, tokenType: "Bearer", expiresIn };
      },
    },
  });
  sdk = { key, client };
  return client;
}

/** Converts anything an SDK call or our fetch threw into PaypalError (PaypalNotConfigured passes through). */
function toPaypalError(error: unknown, operation: string, record?: CallRecord): PaypalError | PaypalNotConfigured {
  if (error instanceof PaypalError || error instanceof PaypalNotConfigured) return error;

  if (error instanceof ResponseError) {
    const payload = error.payload as { kind: string; body?: { debugId?: unknown; details?: Array<{ issue?: unknown }> } };
    const declaredIssue = payload.body?.details?.[0]?.issue;
    const issue = typeof declaredIssue === "string" ? declaredIssue : (record?.issue ?? null);
    const debugId =
      (typeof payload.body?.debugId === "string" ? payload.body.debugId : null) ??
      record?.debugId ??
      error.headers.get("paypal-debug-id");
    return withCause(
      new PaypalError(`PayPal ${operation} failed with HTTP ${error.status}${issue ? ` (${issue})` : ""}`, {
        status: error.status,
        issue,
        debugId,
      }),
      error,
    );
  }

  if (error instanceof PayPalServerSdkError) {
    if (error.cause instanceof PaypalError || error.cause instanceof PaypalNotConfigured) return error.cause;
    const details = { status: record?.status ?? null, issue: record?.issue ?? null, debugId: record?.debugId ?? null };
    const message: Record<typeof error.kind, string> = {
      timeout: `PayPal ${operation} timed out`,
      connection: `PayPal ${operation} failed: connection error`,
      abort: `PayPal ${operation} was aborted`,
      schema: `PayPal ${operation} returned an unreadable body${details.status ? ` (HTTP ${details.status})` : ""}`,
      auth: `PayPal ${operation} failed: could not obtain a token`,
      sdk: `PayPal ${operation} failed inside the SDK`,
    };
    // Timeouts and connection failures learned nothing from PayPal.
    const transport = error.kind === "timeout" || error.kind === "connection" || error.kind === "abort";
    return withCause(new PaypalError(message[error.kind], transport ? {} : details), error);
  }

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return withCause(new PaypalError(`PayPal ${operation} timed out`), error);
  }
  return withCause(new PaypalError(`PayPal ${operation} failed: connection error`), error);
}

/**
 * Runs one SDK operation and returns its value with the HTTP status and debug
 * id PayPal answered with. Every failure is a PaypalError or PaypalNotConfigured.
 */
export async function callPaypal<T>(
  operation: string,
  run: (client: PayPalServerSdkClient) => PromiseLike<T>,
): Promise<{ value: T; status: number | null; debugId: string | null }> {
  const client = getPaypalClient();
  const record: CallRecord = { status: null, debugId: null, issue: null };
  try {
    const value = await callRecords.run(record, () => run(client));
    return { value, status: record.status, debugId: record.debugId };
  } catch (error) {
    throw toPaypalError(error, operation, record);
  }
}

/** Plain-fetch errors (webhooks.ts) mapped like SDK transport failures. */
export function paypalTransportError(error: unknown, operation: string): PaypalError | PaypalNotConfigured {
  return toPaypalError(error, operation);
}

/** Forget the client and token; optionally shorten the request timeout (tests only). */
/** The per-call timeout every PayPal request uses, SDK or plain fetch. */
export function paypalTimeoutMs(): number {
  return timeoutMs;
}

export function resetPaypalClientForTests(options: { timeoutMs?: number } = {}): void {
  timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  sdk = null;
  token = null;
  tokenRequest = null;
}
