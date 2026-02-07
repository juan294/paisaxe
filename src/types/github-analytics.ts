// GitHub Repository Traffic Analytics Types

export interface GitHubTrafficDaily {
  date: string;
  views: number;
  views_unique: number;
  clones: number;
  clones_unique: number;
}

export interface GitHubTrafficReferrer {
  referrer: string;
  count: number;
  uniques: number;
  fetched_at: string;
}

export interface GitHubTrafficPath {
  path: string;
  title: string | null;
  count: number;
  uniques: number;
  fetched_at: string;
}

export interface GitHubTrafficSummary {
  totalViews: number;
  totalUniqueViews: number;
  totalClones: number;
  totalUniqueClones: number;
  dataPointCount: number;
}

export interface GitHubAnalyticsDashboardData {
  summary: GitHubTrafficSummary;
  daily: GitHubTrafficDaily[];
  referrers: GitHubTrafficReferrer[];
  popularPaths: GitHubTrafficPath[];
  lastSyncedAt: string | null;
  dateRange: {
    from: string;
    to: string;
  };
}
