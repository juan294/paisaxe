"use client";

import { useState } from "react";
import { AnalyticsTabs, type AnalyticsSubTab } from "./analytics-tabs";
import { VisitorsAnalyticsPanel } from "./visitors-analytics-panel";
import { LemonSqueezyAnalyticsPanel } from "./lemonsqueezy-analytics-panel";
import { ElevenLabsAnalyticsPanel } from "./elevenlabs-analytics-panel";

/**
 * Analytics Dashboard with sub-tabs for Visitors, Revenue, and Voice analytics.
 * This component organizes all analytics into a tabbed interface.
 */
export function AnalyticsDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>("visitors");

  return (
    <AnalyticsTabs activeTab={activeSubTab} onTabChange={setActiveSubTab}>
      {activeSubTab === "visitors" && <VisitorsAnalyticsPanel />}
      {activeSubTab === "revenue" && <LemonSqueezyAnalyticsPanel />}
      {activeSubTab === "voice" && <ElevenLabsAnalyticsPanel />}
    </AnalyticsTabs>
  );
}
