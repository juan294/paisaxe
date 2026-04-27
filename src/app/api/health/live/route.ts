import { NextResponse } from "next/server";

/**
 * GET /api/health/live
 *
 * Public liveness endpoint for Upptime and external monitors.
 * Always returns HTTP 200 — this endpoint signals that the process
 * is running and can serve requests. It performs NO probes.
 *
 * If you need to know whether backend dependencies are healthy,
 * check the admin diagnostics dashboard instead.
 *
 * DO-B1: Upptime contract — must always return 200.
 * SE-M1: No sensitive diagnostics in the public response.
 */

interface LivenessResponse {
  status: "live";
  timestamp: string;
}

export async function GET(): Promise<NextResponse<LivenessResponse>> {
  return NextResponse.json(
    {
      status: "live",
      timestamp: new Date().toISOString(),
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
