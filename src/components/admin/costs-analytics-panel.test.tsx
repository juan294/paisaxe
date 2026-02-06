import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CostsAnalyticsPanel } from "./costs-analytics-panel";
import { AnalyticsCacheProvider } from "./analytics-cache-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  fetchCostsAnalytics: vi.fn(),
  createManualCostEntry: vi.fn(),
  updateManualCostEntry: vi.fn(),
  deleteManualCostEntry: vi.fn(),
}));

import * as adminApi from "@/lib/admin-api";

const mockCostsData = {
  summary: {
    totalMonthlyUsd: 125.75,
    totalMonthlyFormatted: "$125.75",
    thirtyDayUsd: 89.50,
    thirtyDayFormatted: "$89.50",
    servicesTracked: 4,
    automatedServices: 2,
  },
  services: [
    {
      serviceId: "anthropic",
      serviceName: "Anthropic Claude",
      category: "ai" as const,
      costUsd: 50.25,
      costFormatted: "$50.25",
      source: "api" as const,
      billingPeriodStart: "2024-01-01",
      billingPeriodEnd: "2024-01-31",
      dashboardUrl: "https://console.anthropic.com/settings/cost",
    },
    {
      serviceId: "twilio",
      serviceName: "Twilio",
      category: "communications" as const,
      costUsd: 25.00,
      costFormatted: "$25.00",
      source: "api" as const,
      billingPeriodStart: "2024-01-01",
      billingPeriodEnd: "2024-01-31",
      dashboardUrl: "https://console.twilio.com/us1/billing/usage",
    },
    {
      serviceId: "supabase",
      serviceName: "Supabase",
      category: "infrastructure" as const,
      costUsd: 25.00,
      costFormatted: "$25.00",
      source: "manual" as const,
      billingPeriodStart: "2024-01-01",
      billingPeriodEnd: "2024-01-31",
    },
  ],
  costsByDay: [
    { date: "2024-01-01", costUsd: 5.0 },
    { date: "2024-01-02", costUsd: 7.5 },
    { date: "2024-01-03", costUsd: 4.25 },
  ],
  dateRange: {
    from: "2024-01-01",
    to: "2024-01-31",
  },
};

describe("CostsAnalyticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockImplementation(
      () => new Promise(() => {}) // Never resolves - keeps loading
    );

    render(<CostsAnalyticsPanel />, { wrapper });

    // Should show loading skeleton
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders cost data when loaded", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("$125.75")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Monthly")).toBeInTheDocument();
    expect(screen.getByText("$89.50")).toBeInTheDocument();
    expect(screen.getByText("30-Day Costs")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Services Tracked")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Auto-Tracked")).toBeInTheDocument();
  });

  it("renders service breakdown table", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      // Services may appear in both table and dashboard links
      expect(screen.getAllByText("Anthropic Claude").length).toBeGreaterThanOrEqual(1);
    });

    // Twilio appears in table and possibly dashboard links
    expect(screen.getAllByText("Twilio").length).toBeGreaterThanOrEqual(1);
    // Supabase only appears in table (not in dashboard links)
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("$50.25")).toBeInTheDocument();
    // $25.00 appears twice (Twilio and Supabase)
    expect(screen.getAllByText("$25.00")).toHaveLength(2);
  });

  it("shows category badges correctly", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("ai")).toBeInTheDocument();
    });

    expect(screen.getByText("communications")).toBeInTheDocument();
    expect(screen.getByText("infrastructure")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      error: "Failed to fetch costs",
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch costs")).toBeInTheDocument();
    });
  });

  it("renders empty state when no services", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        services: [],
        summary: {
          ...mockCostsData.summary,
          totalMonthlyUsd: 0,
          totalMonthlyFormatted: "$0.00",
          servicesTracked: 0,
          automatedServices: 0,
        },
      },
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No cost data yet")).toBeInTheDocument();
    });

    expect(screen.getByText("Add Manual Cost")).toBeInTheDocument();
  });

  it("renders Add Cost button when data is present", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Add Cost")).toBeInTheDocument();
    });
  });

  it("renders date range separator", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      // Date inputs are rendered with a separator
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("renders refresh button", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });
});
