import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostsAnalyticsPanel } from "./index";
import { TierAlertsSection } from "./alerts";
import { ScalingForecastSection } from "./forecast";
import { AnalyticsCacheProvider } from "../analytics-cache-context";
import type {
  CostsAnalyticsDashboardData,
  ServiceCost,
  UsageMetrics,
  ForecastScenario,
} from "@/types/costs-analytics";
import type { TierAlert } from "./types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/admin-api", () => ({
  fetchCostsAnalytics: vi.fn(),
  createManualCostEntry: vi.fn(),
  updateManualCostEntry: vi.fn(),
  deleteManualCostEntry: vi.fn(),
}));

vi.mock("@/lib/costs", () => ({
  computeTierAlerts: vi.fn(),
  computeForecasts: vi.fn(),
}));

vi.mock("@/config/service-tiers", () => ({
  SERVICE_TIERS: [
    {
      serviceId: "elevenlabs",
      serviceName: "ElevenLabs",
      currentTierName: "Creator",
      currentMonthlyCostUsd: 18.33,
      limits: [
        {
          metricKey: "voiceMinutes",
          label: "Voice Minutes",
          monthlyLimit: 100,
          unit: "min",
        },
      ],
      nextTier: {
        tierName: "Scale",
        monthlyCostUsd: 99,
        notes: "500 min/mo",
      },
    },
    {
      serviceId: "vercel",
      serviceName: "Vercel",
      currentTierName: "Hobby",
      currentMonthlyCostUsd: 0,
      limits: [
        {
          metricKey: "visitors",
          label: "Monthly Visitors",
          monthlyLimit: 50000,
          unit: "visitors",
        },
      ],
      nextTier: {
        tierName: "Pro",
        monthlyCostUsd: 20,
        notes: "Unlimited bandwidth",
      },
    },
  ],
}));

import * as adminApi from "@/lib/admin-api";
import * as costsLib from "@/lib/costs";

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

const dateRange = { from: "2026-01-01", to: "2026-01-31" };

function makeService(overrides: Partial<ServiceCost> = {}): ServiceCost {
  return {
    serviceId: "anthropic",
    serviceName: "Anthropic Claude",
    category: "ai",
    costUsd: 50.25,
    costFormatted: "$50.25",
    source: "api",
    billingPeriodStart: "2026-01-01",
    billingPeriodEnd: "2026-01-31",
    dashboardUrl: "https://console.anthropic.com/settings/cost",
    ...overrides,
  };
}

const mockServices: ServiceCost[] = [
  makeService(),
  makeService({
    serviceId: "twilio",
    serviceName: "Twilio",
    category: "communications",
    costUsd: 25.0,
    costFormatted: "$25.00",
    source: "api",
    dashboardUrl: "https://console.twilio.com",
  }),
  makeService({
    serviceId: "supabase",
    serviceName: "Supabase",
    category: "infrastructure",
    costUsd: 25.0,
    costFormatted: "$25.00",
    source: "manual",
    dashboardUrl: undefined,
  }),
];

const mockCostsData: CostsAnalyticsDashboardData = {
  summary: {
    totalMonthlyUsd: 125.75,
    totalMonthlyFormatted: "$125.75",
    thirtyDayUsd: 89.5,
    thirtyDayFormatted: "$89.50",
    servicesTracked: 4,
    automatedServices: 2,
  },
  services: mockServices,
  costsByDay: [
    { date: "2026-01-01", costUsd: 5.0 },
    { date: "2026-01-02", costUsd: 7.5 },
  ],
  dateRange,
};

const mockUsageMetrics: UsageMetrics = {
  visitors: 1200,
  chatConversations: 85,
  voiceConversations: 12,
  voiceMinutes: 35.5,
  periodDays: 15,
  posthogEvents: 5000,
};

function makeTierAlert(overrides: Partial<TierAlert> = {}): TierAlert {
  return {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    currentTierName: "Creator",
    metricLabel: "Voice Minutes",
    currentUsage: 71,
    monthlyLimit: 100,
    unit: "min",
    usagePercent: 71,
    dailyRate: 2.37,
    projectedDaysToLimit: 12,
    projectedDate: "2026-02-12",
    alertLevel: "warning",
    recommendation: {
      tierName: "Scale",
      monthlyCostUsd: 99,
      costDelta: 80.67,
    },
    ...overrides,
  };
}

const mockForecasts: ForecastScenario[] = [
  {
    label: "Current",
    multiplier: 1,
    visitors: 2400,
    chats: 170,
    voiceConversations: 24,
    voiceMinutes: 71,
    estimatedMonthlyCost: 65.5,
    breakdown: { infrastructure: 25, ai: 30.5, voice: 10 },
  },
  {
    label: "3x Growth",
    multiplier: 3,
    visitors: 7200,
    chats: 510,
    voiceConversations: 72,
    voiceMinutes: 213,
    estimatedMonthlyCost: 146.5,
    breakdown: { infrastructure: 25, ai: 91.5, voice: 30 },
  },
  {
    label: "10x Growth",
    multiplier: 10,
    visitors: 24000,
    chats: 1700,
    voiceConversations: 240,
    voiceMinutes: 710,
    estimatedMonthlyCost: 430,
    breakdown: { infrastructure: 25, ai: 305, voice: 100 },
  },
];

// ---------------------------------------------------------------------------
// CostsAnalyticsPanel
// ---------------------------------------------------------------------------

describe("CostsAnalyticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: alerts/forecast sub-sections call fetchCostsAnalytics with includeUsage
    // so we mock that too — returning no usageMetrics by default to keep tests focused
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: mockCostsData,
    });
  });

  it("renders loading skeleton when isLoading", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(<CostsAnalyticsPanel />, { wrapper });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders empty state when data has no services", async () => {
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

    expect(
      screen.getByText("Add manual costs or configure API keys")
    ).toBeInTheDocument();
    expect(screen.getByText("Add Manual Cost")).toBeInTheDocument();
  });

  it("renders stat cards, table, and chart when data is present", async () => {
    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("$125.75")).toBeInTheDocument();
    });

    // Stat cards
    expect(screen.getByText("Total Monthly")).toBeInTheDocument();
    expect(screen.getByText("$89.50")).toBeInTheDocument();
    expect(screen.getByText("30-Day Costs")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Services Tracked")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Auto-Tracked")).toBeInTheDocument();

    // Service breakdown table
    expect(
      screen.getAllByText("Anthropic Claude").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("$50.25")).toBeInTheDocument();
    expect(screen.getByText("Service Breakdown")).toBeInTheDocument();

    // Daily costs section header
    expect(screen.getByText("Daily Costs")).toBeInTheDocument();
  });

  it("renders Add Cost button when data is present", async () => {
    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Add Cost")).toBeInTheDocument();
    });
  });

  it("renders Refresh button and date range inputs", async () => {
    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    // The date separator "—" may appear multiple times (in date controls AND service table action columns)
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    // Two date inputs
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateInputs.length).toBe(2);
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

  it("handleAddCost success path — modal closes and refresh is called", async () => {
    const user = userEvent.setup();

    vi.mocked(adminApi.createManualCostEntry).mockResolvedValue({
      data: {
        id: "new-123",
        serviceId: "custom",
        serviceName: "Custom",
        category: "infrastructure" as const,
        costUsd: 10,
        billingPeriodStart: "2026-01-01",
        billingPeriodEnd: "2026-01-31",
        notes: null,
        createdBy: null,
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      },
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Add Cost")).toBeInTheDocument();
    });

    // Open the modal via section button
    await user.click(screen.getByText("Add Cost"));
    expect(screen.getByText("Add Manual Cost")).toBeInTheDocument();

    // The fetchCostsAnalytics was already called for initial load + sub-sections;
    // after add-cost, it should be called again (refresh)
    const initialCallCount = vi.mocked(adminApi.fetchCostsAnalytics).mock.calls
      .length;

    // Fill the form inside the modal
    const modal = screen.getByText("Add Manual Cost").closest("div.fixed")! as HTMLElement;
    const serviceSelect = within(modal).getByLabelText("Service");
    await user.selectOptions(serviceSelect, "anthropic");

    const costInput = within(modal).getByLabelText("Cost (USD)");
    await user.clear(costInput);
    await user.type(costInput, "10");

    // Submit — find the submit button inside the modal
    const submitBtn = within(modal).getByRole("button", { name: "Add Cost" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(adminApi.createManualCostEntry).toHaveBeenCalledTimes(1);
    });

    // Modal should close on success (Add Manual Cost heading disappears)
    await waitFor(() => {
      expect(screen.queryByText("Add Manual Cost")).not.toBeInTheDocument();
    });

    // Refresh was called (fetchCostsAnalytics called again)
    expect(vi.mocked(adminApi.fetchCostsAnalytics).mock.calls.length).toBeGreaterThan(
      initialCallCount
    );
  });

  it("handleAddCost error path — shows error message", async () => {
    const user = userEvent.setup();

    vi.mocked(adminApi.createManualCostEntry).mockResolvedValue({
      error: "Duplicate entry",
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Add Cost")).toBeInTheDocument();
    });

    // Open modal
    await user.click(screen.getByText("Add Cost"));

    // Fill minimal form inside modal
    const modal = screen.getByText("Add Manual Cost").closest("div.fixed")! as HTMLElement;
    const serviceSelect = within(modal).getByLabelText("Service");
    await user.selectOptions(serviceSelect, "anthropic");
    const costInput = within(modal).getByLabelText("Cost (USD)");
    await user.clear(costInput);
    await user.type(costInput, "10");

    const submitBtn = within(modal).getByRole("button", { name: "Add Cost" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Duplicate entry")).toBeInTheDocument();
    });
  });

  it("handleDeleteCost with confirm — calls delete and refreshes", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.mocked(adminApi.deleteManualCostEntry).mockResolvedValue({
      data: { id: "supabase-2026-01-01", deleted: true },
    });

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Supabase")).toBeInTheDocument();
    });

    // Supabase has source: "manual" so it shows delete button
    // Find the delete button (Trash2 icon button) in the row with Supabase
    // The ServiceBreakdownTable renders delete buttons for manual entries
    const supabaseRow = screen.getByText("Supabase").closest("tr")! as HTMLElement;
    const deleteButton = within(supabaseRow).getAllByRole("button").pop()!;
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      "Are you sure you want to delete this cost entry?"
    );

    await waitFor(() => {
      expect(adminApi.deleteManualCostEntry).toHaveBeenCalledTimes(1);
    });

    confirmSpy.mockRestore();
  });

  it("handleDeleteCost without confirm — does not delete", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Supabase")).toBeInTheDocument();
    });

    const supabaseRow = screen.getByText("Supabase").closest("tr")! as HTMLElement;
    const deleteButton = within(supabaseRow).getAllByRole("button").pop()!;
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(adminApi.deleteManualCostEntry).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("date range inputs update state", async () => {
    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("$125.75")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    const fromInput = dateInputs[0];
    const toInput = dateInputs[1];

    // Change the "from" date (wrapped in act to avoid React state-update warnings)
    await act(async () => {
      fireEvent.change(fromInput, { target: { value: "2026-02-01" } });
    });
    expect(fromInput).toHaveValue("2026-02-01");

    // Change the "to" date
    await act(async () => {
      fireEvent.change(toInput, { target: { value: "2026-02-28" } });
    });
    expect(toInput).toHaveValue("2026-02-28");
  });

  it("shows category badges correctly", async () => {
    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("ai")).toBeInTheDocument();
    });

    expect(screen.getByText("communications")).toBeInTheDocument();
    expect(screen.getByText("infrastructure")).toBeInTheDocument();
  });

  it("renders refreshing indicator when isRefreshing", async () => {
    let resolveFetch!: (v: { data: CostsAnalyticsDashboardData }) => void;
    const slowPromise = new Promise<{ data: CostsAnalyticsDashboardData }>((r) => {
      resolveFetch = r;
    });

    vi.mocked(adminApi.fetchCostsAnalytics)
      .mockResolvedValueOnce({ data: mockCostsData })
      .mockReturnValueOnce(slowPromise);

    render(<CostsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("$125.75")).toBeInTheDocument();
    });

    // Click refresh — triggers background revalidation
    fireEvent.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    resolveFetch({ data: mockCostsData });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// TierAlertsSection
// ---------------------------------------------------------------------------

describe("TierAlertsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText("Analyzing usage patterns...")
      ).toBeInTheDocument();
    });
  });

  it("renders 'no usage data' state when API returns no metrics", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: undefined,
      },
    });

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText("No usage data available yet")
      ).toBeInTheDocument();
    });
  });

  it("renders alerts table with data", async () => {
    const criticalAlert = makeTierAlert({
      serviceId: "elevenlabs",
      serviceName: "ElevenLabs",
      alertLevel: "critical",
      currentUsage: 95,
      usagePercent: 95,
      projectedDaysToLimit: 3,
      projectedDate: "2026-02-04",
      recommendation: {
        tierName: "Scale",
        monthlyCostUsd: 99,
        costDelta: 80.67,
      },
    });
    const safeAlert = makeTierAlert({
      serviceId: "vercel",
      serviceName: "Vercel",
      currentTierName: "Hobby",
      metricLabel: "Monthly Visitors",
      alertLevel: "safe",
      currentUsage: 500,
      monthlyLimit: 50000,
      usagePercent: 1,
      dailyRate: 16.67,
      projectedDaysToLimit: null,
      projectedDate: null,
      recommendation: undefined,
      unit: "visitors",
    });

    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: mockUsageMetrics,
      },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue([
      criticalAlert,
      safeAlert,
    ]);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    // Wait for alerts to render
    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    // Alert table should show service names
    expect(screen.getByText("Vercel")).toBeInTheDocument();

    // Metric labels
    expect(screen.getByText("Voice Minutes")).toBeInTheDocument();
    expect(screen.getByText("Monthly Visitors")).toBeInTheDocument();

    // Tier names
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("Hobby")).toBeInTheDocument();

    // Recommendation for critical alert
    expect(screen.getByText(/Scale/)).toBeInTheDocument();
  });

  it("shows alert level badges (critical, warning, watch, safe)", async () => {
    const alerts: TierAlert[] = [
      makeTierAlert({ alertLevel: "critical", serviceId: "a", serviceName: "Svc A", metricLabel: "M1" }),
      makeTierAlert({ alertLevel: "warning", serviceId: "b", serviceName: "Svc B", metricLabel: "M2" }),
      makeTierAlert({ alertLevel: "watch", serviceId: "c", serviceName: "Svc C", metricLabel: "M3", projectedDaysToLimit: 60, projectedDate: "2026-04-01", recommendation: undefined }),
      makeTierAlert({ alertLevel: "safe", serviceId: "d", serviceName: "Svc D", metricLabel: "M4", projectedDaysToLimit: null, projectedDate: null, recommendation: undefined }),
    ];

    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("critical")).toBeInTheDocument();
    });

    expect(screen.getByText("warning")).toBeInTheDocument();
    expect(screen.getByText("watch")).toBeInTheDocument();
    expect(screen.getByText("safe")).toBeInTheDocument();
  });

  it("toggles expand/collapse", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue([
      makeTierAlert(),
    ]);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    // Wait for content to load — it starts expanded
    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });

    // Click the toggle button to collapse
    const toggleButton = screen.getByRole("button", {
      name: /tier upgrade alerts/i,
    });
    fireEvent.click(toggleButton);

    // After collapsing, the table should be hidden
    expect(screen.queryByText("Voice Minutes")).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText("Voice Minutes")).toBeInTheDocument();
    });
  });

  it("shows non-safe alert count badge when collapsed", async () => {
    const alerts: TierAlert[] = [
      makeTierAlert({ alertLevel: "warning", serviceId: "el", serviceName: "EL" }),
      makeTierAlert({ alertLevel: "critical", serviceId: "v", serviceName: "V", metricLabel: "Visitors" }),
      makeTierAlert({ alertLevel: "safe", serviceId: "s", serviceName: "S", metricLabel: "Storage" }),
    ];

    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("EL")).toBeInTheDocument();
    });

    // Collapse the section
    const toggleButton = screen.getByRole("button", {
      name: /tier upgrade alerts/i,
    });
    fireEvent.click(toggleButton);

    // Badge should show the count of non-safe alerts (2)
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("show/hide safe services toggle works", async () => {
    const alerts: TierAlert[] = [
      makeTierAlert({
        alertLevel: "warning",
        serviceId: "el",
        serviceName: "ElevenLabs",
        metricLabel: "Voice Minutes",
      }),
      makeTierAlert({
        alertLevel: "safe",
        serviceId: "vercel",
        serviceName: "Vercel",
        currentTierName: "Hobby",
        metricLabel: "Monthly Visitors",
        projectedDaysToLimit: null,
        projectedDate: null,
        recommendation: undefined,
      }),
    ];

    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue(alerts);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    // Initially showAll is true — both services shown
    await waitFor(() => {
      expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    });
    expect(screen.getByText("Vercel")).toBeInTheDocument();

    // The "Hide safe services" link should be visible
    const hideLink = screen.getByText("Hide safe services");
    fireEvent.click(hideLink);

    // Now safe service (Vercel) should be hidden
    expect(screen.queryByText("Vercel")).not.toBeInTheDocument();
    // Warning service should remain
    expect(screen.getByText("ElevenLabs")).toBeInTheDocument();

    // "Show all" link should be visible with count
    const showLink = screen.getByText(/Show all/);
    fireEvent.click(showLink);

    // Vercel should be back
    expect(screen.getByText("Vercel")).toBeInTheDocument();
  });

  it("shows period-days note when < 30 days", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: { ...mockUsageMetrics, periodDays: 10 },
      },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue([makeTierAlert()]);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Based on 10 days of data/)).toBeInTheDocument();
    });
  });

  it("renders 'Exceeded' when projectedDaysToLimit is 0", async () => {
    const exceededAlert = makeTierAlert({
      alertLevel: "critical",
      projectedDaysToLimit: 0,
      projectedDate: "2026-01-20",
    });

    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue([exceededAlert]);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Exceeded")).toBeInTheDocument();
    });
  });

  it("renders dash when projectedDate is null", async () => {
    const safeAlert = makeTierAlert({
      alertLevel: "safe",
      projectedDaysToLimit: null,
      projectedDate: null,
      recommendation: undefined,
    });

    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeTierAlerts).mockReturnValue([safeAlert]);

    render(<TierAlertsSection dateRange={dateRange} />, { wrapper });

    // The dash character appears in Projected Limit and Action columns
    await waitFor(() => {
      // Multiple dashes: one for projected limit, one for action (no recommendation)
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---------------------------------------------------------------------------
// ScalingForecastSection
// ---------------------------------------------------------------------------

describe("ScalingForecastSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText("Loading usage data...")).toBeInTheDocument();
    });
  });

  it("renders 'no usage data' state when API returns no metrics", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: undefined,
      },
    });

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(
        screen.getByText("No usage data available yet")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Chat events will appear after users interact with the chat")
    ).toBeInTheDocument();
  });

  it("renders reality table with metrics", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: mockUsageMetrics,
      },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    // Wait for reality table
    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    // Reality table rows
    expect(screen.getByText("Visitors")).toBeInTheDocument();
    expect(screen.getByText("Chat Conversations")).toBeInTheDocument();
    expect(screen.getByText("Voice Sessions")).toBeInTheDocument();
    // "Voice Minutes" appears in both reality table and forecast table
    expect(screen.getAllByText("Voice Minutes").length).toBeGreaterThanOrEqual(1);

    // Table headers
    expect(screen.getByText("Metric")).toBeInTheDocument();
    expect(screen.getByText("This Period")).toBeInTheDocument();
    expect(screen.getByText("Monthly Rate")).toBeInTheDocument();
  });

  it("renders forecast table with scenarios", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText("Growth Projections")).toBeInTheDocument();
    });

    // Scenario column headers
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("3x Growth")).toBeInTheDocument();
    expect(screen.getByText("10x Growth")).toBeInTheDocument();

    // Forecast rows
    expect(screen.getByText("Monthly Visitors")).toBeInTheDocument();
    expect(screen.getByText("Chats")).toBeInTheDocument();
    // "Voice Minutes" already in reality table, check forecast also has it
    // Infrastructure row
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("AI (Claude)")).toBeInTheDocument();
    expect(screen.getByText("Voice (ElevenLabs)")).toBeInTheDocument();
    expect(screen.getByText("Est. Monthly")).toBeInTheDocument();
  });

  it("toggles expand/collapse", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    // Collapse
    const toggleButton = screen.getByRole("button", {
      name: /scaling forecast/i,
    });
    fireEvent.click(toggleButton);

    // Content should disappear
    expect(screen.queryByText("Current Period Reality")).not.toBeInTheDocument();
    expect(screen.queryByText("Growth Projections")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });
  });

  it("shows period days note when < 30 days", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: { ...mockUsageMetrics, periodDays: 12 },
      },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(
        screen.getByText(/based on 12 days of data/i)
      ).toBeInTheDocument();
    });
  });

  it("does not show period days note when >= 30 days", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: {
        ...mockCostsData,
        usageMetrics: { ...mockUsageMetrics, periodDays: 30 },
      },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    expect(screen.queryByText(/based on.*days of data/i)).not.toBeInTheDocument();
  });

  it("does not render forecast table when computeForecasts returns empty", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue([]);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText("Current Period Reality")).toBeInTheDocument();
    });

    // Growth Projections should NOT be present when no forecasts
    expect(screen.queryByText("Growth Projections")).not.toBeInTheDocument();
  });

  it("calls computeForecasts with services and usage metrics", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(costsLib.computeForecasts).toHaveBeenCalledWith(
        mockServices,
        mockUsageMetrics
      );
    });
  });

  it("renders actual usage numbers in reality table", async () => {
    vi.mocked(adminApi.fetchCostsAnalytics).mockResolvedValue({
      data: { ...mockCostsData, usageMetrics: mockUsageMetrics },
    });
    vi.mocked(costsLib.computeForecasts).mockReturnValue(mockForecasts);

    render(
      <ScalingForecastSection services={mockServices} dateRange={dateRange} />,
      { wrapper }
    );

    await waitFor(() => {
      // visitors: 1200, shown with toLocaleString
      expect(screen.getByText("1,200")).toBeInTheDocument();
    });

    // chatConversations: 85
    expect(screen.getByText("85")).toBeInTheDocument();
    // voiceConversations: 12
    expect(screen.getByText("12")).toBeInTheDocument();
    // voiceMinutes: 35.5 with decimals=1 -> "35.5"
    expect(screen.getByText("35.5")).toBeInTheDocument();
  });
});
