// Lemon Squeezy Revenue Analytics Types

export interface LemonSqueezyOrder {
  id: string;
  storeId: string;
  customerEmail: string;
  customerName: string | null;
  total: number;
  totalFormatted: string;
  currency: string;
  status: "pending" | "paid" | "refunded" | "partial_refund" | "chargedback";
  createdAt: string;
  productName: string;
  variantName: string | null;
}

export interface LemonSqueezyRevenueByDay {
  date: string;
  revenue: number;
  orders: number;
}

export interface LemonSqueezyAnalyticsSummary {
  totalRevenue: number;
  totalRevenueFormatted: string;
  thirtyDayRevenue: number;
  thirtyDayRevenueFormatted: string;
  totalOrders: number;
  thirtyDayOrders: number;
  averageOrderValue: number;
  averageOrderValueFormatted: string;
  currency: string;
}

export interface LemonSqueezyProductBreakdown {
  productId: string;
  productName: string;
  orderCount: number;
  revenue: number;
  revenueFormatted: string;
}

export interface LemonSqueezyAnalyticsDashboardData {
  summary: LemonSqueezyAnalyticsSummary;
  recentOrders: LemonSqueezyOrder[];
  revenueByDay: LemonSqueezyRevenueByDay[];
  productBreakdown: LemonSqueezyProductBreakdown[];
  dateRange: {
    from: string;
    to: string;
  };
}
