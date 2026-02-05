"use client";

import { useState } from "react";
import { AnalyticsTabs, type AnalyticsSubTab } from "./analytics-tabs";
import { VisitorsAnalyticsPanel } from "./visitors-analytics-panel";
import { StripeAnalyticsPanel } from "./stripe-analytics-panel";
import { ElevenLabsAnalyticsPanel } from "./elevenlabs-analytics-panel";
import { CostsAnalyticsPanel } from "./costs-analytics-panel";

/**
 * Analytics Dashboard with sub-tabs for Visitors, Revenue, Voice, and Costs analytics.
 * This component organizes all analytics into a tabbed interface.
 */
export function AnalyticsDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>("visitors");

  return (
    <AnalyticsTabs activeTab={activeSubTab} onTabChange={setActiveSubTab}>
      {activeSubTab === "visitors" && <VisitorsAnalyticsPanel />}
      {activeSubTab === "revenue" && <StripeAnalyticsPanel />}
      {activeSubTab === "voice" && <ElevenLabsAnalyticsPanel />}
      {activeSubTab === "costs" && <CostsAnalyticsPanel />}
    </AnalyticsTabs>
  );
}
