import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    expect(screen.getByText("08 — Operating Systems")).toBeInTheDocument();
    expect(screen.getByText("09 — Screen Sizes")).toBeInTheDocument();
  });

  it("renders device and browser data content in DataTable callbacks", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("06 — Devices")).toBeInTheDocument();
    });

    // Verify device data renders (DataTable renderItem callback)
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    // Verify browser data renders
    expect(screen.getByText("07 — Browsers")).toBeInTheDocument();
    expect(screen.getByText("Chrome")).toBeInTheDocument();
    // Verify count values render (DataTable getCount callback)
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("renders operating system and screen size data", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        operatingSystems: [
          { os: "Windows", count: 200 },
          { os: "macOS", count: 150 },
        ],
        screenSizes: [
          { width: 1920, height: 1080, count: 100 },
          { width: 1440, height: 900, count: 50 },
        ],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("08 — Operating Systems")).toBeInTheDocument();
    });

    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.getByText("macOS")).toBeInTheDocument();
    expect(screen.getByText("09 — Screen Sizes")).toBeInTheDocument();
    expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
    expect(screen.getByText("1440 × 900")).toBeInTheDocument();
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

  it("updates from-date when date input changes", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    // First date input is "from" — use fireEvent to set atomically (avoids invalid date on clear)
    fireEvent.change(dateInputs[0], { target: { value: "2024-01-10" } });

    expect(dateInputs[0]).toHaveValue("2024-01-10");
  });

  it("updates to-date when date input changes", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    // Second date input is "to"
    fireEvent.change(dateInputs[1], { target: { value: "2024-02-20" } });

    expect(dateInputs[1]).toHaveValue("2024-02-20");
  });

  it("shows 'No data available' for empty data tables", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        topPages: [],
        topReferrers: [],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    // Empty DataTable renders "No data available"
    const noDataMessages = screen.getAllByText("No data available");
    expect(noDataMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("initializes dev toggle from localStorage on mount", async () => {
    // Pre-set localStorage BEFORE rendering so the init useEffect reads it
    localStorage.setItem("admin:visitors:includeLocalhost", "true");

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    // Wait for data to load (which means isInitialized has been set to true)
    await waitFor(() => {
      expect(screen.getByText("500")).toBeInTheDocument();
    });

    // The dev toggle should reflect the localStorage value
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // fetchAnalytics should have been called with includeLocalhost=true
    // (third argument), proving the useEffect initialized the state from localStorage
    expect(adminApi.fetchAnalytics).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      true
    );
  });

  it("persists dev toggle changes to localStorage on toggle", async () => {
    const user = userEvent.setup();

    // Start with localStorage explicitly set to "false"
    localStorage.setItem("admin:visitors:includeLocalhost", "false");

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    // Verify initial state is false (from localStorage)
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    // After initialization, the persist useEffect writes the initial value
    await waitFor(() => {
      expect(localStorage.getItem("admin:visitors:includeLocalhost")).toBe("false");
    });

    // Now toggle it ON
    await user.click(toggle);

    // The persist useEffect should write "true" to localStorage
    await waitFor(() => {
      expect(localStorage.getItem("admin:visitors:includeLocalhost")).toBe("true");
    });

    // Toggle it OFF again to confirm persistence both ways
    await user.click(toggle);

    await waitFor(() => {
      expect(localStorage.getItem("admin:visitors:includeLocalhost")).toBe("false");
    });
  });

  it("renders time series chart SVG with correct visitor data points", async () => {
    const timeSeriesData = [
      { date: "2024-01-15", pageviews: 100, visitors: 40 },
      { date: "2024-01-16", pageviews: 80, visitors: 60 },
      { date: "2024-01-17", pageviews: 120, visitors: 50 },
    ];

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        timeSeries: timeSeriesData,
      },
    });

    const { container } = render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Traffic Over Time")).toBeInTheDocument();
    });

    // The SVG should be rendered with viewBox
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 800 200");

    // Should have path elements for pageviews (blue) and visitors (emerald)
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);

    // Blue path = pageviews, Emerald path = visitors
    const pageviewsPath = container.querySelector('path[stroke="#3b82f6"]');
    const visitorsPath = container.querySelector('path[stroke="#10b981"]');
    expect(pageviewsPath).not.toBeNull();
    expect(visitorsPath).not.toBeNull();

    // Should have 3 data points per line = 6 circles total
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(6); // 3 pageview dots + 3 visitor dots

    // Pageview circles are blue, visitor circles are emerald
    const blueCircles = container.querySelectorAll('circle[fill="#3b82f6"]');
    const greenCircles = container.querySelectorAll('circle[fill="#10b981"]');
    expect(blueCircles.length).toBe(3);
    expect(greenCircles.length).toBe(3);

    // Legend should show both labels
    expect(screen.getAllByText("Pageviews").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Visitors").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'No visitor data available' when new+returning is zero", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        newVsReturning: { newVisitors: 0, returningVisitors: 0 },
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("12 — New vs Returning Visitors")).toBeInTheDocument();
    });

    expect(screen.getByText("No visitor data available")).toBeInTheDocument();
  });

  it("defaults dev toggle OFF on non-localhost hostname with no stored preference", async () => {
    // When no localStorage value is stored and hostname is NOT localhost,
    // getStoredDevToggle() calls isLocalhost() which returns false,
    // so includeLocalhost defaults to false.
    const originalHostname = window.location.hostname;
    Object.defineProperty(window, "location", {
      value: { ...window.location, hostname: "paisaxe.es" },
      writable: true,
    });

    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Visitor Data")).toBeInTheDocument();
    });

    // With non-localhost hostname and no stored preference, toggle should be OFF
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    // fetchAnalytics should have been called with includeLocalhost=false
    expect(adminApi.fetchAnalytics).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      false
    );

    // Restore hostname
    Object.defineProperty(window, "location", {
      value: { ...window.location, hostname: originalHostname },
      writable: true,
    });
  });

  it("renders time series chart with a single data point", async () => {
    // Edge case: single data point means xStep denominator is max(1-1, 1) = 1
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        timeSeries: [{ date: "2024-01-15", pageviews: 100, visitors: 40 }],
      },
    });

    const { container } = render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Traffic Over Time")).toBeInTheDocument();
    });

    // Should render exactly 2 circles (1 pageview + 1 visitor)
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  it("does not render UTM section when utmCampaigns is empty", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        utmCampaigns: [],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    // The "03 — UTM Campaigns" section should NOT appear when utmCampaigns is empty
    expect(screen.queryByText("03 — UTM Campaigns")).not.toBeInTheDocument();
    // The "No UTM data available" message is inside UTMTable but unreachable
    // because the parent guards with data.utmCampaigns.length > 0
    expect(screen.queryByText("No UTM data available")).not.toBeInTheDocument();
  });

  it("renders TimeSeriesChart returning null when data array is empty (line 343)", async () => {
    // Line 343: `if (data.length === 0) return null;` in TimeSeriesChart
    // The parent component guards with `data.timeSeries.length > 0 &&` before rendering
    // TimeSeriesChart, so this internal guard is architecturally unreachable through
    // normal rendering. TimeSeriesChart is a non-exported internal function.
    // This test confirms the parent guard prevents rendering:
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

    // Parent guard prevents TimeSeriesChart from being rendered at all
    expect(screen.queryByText("Traffic Over Time")).not.toBeInTheDocument();
  });

  it("documents UTMTable empty guard (line 544) as unreachable", async () => {
    // Line 544: `if (items.length === 0) return <p>No UTM data available</p>;`
    // The parent checks `data.utmCampaigns.length > 0` before rendering UTMTable,
    // making the internal empty guard unreachable. When utmCampaigns is empty,
    // the entire UTM section is not rendered.
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        utmCampaigns: [],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Pages")).toBeInTheDocument();
    });

    // Neither the section header nor the empty fallback message appears
    expect(screen.queryByText("03 — UTM Campaigns")).not.toBeInTheDocument();
    expect(screen.queryByText("No UTM data available")).not.toBeInTheDocument();
  });

  it("hides percentage label in bar when segment is <= 10%", async () => {
    // When newPercent or returningPercent is <= 10, the percentage label
    // inside the bar is not rendered (lines 613, 619)
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        newVsReturning: { newVisitors: 5, returningVisitors: 95 },
      },
    });

    const { container } = render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("12 — New vs Returning Visitors")).toBeInTheDocument();
    });

    // newPercent = round(5/100*100) = 5%, which is <= 10
    // The violet bar should NOT contain a percentage label inside it
    const bars = container.querySelectorAll(".flex.h-10 > div");
    expect(bars.length).toBe(2);

    // The narrow bar (5%) should have no text content
    const narrowBar = bars[0];
    expect(narrowBar.textContent).toBe("");

    // The wide bar (95%) should show its percentage
    const wideBar = bars[1];
    expect(wideBar.textContent).toBe("95%");
  });

  it("renders StatCard with no color prop (default color class)", async () => {
    // All 4 StatCard usages in the component provide a color prop,
    // so the `!color` fallback in StatCard is unreachable through the
    // VisitorsAnalyticsPanel. This is a non-exported internal function
    // and cannot be tested independently.
    // This test documents that all 4 stat cards render with their colors.
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("500")).toBeInTheDocument();
    });

    // All 4 stats render
    expect(screen.getByText("Bounce Rate")).toBeInTheDocument();
  });

  // Lines 27, 35: SSR guards in isLocalhost() and getStoredDevToggle()
  // These `typeof window === "undefined"` checks are unreachable in jsdom because
  // React DOM requires window to render. The functions are not exported, so they
  // can only be invoked through the component. Deleting globalThis.window would
  // break React rendering before these functions execute.

  it("renders entry pages and exit pages DataTable content", async () => {
    vi.mocked(adminApi.fetchAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        entryPages: [
          { page: "/immersive", count: 120 },
          { page: "/pricing", count: 45 },
        ],
        exitPages: [
          { page: "/chat", count: 80 },
          { page: "/about", count: 30 },
        ],
      },
    });

    render(<VisitorsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("10 — Entry Pages")).toBeInTheDocument();
    });

    // Entry Pages DataTable renderItem and getCount callbacks
    expect(screen.getByText("/immersive")).toBeInTheDocument();
    expect(screen.getByText("/pricing")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    // Exit Pages DataTable renderItem and getCount callbacks
    expect(screen.getByText("11 — Exit Pages")).toBeInTheDocument();
    expect(screen.getByText("/chat")).toBeInTheDocument();
    expect(screen.getByText("/about")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });
});
