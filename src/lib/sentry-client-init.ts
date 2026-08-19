import type * as SentryNS from "@sentry/nextjs";
import { sanitizeSentryEvent } from "@/lib/sentry-before-send";

/**
 * Read (and normalize) the client-side Sentry DSN.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is only ever set in Production (see #818 / DO-B1
 * — Preview and local dev builds deliberately don't carry it). Exported so
 * tests can exercise the gating logic without touching `process.env`.
 */
export function getClientDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

/**
 * Initialize the Sentry client SDK, but only when a DSN is actually
 * configured. `@sentry/nextjs` is loaded via a dynamic `import()` rather
 * than a static one so that builds without a DSN (local dev, Preview) can
 * fully dead-code-eliminate the SDK instead of shipping it inert in the
 * shared JS baseline of every prerendered page (~8.4KB gzip — #818). When a
 * DSN *is* present (Production today), this still initializes Sentry with
 * the exact same config as before, just one microtask later.
 *
 * `loadSentry` is injectable so tests can assert the gating behavior
 * without pulling in the real SDK.
 */
export async function initSentryClient(
  dsn: string | undefined = getClientDsn(),
  loadSentry: () => Promise<typeof SentryNS> = () => import("@sentry/nextjs"),
): Promise<void> {
  if (!dsn) {
    return;
  }

  const Sentry = await loadSentry();
  Sentry.init({
    dsn,
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    beforeSend: sanitizeSentryEvent,
  });
}
