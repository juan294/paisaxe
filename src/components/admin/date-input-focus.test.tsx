import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { AnalyticsCacheProvider } from "./analytics-cache-context";
import { ElevenLabsAnalyticsPanel } from "./elevenlabs-analytics-panel";
import { StripeAnalyticsPanel } from "./stripe-analytics-panel";
import { VisitorsAnalyticsPanel } from "./visitors-analytics-panel";
import { CostsAnalyticsPanel } from "./costs-analytics-panel";
import { GitHubAnalyticsPanel } from "./github-analytics-panel";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>
);

// Mock all admin API calls to prevent network requests
vi.mock("@/lib/admin-api", () => ({
  fetchElevenLabsAnalytics: vi.fn(() => new Promise(() => {})),
  fetchStripeAnalytics: vi.fn(() => new Promise(() => {})),
  fetchAnalytics: vi.fn(() => new Promise(() => {})),
  fetchCostsAnalytics: vi.fn(() => new Promise(() => {})),
  fetchGithubAnalytics: vi.fn(() => new Promise(() => {})),
  syncGithubTraffic: vi.fn(),
  createManualCostEntry: vi.fn(),
  updateManualCostEntry: vi.fn(),
  deleteManualCostEntry: vi.fn(),
}));

function assertDateInputsHaveFocusIndicator(container: HTMLElement) {
  const dateInputs = container.querySelectorAll('input[type="date"]');
  expect(dateInputs.length).toBeGreaterThan(0);

  dateInputs.forEach((input) => {
    const classes = input.className;
    expect(classes).toContain("focus-visible:ring-1");
    expect(classes).toContain("focus-visible:ring-white/40");
  });
}

describe("Admin date inputs have focus-visible indicators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("ElevenLabsAnalyticsPanel date inputs have focus-visible ring", () => {
    const { container } = render(<ElevenLabsAnalyticsPanel />, { wrapper });
    assertDateInputsHaveFocusIndicator(container);
  });

  it("StripeAnalyticsPanel date inputs have focus-visible ring", () => {
    const { container } = render(<StripeAnalyticsPanel />, { wrapper });
    assertDateInputsHaveFocusIndicator(container);
  });

  it("VisitorsAnalyticsPanel date inputs have focus-visible ring", () => {
    const { container } = render(<VisitorsAnalyticsPanel />, { wrapper });
    assertDateInputsHaveFocusIndicator(container);
  });

  it("CostsAnalyticsPanel date inputs have focus-visible ring", () => {
    const { container } = render(<CostsAnalyticsPanel />, { wrapper });
    assertDateInputsHaveFocusIndicator(container);
  });

  it("GitHubAnalyticsPanel date inputs have focus-visible ring", () => {
    const { container } = render(<GitHubAnalyticsPanel />, { wrapper });
    assertDateInputsHaveFocusIndicator(container);
  });
});
