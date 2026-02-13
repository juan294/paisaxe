import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverallHealthBanner } from "./overall-health-banner";
import type { AgentStatus } from "@/types/agents-dashboard";

const greenAgent: AgentStatus = {
  flagKey: "test_agent",
  name: "Test Agent",
  health: "green",
  healthSummary: "OK",
  lastRun: null,
  schedule: "Daily",
  reportFile: "docs/agents/test-report.md",
};

const yellowAgent: AgentStatus = {
  ...greenAgent,
  health: "yellow",
};

describe("OverallHealthBanner", () => {
  it("shows green health label", () => {
    render(<OverallHealthBanner health="green" agents={[greenAgent]} />);

    expect(screen.getByText("All Systems Healthy")).toBeInTheDocument();
    expect(screen.getByText("1/1 agents healthy")).toBeInTheDocument();
  });

  it("shows yellow health label", () => {
    render(<OverallHealthBanner health="yellow" agents={[yellowAgent]} />);

    expect(screen.getByText("Some Warnings Detected")).toBeInTheDocument();
    expect(screen.getByText("0/1 agents healthy")).toBeInTheDocument();
  });

  it("shows red health label", () => {
    render(<OverallHealthBanner health="red" agents={[{ ...greenAgent, health: "red" }]} />);

    expect(screen.getByText("Critical Issues Found")).toBeInTheDocument();
  });

  it("shows unknown health label", () => {
    render(<OverallHealthBanner health="unknown" agents={[]} />);

    expect(screen.getByText("Status Unknown")).toBeInTheDocument();
    expect(screen.getByText("0/0 agents healthy")).toBeInTheDocument();
  });
});
