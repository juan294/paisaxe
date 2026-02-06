import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { readFileSync } from "fs";
import { join } from "path";

const APP_VERSION = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8")
).version as string;

interface SupabaseServiceStatus {
  status: "connected" | "error";
  latency_ms: number;
  error?: string;
}

interface DatabaseSizeStatus {
  size_mb: number;
  limit_mb: number;
  usage_percent: number;
  error?: string;
}

interface DatabaseSizeErrorStatus {
  error: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    supabase: SupabaseServiceStatus;
    database: DatabaseSizeStatus | DatabaseSizeErrorStatus;
  };
}

async function checkSupabase(): Promise<SupabaseServiceStatus> {
  const start = performance.now();
  try {
    const { error } = await supabase.from("chunks").select("id").limit(1);
    const latency_ms = Math.round(performance.now() - start);

    if (error) {
      return { status: "error", latency_ms, error: error.message };
    }

    return { status: "connected", latency_ms };
  } catch (err) {
    const latency_ms = Math.round(performance.now() - start);
    return {
      status: "error",
      latency_ms,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

const STORAGE_LIMIT_MB = 8192; // Supabase Pro tier: 8 GB
const STORAGE_WARNING_THRESHOLD = 0.8; // 80%

async function checkDatabaseSize(): Promise<
  DatabaseSizeStatus | DatabaseSizeErrorStatus
> {
  try {
    const { data, error } = await supabase.rpc("get_database_size");

    if (error) {
      return { error: error.message };
    }

    const sizeBytes = data as number;
    const size_mb = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
    const usage_percent =
      Math.round((size_mb / STORAGE_LIMIT_MB) * 1000) / 10;

    return {
      size_mb,
      limit_mb: STORAGE_LIMIT_MB,
      usage_percent,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    const [supabaseStatus, databaseStatus] = await Promise.all([
      checkSupabase(),
      checkDatabaseSize(),
    ]);

    const isSupabaseError = supabaseStatus.status !== "connected";
    const isDatabaseOverThreshold =
      "usage_percent" in databaseStatus &&
      databaseStatus.usage_percent >= STORAGE_WARNING_THRESHOLD * 100;

    const overallStatus =
      isSupabaseError || isDatabaseOverThreshold ? "degraded" : "healthy";

    const body: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: process.uptime(),
      services: {
        supabase: supabaseStatus,
        database: databaseStatus,
      },
    };

    const httpStatus = overallStatus === "healthy" ? 200 : 503;

    return NextResponse.json(body, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const body: HealthResponse = {
      status: "degraded",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: process.uptime(),
      services: {
        supabase: {
          status: "error",
          latency_ms: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        },
        database: {
          error: err instanceof Error ? err.message : "Unknown error",
        },
      },
    };

    return NextResponse.json(body, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  }
}
