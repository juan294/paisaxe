import type {
  AnalyticsDashboardData,
  TimeSeriesPoint,
  TopPage,
  TopReferrer,
  CountryBreakdown,
  CityBreakdown,
  DeviceBreakdown,
  BrowserBreakdown,
  OSBreakdown,
  ScreenSizeBreakdown,
  EntryPageBreakdown,
  ExitPageBreakdown,
  UTMBreakdown,
} from "@/types/analytics";

export type {
  AnalyticsDashboardData,
  TimeSeriesPoint,
  TopPage,
  TopReferrer,
  CountryBreakdown,
  CityBreakdown,
  DeviceBreakdown,
  BrowserBreakdown,
  OSBreakdown,
  ScreenSizeBreakdown,
  EntryPageBreakdown,
  ExitPageBreakdown,
  UTMBreakdown,
};

export interface StatCardProps {
  value: number | string;
  label: string;
  color?: "blue" | "emerald" | "amber" | "rose";
}

export interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

export interface DataTableProps<T> {
  number: string;
  title: string;
  items: T[];
  renderItem: (item: T) => string;
  getCount: (item: T) => number;
}

export interface UTMTableProps {
  items: UTMBreakdown[];
}

export interface NewVsReturningBarProps {
  newVisitors: number;
  returningVisitors: number;
}
