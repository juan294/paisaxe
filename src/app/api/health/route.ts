import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type HealthStatus = "healthy" | "degraded";
type SentryStatus = "configured" | "unconfigured";

interface SentryProbeResult {
  status: SentryStatus;
}

interface PublicHealthResponse {
  status: HealthStatus;
  timestamp: string;
  sentry: SentryProbeResult;
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

export const PROBE_TIMEOUTS_MS = {
  supabase: 2_000,
  stories: 2_000,
  database: 2_000,
} as const;

function checkSentry(): SentryProbeResult {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return { status: dsn ? "configured" : "unconfigured" };
}

const STORAGE_LIMIT_MB = 8192; // Supabase Pro tier: 8 GB
const STORAGE_WARNING_THRESHOLD = 0.8; // 80%

async function checkSupabase(): Promise<SupabaseProbeResult> {
  return withTimeout(
    (async (): Promise<SupabaseProbeResult> => {
      try {
        const { error } = await supabase.from("chunks").select("id").limit(1);
        return error ? { status: "error" } : { status: "connected" };
      } catch {
        return { status: "error" };
      }
    })(),
    PROBE_TIMEOUTS_MS.supabase,
    (): SupabaseProbeResult => ({ status: "error" })
  );
}

async function checkStories(): Promise<StoriesProbeResult> {
  return withTimeout(
    (async (): Promise<StoriesProbeResult> => {
      try {
        const { count, error } = await supabase
          .from("stories")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("curation_status", "approved");

        if (error) {
          return { status: "fallback" };
        }

        return (count ?? 0) > 0 ? { status: "ok" } : { status: "fallback" };
      } catch {
        return { status: "fallback" };
      }
    })(),
    PROBE_TIMEOUTS_MS.stories,
    (): StoriesProbeResult => ({ status: "fallback" })
  );
}

async function checkDatabaseSize(): Promise<DatabaseProbeResult> {
  return withTimeout(
    (async (): Promise<DatabaseProbeResult> => {
      try {
        const { data, error } = await supabase.rpc("get_database_size");

        if (error) {
          return { usage_percent: null };
        }

        const sizeBytes = data as number;
        const size_mb = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
        const usage_percent =
          Math.round((size_mb / STORAGE_LIMIT_MB) * 1000) / 10;

        return { usage_percent };
      } catch {
        return { usage_percent: null };
      }
    })(),
    PROBE_TIMEOUTS_MS.database,
    (): DatabaseProbeResult => ({ usage_percent: null })
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function buildHealthResponse(
  status: HealthStatus,
  sentry: SentryProbeResult
): NextResponse<PublicHealthResponse> {
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      sentry,
    },
    {
      status: status === "healthy" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    }
  );
}

export async function GET(): Promise<NextResponse<PublicHealthResponse>> {
  const sentryStatus = checkSentry();

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

    const overallStatus =
      isSupabaseError || isStoriesFallback || isDatabaseOverThreshold
        ? "degraded"
        : "healthy";

    return buildHealthResponse(overallStatus, sentryStatus);
  } catch {
    return buildHealthResponse("degraded", sentryStatus);
  }
}
