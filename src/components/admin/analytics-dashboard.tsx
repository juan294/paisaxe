"use client";

import { useState } from "react";
import { AnalyticsTabs, type AnalyticsSubTab } from "./analytics-tabs";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import { VisitorsAnalyticsPanel } from "./visitors-analytics-panel";
import { StripeAnalyticsPanel } from "./stripe-analytics-panel";
import { ElevenLabsAnalyticsPanel } from "./elevenlabs-analytics-panel";
import { CostsAnalyticsPanel } from "./costs-analytics-panel";
import { GitHubAnalyticsPanel } from "./github-analytics-panel";

/**
 * Analytics Dashboard with sub-tabs for Visitors, Revenue, Voice, Costs, and GitHub analytics.
 * Panels are lazy-mounted on first visit — only rendered when their tab is clicked.
 * Once mounted, panels stay in the DOM (hidden via display:none) to preserve state
 * across tab switches and benefit from the shared analytics cache.
 */
export function AnalyticsDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>("visitors");
  const [visitedTabs, setVisitedTabs] = useState<Set<AnalyticsSubTab>>(new Set(["visitors"]));

  const handleTabChange = (tab: AnalyticsSubTab) => {
    setActiveSubTab(tab);
    setVisitedTabs(prev => prev.has(tab) ? prev : new Set(prev).add(tab));
  };

  return (
    <AnalyticsCacheProvider>
      <AnalyticsTabs activeTab={activeSubTab} onTabChange={handleTabChange}>
        {visitedTabs.has("visitors") && (
          <div
            role="tabpanel"
            aria-hidden={activeSubTab !== "visitors"}
            style={{ display: activeSubTab === "visitors" ? "block" : "none" }}
          >
            <VisitorsAnalyticsPanel />
          </div>
        )}
        {visitedTabs.has("voice") && (
          <div
            role="tabpanel"
            aria-hidden={activeSubTab !== "voice"}
            style={{ display: activeSubTab === "voice" ? "block" : "none" }}
          >
            <ElevenLabsAnalyticsPanel />
          </div>
        )}
        {visitedTabs.has("github") && (
          <div
            role="tabpanel"
            aria-hidden={activeSubTab !== "github"}
            style={{ display: activeSubTab === "github" ? "block" : "none" }}
          >
            <GitHubAnalyticsPanel />
          </div>
        )}
        {visitedTabs.has("costs") && (
          <div
            role="tabpanel"
            aria-hidden={activeSubTab !== "costs"}
            style={{ display: activeSubTab === "costs" ? "block" : "none" }}
          >
            <CostsAnalyticsPanel />
          </div>
        )}
        {visitedTabs.has("revenue") && (
          <div
            role="tabpanel"
            aria-hidden={activeSubTab !== "revenue"}
            style={{ display: activeSubTab === "revenue" ? "block" : "none" }}
          >
            <StripeAnalyticsPanel />
          </div>
        )}
      </AnalyticsTabs>
    </AnalyticsCacheProvider>
  );
}
