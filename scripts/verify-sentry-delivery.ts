#!/usr/bin/env tsx
/**
 * DO-B1: manual Sentry delivery verification.
 *
 * The `/api/health` endpoint reports Sentry as "configured" whenever
 * NEXT_PUBLIC_SENTRY_DSN is set, but that only proves the SDK was initialized
 * with a DSN — it says nothing about whether events actually reach the
 * project. A 90-day dashboard query for `the-creative-token/paisaxe` returned
 * zero issues, including across the known 2026-07-20 outage window, so
 * delivery has never been independently confirmed. See
 * docs/operations/logging.md and GitHub issue #821.
 *
 * This script cannot confirm delivery by itself — it only fires one
 * distinctively tagged synthetic error and reports whether the SDK believes
 * it flushed the event to Sentry's transport. A human operator MUST then
 * open the Sentry dashboard and confirm an issue with the printed marker
 * actually arrived. Flush success only means "handed off to the network
 * layer without a client-side timeout" — it is not proof of ingestion.
 *
 * This is a standalone, locally-run script. It is not wired into any HTTP
 * route, so it cannot be reached by unauthenticated users and cannot affect
 * `/api/health`.
 *
 * Usage (run with the SAME DSN that production uses, e.g. after
 * `vercel env pull .env.production.local` or by exporting the value shown
 * in the Vercel dashboard):
 *
 *   NEXT_PUBLIC_SENTRY_DSN=... npm run verify-sentry-delivery
 */
import { fileURLToPath } from "node:url";
import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryEvent } from "../src/lib/sentry-before-send";

/** Tag key used to mark synthetic verification events, distinct from real errors. */
export const SYNTHETIC_ERROR_TAG = "do_b1_sentry_delivery_check";

export function buildMarker(now: Date = new Date()): string {
  const random = globalThis.crypto.randomUUID().slice(0, 8);
  return `sentry-delivery-check-${now.toISOString()}-${random}`;
}

export interface VerifyResult {
  marker: string;
  flushed: boolean;
}

type SentrySdk = Pick<typeof Sentry, "init" | "captureException" | "flush">;

export async function runVerification(sentry: SentrySdk = Sentry): Promise<VerifyResult> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    throw new Error(
      "NEXT_PUBLIC_SENTRY_DSN is not set. Run this script with the same DSN production " +
        "uses (e.g. `vercel env pull .env.production.local` locally, or export the value " +
        "from the Vercel dashboard) so the synthetic event lands in the real project — " +
        "otherwise this only proves the SDK itself works, not that production delivers.",
    );
  }

  sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend: sanitizeSentryEvent,
  });

  const marker = buildMarker();
  sentry.captureException(new Error(`[SENTRY_DELIVERY_CHECK] ${marker}`), {
    level: "info",
    tags: { [SYNTHETIC_ERROR_TAG]: "true" },
  });

  // Scripts exit immediately after the last statement, unlike a long-lived
  // server process — without an explicit flush, the event may never leave
  // the process before it terminates.
  const flushed = await sentry.flush(5000);

  return { marker, flushed };
}

function printInstructions(result: VerifyResult): void {
  console.log(`Fired synthetic error with marker: ${result.marker}`);
  console.log(
    result.flushed
      ? "SDK reports the event was flushed to the transport before the timeout."
      : "WARNING: flush() timed out — the SDK cannot confirm the event left the process.",
  );
  console.log("");
  console.log("This does NOT confirm delivery. To confirm, a human must:");
  console.log(
    "  1. Open the Sentry dashboard for the-creative-token/paisaxe and search for:",
  );
  console.log(`       ${SYNTHETIC_ERROR_TAG}:true`);
  console.log(`     or for the marker text: ${result.marker}`);
  console.log("  2. Confirm an issue with that tag/marker appears (usually within ~1 minute).");
  console.log(
    "  3. If nothing appears after a few minutes, the Sentry pipeline is broken — file/reopen",
  );
  console.log("     an issue and treat #821 as unresolved until this check passes.");
}

async function runCli(): Promise<void> {
  const result = await runVerification();
  printInstructions(result);
  process.exit(result.flushed ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
