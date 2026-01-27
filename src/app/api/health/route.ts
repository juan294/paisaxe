import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const APP_VERSION = "0.1.0";

interface SupabaseServiceStatus {
  status: "connected" | "error";
  latency_ms: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    supabase: SupabaseServiceStatus;
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

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    const supabaseStatus = await checkSupabase();

    const overallStatus = supabaseStatus.status === "connected" ? "healthy" : "degraded";

    const body: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: process.uptime(),
      services: {
        supabase: supabaseStatus,
      },
    };

    return NextResponse.json(body, {
      status: 200,
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
      },
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  }
}
