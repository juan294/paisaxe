export interface AnalyticsEvent {
  id: string;
  eventName: string;
  featureFlag: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalEvents: number;
  totalSessions: number;
  featureBreakdown: FeatureAnalytics[];
}

export interface FeatureAnalytics {
  featureFlag: string;
  eventCount: number;
  uniqueSessions: number;
}

export interface AnalyticsDashboardData {
  summary: AnalyticsSummary;
  dateRange: {
    from: string;
    to: string;
  };
}
