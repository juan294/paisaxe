import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AgentsDashboard } from "./index";
import * as adminApi from "@/lib/admin-api";
import type { AgentConfigFile } from "@/types/agent-config";

vi.mock("@/lib/admin-api", () => ({
  fetchAgentsSummary: vi.fn(),
  fetchAgentConfig: vi.fn(),
  updateAgentMaster: vi.fn(),
  updateAgentEnabled: vi.fn(),
  triggerOptimizerRun: vi.fn(),
}));

// Mock sub-components that do complex rendering
vi.mock("./optimizer-report-dialog", () => ({
  OptimizerReportDialog: () => null,
}));
vi.mock("./terminal-display", () => ({
  AgentTerminal: () => null,
}));

const mockData = {
  overallHealth: "green" as const,
  agents: [
    {
      flagKey: "coverage_agent_enabled",
      name: "Coverage Agent",
      health: "green" as const,
      healthSummary: "All tests passing, 85% coverage",
      lastRun: "2024-01-15T10:00:00Z",
      schedule: "Daily at 3:00 UTC",
      reportFile: "docs/agents/coverage-report.md",
    },
    {
      flagKey: "security_agent_enabled",
      name: "Security Agent",
      health: "yellow" as const,
      healthSummary: "2 warnings found",
      lastRun: "2024-01-15T09:00:00Z",
      schedule: "Daily at 4:00 UTC",
      reportFile: "docs/agents/security-report.md",
    },
  ],
  sharedContext: [],
  recentActivity: [
    {
      agentName: "Coverage Agent",
      health: "green" as const,
      summary: "Completed scan with no issues",
      timestamp: "2024-01-15T10:00:00Z",
    },
  ],
};

const mockAgentConfig: AgentConfigFile = {
  master_enabled: true,
  agents: {
    coverage_agent_enabled: { enabled: true, config: {} },
    security_agent_enabled: { enabled: true, config: {} },
  },
};

describe("AgentsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.fetchAgentConfig).mockResolvedValue({ data: mockAgentConfig });
  });

  it("shows loading state initially", () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockImplementation(
      () => new Promise(() => {})
    );

    render(<AgentsDashboard />);

    expect(screen.getByText("Loading agents...")).toBeInTheDocument();
  });

  it("renders header after data loads", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      data: mockData,
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Agent Intelligence")).toBeInTheDocument();
    });

    expect(screen.getByText("Admin / Agents")).toBeInTheDocument();
  });

  it("renders agent cards", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      data: mockData,
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("Coverage Agent").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("Security Agent").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("All tests passing, 85% coverage")).toBeInTheDocument();
    expect(screen.getByText("2 warnings found")).toBeInTheDocument();
  });

  it("renders overall health banner", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      data: mockData,
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("All Systems Healthy")).toBeInTheDocument();
    });

    // Coverage=green, Security=yellow -> 1 green out of 2
    expect(screen.getByText("1/2 agents healthy")).toBeInTheDocument();
  });

  it("renders recent activity", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      data: mockData,
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    expect(screen.getByText("Completed scan with no issues")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      error: "Failed to fetch agents",
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch agents")).toBeInTheDocument();
    });
  });

  it("renders agent toggle section when config loaded", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      data: mockData,
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Agent Toggles")).toBeInTheDocument();
    });

    expect(screen.getByText("All Automated Agents")).toBeInTheDocument();
  });

  it("renders run buttons for each agent", async () => {
    vi.mocked(adminApi.fetchAgentsSummary).mockResolvedValue({
      data: mockData,
    });

    render(<AgentsDashboard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Run Coverage Agent")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Run Security Agent")).toBeInTheDocument();
  });
});
