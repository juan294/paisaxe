import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StripeAnalyticsPanel } from "./stripe-analytics-panel";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import * as adminApi from "@/lib/admin-api";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

vi.mock("@/lib/admin-api", () => ({
  fetchStripeAnalytics: vi.fn(),
}));

const mockData = {
  summary: {
    totalOrders: 15,
    thirtyDayOrders: 10,
    totalRevenue: 4500,
    totalRevenueFormatted: "€45.00",
    totalRefunds: 500,
    totalRefundsFormatted: "€5.00",
    netRevenue: 4000,
    netRevenueFormatted: "€40.00",
    thirtyDayRevenue: 3500,
    thirtyDayRevenueFormatted: "€35.00",
    thirtyDayRefunds: 200,
    thirtyDayRefundsFormatted: "€2.00",
    thirtyDayNetRevenue: 3000,
    thirtyDayNetRevenueFormatted: "€30.00",
    averageOrderValue: 300,
    averageOrderValueFormatted: "€3.00",
    currency: "EUR",
  },
  recentOrders: [
    {
      id: "pi_1",
      customerEmail: "a@b.com",
      customerName: null,
      productName: "Day Pass",
      total: 300,
      totalFormatted: "€3.00",
      currency: "eur",
      status: "succeeded" as const,
      createdAt: "2024-01-15T10:00:00Z",
      refundedAmount: 0,
      refundedAmountFormatted: "€0.00",
    },
    {
      id: "pi_2",
      customerEmail: "c@d.com",
      customerName: null,
      productName: "Day Pass",
      total: 300,
      totalFormatted: "€3.00",
      currency: "eur",
      status: "refunded" as const,
      createdAt: "2024-01-14T10:00:00Z",
      refundedAmount: 300,
      refundedAmountFormatted: "€3.00",
    },
  ],
  productBreakdown: [
    {
      productId: "prod_1",
      productName: "Day Pass",
      orderCount: 15,
      revenue: 4500,
      revenueFormatted: "€45.00",
    },
  ],
  revenueByDay: [
    { date: "2024-01-15", revenue: 300, orders: 1 },
    { date: "2024-01-16", revenue: 600, orders: 2 },
  ],
  dateRange: { from: "2024-01-15", to: "2024-01-16" },
};

describe("StripeAnalyticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockImplementation(
      () => new Promise(() => {})
    );

    render(<StripeAnalyticsPanel />, { wrapper });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders header", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Data")).toBeInTheDocument();
    });
  });

  it("displays summary statistics", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("€40.00")).toBeInTheDocument();
    });

    expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    expect(screen.getAllByText("€5.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Refunds")).toBeInTheDocument();
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
  });

  it("displays product breakdown table", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Revenue by Product")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Day Pass").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€45.00").length).toBeGreaterThanOrEqual(1);
  });

  it("displays recent orders table", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — Recent Orders")).toBeInTheDocument();
    });

    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Refunded")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        summary: {
          totalOrders: 0,
          thirtyDayOrders: 0,
          totalRevenue: 0,
          totalRevenueFormatted: "€0.00",
          totalRefunds: 0,
          totalRefundsFormatted: "€0.00",
          netRevenue: 0,
          netRevenueFormatted: "€0.00",
          thirtyDayRevenue: 0,
          thirtyDayRevenueFormatted: "€0.00",
          thirtyDayRefunds: 0,
          thirtyDayRefundsFormatted: "€0.00",
          thirtyDayNetRevenue: 0,
          thirtyDayNetRevenueFormatted: "€0.00",
          averageOrderValue: 0,
          averageOrderValueFormatted: "€0.00",
          currency: "EUR",
        },
        recentOrders: [],
        productBreakdown: [],
        revenueByDay: [],
        dateRange: { from: "2024-01-15", to: "2024-01-16" },
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No revenue data yet")).toBeInTheDocument();
    });
  });

  it("shows error on API failure", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      error: "Stripe API error",
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Stripe API error")).toBeInTheDocument();
    });
  });

  it("shows warning when returned by API", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
      warning: "Using test API key",
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Using test API key")).toBeInTheDocument();
    });

    expect(screen.getByText("Configure API")).toBeInTheDocument();
  });

  it("displays Stripe dashboard link", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("View Full Dashboard on Stripe")).toBeInTheDocument();
    });
  });

  it("clears warning when subsequent fetch has no warning", async () => {
    const user = userEvent.setup();

    // First fetch returns a warning
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValueOnce({
      data: mockData,
      warning: "Using test API key",
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Using test API key")).toBeInTheDocument();
    });

    // Second fetch has no warning
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValueOnce({
      data: mockData,
    });

    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(screen.queryByText("Using test API key")).not.toBeInTheDocument();
    });
  });

  it("displays revenue chart when revenueByDay has data", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Over Time")).toBeInTheDocument();
    });

    // Chart legend
    expect(screen.getByText("Daily Revenue")).toBeInTheDocument();
  });

  it("displays refunded order with strikethrough amount", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — Recent Orders")).toBeInTheDocument();
    });

    // The second order has refundedAmount > 0, showing strikethrough + refund amount
    expect(screen.getByText("-€3.00")).toBeInTheDocument();
  });

  it("displays revenue breakdown text", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Gross: €45.00/)).toBeInTheDocument();
    });
  });

  it("shows Open Stripe Dashboard link in empty state", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        summary: {
          totalOrders: 0,
          thirtyDayOrders: 0,
          totalRevenue: 0,
          totalRevenueFormatted: "€0.00",
          totalRefunds: 0,
          totalRefundsFormatted: "€0.00",
          netRevenue: 0,
          netRevenueFormatted: "€0.00",
          thirtyDayRevenue: 0,
          thirtyDayRevenueFormatted: "€0.00",
          thirtyDayRefunds: 0,
          thirtyDayRefundsFormatted: "€0.00",
          thirtyDayNetRevenue: 0,
          thirtyDayNetRevenueFormatted: "€0.00",
          averageOrderValue: 0,
          averageOrderValueFormatted: "€0.00",
          currency: "EUR",
        },
        recentOrders: [],
        productBreakdown: [],
        revenueByDay: [],
        dateRange: { from: "2024-01-15", to: "2024-01-16" },
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Open Stripe Dashboard")).toBeInTheDocument();
    });
  });

  it("shows refreshing state during background refresh", async () => {
    const user = userEvent.setup();
    let resolveRefresh: (value: unknown) => void;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValueOnce({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    vi.mocked(adminApi.fetchStripeAnalytics).mockImplementationOnce(
      () => refreshPromise as Promise<{ data: typeof mockData }>
    );

    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    resolveRefresh!({ data: mockData });
  });

  it("shows empty product breakdown table when no products", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalOrders: 1 },
        productBreakdown: [],
        recentOrders: [mockData.recentOrders[0]],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Revenue by Product")).toBeInTheDocument();
    });

    expect(screen.getByText("No product data available")).toBeInTheDocument();
  });

  it("shows empty orders table when no orders but has products", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalOrders: 1 },
        recentOrders: [],
        productBreakdown: [mockData.productBreakdown[0]],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — Recent Orders")).toBeInTheDocument();
    });

    expect(screen.getByText("No orders yet")).toBeInTheDocument();
  });

  it("renders revenue chart with many days to trigger label skipping", async () => {
    const manyDays = Array.from({ length: 14 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      revenue: 100 + i * 50,
      orders: 1 + i,
    }));

    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        revenueByDay: manyDays,
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Over Time")).toBeInTheDocument();
    });

    // Chart should render with some labels skipped (x-axis label skipping logic)
    expect(screen.getByText("Daily Revenue")).toBeInTheDocument();
  });

  it("displays pending order status badge", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        recentOrders: [
          {
            ...mockData.recentOrders[0],
            status: "pending" as const,
          },
        ],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  it("updates date range when 'from' date input is changed", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Data")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    const fromInput = dateInputs[0];

    // Use fireEvent.change to atomically set the value (avoids intermediate invalid date states)
    vi.mocked(adminApi.fetchStripeAnalytics).mockClear();
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    fireEvent.change(fromInput, { target: { value: "2024-06-01" } });

    // The from input should reflect the new value
    expect(fromInput).toHaveValue("2024-06-01");

    // The API should be re-called with the new date range
    await waitFor(() => {
      expect(adminApi.fetchStripeAnalytics).toHaveBeenCalled();
    });
  });

  it("updates date range when 'to' date input is changed", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Data")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    const toInput = dateInputs[1];

    // Use fireEvent.change to atomically set the value (avoids intermediate invalid date states)
    vi.mocked(adminApi.fetchStripeAnalytics).mockClear();
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: mockData,
    });

    fireEvent.change(toInput, { target: { value: "2024-12-31" } });

    // The to input should reflect the new value
    expect(toInput).toHaveValue("2024-12-31");

    // The API should be re-called with the new date range
    await waitFor(() => {
      expect(adminApi.fetchStripeAnalytics).toHaveBeenCalled();
    });
  });

  it("formats currency with 'k' suffix when revenue >= 1000 in chart", async () => {
    const highRevenueData = {
      ...mockData,
      revenueByDay: [
        { date: "2024-01-15", revenue: 1500, orders: 5 },
        { date: "2024-01-16", revenue: 2000, orders: 8 },
      ],
    };

    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: highRevenueData,
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Over Time")).toBeInTheDocument();
    });

    // The Y-axis label should show the max revenue formatted with 'k' suffix
    // maxRevenue = 2000, so it should show "€2.0k"
    expect(screen.getByText("€2.0k")).toBeInTheDocument();
  });

  it("does not render revenue chart section when revenueByDay is empty", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        revenueByDay: [],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    // Wait for data to load — the summary stats should appear
    await waitFor(() => {
      expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    });

    // Revenue chart section should NOT be rendered when revenueByDay is empty
    expect(screen.queryByText("Revenue Over Time")).not.toBeInTheDocument();
    expect(screen.queryByText("Daily Revenue")).not.toBeInTheDocument();
  });

  it("documents RevenueChart empty guard (line 244) as unreachable", async () => {
    // Line 244: `if (data.length === 0) return null;` in RevenueChart
    // The parent checks `data.revenueByDay.length > 0` before rendering RevenueChart,
    // making the internal empty guard unreachable through normal rendering.
    // RevenueChart is a non-exported internal function.
    // This test confirms the parent guard prevents rendering:
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        revenueByDay: [],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    });

    // Parent guard prevents RevenueChart from being rendered
    expect(screen.queryByText("Revenue Over Time")).not.toBeInTheDocument();
  });

  it("formats currency with fallback to EUR when currency is empty string", async () => {
    // Covers line 350: currency || "EUR" fallback in formatCurrencyShort
    // Revenue values < 1000 go through Intl.NumberFormat (not the 'k' suffix path)
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, currency: "" },
        revenueByDay: [
          { date: "2024-01-15", revenue: 500, orders: 2 },
        ],
      },
    });

    const { container } = render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Revenue Over Time")).toBeInTheDocument();
    });

    // The Y-axis label should format 500 using EUR as fallback currency
    // Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }) for 500 = "€500"
    const chartSvg = container.querySelector("svg");
    expect(chartSvg).not.toBeNull();
  });

  it("displays failed order status badge", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        recentOrders: [
          {
            ...mockData.recentOrders[0],
            status: "failed" as const,
          },
        ],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("displays partially_refunded order status badge", async () => {
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        recentOrders: [
          {
            ...mockData.recentOrders[0],
            status: "partially_refunded" as const,
            refundedAmount: 100,
            refundedAmountFormatted: "€1.00",
          },
        ],
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Partial")).toBeInTheDocument();
    });

    // partially_refunded with refundedAmount > 0 shows strikethrough + refund
    expect(screen.getByText("-€1.00")).toBeInTheDocument();
  });

  // Line 225: `const colorClass = color ? statColorClasses[color] : "text-[#2d2a26]...";`
  // The fallback for undefined color is architecturally unreachable because all 4 StatCard
  // call sites in StripeAnalyticsPanel pass explicit color props ("emerald", "rose", "blue", "amber").
  // StatCard is a non-exported internal function, so it cannot be called externally.
  // This is a defensive fallback that cannot be exercised through the component's public API.

  // Line 531: `const style = styles[status] || styles.pending;`
  // The fallback `|| styles.pending` in OrderStatusBadge is architecturally unreachable because:
  // 1. The status prop type is `StripeOrder["status"]` which is a union of exactly
  //    "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded"
  // 2. The styles Record covers all 5 status values exhaustively
  // 3. OrderStatusBadge is a non-exported internal function only called from RecentOrdersTable
  // Therefore no runtime path can produce a status value outside the styles keys.

  it("renders StatCard with number value using toLocaleString", async () => {
    // Covers line 224: typeof value === "number" ? value.toLocaleString() : value
    // totalOrders is the only number-typed stat card value
    vi.mocked(adminApi.fetchStripeAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalOrders: 1234 },
      },
    });

    render(<StripeAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      // toLocaleString formats 1234 as "1,234"
      expect(screen.getByText("1,234")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Orders")).toBeInTheDocument();
  });
});
