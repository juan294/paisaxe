"use client";

import { useState } from "react";
import { AnalyticsTabs, type AnalyticsSubTab } from "./analytics-tabs";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import { VisitorsAnalyticsPanel } from "./visitors-analytics-panel";
import { StripeAnalyticsPanel } from "./stripe-analytics-panel";
import { ElevenLabsAnalyticsPanel } from "./elevenlabs-analytics-panel";
import { CostsAnalyticsPanel } from "./costs-analytics-panel";

/**
 * Analytics Dashboard with sub-tabs for Visitors, Revenue, Voice, and Costs analytics.
 * All panels are mounted simultaneously (CSS visibility) so they retain state
 * across tab switches and benefit from the shared analytics cache.
 */
export function AnalyticsDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>("visitors");

  return (
    <AnalyticsCacheProvider>
      <AnalyticsTabs activeTab={activeSubTab} onTabChange={setActiveSubTab}>
        <div
          role="tabpanel"
          aria-hidden={activeSubTab !== "visitors"}
          style={{ display: activeSubTab === "visitors" ? "block" : "none" }}
        >
          <VisitorsAnalyticsPanel />
        </div>
        <div
          role="tabpanel"
          aria-hidden={activeSubTab !== "voice"}
          style={{ display: activeSubTab === "voice" ? "block" : "none" }}
        >
          <ElevenLabsAnalyticsPanel />
        </div>
        <div
          role="tabpanel"
          aria-hidden={activeSubTab !== "costs"}
          style={{ display: activeSubTab === "costs" ? "block" : "none" }}
        >
          <CostsAnalyticsPanel />
        </div>
        <div
          role="tabpanel"
          aria-hidden={activeSubTab !== "revenue"}
          style={{ display: activeSubTab === "revenue" ? "block" : "none" }}
        >
          <StripeAnalyticsPanel />
        </div>
      </AnalyticsTabs>
    </AnalyticsCacheProvider>
  );
}
