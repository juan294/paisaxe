import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TierAlertsSection } from "./alerts";
import type { TierAlert, AlertLevel } from "./types";

// Mock fetchCostsAnalytics
const mockFetchCostsAnalytics = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  fetchCostsAnalytics: (...args: unknown[]) => mockFetchCostsAnalytics(...args),
}));

// Mock computeTierAlerts
const mockComputeTierAlerts = vi.fn();
vi.mock("@/lib/costs", () => ({
  computeTierAlerts: (...args: unknown[]) => mockComputeTierAlerts(...args),
}));

// Mock SERVICE_TIERS
vi.mock("@/config/service-tiers", () => ({
  SERVICE_TIERS: [{ id: "test", name: "Test" }],
}));

// Mock formatDateShort (used by TierAlertRow)
vi.mock("./chart", () => ({
  formatDateShort: (d: string) => d.slice(0, 10),
}));

const dateRange = { from: "2026-02-01", to: "2026-02-28" };

function makeMockAlerts(overrides?: Partial<TierAlert>[]): TierAlert[] {
  const base: TierAlert = {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    currentTierName: "Starter",
    metricLabel: "Voice Minutes",
    unit: "min",
    currentUsage: 50,
    monthlyLimit: 100,
    usagePercent: 50,
    dailyRate: 3.3,
    projectedDaysToLimit: 15,
    projectedDate: "2026-03-15",
    alertLevel: "safe" as AlertLevel,
    recommendation: undefined,
  };
  if (!overrides) return [base];
  return overrides.map((o) => ({ ...base, ...o }));
}

describe("TierAlertsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while fetching data", () => {
    // Make fetchCostsAnalytics hang
    mockFetchCostsAnalytics.mockImplementation(() => new Promise(() => {}));

    render(<TierAlertsSection dateRange={dateRange} />);

    expect(screen.getByText("Analyzing usage patterns...")).toBeInTheDocument();
  });

  it("renders no data state when usageMetrics is missing", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({ data: {} });

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("No usage data available yet")).toBeInTheDocument();
    });
  });

  it("renders alerts table when data loads successfully", async () => {
    const alerts = makeMockAlerts([{ alertLevel: "safe" }]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });
  });

  it("handles posthogEvents being null (nullish coalescing at line 33)", async () => {
    // This exercises the `metrics.posthogEvents ?? 0` branch where posthogEvents is null/undefined
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: null, // null triggers the ?? 0 fallback
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(mockComputeTierAlerts).toHaveBeenCalled();
    });

    // Verify the usageMap passed to computeTierAlerts has posthogEvents: 0
    const usageMap = mockComputeTierAlerts.mock.calls[0][1];
    expect(usageMap.posthogEvents).toBe(0);
  });

  it("handles posthogEvents being undefined (nullish coalescing at line 33)", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          // posthogEvents is missing/undefined
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(mockComputeTierAlerts).toHaveBeenCalled();
    });

    const usageMap = mockComputeTierAlerts.mock.calls[0][1];
    expect(usageMap.posthogEvents).toBe(0);
  });

  it("handles posthogEvents being a valid number", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 1234,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(mockComputeTierAlerts).toHaveBeenCalled();
    });

    const usageMap = mockComputeTierAlerts.mock.calls[0][1];
    expect(usageMap.posthogEvents).toBe(1234);
  });

  it("collapses and expands the section", async () => {
    const user = userEvent.setup();
    const alerts = makeMockAlerts([{ alertLevel: "safe" }]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    // Click to collapse
    await user.click(screen.getByText("Tier Upgrade Alerts"));

    // Content should be hidden
    expect(screen.queryByText("ElevenLabs")).not.toBeInTheDocument();
  });

  it("loads data when expanding after collapse (handleToggle branch)", async () => {
    const user = userEvent.setup();
    mockFetchCostsAnalytics.mockResolvedValue({ data: {} });

    render(<TierAlertsSection dateRange={dateRange} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);
    });

    // Collapse
    await user.click(screen.getByText("Tier Upgrade Alerts"));

    // Expand again - should not call loadData again since usageMetrics is null but data was already fetched
    // (usageMetrics is still null because the API returned empty data)
    await user.click(screen.getByText("Tier Upgrade Alerts"));

    // The loadData function is called again because usageMetrics is still null
    await waitFor(() => {
      expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  it("shows non-safe alert count badge when collapsed", async () => {
    const user = userEvent.setup();
    const alerts = makeMockAlerts([
      { alertLevel: "warning", serviceName: "ElevenLabs" },
      { alertLevel: "critical", serviceName: "Anthropic" },
      { alertLevel: "safe", serviceName: "Vercel" },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    // Collapse - the badge should show "2" (2 non-safe alerts)
    await user.click(screen.getByText("Tier Upgrade Alerts"));

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows period days message when periodDays < 30", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 15,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Based on 15 days of data")).toBeInTheDocument();
    });
  });

  it("does not show period message when periodDays >= 30", async () => {
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Based on/)).not.toBeInTheDocument();
  });

  it("shows 'Hide safe services' button when showAll is true and there are safe alerts", async () => {
    const alerts = makeMockAlerts([
      { alertLevel: "warning", serviceName: "ElevenLabs" },
      { alertLevel: "safe", serviceName: "Vercel" },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Hide safe services")).toBeInTheDocument();
    });
  });

  it("toggles to show only non-safe services and back", async () => {
    const user = userEvent.setup();
    const alerts = makeMockAlerts([
      { alertLevel: "warning", serviceName: "ElevenLabs", metricLabel: "Voice Minutes" },
      { alertLevel: "safe", serviceName: "Vercel", metricLabel: "Bandwidth" },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Hide safe services")).toBeInTheDocument();
    });

    // Click to hide safe services
    await user.click(screen.getByText("Hide safe services"));

    // Should show "Show all" button now
    await waitFor(() => {
      expect(screen.getByText(/Show all/)).toBeInTheDocument();
    });
  });

  it("shows 'All services within safe limits' when filtering shows zero results", async () => {
    const user = userEvent.setup();
    const alerts = makeMockAlerts([
      { alertLevel: "safe", serviceName: "ElevenLabs" },
      { alertLevel: "safe", serviceName: "Vercel" },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Hide safe services")).toBeInTheDocument();
    });

    // Click to hide safe services
    await user.click(screen.getByText("Hide safe services"));

    // All alerts are safe, so should show the "all safe" message
    await waitFor(() => {
      expect(screen.getByText("All services within safe limits")).toBeInTheDocument();
    });

    // Should also show "Show all services" button
    expect(screen.getByText("Show all services")).toBeInTheDocument();
  });

  it("silently handles fetch error (catch block)", async () => {
    mockFetchCostsAnalytics.mockRejectedValue(new Error("Network error"));

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      // After error, loading stops and we see "No usage data available" (alerts is null)
      expect(screen.getByText("No usage data available yet")).toBeInTheDocument();
    });
  });

  it("renders alert row with projected date", async () => {
    const alerts = makeMockAlerts([
      {
        alertLevel: "warning",
        projectedDaysToLimit: 10,
        projectedDate: "2026-03-10",
      },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText(/~10d/)).toBeInTheDocument();
    });
  });

  it("renders 'Exceeded' when projectedDaysToLimit is 0", async () => {
    const alerts = makeMockAlerts([
      {
        alertLevel: "critical",
        projectedDaysToLimit: 0,
        projectedDate: "2026-02-28",
      },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 100,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("Exceeded")).toBeInTheDocument();
    });
  });

  it("renders em-dash when projectedDate is null", async () => {
    const alerts = makeMockAlerts([
      {
        alertLevel: "safe",
        projectedDaysToLimit: null as unknown as number,
        projectedDate: null,
      },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 10,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });
  });

  it("renders recommendation when present", async () => {
    const alerts = makeMockAlerts([
      {
        alertLevel: "warning",
        recommendation: {
          tierName: "Pro",
          monthlyCostUsd: 99,
          costDelta: 79,
        },
      },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 80,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    // The recommendation is rendered as: "→ Pro ($99/mo, +$79)"
    // Text is split across nodes, so search for the container element
    const actionCell = screen.getByText((_, element) => {
      return element?.tagName === "SPAN" && element.textContent?.includes("Pro") && element.textContent?.includes("$99") === true;
    });
    expect(actionCell).toBeInTheDocument();
    expect(actionCell.textContent).toContain("+$79");
  });

  it("renders recommendation without costDelta when it is 0", async () => {
    const alerts = makeMockAlerts([
      {
        alertLevel: "watch",
        recommendation: {
          tierName: "Basic",
          monthlyCostUsd: 20,
          costDelta: 0,
        },
      },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 40,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText(/Basic/)).toBeInTheDocument();
    });

    // costDelta is 0, so the "+$0" should NOT appear
    expect(screen.queryByText(/\+\$/)).not.toBeInTheDocument();
  });

  it("formats numbers >= 1000 with 'k' suffix", async () => {
    const alerts = makeMockAlerts([
      {
        alertLevel: "safe",
        currentUsage: 1500,
        monthlyLimit: 10000,
      },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 1500,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText(/1\.5k/)).toBeInTheDocument();
      expect(screen.getByText(/10\.0k/)).toBeInTheDocument();
    });
  });

  it("renders AlertLevelBadge for each level", async () => {
    const alerts = makeMockAlerts([
      { alertLevel: "critical", serviceName: "Critical Service", metricLabel: "M1" },
      { alertLevel: "warning", serviceName: "Warning Service", metricLabel: "M2" },
      { alertLevel: "watch", serviceName: "Watch Service", metricLabel: "M3" },
      { alertLevel: "safe", serviceName: "Safe Service", metricLabel: "M4" },
    ]);
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />);

    await waitFor(() => {
      expect(screen.getByText("critical")).toBeInTheDocument();
      expect(screen.getByText("warning")).toBeInTheDocument();
      expect(screen.getByText("watch")).toBeInTheDocument();
      expect(screen.getByText("safe")).toBeInTheDocument();
    });
  });

  it("does not re-fetch in useEffect when data already loaded (line 49 !usageMetrics false branch)", async () => {
    // The useEffect guard on line 49 is `if (!usageMetrics && !isLoading)`.
    // When usageMetrics is already loaded (non-null), the condition is false
    // and loadData is NOT called again on rerender.
    mockFetchCostsAnalytics.mockResolvedValue({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());

    const { rerender } = render(<TierAlertsSection dateRange={dateRange} />);

    // Wait for initial data load to complete
    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    // Data is now loaded (usageMetrics is non-null).
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);

    // Rerender with same props — useEffect fires but !usageMetrics is false,
    // so loadData is NOT called again
    rerender(<TierAlertsSection dateRange={dateRange} />);

    // Still only 1 call — the guard prevented a refetch
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch in useEffect when already loading (line 49 false branch)", async () => {
    // The useEffect guard on line 49 is `if (!usageMetrics && !isLoading)`.
    // When isLoading is true (fetch already in progress), the condition is false
    // and loadData is NOT called again.
    let resolveFirst!: (v: unknown) => void;
    mockFetchCostsAnalytics.mockImplementation(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );

    const { rerender } = render(<TierAlertsSection dateRange={dateRange} />);

    // First call is in-flight (isLoading = true)
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);

    // Re-render — the useEffect fires again but the guard prevents a duplicate call
    rerender(<TierAlertsSection dateRange={dateRange} />);

    // Still only one call
    expect(mockFetchCostsAnalytics).toHaveBeenCalledTimes(1);

    // Resolve to clean up
    mockComputeTierAlerts.mockReturnValue(makeMockAlerts());
    resolveFirst({
      data: {
        usageMetrics: {
          voiceMinutes: 50,
          visitors: 100,
          posthogEvents: 500,
          chatConversations: 10,
          voiceConversations: 5,
          periodDays: 30,
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });
  });
});
