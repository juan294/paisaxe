import path from "node:path";
import { expect } from "vitest";
import type * as SentryNS from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/sentry-options";

type Sentry = typeof SentryNS;

/** A booking capability, shaped like src/lib/booking/links.ts creates them. */
export const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

/** Values that must never leave the process (PII and credentials). */
export const SECRETS = ["traveler@example.com", "203.0.113.42", "secret-cookie", "super-secret", "api-key-value", "+34 611 22 33 44"];

// Defined here, away from the capture calls: error events carry the source
// lines around each stack frame, which would otherwise quote these values.
const USER = { id: "user-123", email: "traveler@example.com", ip_address: "203.0.113.42" };
const HEADERS = { cookie: "session=secret-cookie", authorization: "Bearer super-secret", "x-api-key": "api-key-value" };
const REQUEST = {
  url: `https://paisaxe.es/booking/${CAPABILITY}/return?token=X&PayerID=Y`,
  method: "GET",
  query_string: "token=X&PayerID=Y",
  cookies: { session: "secret-cookie" },
  data: { phone: "+34 611 22 33 44" },
  headers: HEADERS,
};
const SPAN_ATTRIBUTES = {
  "url.full": `https://paisaxe.es/booking/${CAPABILITY}?token=X`,
  ...Object.fromEntries(Object.entries(HEADERS).map(([name, value]) => [`http.request.header.${name}`, [value]])),
};

/**
 * Loads one runtime build of @sentry/nextjs. Vitest resolves the bare
 * specifier to the server build in every environment, so the client and edge
 * builds are loaded from their files (the client's CommonJS build, because its
 * ESM build imports `next/router` without an extension).
 */
export async function loadSentryBuild(runtime: "server" | "edge" | "client"): Promise<Sentry> {
  if (runtime === "server") return import("@sentry/nextjs");
  const file = runtime === "edge" ? "build/esm/edge/index.js" : "build/cjs/index.client.js";
  return (await import(/* @vite-ignore */ path.resolve("node_modules/@sentry/nextjs", file))) as Sentry;
}

/**
 * Initializes the SDK with this project's options (every trace sampled) and a
 * transport that records each envelope, runs a request that carries a
 * capability link and PII everywhere the SDK reads them, and returns every
 * envelope the SDK sent.
 */
export async function captureEnvelopes(Sentry: Sentry, setUp?: () => void): Promise<string> {
  const envelopes: string[] = [];
  Sentry.init({
    ...sentryInitOptions("https://public@o0.ingest.sentry.io/0"),
    // CI supplies a release; without one the SDK drops session envelopes,
    // hiding session-only privacy regressions from local runs.
    release: "sentry-privacy-regression",
    tracesSampleRate: 1,
    transport: (options: Parameters<Sentry["createTransport"]>[0]) => Sentry.createTransport(options, async ({ body }) => {
      envelopes.push(typeof body === "string" ? body : new TextDecoder().decode(body));
      return { statusCode: 200 };
    }),
  });

  Sentry.withIsolationScope((isolationScope) => {
    isolationScope.setSDKProcessingMetadata({ normalizedRequest: REQUEST });
    setUp?.();
    Sentry.setUser(USER);
    Sentry.startSpan({ name: `GET /booking/${CAPABILITY}`, op: "http.server", forceTransaction: true, attributes: SPAN_ATTRIBUTES }, () => {
      Sentry.startSpan({ name: `POST /api/booking/bookings/${CAPABILITY}/payment`, op: "http.client" }, () => undefined);
      Sentry.addBreadcrumb({ category: "navigation", data: { from: "/immersive", to: `/booking/${CAPABILITY}` } });
      Sentry.captureException(new Error("probe"));
    });
  });

  await Sentry.flush(5000);
  await Sentry.close(5000);
  return envelopes.join("\n");
}

/** Asserts that both an error event and streamed spans were sent, and that neither leaked. */
export function expectNothingSensitive(sent: string) {
  expect(sent).toContain('"type":"event"');
  expect(sent).toContain('"type":"span"');
  expect(sent).toContain("/booking/[redacted]");
  expect(sent).not.toContain(CAPABILITY.split(".")[1]);
  for (const secret of SECRETS) expect(sent).not.toContain(secret);
}
