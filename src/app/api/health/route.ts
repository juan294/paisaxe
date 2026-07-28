import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabase } from "@/lib/supabase";
import { getEnv } from "@/lib/env";
import { getRateLimitBackendStatus } from "@/lib/rate-limit";
import { PROBE_TIMEOUTS_MS } from "@/lib/health-timeouts";

type HealthStatus = "healthy" | "degraded";
type SentryStatus = "configured" | "unconfigured";

interface SentryProbeResult {
  status: SentryStatus;
}

interface RateLimitProbeResult {
  status: "ok" | "degraded";
  backend: "upstash" | "memory" | "blocked";
  reason?: "upstash_missing" | "upstash_unavailable";
}

type CronAuthStatus =
  | { status: "ok" }
  | { status: "misconfigured"; message: string };

interface BuildIdentity {
  commit: string;
  tree: string;
}

interface PublicHealthResponse {
  status: HealthStatus;
  timestamp: string;
  cron_auth: CronAuthStatus;
  sentry: SentryProbeResult;
  rate_limit: RateLimitProbeResult;
  /**
   * Present only for authorized callers — see checkBuildIdentity. The public
   * response keeps the exact shape SE-M1 allow-lists.
   */
  build?: BuildIdentity;
}

interface SupabaseProbeResult {
  status: "connected" | "error";
}

interface StoriesProbeResult {
  status: "ok" | "fallback";
}

interface DatabaseProbeResult {
  usage_percent: number | null;
}

function checkSentry(): SentryProbeResult {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return { status: dsn ? "configured" : "unconfigured" };
}

function checkRateLimitBackend(): RateLimitProbeResult {
  const backendStatus = getRateLimitBackendStatus();
  return {
    status: backendStatus.degraded ? "degraded" : "ok",
    backend: backendStatus.backend,
    ...(backendStatus.reason ? { reason: backendStatus.reason } : {}),
  };
}

/**
 * Release verification (Wave A, Phase 2): report what this deployment was built
 * from, so release evidence can be bound to a candidate rather than to a URL.
 *
 * SE-M1 forbids operational recon data on the *unauthenticated* endpoint, and
 * this repo is private — a deployed commit SHA is exactly that. So the identity
 * is returned only to callers presenting `Authorization: Bearer <CRON_SECRET>`,
 * the same trusted-automation credential Vercel Cron uses. The public response
 * keeps the shape SE-M1 asserts, unchanged.
 *
 * The check is silent by design: /api/health is polled continuously by Upptime,
 * so borrowing verifyVercelCron() would emit a [CRON_AUTH_REJECTED] warning on
 * every monitor hit. Constant-time comparison follows validateMcpSecret.
 */
const UNKNOWN_BUILD_IDENTITY = "unknown";
const SHORT_HASH_LENGTH = 12;

function isReleaseIdentityAuthorized(request: Request | undefined): boolean {
  const cronSecret = getEnv("CRON_SECRET");
  if (!request || !cronSecret) {
    return false;
  }

  const provided = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (!provided || provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function shortenHash(value: string): string {
  return /^[0-9a-f]{40}$/i.test(value)
    ? value.slice(0, SHORT_HASH_LENGTH)
    : value;
}

/**
 * Both fields degrade to "unknown" (never throw) so local and non-Vercel runs
 * still return a well-formed response. "unknown" is the fail-closed signal
 * consumers check — scripts/release/candidate-identity.ts refuses to verify an
 * unidentified build. `tree` is only populated when the build injects
 * BUILD_TREE_HASH; verification does not depend on it, because the tree is
 * re-derived locally from the commit.
 */
function checkBuildIdentity(): BuildIdentity {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const tree = process.env.BUILD_TREE_HASH?.trim();

  return {
    commit: commit || UNKNOWN_BUILD_IDENTITY,
    tree: tree ? shortenHash(tree) : UNKNOWN_BUILD_IDENTITY,
  };
}

function isProductionEnv(): boolean {
  return process.env.VERCEL_ENV === "production";
}

function isSentryRequired(): boolean {
  return isProductionEnv();
}

function isRateLimitBackendRequired(): boolean {
  return isProductionEnv();
}

/**
 * DO-L1: Allow overriding the storage limit via env var so operators can
 * adjust the threshold without a code change (e.g. after a plan upgrade).
 * Defaults to 8192 MB (Supabase Pro tier: 8 GB).
 * Evaluated at call time so tests can stub SUPABASE_STORAGE_LIMIT_MB.
 */
function getStorageLimitMb(): number {
  const raw = process.env.SUPABASE_STORAGE_LIMIT_MB?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8192;
}
const STORAGE_WARNING_THRESHOLD = 0.8; // 80%

async function checkSupabase(): Promise<SupabaseProbeResult> {
  return withTimeout(
    async (signal): Promise<SupabaseProbeResult> => {
      try {
        const { error } = await supabase
          .from("chunks")
          .select("id")
          .limit(1)
          .abortSignal(signal);
        return error ? { status: "error" } : { status: "connected" };
      } catch {
        return { status: "error" };
      }
    },
    PROBE_TIMEOUTS_MS.supabase,
    (): SupabaseProbeResult => ({ status: "error" })
  );
}

async function checkStories(): Promise<StoriesProbeResult> {
  return withTimeout(
    async (signal): Promise<StoriesProbeResult> => {
      try {
        const { count, error } = await supabase
          .from("stories")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("curation_status", "approved")
          .abortSignal(signal);

        if (error) {
          return { status: "fallback" };
        }

        return (count ?? 0) > 0 ? { status: "ok" } : { status: "fallback" };
      } catch {
        return { status: "fallback" };
      }
    },
    PROBE_TIMEOUTS_MS.stories,
    (): StoriesProbeResult => ({ status: "fallback" })
  );
}

async function checkDatabaseSize(): Promise<DatabaseProbeResult> {
  return withTimeout(
    async (signal): Promise<DatabaseProbeResult> => {
      try {
        const { data, error } = await supabase
          .rpc("get_database_size")
          .abortSignal(signal);

        if (error) {
          return { usage_percent: null };
        }

        const sizeBytes = data as number;
        const size_mb = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
        const usage_percent =
          Math.round((size_mb / getStorageLimitMb()) * 1000) / 10;

        return { usage_percent };
      } catch {
        return { usage_percent: null };
      }
    },
    PROBE_TIMEOUTS_MS.database,
    (): DatabaseProbeResult => ({ usage_percent: null })
  );
}

/**
 * DO-L2 (#528): run a probe with a hard timeout AND cancel the underlying
 * request when the timeout fires. The probe factory receives an AbortSignal
 * which is threaded into the Supabase query via .abortSignal(); on timeout we
 * abort the controller so the in-flight request is actually cancelled instead
 * of leaking after Promise.race resolves the fallback value.
 */
function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(onTimeout());
    }, timeoutMs);
  });
  return Promise.race([run(controller.signal), timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * BE-B1: surface CRON_SECRET configuration in the public health body so that
 * monitoring can detect silent cron-auth misconfigurations. Informational only —
 * does not affect overall health status. The secret value itself is never
 * included; only "ok" / "misconfigured".
 */
function checkCronAuthConfigured(): CronAuthStatus {
  const cronSecret = getEnv("CRON_SECRET");
  if (!cronSecret) {
    return { status: "misconfigured", message: "CRON_SECRET not set" };
  }
  return { status: "ok" };
}

function buildHealthResponse(
  status: HealthStatus,
  cronAuth: CronAuthStatus,
  sentry: SentryProbeResult,
  rateLimit: RateLimitProbeResult,
  includeBuildIdentity: boolean
): NextResponse<PublicHealthResponse> {
  // DO-H1 / PE-H3: Always return HTTP 200.
  // Degraded state is signalled via the JSON body only.
  // This keeps Upptime happy and allows preview-smoke.yml to gate on body content.
  // The dedicated liveness probe (/api/health/live) is a no-probe always-200 endpoint
  // for monitors that cannot parse JSON.
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      cron_auth: cronAuth,
      sentry,
      rate_limit: rateLimit,
      // Additive and informational only: build identity never affects `status`,
      // so an unidentified build (local, non-Vercel) cannot flip health to degraded.
      ...(includeBuildIdentity ? { build: checkBuildIdentity() } : {}),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    }
  );
}

export async function GET(
  request?: Request
): Promise<NextResponse<PublicHealthResponse>> {
  const cronAuth = checkCronAuthConfigured();
  const sentryStatus = checkSentry();
  const rateLimitStatus = checkRateLimitBackend();
  const includeBuildIdentity = isReleaseIdentityAuthorized(request);

  try {
    const [supabaseStatus, storiesStatus, databaseStatus] = await Promise.all([
      checkSupabase(),
      checkStories(),
      checkDatabaseSize(),
    ]);

    const isSupabaseError = supabaseStatus.status !== "connected";
    const isStoriesFallback = storiesStatus.status !== "ok";
    const isDatabaseOverThreshold =
      databaseStatus.usage_percent !== null &&
      databaseStatus.usage_percent >= STORAGE_WARNING_THRESHOLD * 100;
    const isSentryMissingInDeployedEnv =
      isSentryRequired() && sentryStatus.status !== "configured";
    const isRateLimitDegradedInRequiredEnv =
      isRateLimitBackendRequired() && rateLimitStatus.status === "degraded";
    /**
     * DO-L2: In production, an unconfigured CRON_SECRET means scheduled jobs
     * silently fail auth. Surface this as degraded so monitors catch it.
     * Non-production environments (dev, preview) are excluded to avoid noise.
     * HTTP status stays 200 — degraded is expressed in the body only.
     */
    const isCronAuthMisconfiguredInProduction =
      isProductionEnv() && cronAuth.status === "misconfigured";

    const overallStatus =
      isSupabaseError ||
      isStoriesFallback ||
      isDatabaseOverThreshold ||
      isSentryMissingInDeployedEnv ||
      isRateLimitDegradedInRequiredEnv ||
      isCronAuthMisconfiguredInProduction
        ? "degraded"
        : "healthy";

    return buildHealthResponse(
      overallStatus,
      cronAuth,
      sentryStatus,
      rateLimitStatus,
      includeBuildIdentity
    );
  } catch {
    return buildHealthResponse(
      "degraded",
      cronAuth,
      sentryStatus,
      rateLimitStatus,
      includeBuildIdentity
    );
  }
}
