import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsDashboard } from "./analytics-dashboard";

// Mock all panel components
vi.mock("./visitors-analytics-panel", () => ({
  VisitorsAnalyticsPanel: () => <div data-testid="visitors-panel">Visitors Panel</div>,
}));
vi.mock("./elevenlabs-analytics-panel", () => ({
  ElevenLabsAnalyticsPanel: () => <div data-testid="voice-panel">Voice Panel</div>,
}));
vi.mock("./github-analytics-panel", () => ({
  GitHubAnalyticsPanel: () => <div data-testid="github-panel">GitHub Panel</div>,
}));
vi.mock("./costs-analytics-panel", () => ({
  CostsAnalyticsPanel: () => <div data-testid="costs-panel">Costs Panel</div>,
}));
vi.mock("./stripe-analytics-panel", () => ({
  StripeAnalyticsPanel: () => <div data-testid="revenue-panel">Revenue Panel</div>,
}));

// Mock the cache provider as a passthrough
vi.mock("./analytics-cache-context", () => ({
  AnalyticsCacheProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cache-provider">{children}</div>
  ),
}));

describe("AnalyticsDashboard lazy-mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only renders the visitors panel on initial mount", () => {
    render(<AnalyticsDashboard />);

    // Visitors panel should be in the DOM (it's the default tab)
    expect(screen.getByTestId("visitors-panel")).toBeInTheDocument();

    // Other panels should NOT be in the DOM yet
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("github-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("costs-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revenue-panel")).not.toBeInTheDocument();
  });

  it("mounts a panel when its tab is clicked", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Voice panel not mounted yet
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();

    // Click the Voice tab
    await user.click(screen.getByRole("tab", { name: /Voice/i }));

    // Voice panel should now be mounted and visible
    expect(screen.getByTestId("voice-panel")).toBeInTheDocument();
    const voiceTabpanel = screen.getByTestId("voice-panel").closest('[role="tabpanel"]');
    expect(voiceTabpanel).toHaveAttribute("aria-hidden", "false");
  });

  it("keeps previously visited panels mounted when switching away", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Click Voice tab to mount it
    await user.click(screen.getByRole("tab", { name: /Voice/i }));
    expect(screen.getByTestId("voice-panel")).toBeInTheDocument();

    // Switch back to Visitors
    await user.click(screen.getByRole("tab", { name: /Visitors/i }));

    // Voice panel should still be in the DOM (hidden)
    expect(screen.getByTestId("voice-panel")).toBeInTheDocument();
    const voiceTabpanel = screen.getByTestId("voice-panel").closest('[role="tabpanel"]');
    expect(voiceTabpanel).toHaveAttribute("aria-hidden", "true");
    expect(voiceTabpanel).toHaveStyle({ display: "none" });

    // Visitors panel should be visible
    const visitorsTabpanel = screen.getByTestId("visitors-panel").closest('[role="tabpanel"]');
    expect(visitorsTabpanel).toHaveAttribute("aria-hidden", "false");
    expect(visitorsTabpanel).toHaveStyle({ display: "block" });
  });

  it("wraps content in AnalyticsCacheProvider", () => {
    render(<AnalyticsDashboard />);
    expect(screen.getByTestId("cache-provider")).toBeInTheDocument();
  });

  it("does not re-mount panels that were already visited", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Visit Voice
    await user.click(screen.getByRole("tab", { name: /Voice/i }));
    const voiceEl1 = screen.getByTestId("voice-panel");

    // Go to Costs
    await user.click(screen.getByRole("tab", { name: /Costs/i }));

    // Go back to Voice
    await user.click(screen.getByRole("tab", { name: /Voice/i }));
    const voiceEl2 = screen.getByTestId("voice-panel");

    // Same DOM node — not re-mounted
    expect(voiceEl1).toBe(voiceEl2);
  });

  it("mounts the GitHub panel when its tab is clicked", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // GitHub panel not mounted yet
    expect(screen.queryByTestId("github-panel")).not.toBeInTheDocument();

    // Click the GitHub tab
    await user.click(screen.getByRole("tab", { name: /GitHub/i }));

    // GitHub panel should now be mounted and visible
    expect(screen.getByTestId("github-panel")).toBeInTheDocument();
    const githubTabpanel = screen.getByTestId("github-panel").closest('[role="tabpanel"]');
    expect(githubTabpanel).toHaveAttribute("aria-hidden", "false");
    expect(githubTabpanel).toHaveStyle({ display: "block" });
  });

  it("mounts the Revenue panel when its tab is clicked", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Revenue panel not mounted yet
    expect(screen.queryByTestId("revenue-panel")).not.toBeInTheDocument();

    // Click the Revenue tab
    await user.click(screen.getByRole("tab", { name: /Revenue/i }));

    // Revenue panel should now be mounted and visible
    expect(screen.getByTestId("revenue-panel")).toBeInTheDocument();
    const revenueTabpanel = screen.getByTestId("revenue-panel").closest('[role="tabpanel"]');
    expect(revenueTabpanel).toHaveAttribute("aria-hidden", "false");
    expect(revenueTabpanel).toHaveStyle({ display: "block" });
  });

  it("hides GitHub panel when switching to another tab after visiting it", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Visit GitHub tab
    await user.click(screen.getByRole("tab", { name: /GitHub/i }));
    expect(screen.getByTestId("github-panel")).toBeInTheDocument();

    // Switch back to Visitors
    await user.click(screen.getByRole("tab", { name: /Visitors/i }));

    // GitHub panel should still be in DOM but hidden
    const githubTabpanel = screen.getByTestId("github-panel").closest('[role="tabpanel"]');
    expect(githubTabpanel).toHaveAttribute("aria-hidden", "true");
    expect(githubTabpanel).toHaveStyle({ display: "none" });
  });

  it("hides Revenue panel when switching to another tab after visiting it", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Visit Revenue tab
    await user.click(screen.getByRole("tab", { name: /Revenue/i }));
    expect(screen.getByTestId("revenue-panel")).toBeInTheDocument();

    // Switch to Costs
    await user.click(screen.getByRole("tab", { name: /Costs/i }));

    // Revenue panel should still be in DOM but hidden
    const revenueTabpanel = screen.getByTestId("revenue-panel").closest('[role="tabpanel"]');
    expect(revenueTabpanel).toHaveAttribute("aria-hidden", "true");
    expect(revenueTabpanel).toHaveStyle({ display: "none" });
  });

  it("mounts all five panels after visiting each tab", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    // Visit all tabs
    await user.click(screen.getByRole("tab", { name: /Voice/i }));
    await user.click(screen.getByRole("tab", { name: /GitHub/i }));
    await user.click(screen.getByRole("tab", { name: /Costs/i }));
    await user.click(screen.getByRole("tab", { name: /Revenue/i }));

    // All five panels should be in the DOM
    expect(screen.getByTestId("visitors-panel")).toBeInTheDocument();
    expect(screen.getByTestId("voice-panel")).toBeInTheDocument();
    expect(screen.getByTestId("github-panel")).toBeInTheDocument();
    expect(screen.getByTestId("costs-panel")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-panel")).toBeInTheDocument();

    // Only Revenue (last clicked) should be visible
    const revenueTabpanel = screen.getByTestId("revenue-panel").closest('[role="tabpanel"]');
    expect(revenueTabpanel).toHaveStyle({ display: "block" });

    // Others should be hidden
    const visitorsTabpanel = screen.getByTestId("visitors-panel").closest('[role="tabpanel"]');
    expect(visitorsTabpanel).toHaveStyle({ display: "none" });
  });
});
