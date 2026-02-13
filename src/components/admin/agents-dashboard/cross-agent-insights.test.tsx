import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrossAgentInsights } from "./cross-agent-insights";
import type { SharedContextEntry } from "@/types/agents-dashboard";

const mockEntries: SharedContextEntry[] = [
  {
    agentFlag: "coverage_agent_enabled",
    agentName: "Coverage Agent",
    content: "Coverage is at 85%, recommend adding tests for admin components",
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    agentFlag: "security_agent_enabled",
    agentName: "Security Agent",
    content: "No critical vulnerabilities found",
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
  },
];

describe("CrossAgentInsights", () => {
  it("renders section heading", () => {
    render(<CrossAgentInsights entries={mockEntries} />);
    expect(screen.getByText("Cross-Agent Insights")).toBeInTheDocument();
  });

  it("renders agent selector pills", () => {
    render(<CrossAgentInsights entries={mockEntries} />);
    expect(screen.getAllByText("Coverage Agent").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Security Agent").length).toBeGreaterThanOrEqual(1);
  });

  it("shows first entry by default", () => {
    render(<CrossAgentInsights entries={mockEntries} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("navigates to next entry", async () => {
    const user = userEvent.setup();
    render(<CrossAgentInsights entries={mockEntries} />);

    await user.click(screen.getByLabelText("Next agent insight"));

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("navigates to previous entry", async () => {
    const user = userEvent.setup();
    render(<CrossAgentInsights entries={mockEntries} />);

    // Go to second
    await user.click(screen.getByLabelText("Next agent insight"));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    // Go back to first
    await user.click(screen.getByLabelText("Previous agent insight"));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("disables previous button on first entry", () => {
    render(<CrossAgentInsights entries={mockEntries} />);

    const prevButton = screen.getByLabelText("Previous agent insight");
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last entry", async () => {
    const user = userEvent.setup();
    render(<CrossAgentInsights entries={mockEntries} />);

    await user.click(screen.getByLabelText("Next agent insight"));

    const nextButton = screen.getByLabelText("Next agent insight");
    expect(nextButton).toBeDisabled();
  });

  it("switches entry when pill clicked", async () => {
    const user = userEvent.setup();
    render(<CrossAgentInsights entries={mockEntries} />);

    await user.click(screen.getAllByText("Security Agent")[0]);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });
});
