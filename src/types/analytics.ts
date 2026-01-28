// PostHog-powered analytics types

export interface AnalyticsSummary {
  totalPageviews: number;
  uniqueVisitors: number;
}

export interface TopPage {
  url: string;
  count: number;
}

export interface TopReferrer {
  referrer: string;
  count: number;
}

export interface CountryBreakdown {
  country: string;
  count: number;
}

export interface DeviceBreakdown {
  device: string;
  count: number;
}

export interface AnalyticsDashboardData {
  summary: AnalyticsSummary;
  topPages: TopPage[];
  topReferrers: TopReferrer[];
  countries: CountryBreakdown[];
  devices: DeviceBreakdown[];
  dateRange: {
    from: string;
    to: string;
  };
}
