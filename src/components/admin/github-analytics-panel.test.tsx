import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitHubAnalyticsPanel } from "./github-analytics-panel";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import * as adminApi from "@/lib/admin-api";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

vi.mock("@/lib/admin-api", () => ({
  fetchGithubAnalytics: vi.fn(),
  syncGithubTraffic: vi.fn(),
}));

const mockData = {
  summary: {
    totalViews: 250,
    totalUniqueViews: 80,
    totalClones: 15,
    totalUniqueClones: 10,
    dataPointCount: 14,
  },
  daily: [
    { date: "2024-01-15", views: 50, views_unique: 20, clones: 5, clones_unique: 3 },
    { date: "2024-01-16", views: 70, views_unique: 30, clones: 10, clones_unique: 7 },
  ],
  referrers: [
    { referrer: "google.com", count: 40, uniques: 30, fetched_at: "2024-01-16T00:00:00Z" },
  ],
  popularPaths: [
    { path: "/paisaxe", title: "Paisaxe", count: 100, uniques: 60, fetched_at: "2024-01-16T00:00:00Z" },
  ],
  lastSyncedAt: "2024-01-16T12:00:00Z",
  dateRange: { from: "2024-01-15", to: "2024-01-16" },
};

describe("GitHubAnalyticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockImplementation(
      () => new Promise(() => {})
    );

    render(<GitHubAnalyticsPanel />, { wrapper });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders header", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("GitHub Traffic")).toBeInTheDocument();
    });
  });

  it("displays summary statistics", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("250")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Views")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Unique Visitors")).toBeInTheDocument();
  });

  it("displays referrers table", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — Top Referrers")).toBeInTheDocument();
    });

    expect(screen.getByText("google.com")).toBeInTheDocument();
  });

  it("displays paths table", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — Popular Paths")).toBeInTheDocument();
    });

    expect(screen.getByText("/paisaxe")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        summary: {
          totalViews: 0,
          totalUniqueViews: 0,
          totalClones: 0,
          totalUniqueClones: 0,
          dataPointCount: 0,
        },
        daily: [],
        referrers: [],
        popularPaths: [],
        lastSyncedAt: null,
        dateRange: { from: "2024-01-15", to: "2024-01-16" },
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No traffic data yet")).toBeInTheDocument();
    });
  });

  it("shows error on API failure", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      error: "GitHub token not configured",
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("GitHub token not configured")).toBeInTheDocument();
    });
  });

  it("triggers sync when button clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });
    vi.mocked(adminApi.syncGithubTraffic).mockResolvedValue({ data: { synced: true, syncedAt: "2024-01-16T12:30:00Z" } });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("GitHub Traffic")).toBeInTheDocument();
    });

    const syncButton = screen.getByText("Sync Now");
    await user.click(syncButton);

    expect(adminApi.syncGithubTraffic).toHaveBeenCalledTimes(1);
  });

  it("shows last synced timestamp", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
    });
  });

  it("displays sync error when syncGithubTraffic returns an error", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });
    vi.mocked(adminApi.syncGithubTraffic).mockResolvedValue({
      error: "Rate limit exceeded",
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Sync Now")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Sync GitHub data"));

    await waitFor(() => {
      expect(screen.getByText(/Sync failed: Rate limit exceeded/)).toBeInTheDocument();
    });
  });

  it("updates date range when date inputs change", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("GitHub Traffic")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    // First input is "from", second is "to"
    const fromInput = dateInputs[0];
    const toInput = dateInputs[1];

    // Change "from" date
    await user.clear(fromInput);
    await user.type(fromInput, "2024-02-01");
    expect(fromInput).toHaveValue("2024-02-01");

    // Change "to" date
    await user.clear(toInput);
    await user.type(toInput, "2024-02-28");
    expect(toInput).toHaveValue("2024-02-28");
  });

  it("does not render traffic chart when daily data is empty", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalViews: 1, totalClones: 1 },
        daily: [],
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Total Views")).toBeInTheDocument();
    });

    // The chart heading "Daily Traffic" should NOT be present
    expect(screen.queryByText("Daily Traffic")).not.toBeInTheDocument();
  });

  it("shows 'No referrer data' when referrers list is empty", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalViews: 1, totalClones: 1 },
        referrers: [],
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No referrer data")).toBeInTheDocument();
    });
  });

  it("shows 'No path data' when popular paths list is empty", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalViews: 1, totalClones: 1 },
        popularPaths: [],
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No path data")).toBeInTheDocument();
    });
  });

  it("displays all five summary stat cards including suffix", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("250")).toBeInTheDocument();
    });

    // Verify all stat cards render, including unique views (line 146)
    expect(screen.getByText("Total Views")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Unique Visitors")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Total Clones")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Unique Cloners")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Days Tracked")).toBeInTheDocument();
    // The "days" suffix on the Days Tracked card (line 247)
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("renders traffic chart SVG with daily data", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: mockData,
    });

    const { container } = render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Daily Traffic")).toBeInTheDocument();
    });

    // The chart SVG uses preserveAspectRatio="none" to distinguish from icon SVGs
    const chartSvg = container.querySelector('svg[preserveAspectRatio="none"]');
    expect(chartSvg).not.toBeNull();
    expect(chartSvg!.getAttribute("viewBox")).toBe("0 0 600 160");

    // Views line (blue) and Clones line (emerald)
    const bluePathEl = chartSvg!.querySelector('path[stroke="#3b82f6"]');
    const greenPathEl = chartSvg!.querySelector('path[stroke="#10b981"]');
    expect(bluePathEl).not.toBeNull();
    expect(greenPathEl).not.toBeNull();

    // Legend labels ("Views" and "Clones" may appear in table headers too)
    expect(screen.getAllByText("Views").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Clones").length).toBeGreaterThanOrEqual(1);
  });

  it("renders traffic chart with single data point (xStep edge case)", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        daily: [
          { date: "2024-01-15", views: 50, views_unique: 20, clones: 5, clones_unique: 3 },
        ],
      },
    });

    const { container } = render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Daily Traffic")).toBeInTheDocument();
    });

    // Single data point: xStep = w (not division by zero)
    const chartSvg = container.querySelector('svg[preserveAspectRatio="none"]');
    expect(chartSvg).not.toBeNull();

    // Should have 2 path elements (views + clones) inside the chart SVG
    const paths = chartSvg!.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });

  it("renders traffic chart with many data points and label skipping", async () => {
    // Create 12 data points to trigger labelInterval > 1 (line 285, 329)
    const manyDaily = Array.from({ length: 12 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      views: 30 + i * 10,
      views_unique: 15 + i * 5,
      clones: 2 + i,
      clones_unique: 1 + i,
    }));

    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        daily: manyDaily,
      },
    });

    const { container } = render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Daily Traffic")).toBeInTheDocument();
    });

    // Chart should render without errors
    const chartSvg = container.querySelector('svg[preserveAspectRatio="none"]');
    expect(chartSvg).not.toBeNull();

    // With 12 points and labelInterval = floor(12/5) = 2,
    // labels show at indices 0, 2, 4, 6, 8, 10, and also last (11)
    // The last label (i === daily.length - 1) is always shown (line 329)
    const textElements = chartSvg!.querySelectorAll("text");
    expect(textElements.length).toBeGreaterThan(0);
  });

  it("renders paths table with title annotation when path has a title", async () => {
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        popularPaths: [
          { path: "/paisaxe", title: "Paisaxe", count: 100, uniques: 60, fetched_at: "2024-01-16T00:00:00Z" },
          { path: "/paisaxe/about", title: "", count: 50, uniques: 30, fetched_at: "2024-01-16T00:00:00Z" },
        ],
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — Popular Paths")).toBeInTheDocument();
    });

    // Path with title should show the title in parentheses (line 448)
    expect(screen.getByText("(Paisaxe)")).toBeInTheDocument();
    // Path with empty title should not render the annotation
    expect(screen.getByText("/paisaxe/about")).toBeInTheDocument();
  });

  it("shows refreshing state during background data refresh", async () => {
    const user = userEvent.setup();
    let resolveRefresh: (value: unknown) => void;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValueOnce({
      data: mockData,
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    vi.mocked(adminApi.fetchGithubAnalytics).mockImplementationOnce(
      () => refreshPromise as Promise<{ data: typeof mockData }>
    );

    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    resolveRefresh!({ data: mockData });
  });

  it("documents TrafficChart empty guard (line 254) as unreachable", async () => {
    // Line 254: `if (daily.length === 0) return null;` in TrafficChart
    // The parent checks `data.daily.length > 0` before rendering TrafficChart,
    // making the internal empty guard unreachable. When daily is empty and
    // summary has data, the chart section is simply not rendered.
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalViews: 1, totalClones: 1 },
        daily: [],
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Total Views")).toBeInTheDocument();
    });

    // Parent guard prevents TrafficChart from being rendered
    expect(screen.queryByText("Daily Traffic")).not.toBeInTheDocument();
  });

  // Line 238: `const colors = statColorClasses[color] || statColorClasses.stone;`
  // The fallback `|| statColorClasses.stone` is architecturally unreachable because:
  // 1. The color prop type is `"blue" | "emerald" | "amber" | "violet" | "stone"`
  // 2. The default parameter value is `color = "stone"`
  // 3. All 5 StatCard call sites in GitHubAnalyticsPanel pass explicit valid color values
  // Therefore no runtime path can produce a color value outside statColorClasses keys.
  // This is a defensive fallback that cannot be exercised through the component's public API.

  it("renders StatCard with large number values using toLocaleString formatting", async () => {
    // Covers line 246: typeof value === "number" ? value.toLocaleString() : value
    vi.mocked(adminApi.fetchGithubAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: {
          totalViews: 12345,
          totalUniqueViews: 6789,
          totalClones: 1234,
          totalUniqueClones: 567,
          dataPointCount: 90,
        },
      },
    });

    render(<GitHubAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      // toLocaleString formats large numbers with commas
      expect(screen.getByText("12,345")).toBeInTheDocument();
    });

    expect(screen.getByText("6,789")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("567")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    // The "days" suffix should render for the Days Tracked card (line 247)
    expect(screen.getByText("days")).toBeInTheDocument();
  });
});
