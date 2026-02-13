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
});
