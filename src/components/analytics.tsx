"use client";

import dynamic from "next/dynamic";

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

export function VercelAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
