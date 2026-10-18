import type { DataCollection, Options } from "@sentry/core";
import { redactCapabilityTraceContext, redactSessionUserInfo, sanitizeSentryEvent, sanitizeSentrySpan } from "./sentry-before-send";

// v11 collects user info, cookies, HTTP bodies, GenAI, database and queue data
// unless told otherwise. This is the v10 default (sendDefaultPii unset), as
// the v10 -> v11 migration guide spells it out (#1033).
const V10_DENY = ["forwarded", "-ip", "remote-", "via", "-user"];
const V10_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: V10_DENY }, response: { deny: V10_DENY } },
  httpBodies: [],
  urlQueryParams: { deny: V10_DENY },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
};

/** The options of every Sentry init: client, server and edge. */
export function sentryInitOptions(dsn: string) {
  return {
    dsn,
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Explicit, so SENTRY_TRACE_LIFECYCLE=static cannot switch to transactions,
    // which beforeSendSpan does not see.
    traceLifecycle: "stream",
    dataCollection: V10_DATA_COLLECTION,
    beforeSend: sanitizeSentryEvent,
    beforeSendSpan: sanitizeSentrySpan,
    integrations: [redactCapabilityTraceContext, redactSessionUserInfo],
  } satisfies Options;
}
