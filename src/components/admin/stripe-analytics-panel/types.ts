import type {
  StripeAnalyticsDashboardData,
  StripeOrder,
  StripeProductBreakdown,
  StripeRevenueByDay,
} from "@/types/stripe-analytics";

export type {
  StripeAnalyticsDashboardData,
  StripeOrder,
  StripeProductBreakdown,
  StripeRevenueByDay,
};

export interface StatCardProps {
  value: number | string;
  label: string;
  color?: "blue" | "emerald" | "amber" | "violet" | "rose";
}

export interface RevenueChartProps {
  data: StripeRevenueByDay[];
  currency: string;
}

export interface ProductBreakdownTableProps {
  number: string;
  title: string;
  items: StripeProductBreakdown[];
}

export interface RecentOrdersTableProps {
  number: string;
  title: string;
  orders: StripeOrder[];
}
