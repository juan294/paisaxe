// Stripe Revenue Analytics Types

export interface StripeOrder {
  id: string;
  customerEmail: string;
  customerName: string | null;
  total: number;
  totalFormatted: string;
  currency: string;
  status: "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded";
  createdAt: string;
  productName: string;
  refundedAmount: number;
  refundedAmountFormatted: string;
}

export interface StripeRevenueByDay {
  date: string;
  revenue: number;
  orders: number;
}

export interface StripeAnalyticsSummary {
  totalRevenue: number;
  totalRevenueFormatted: string;
  totalRefunds: number;
  totalRefundsFormatted: string;
  netRevenue: number;
  netRevenueFormatted: string;
  thirtyDayRevenue: number;
  thirtyDayRevenueFormatted: string;
  thirtyDayRefunds: number;
  thirtyDayRefundsFormatted: string;
  thirtyDayNetRevenue: number;
  thirtyDayNetRevenueFormatted: string;
  totalOrders: number;
  thirtyDayOrders: number;
  averageOrderValue: number;
  averageOrderValueFormatted: string;
  currency: string;
}

export interface StripeProductBreakdown {
  productId: string;
  productName: string;
  orderCount: number;
  revenue: number;
  revenueFormatted: string;
}

export interface StripeAnalyticsDashboardData {
  summary: StripeAnalyticsSummary;
  recentOrders: StripeOrder[];
  revenueByDay: StripeRevenueByDay[];
  productBreakdown: StripeProductBreakdown[];
  dateRange: {
    from: string;
    to: string;
  };
}
