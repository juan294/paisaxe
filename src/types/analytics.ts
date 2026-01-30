// PostHog-powered analytics types

export interface AnalyticsSummary {
  totalPageviews: number;
  uniqueVisitors: number;
  totalSessions: number;
  avgPagesPerSession: number;
  bounceRate: number;
}

export interface TimeSeriesPoint {
  date: string;
  pageviews: number;
  visitors: number;
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

export interface CityBreakdown {
  city: string;
  country: string;
  count: number;
}

export interface DeviceBreakdown {
  device: string;
  count: number;
}

export interface BrowserBreakdown {
  browser: string;
  count: number;
}

export interface OSBreakdown {
  os: string;
  count: number;
}

export interface ScreenSizeBreakdown {
  width: number;
  height: number;
  count: number;
}

export interface EntryPageBreakdown {
  page: string;
  count: number;
}

export interface ExitPageBreakdown {
  page: string;
  count: number;
}

export interface UTMBreakdown {
  source: string;
  medium: string;
  campaign: string;
  count: number;
}

export interface NewVsReturning {
  newVisitors: number;
  returningVisitors: number;
}

export interface AnalyticsDashboardData {
  summary: AnalyticsSummary;
  timeSeries: TimeSeriesPoint[];
  topPages: TopPage[];
  topReferrers: TopReferrer[];
  countries: CountryBreakdown[];
  cities: CityBreakdown[];
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
  operatingSystems: OSBreakdown[];
  screenSizes: ScreenSizeBreakdown[];
  entryPages: EntryPageBreakdown[];
  exitPages: ExitPageBreakdown[];
  utmCampaigns: UTMBreakdown[];
  newVsReturning: NewVsReturning;
  dateRange: {
    from: string;
    to: string;
  };
}
