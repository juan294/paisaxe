"use client";

import dynamic from "next/dynamic";
import { redactCapabilityPath } from "@/lib/redact-capability-path";

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => ({ default: m.Analytics })),
  { ssr: false }
);
const SpeedInsights = dynamic(
  () =>
    import("@vercel/speed-insights/next").then((m) => ({
      default: m.SpeedInsights,
    })),
  { ssr: false }
);

/** F05: Vercel Analytics and Speed Insights send the page URL; never a capability link. */
export function analyticsBeforeSend<E extends { url: string }>(event: E): E {
  return { ...event, url: redactCapabilityPath(event.url) };
}

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={analyticsBeforeSend} />
      <SpeedInsights beforeSend={analyticsBeforeSend} />
    </>
  );
}
