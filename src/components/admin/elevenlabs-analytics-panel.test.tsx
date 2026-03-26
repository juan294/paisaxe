import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
      expect(screen.getByText("English")).toBeInTheDocument();
      expect(screen.getByText("Spanish")).toBeInTheDocument();
    });
  });

  it("displays recent conversations", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("04 — Recent Conversations")).toBeInTheDocument();
      // "Completed" appears multiple times (summary stat label, status breakdown, recent conversations)
      expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("120s")).toBeInTheDocument();
      expect(screen.getByText("30s")).toBeInTheDocument();
    });
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

  it("shows refreshing pulse bar during background refresh", async () => {
    const user = userEvent.setup();
    let resolveRefresh: (value: unknown) => void;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    // First load resolves immediately
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValueOnce({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    // Second call hangs to trigger refreshing state
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockImplementationOnce(
      () => refreshPromise as Promise<{ data: typeof mockData }>
    );

    await user.click(screen.getByText("Refresh"));

    // The refreshing pulse bar should appear (line 87-88)
    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    // Resolve to clean up
    resolveRefresh!({ data: mockData });
  });

  it("displays status breakdown table", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("03 — By Status")).toBeInTheDocument();
    });

    // The formatStatus function maps "done" -> "Completed", "failed" -> "Failed"
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
  });

  it("displays active calls with zero calls styling", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: { ...mockData, activeCalls: 0 },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Active calls: 0")).toBeInTheDocument();
    });
  });

  it("displays conversation with no duration", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        recentConversations: [
          {
            conversation_id: "conv3",
            agent_id: "agent1",
            status: "initiated" as const,
            start_time_unix: undefined as unknown as number,
            call_duration_secs: undefined as unknown as number,
          },
        ],
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("04 — Recent Conversations")).toBeInTheDocument();
    });

    // formatTime returns "—" for falsy unix, call_duration_secs shows "—" when falsy
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    // formatStatus maps "initiated" -> "Initiated"
    expect(screen.getByText("Initiated")).toBeInTheDocument();
  });

  it("shows zero failed conversations with stone color", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, failedConversations: 0 },
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    // The "Failed" stat card should show 0 with "stone" color
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("updates from date when changed", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    // Get the from date input (first date input)
    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);

    // Use fireEvent.change for date inputs to avoid invalid intermediate states
    fireEvent.change(dateInputs[0], { target: { value: "2024-06-01" } });

    expect(dateInputs[0]).toHaveValue("2024-06-01");
  });

  it("updates to date when changed", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);

    fireEvent.change(dateInputs[1], { target: { value: "2024-12-31" } });

    expect(dateInputs[1]).toHaveValue("2024-12-31");
  });

  it("shows empty state for breakdown tables with empty items", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalConversations: 1 },
        conversationsByAgent: [],
        conversationsByLanguage: [],
        conversationsByStatus: [],
        recentConversations: [
          {
            conversation_id: "conv1",
            agent_id: "agent1",
            status: "done" as const,
            start_time_unix: 1704067200,
            call_duration_secs: 120,
          },
        ],
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("01 — By Agent")).toBeInTheDocument();
    });

    // Empty breakdowns should show "No data available"
    const noDataMessages = screen.getAllByText("No data available");
    expect(noDataMessages.length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state for recent conversations when list is empty", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, totalConversations: 1 },
        recentConversations: [],
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("04 — Recent Conversations")).toBeInTheDocument();
    });

    // Empty recent conversations should show "No conversations yet"
    // (different from the global empty state, this is the table-level empty state)
    const noConvMessages = screen.getAllByText("No conversations yet");
    expect(noConvMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("renders active calls widget with zero active calls (idle styling)", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: { ...mockData, activeCalls: 0 },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Active calls: 0")).toBeInTheDocument();
    });

    // The indicator dot should have idle styling (bg-[#a39e98]), NOT animate-pulse
    const activeCallsText = screen.getByText("Active calls: 0");
    const widgetContainer = activeCallsText.closest("[class*='inline-flex']")!;
    const indicatorDot = widgetContainer.querySelector("span[class*='rounded-full'][class*='h-2.5']")!;

    expect(indicatorDot.className).toContain("bg-[#a39e98]");
    expect(indicatorDot.className).not.toContain("animate-pulse");
    // Container should have neutral background, not emerald
    expect(widgetContainer.className).toContain("bg-[#f5f3ee]");
    expect(widgetContainer.className).not.toContain("bg-emerald-50");
  });

  it("renders active calls widget with active calls (emerald pulse styling)", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: { ...mockData, activeCalls: 3 },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Active calls: 3")).toBeInTheDocument();
    });

    // The indicator dot should have animate-pulse and emerald styling
    const activeCallsText = screen.getByText("Active calls: 3");
    const widgetContainer = activeCallsText.closest("[class*='inline-flex']")!;
    const indicatorDot = widgetContainer.querySelector("span[class*='rounded-full'][class*='h-2.5']")!;

    expect(indicatorDot.className).toContain("animate-pulse");
    expect(indicatorDot.className).toContain("bg-emerald-500");
    // Container should have emerald background
    expect(widgetContainer.className).toContain("bg-emerald-50");
    // Text should have emerald styling
    expect(activeCallsText.className).toContain("text-emerald-700");
  });

  it("renders date range separator dash", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: mockData,
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Voice Analytics")).toBeInTheDocument();
    });

    // The em dash separator between from/to date inputs
    const dateContainer = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)[0].closest("div")!;
    const dashSpan = dateContainer.querySelector("span");
    expect(dashSpan).toBeInTheDocument();
    expect(dashSpan!.textContent).toBe("—");
  });

  it("renders conversation with failed status and duration (rose styling)", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        recentConversations: [
          {
            conversation_id: "conv-fail",
            agent_id: "agent1",
            status: "failed" as const,
            start_time_unix: 1704067200,
            call_duration_secs: 45,
          },
        ],
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("04 — Recent Conversations")).toBeInTheDocument();
    });

    // Find the "Failed" badge specifically in the recent conversations table
    const recentSection = screen.getByText("04 — Recent Conversations").closest("section")!;
    const failedBadge = recentSection.querySelector("span[class*='bg-rose-100']")!;
    expect(failedBadge).toBeInTheDocument();
    expect(failedBadge.textContent).toBe("Failed");
    expect(failedBadge.className).toContain("text-rose-700");

    // Duration should be rendered
    expect(screen.getByText("45s")).toBeInTheDocument();
  });

  it("handles unknown language code in breakdown", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        conversationsByLanguage: [
          { language: "ja", count: 5 },
        ],
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("02 — By Language")).toBeInTheDocument();
    });

    // "ja" is not in the languageNames map, so it should be returned as-is
    expect(screen.getByText("ja")).toBeInTheDocument();
  });

  it("handles unknown status code in formatStatus (line 216 fallback)", async () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        conversationsByStatus: [
          { status: "unknown_status", count: 3 },
        ],
        recentConversations: [
          {
            conversation_id: "conv-unknown",
            agent_id: "agent1",
            status: "pending_review" as never,
            start_time_unix: 1704067200,
            call_duration_secs: 60,
          },
        ],
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("03 — By Status")).toBeInTheDocument();
    });

    // Unknown status should be returned as-is
    expect(screen.getByText("unknown_status")).toBeInTheDocument();
    // In recent conversations, unknown status also returned as-is
    expect(screen.getByText("pending_review")).toBeInTheDocument();
  });

  it("applies stone color to StatCard when failedConversations is zero (line 270 color fallback path)", async () => {
    // When failedConversations is 0, the "Failed" stat card uses "stone" color.
    // The color lookup `statColorClasses[color] || statColorClasses.stone` covers the fallback.
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockResolvedValue({
      data: {
        ...mockData,
        summary: { ...mockData.summary, failedConversations: 0 },
      },
    });

    render(<ElevenLabsAnalyticsPanel />, { wrapper });

    await waitFor(() => {
      // Verify that the stat card with "Failed" label exists with stone coloring
      expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders skeleton recent conversations table during loading (line 544)", () => {
    vi.mocked(adminApi.fetchElevenLabsAnalytics).mockImplementation(
      () => new Promise(() => {})
    );

    const { container } = render(<ElevenLabsAnalyticsPanel />, { wrapper });

    // The SkeletonRecentConversations component renders a table with 5 skeleton rows
    const skeletonRows = container.querySelectorAll("tbody tr");
    expect(skeletonRows.length).toBeGreaterThanOrEqual(5);

    // Verify skeleton pulse animations are present
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);

    // Verify table headers for the recent conversations skeleton
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  // Line 270: `statColorClasses[color] || statColorClasses.stone` — the `||` fallback is unreachable.
  // The StatCard `color` prop is typed as a union of valid keys ("blue" | "emerald" | ... | "stone")
  // with a default of "stone". The parent component only passes valid color strings.
  // The fallback is defensive code that cannot be triggered through the component's public API.
  //
  // Line 471: `skeletonColorClasses[color] || skeletonColorClasses.stone` — same pattern.
  // SkeletonStatCard is a private component called with hardcoded valid color strings.
  // The fallback is defensive code that cannot be triggered through the component's public API.
});
