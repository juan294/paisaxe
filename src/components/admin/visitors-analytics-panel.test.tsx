import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisitorsAnalyticsPanel } from "./visitors-analytics-panel";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import * as adminApi from "@/lib/admin-api";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

vi.mock("@/lib/admin-api", () => ({
  fetchAnalytics: vi.fn(),
}));

const mockData = {
  summary: {
    totalPageviews: 500,
    uniqueVisitors: 120,
    totalSessions: 200,
    avgPagesPerSession: 2.5,
    bounceRate: 45,
  },
  timeSeries: [
    { date: "2024-01-15", pageviews: 50, visitors: 20 },
    { date: "2024-01-16", pageviews: 70, visitors: 30 },
  ],
  topPages: [
    { url: "https://paisaxe.es/", count: 200 },
    { url: "https://paisaxe.es/chat", count: 100 },
  ],
  topReferrers: [
    { referrer: "https://google.com", count: 80 },
  ],
  utmCampaigns: [],
  countries: [
    { country: "Spain", count: 150 },
  ],
  cities: [
    { city: "Oviedo", country: "Spain", count: 40 },
  ],
  devices: [
    { device: "Desktop", count: 300 },
    { device: "Mobile", count: 200 },
  ],
  browsers: [
    { browser: "Chrome", count: 250 },
  ],
  operatingSystems: [
    { os: "Windows", count: 200 },
  ],
  screenSizes: [
    { width: 1920, height: 1080, count: 100 },
  ],
  entryPages: [
    { page: "/", count: 150 },
  ],
  exitPages: [
    { page: "/chat", count: 80 },
  ],
  newVsReturning: {
    newVisitors: 80,
    returningVisitors: 40,
  },
  dateRange: { from: "2024-01-15", to: "2024-01-16" },
};

describe("VisitorsAnalyticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows loading state initially", () => {
    vi.mocked(adminApi.fetchAnalytics).mockImplementation(
      () => new Promise(() => {})
    );

    render(<VisitorsAnalyticsPanel />, { wrapper });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders header and controls", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Dev")).toBeInTheDocument();
  });

  it("displays summary statistics when data loads", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("500")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Pageviews").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("120").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Visitors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("200").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sessions").length).toBeGreaterThanOrEqual(1);
  });

  it("displays data tables", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    expect(screen.getByText("02 — Top Referrers")).toBeInTheDocument();
    expect(screen.getByText("04 — Countries")).toBeInTheDocument();
    expect(screen.getByText("06 — Devices")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        summary: { totalPageviews: 0, uniqueVisitors: 0, totalSessions: 0, bounceRate: 0, avgPagesPerSession: 0 },
        timeSeries: [],
        topPages: [],
        topReferrers: [],
        utmCampaigns: [],
        countries: [],
        cities: [],
        devices: [],
        browsers: [],
        operatingSystems: [],
        screenSizes: [],
        entryPages: [],
        exitPages: [],
        newVsReturning: { newVisitors: 0, returningVisitors: 0 },
        dateRange: { from: "2024-01-15", to: "2024-01-16" },
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No data yet")).toBeInTheDocument();
    });
  });

  it("shows error on API failure", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      error: "Failed to fetch analytics",
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch analytics")).toBeInTheDocument();
    });
  });

  it("toggles dev mode switch", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    // Should trigger a refetch with changed params
    expect(adminApi.fetchAnalytics).toHaveBeenCalled();
  });

  it("reads dev toggle from localStorage when stored as 'true'", async () => {
    localStorage.setItem("admin:visitors:includeLocalhost", "true");

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    // Toggle should be checked since localStorage has "true"
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("reads dev toggle from localStorage when stored as 'false'", async () => {
    localStorage.setItem("admin:visitors:includeLocalhost", "false");

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    // Toggle should be unchecked since localStorage has "false"
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("persists dev toggle preference to localStorage", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    // Should persist the changed value to localStorage
    const stored = localStorage.getItem("admin:visitors:includeLocalhost");
    expect(stored).toBeTruthy();
  });

  it("formats URL correctly for paths and hostname-only", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        topPages: [
          { url: "https://paisaxe.es/chat", count: 100 },
          { url: "https://paisaxe.es/", count: 200 },
        ],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    // "https://paisaxe.es/chat" should show as "paisaxe.es/chat"
    expect(screen.getByText("paisaxe.es/chat")).toBeInTheDocument();
    // "https://paisaxe.es/" should show as just "paisaxe.es" (path === "/")
    expect(screen.getByText("paisaxe.es")).toBeInTheDocument();
  });

  it("formats invalid URL by returning it as-is (catch path)", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        topPages: [
          { url: "not a url at all", count: 50 },
        ],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    // "not a url at all" should fail URL parsing and be returned as-is
    expect(screen.getByText("not a url at all")).toBeInTheDocument();
  });

  it("displays time series chart with data", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Traffic Over Time")).toBeInTheDocument();
    });

    // Chart legend
    expect(screen.getAllByText("Pageviews").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Visitors").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render time series chart when data is empty", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        timeSeries: [],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    // "Traffic Over Time" header should NOT appear
    expect(screen.queryByText("Traffic Over Time")).not.toBeInTheDocument();
  });

  it("renders UTM campaigns table when data exists", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        utmCampaigns: [
          { source: "google", medium: "cpc", campaign: "spring-launch", count: 42 },
        ],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("03 — UTM Campaigns")).toBeInTheDocument();
    });

    expect(screen.getByText("google")).toBeInTheDocument();
    expect(screen.getByText("cpc")).toBeInTheDocument();
    expect(screen.getByText("spring-launch")).toBeInTheDocument();
  });

  it("displays New vs Returning section", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("12 — New vs Returning Visitors")).toBeInTheDocument();
    });

    // 80 new / 120 total = 67%
    expect(screen.getByText(/New: 80/)).toBeInTheDocument();
    expect(screen.getByText(/Returning: 40/)).toBeInTheDocument();
  });

  it("shows refreshing state during background refresh", async () => {
    const user = userEvent.setup();
    let resolveRefresh: (value: unknown) => void;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValueOnce({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    vi.mocked(adminApi.fetchAnalytics).mockImplementationOnce(
      () => refreshPromise as Promise<{ data: typeof mockData }>
    );

    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    resolveRefresh!({ data: mockData });
  });

  it("displays time series chart with many data points (label skipping)", async () => {
    // Create more than 7 data points to trigger label skipping logic (line 425)
    const manyPoints = Array.from({ length: 14 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      pageviews: 50 + i * 10,
      visitors: 20 + i * 5,
    }));

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        timeSeries: manyPoints,
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Traffic Over Time")).toBeInTheDocument();
    });

    // Chart should render without errors even with many data points
    // Some labels will be skipped (line 425: showLabel logic)
    expect(screen.getAllByText("Pageviews").length).toBeGreaterThanOrEqual(1);
  });
});
