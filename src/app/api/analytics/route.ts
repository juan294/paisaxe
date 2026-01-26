import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

const ANALYTICS_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 60,
  maxEntries: 10_000,
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimit = checkRateLimit(`analytics:${ip}`, ANALYTICS_RATE_LIMIT);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const body = await request.json();
    const { eventName, featureFlag, sessionId, metadata } = body;

    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json(
        { error: "eventName is required" },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent") || null;
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const { error } = await supabase
      .from("analytics_events")
      .insert({
        event_name: eventName,
        feature_flag: featureFlag || null,
        session_id: sessionId || null,
        metadata: metadata || {},
        user_agent: userAgent,
        ip_hash: ipHash,
      });

    if (error) {
      console.error("Failed to insert analytics event:", error.message);
      return NextResponse.json(
        { error: "Failed to record event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
