// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeSentryEvent, sanitizeSentrySpan } from "./sentry-before-send";
import { sentryInitOptions } from "./sentry-options";

const DSN = "https://public@o0.ingest.sentry.io/0";
// The v10 default (sendDefaultPii unset), as the v10 -> v11 migration guide
// spells it out. v11 collects every one of these categories when unset.
const V10_DENY = ["forwarded", "-ip", "remote-", "via", "-user"];

describe("sentryInitOptions (#1033)", () => {
  it("keeps v10 data collection: no user info, cookies, bodies, GenAI, database, queue or GraphQL data", () => {
    expect(sentryInitOptions(DSN).dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { deny: V10_DENY }, response: { deny: V10_DENY } },
      httpBodies: [],
      urlQueryParams: { deny: V10_DENY },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    });
  });

  it("streams spans explicitly, so SENTRY_TRACE_LIFECYCLE=static cannot bypass beforeSendSpan", () => {
    const options = sentryInitOptions(DSN);

    expect(options.traceLifecycle).toBe("stream");
    expect(options.beforeSendSpan).toBe(sanitizeSentrySpan);
    expect(options.beforeSend).toBe(sanitizeSentryEvent);
    expect(options).not.toHaveProperty("beforeSendTransaction");
  });

  it("keeps the DSN and the 10% trace sample rate", () => {
    expect(sentryInitOptions(DSN)).toMatchObject({ dsn: DSN, tracesSampleRate: 0.1 });
  });

  it("is the configuration of every Sentry init (client, server and edge)", () => {
    for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "src/lib/sentry-client-init.ts"]) {
      expect(readFileSync(file, "utf8")).toMatch(/\.init\(sentryInitOptions\(dsn\)\)/);
    }
  });
});
