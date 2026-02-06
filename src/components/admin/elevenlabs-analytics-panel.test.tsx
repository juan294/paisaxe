import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElevenLabsAnalyticsPanel } from "./elevenlabs-analytics-panel";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import * as adminApi from "@/lib/admin-api";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

vi.mock("@/lib/admin-api", () => ({
  fetchElevenLabsAnalytics: vi.fn(),
}));

const mockData = {
  summary: {
    totalConversations: 25,
    completedConversations: 20,
    failedConversations: 5,
    totalMinutesUsed: 120.5,
    averageCallDuration: 290,
    averageRating: 4.2,
  },
  activeCalls: 2,
  conversationsByAgent: [
    { agentId: "agent1", agentName: "Xander", conversationCount: 15, totalMinutes: 80 },
    { agentId: "agent2", agentName: "Iris", conversationCount: 10, totalMinutes: 40.5 },
  ],
  conversationsByLanguage: [
    { language: "en", count: 18 },
    { language: "es", count: 7 },
  ],
  conversationsByStatus: [
    { status: "done", count: 20 },
    { status: "failed", count: 5 },
  ],
  recentConversations: [
    {
      conversation_id: "conv1",
      agent_id: "agent1",
      status: "done" as const,
      start_time_unix: 1704067200,
      call_duration_secs: 120,
    },
    {
      conversation_id: "conv2",
      agent_id: "agent2",
      status: "failed" as const,
      start_time_unix: 1704060000,
      call_duration_secs: 30,
    },
  ],
  dateRange: { from: "2024-01-01", to: "2024-01-31" },
};

describe("ElevenLabsAnalyticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays summary statistics", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Conversations")).toBeInTheDocument();
    // Use getAllByText for values that appear multiple times
    expect(screen.getAllByText("20").length).toBeGreaterThanOrEqual(1);
    // Check for Completed label (status badge may also show "Completed")
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Minutes Used")).toBeInTheDocument();
  });

  it("displays conversations by agent breakdown", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — By Agent")).toBeInTheDocument();
    });

    expect(screen.getByText("Xander")).toBeInTheDocument();
    expect(screen.getByText("Iris")).toBeInTheDocument();
    expect(screen.getByText("80 min")).toBeInTheDocument();
    expect(screen.getByText("40.5 min")).toBeInTheDocument();
  });

  it("displays conversations by language breakdown", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — By Language")).toBeInTheDocument();
    });

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Spanish")).toBeInTheDocument();
  });

  it("displays recent conversations", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("04 — Recent Conversations")).toBeInTheDocument();
    });

    // "Completed" appears multiple times (summary stat label, status breakdown, recent conversations)
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("120s")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        summary: {
          totalConversations: 0,
          completedConversations: 0,
          failedConversations: 0,
          totalMinutesUsed: 0,
          averageCallDuration: 0,
          averageRating: null,
        },
        activeCalls: 0,
        conversationsByAgent: [],
        conversationsByLanguage: [],
        conversationsByStatus: [],
        recentConversations: [],
        dateRange: { from: "2024-01-01", to: "2024-01-31" },
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Voice agent data will appear here once conversations begin")
    ).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      error: "Failed to fetch data",
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch data")).toBeInTheDocument();
    });
  });

  it("refreshes data when refresh button is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Refresh"));

    expect(adminApi.fetchElevenLabsAnalytics).toHaveBeenCalledTimes(2);
  });

  it("displays average rating when available", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("4.2")).toBeInTheDocument();
    });

    expect(screen.getByText("Avg Rating")).toBeInTheDocument();
    expect(screen.getByText("/5")).toBeInTheDocument();
  });

  it("displays dash for rating when null", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, averageRating: null },
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("renders the header with title", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Voice Analytics")).toBeInTheDocument();
    });
  });

  it("displays active calls widget", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Active calls: 2")).toBeInTheDocument();
    });
  });
});
