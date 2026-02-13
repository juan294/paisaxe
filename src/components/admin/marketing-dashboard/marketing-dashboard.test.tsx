import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarketingDashboard } from "./marketing-dashboard";

// Mock child components
vi.mock("./account-card", () => ({
  AccountCard: ({ platform }: { platform: string }) => (
    <div data-testid={`account-card-${platform}`}>{platform}</div>
  ),
}));
vi.mock("./account-config-dialog", () => ({
  AccountConfigDialog: () => null,
}));
vi.mock("./post-row", () => ({
  PostRow: ({ post }: { post: { content: string } }) => (
    <tr data-testid="post-row"><td>{post.content}</td></tr>
  ),
}));
vi.mock("./stat-card", () => ({
  StatCard: ({ label, value }: { label: string; value: number }) => (
    <div data-testid={`stat-${label}`}>{value}</div>
  ),
}));
vi.mock("./drafts-panel", () => ({
  DraftsPanel: () => <div data-testid="drafts-panel">Drafts</div>,
}));
vi.mock("../voice-agent-chat", () => ({
  VoiceAgentChat: () => <div data-testid="voice-agent-chat">Voice Chat</div>,
}));

const mockData = {
  accounts: [
    { platform: "x", isActive: true, hasCredentials: true, accountHandle: "@elpaisaxe" },
  ],
  stats: {
    totalPosts: 10,
    postsThisWeek: 3,
    postsThisMonth: 8,
    failedPosts: 0,
    totalEngagement: { likes: 0, comments: 0, shares: 0 },
    byPlatform: {},
  },
  recentPosts: [],
  upcomingPosts: [],
  schedules: [],
};

describe("MarketingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<MarketingDashboard />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders header after data loads", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Marketing Automation")).toBeInTheDocument();
    });
  });

  it("renders account cards", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("account-card-x")).toBeInTheDocument();
    });
  });

  it("renders stat cards", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("stat-Total Posts")).toBeInTheDocument();
    });

    expect(screen.getByTestId("stat-This Week")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to fetch marketing data" }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch marketing data")).toBeInTheDocument();
    });
  });

  it("renders voice chat section", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("voice-agent-chat")).toBeInTheDocument();
    });
  });

  it("renders drafts panel", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("drafts-panel")).toBeInTheDocument();
    });
  });
});
