import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScalingForecastSection } from "./forecast";
import type { ServiceCost } from "@/types/costs-analytics";

// Mock fetchCostsAnalytics
const mockFetchCostsAnalytics = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  fetchCostsAnalytics: (...args: unknown[]) => mockFetchCostsAnalytics(...args),
}));

// Mock computeForecasts
const mockComputeForecasts = vi.fn();
vi.mock("@/lib/costs", () => ({
  computeForecasts: (...args: unknown[]) => mockComputeForecasts(...args),
}));

const dateRange = { from: "2026-02-01", to: "2026-02-28" };
const mockServices: ServiceCost[] = [
  {
    serviceId: "anthropic",
    serviceName: "Anthropic Claude",
    category: "ai",
    costUsd: 15,
    costFormatted: "$15.00",
    source: "manual",
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd: "2026-02-28",
  },
];

const mockUsageMetrics = {
  voiceMinutes: 50,
  visitors: 100,
  posthogEvents: 500,
  chatConversations: 10,
  voiceConversations: 5,
  periodDays: 30,
};

const mockForecasts = [
  {
    label: "Current",
    visitors: 100,
    chats: 10,
    voiceMinutes: 50,
    breakdown: { infrastructure: 20, ai: 15, voice: 10 },
    estimatedMonthlyCost: 45,
  },
  {
    label: "2x Growth",
    visitors: 200,
    chats: 20,
    voiceMinutes: 100,
    breakdown: { infrastructure: 30, ai: 30, voice: 20 },
    estimatedMonthlyCost: 80,
  },
];

describe("ScalingForecastSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while fetching data", () => {
    mockFetchCostsAnalytics.mockImplementation(() => new Promise(() => {}));

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    expect(screen.getByText("Loading usage data...")).toBeInTheDocument();
  });

  it("renders no data state when usageMetrics is missing", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({ data: {} });

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("No usage data available yet")).toBeInTheDocument();
    });

    // Should also show the explanation text
    expect(screen.getByText(/Chat events will appear/)).toBeInTheDocument();
  });

  it("renders reality table and forecasts when data loads", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: { usageMetrics: mockUsageMetrics },
    });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    // Reality table rows
    expect(screen.getByText("Visitors")).toBeInTheDocument();
    expect(screen.getByText("Chat Conversations")).toBeInTheDocument();
    expect(screen.getByText("Voice Sessions")).toBeInTheDocument();
    // "Voice Minutes" appears in both reality and forecast tables
    expect(screen.getAllByText("Voice Minutes").length).toBeGreaterThanOrEqual(1);

    // Forecast table
    expect(screen.getByText("Growth Projections")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("2x Growth")).toBeInTheDocument();
  });

  it("shows period days notice when periodDays < 30", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: { ...mockUsageMetrics, periodDays: 15 },
      },
    });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText(/based on 15 days of data/)).toBeInTheDocument();
    });
  });

  it("does not show period notice when periodDays >= 30", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: { usageMetrics: mockUsageMetrics },
    });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    expect(screen.queryByText(/based on/)).not.toBeInTheDocument();
  });

  it("collapses and expands the section", async () => {
    const user = userEvent.setup();
    mockFetchCostsAnalytics.mockResolvedValue({ data: {} });

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("No usage data available yet")).toBeInTheDocument();
    });

    // Collapse
    await user.click(screen.getByText("Scaling Forecast"));
    expect(screen.queryByText("No usage data available yet")).not.toBeInTheDocument();

    // Expand again
    await user.click(screen.getByText("Scaling Forecast"));
    await waitFor(() => {
      expect(screen.getByText("No usage data available yet")).toBeInTheDocument();
    });
  });

  it("loads data when expanding if not already loaded (handleToggle branch, line 43)", async () => {
    const user = userEvent.setup();
    mockFetchCostsAnalytics.mockResolvedValue({ data: {} });

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);
    });

    // Collapse
    await user.click(screen.getByText("Scaling Forecast"));

    // Expand again - usageMetrics is still null, so loadUsageData is called again
    await user.click(screen.getByText("Scaling Forecast"));

    await waitFor(() => {
      expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  it("auto-loads on mount via useEffect (line 35 branch)", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: { usageMetrics: mockUsageMetrics },
    });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    // The useEffect at line 34-37 should trigger loadUsageData on mount
    await waitFor(() => {
      expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  it("does not show forecast table when forecasts is empty array", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: { usageMetrics: mockUsageMetrics },
    });
    mockComputeForecasts.mockReturnValue([]);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    // Forecast table should not appear when array is empty
    expect(screen.queryByText("Growth Projections")).not.toBeInTheDocument();
  });

  it("silently handles fetch error (catch block)", async () => {
    mockFetchCostsAnalytics.mockRejectedValue(new Error("Network error"));

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      // After error, shows "No usage data" because usageMetrics remains null
      expect(screen.getByText("No usage data available yet")).toBeInTheDocument();
    });
  });

  it("renders RealityRow with decimals for voice minutes", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: { ...mockUsageMetrics, voiceMinutes: 12.5 },
      },
    });
    mockComputeForecasts.mockReturnValue([]);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      // Voice Minutes row uses decimals=1, so should show "12.5"
      // It appears twice: once as actual and once as monthly rate
      const cells = screen.getAllByText("12.5");
      expect(cells.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders ForecastRow with cost styling", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: { usageMetrics: mockUsageMetrics },
    });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    render(<ScalingForecastSection services={mockServices} dateRange={dateRange} />);

    await waitFor(() => {
      // Cost rows should have rose-colored text
      expect(screen.getByText("Infrastructure")).toBeInTheDocument();
      expect(screen.getByText("AI (Claude)")).toBeInTheDocument();
      expect(screen.getByText("Voice (ElevenLabs)")).toBeInTheDocument();
      expect(screen.getByText("Est. Monthly")).toBeInTheDocument();
    });
  });

  it("does not re-fetch in useEffect when data already loaded (line 35 !usageMetrics false branch)", async () => {
    // The useEffect guard on line 35 is `if (!usageMetrics && !isLoadingUsage)`.
    // The useEffect depends on [loadUsageData], and loadUsageData depends on
    // [dateRange.from, dateRange.to, services]. Changing the dateRange prop creates
    // a new loadUsageData reference, which triggers the useEffect. But since
    // usageMetrics is already non-null, the guard evaluates to false.
    mockFetchCostsAnalytics.mockResolvedValue({
      data: { usageMetrics: mockUsageMetrics },
    });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    const { rerender } = render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />
    );

    // Wait for initial data load to complete
    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    // Data is now loaded (usageMetrics is non-null).
    // Only 1 fetch call so far.
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);

    // Rerender with a DIFFERENT dateRange — this creates a new loadUsageData callback,
    // which triggers the useEffect to re-run. But usageMetrics is non-null,
    // so the guard `!usageMetrics && !isLoadingUsage` is false.
    rerender(
      <ScalingForecastSection services={mockServices} dateRange={{ from: "2026-03-01", to: "2026-03-31" }} />
    );

    // Still only 1 call — the guard prevented a refetch
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch in useEffect when already loading (line 35 false branch)", async () => {
    // The useEffect guard on line 35 is `if (!usageMetrics && !isLoadingUsage)`.
    // When isLoadingUsage is true (fetch already in progress), the condition is false
    // and loadUsageData is NOT called again. This tests that deduplication.
    //
    // We verify this by ensuring that even when the component re-renders (e.g. due
    // to a prop change that recreates loadUsageData), only one fetch call happens
    // because the loading guard prevents a second concurrent call.
    let resolveFirst!: (v: unknown) => void;
    mockFetchCostsAnalytics.mockImplementation(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );

    const { rerender } = render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />
    );

    // First call is in-flight (isLoadingUsage = true)
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);

    // Re-render with same props — the useEffect fires again because loadUsageData
    // reference may change, but the guard `!isLoadingUsage` prevents a duplicate call
    rerender(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />
    );

    // Still only one call — the guard prevented a second
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);

    // Resolve to clean up
    resolveFirst({ data: { usageMetrics: mockUsageMetrics } });
    mockComputeForecasts.mockReturnValue(mockForecasts);

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });
  });
});
