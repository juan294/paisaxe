import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAdminClient } from "@/lib/supabase-admin";
import { getEnv } from "@/lib/env";
import { probeRateLimitBackend } from "@/lib/rate-limit";
import { PROBE_TIMEOUTS_MS } from "@/lib/health-timeouts";
import { safeEqual } from "@/lib/safe-equal";

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
  /**
   * SE-L2 (#850): cron_auth/sentry/rate_limit disclose backend configuration
   * state. Both fail closed when misconfigured (a missing cron secret
   * rejects every cron request; a degraded rate limiter denies traffic), so
   * disclosure impact is low, but they're still reconnaissance surface —
   * present only for the same authorized caller as `build`, never to an
   * anonymous monitor.
   */
  cron_auth?: CronAuthStatus;
  sentry?: SentryProbeResult;
  rate_limit?: RateLimitProbeResult;
  /**
   * Present only for authorized callers — see checkBuildIdentity. The public
   * response keeps this field, and cron_auth/sentry/rate_limit above, gated
   * to the same authorized caller so an unauthenticated monitor sees only
   * status/timestamp.
   */
  build?: BuildIdentity;
}

interface SupabaseProbeResult {
  status: "connected" | "error";
}

interface StoriesProbeResult {
  status: "ok" | "fallback";
}

interface VoicePurchasesProbeResult {
  status: "ok" | "error";
}

interface DatabaseProbeResult {
  usage_percent: number | null;
  /**
   * #776: distinguishes "the probe genuinely has nothing to report" from
   * "the RPC call itself failed" (permission error, timeout, or infra
   * outage). Both map to `usage_percent: null`, but only "unavailable"
   * should ever escalate `status` to degraded — see isDatabaseProbeUnavailableInProduction.
   */
  probe_status: "ok" | "unavailable";
}

function checkSentry(): SentryProbeResult {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return { status: dsn ? "configured" : "unconfigured" };
}

/**
 * DO-H2 (#823): actively probe Redis instead of reading `_rateLimitDegraded`,
 * module-level state set only inside the process that experienced an Upstash
 * failure. Vercel routes are separate isolates, so this endpoint could never
 * observe a flag set by `/api/chat/stream` — meaning a total Upstash outage
 * silently denying every chat request still reported `rate_limit: ok` here.
 * Bounded by the same timeout harness as the other probes below so a Redis
 * hang can't make `/api/health` itself slow or unresponsive.
 */
async function checkRateLimitBackend(): Promise<RateLimitProbeResult> {
  return withTimeout(
    async (signal): Promise<RateLimitProbeResult> => {
      const backendStatus = await probeRateLimitBackend(signal);
      return {
        status: backendStatus.degraded ? "degraded" : "ok",
        backend: backendStatus.backend,
        ...(backendStatus.reason ? { reason: backendStatus.reason } : {}),
      };
    },
    PROBE_TIMEOUTS_MS.rateLimit,
    // A timeout only ever happens mid-PING, which only happens when Upstash is
    // configured — so on timeout we know the backend is "upstash" and degraded.
    (): RateLimitProbeResult => ({
      status: "degraded",
      backend: "upstash",
      reason: "upstash_unavailable",
    })
  );
}

/**
 * Release verification (Wave A, Phase 2): report what this deployment was built
 * from, so release evidence can be bound to a candidate rather than to a URL.
 *
 * Operational recon data must never reach the *unauthenticated* endpoint, and
 * this repo is private — a deployed commit SHA is exactly that. So the identity
 * is returned only to callers presenting `Authorization: Bearer <CRON_SECRET>`,
 * the same trusted-automation credential Vercel Cron uses. The unauthorized
 * response shape is unaffected by this gate.
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
  if (!provided) {
    return false;
  }

  // #827: safeEqual compares byte length before timingSafeEqual, so
  // multibyte Authorization header values can't trigger an unhandled
  // RangeError ahead of the route's try block.
  const expected = `Bearer ${cronSecret}`;
  return safeEqual(provided, expected);
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
 * Shared escalation rule for probes that run on the admin client
 * (database size, voice_purchases): only degrade in production, since
 * local/CI/preview environments commonly lack SUPABASE_SERVICE_KEY, which
 * would otherwise make every non-production health check falsely degraded.
 */
function isProbeUnavailableInProduction(isUnavailable: boolean): boolean {
  return isProductionEnv() && isUnavailable;
}

/**
 * Allow overriding the storage limit via env var so operators can
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

/**
 * Shared shape for probes that run on the admin (service-role) client:
 * fetch the client, run the query, and map any thrown/rejected error to the
 * same failure result the timeout path already returns — bounded by the
 * same timeout harness as every other probe on this route.
 */
async function probeAdminClient<T>(
  run: (client: ReturnType<typeof getAdminClient>, signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onFailure: () => T
): Promise<T> {
  return withTimeout(
    async (signal) => {
      try {
        return await run(getAdminClient(), signal);
      } catch {
        return onFailure();
      }
    },
    timeoutMs,
    onFailure
  );
}

/**
 * QA-L3 (#882): the anon client has no grant on voice_purchases — RLS scopes
 * SELECT to `auth.uid() = user_id` and only `authenticated`/`service_role`
 * hold the grant at all (migration 075), so an anon probe would either
 * error on every call (no grant) or, if a broader grant is ever added,
 * silently return zero rows regardless of the table's real health. Uses the
 * admin (service-role) client instead, the same reasoning as
 * checkDatabaseSize below. Like that probe, the result never appears in the
 * public JSON body — it only feeds the internal degraded/healthy decision.
 */
async function checkVoicePurchases(): Promise<VoicePurchasesProbeResult> {
  return probeAdminClient(
    async (client, signal) => {
      const { error } = await client
        .from("voice_purchases")
        .select("id")
        .limit(1)
        .abortSignal(signal);

      return error ? { status: "error" } : { status: "ok" };
    },
    PROBE_TIMEOUTS_MS.voicePurchases,
    (): VoicePurchasesProbeResult => ({ status: "error" })
  );
}

/**
 * Migrations 091/092 revoked EXECUTE on get_database_size() from
 * anon/authenticated, granting it only to service_role — the anon client
 * used elsewhere on this route can never call this RPC. Uses the admin
 * (service-role) client instead. The response shape is unaffected: this
 * probe's result never appears in the public JSON body (see
 * buildHealthResponse) — it only feeds the internal degraded/healthy
 * decision, so switching clients does not expose any new data.
 */
async function checkDatabaseSize(): Promise<DatabaseProbeResult> {
  return probeAdminClient(
    async (client, signal) => {
      const { data, error } = await client.rpc("get_database_size").abortSignal(signal);

      if (error) {
        return { usage_percent: null, probe_status: "unavailable" };
      }

      const sizeBytes = data as number;
      const size_mb = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
      const usage_percent =
        Math.round((size_mb / getStorageLimitMb()) * 1000) / 10;

      return { usage_percent, probe_status: "ok" };
    },
    PROBE_TIMEOUTS_MS.database,
    (): DatabaseProbeResult => ({ usage_percent: null, probe_status: "unavailable" })
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
 * Surface CRON_SECRET configuration in the public health body so that
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
  isAuthorizedCaller: boolean
): NextResponse<PublicHealthResponse> {
  // Always return HTTP 200.
  // Degraded state is signalled via the JSON body only.
  // This keeps Upptime happy and allows preview-smoke.yml to gate on body content.
  // The dedicated liveness probe (/api/health/live) is a no-probe always-200 endpoint
  // for monitors that cannot parse JSON.
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      // SE-L2 (#850): cron_auth/sentry/rate_limit/build are all additive and
      // informational only — none of them affect `status`, so withholding
      // them from an unauthorized caller cannot flip health to degraded.
      ...(isAuthorizedCaller
        ? {
            cron_auth: cronAuth,
            sentry,
            rate_limit: rateLimit,
            build: checkBuildIdentity(),
          }
        : {}),
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
  request: Request
): Promise<NextResponse<PublicHealthResponse>> {
  const cronAuth = checkCronAuthConfigured();
  const sentryStatus = checkSentry();
  // Default fail-closed (never expose gated fields). The real
  // computation moves inside the try block below as defense in depth — if
  // isReleaseIdentityAuthorized ever throws, the route still returns a
  // well-formed degraded response instead of an unhandled 500.
  let isAuthorizedCaller = false;
  // Fallback only for the (effectively unreachable) outer catch below — every
  // real failure/timeout path is handled inside checkRateLimitBackend itself.
  let rateLimitStatus: RateLimitProbeResult = { status: "ok", backend: "memory" };

  try {
    isAuthorizedCaller = isReleaseIdentityAuthorized(request);

    const [supabaseStatus, storiesStatus, databaseStatus, voicePurchasesStatus, rateLimit] =
      await Promise.all([
        checkSupabase(),
        checkStories(),
        checkDatabaseSize(),
        checkVoicePurchases(),
        checkRateLimitBackend(),
      ]);
    rateLimitStatus = rateLimit;

    const isSupabaseError = supabaseStatus.status !== "connected";
    const isStoriesFallback = storiesStatus.status !== "ok";
    const isDatabaseOverThreshold =
      databaseStatus.usage_percent !== null &&
      databaseStatus.usage_percent >= STORAGE_WARNING_THRESHOLD * 100;
    const isDatabaseProbeUnavailableInProduction = isProbeUnavailableInProduction(
      databaseStatus.probe_status === "unavailable"
    );
    // QA-L3 (#882): same production-only gate as the database probe above,
    // and for the same reason — non-production environments commonly lack
    // the service-role credential this probe also depends on.
    const isVoicePurchasesProbeUnavailableInProduction = isProbeUnavailableInProduction(
      voicePurchasesStatus.status === "error"
    );
    const isSentryMissingInDeployedEnv =
      isSentryRequired() && sentryStatus.status !== "configured";
    const isRateLimitDegradedInRequiredEnv =
      isRateLimitBackendRequired() && rateLimitStatus.status === "degraded";
    /**
     * In production, an unconfigured CRON_SECRET means scheduled jobs
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
      isDatabaseProbeUnavailableInProduction ||
      isVoicePurchasesProbeUnavailableInProduction ||
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
      isAuthorizedCaller
    );
  } catch {
    return buildHealthResponse(
      "degraded",
      cronAuth,
      sentryStatus,
      rateLimitStatus,
      isAuthorizedCaller
    );
  }
}
