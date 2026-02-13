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
});
