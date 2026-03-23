import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentCard } from "./agent-card";
import type { AgentStatus } from "@/types/agents-dashboard";

const mockAgent: AgentStatus = {
  flagKey: "coverage_agent_enabled",
  name: "Coverage Agent",
  health: "green",
  healthSummary: "All tests passing",
  lastRun: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  schedule: "Daily at 3:00 UTC",
  reportFile: "docs/agents/coverage-report.md",
};

describe("AgentCard", () => {
  it("renders agent name and schedule", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
    expect(screen.getByText("Daily at 3:00 UTC")).toBeInTheDocument();
  });

  it("shows health summary", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("All tests passing")).toBeInTheDocument();
  });

  it("shows relative time for last run", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    // relativeTime: 3600000ms = 60 min, but >= 60 goes to hours
    expect(screen.getByText("1h ago")).toBeInTheDocument();
  });

  it("shows 'Never' when no last run", () => {
    render(
      <AgentCard
        agent={{ ...mockAgent, lastRun: null }}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows running state", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={true}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("Running...")).toBeInTheDocument();
  });

  it("shows stop button when running", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={true}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Stop Coverage Agent")).toBeInTheDocument();
  });

  it("hides stop button when hideStop is true", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={true}
        onRun={vi.fn()}
        onStop={vi.fn()}
        hideStop={true}
      />
    );

    expect(screen.queryByLabelText("Stop Coverage Agent")).not.toBeInTheDocument();
  });

  it("shows run button when not running", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Run Coverage Agent")).toBeInTheDocument();
  });

  it("calls onRun when run button clicked", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={onRun}
        onStop={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText("Run Coverage Agent"));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("shows last run result when available", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        lastRunResult={{ status: "error", time: new Date().toISOString() }}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("Last run failed")).toBeInTheDocument();
  });

  it("is clickable when onClick provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
        onClick={onClick}
      />
    );

    // The card itself has role="button" and the agent name as text
    const card = screen.getByText("Coverage Agent").closest("[role='button']")!;
    await user.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it("handles keyboard Enter to trigger onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
        onClick={onClick}
      />
    );

    const card = screen.getByText("Coverage Agent").closest("[role='button']")!;
    (card as HTMLElement).focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("handles keyboard Space to trigger onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
        onClick={onClick}
      />
    );

    const card = screen.getByText("Coverage Agent").closest("[role='button']")!;
    (card as HTMLElement).focus();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not have keyboard handler when onClick is not provided", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    // The outer card should NOT have role="button" when onClick is not provided
    const card = screen.getByText("Coverage Agent").closest("div")!;
    expect(card).not.toHaveAttribute("role", "button");
    expect(card).not.toHaveAttribute("tabindex");
  });

  it("calls onStop when stop button is clicked (not onClick)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onStop = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={true}
        onRun={vi.fn()}
        onStop={onStop}
        onClick={onClick}
      />
    );

    await user.click(screen.getByLabelText("Stop Coverage Agent"));
    expect(onStop).toHaveBeenCalledTimes(1);
    // onClick should NOT have been called (stopPropagation)
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onRun when run button is clicked (not onClick)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onRun = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={onRun}
        onStop={vi.fn()}
        onClick={onClick}
      />
    );

    await user.click(screen.getByLabelText("Run Coverage Agent"));
    expect(onRun).toHaveBeenCalledTimes(1);
    // onClick should NOT have been called (stopPropagation)
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows 'Last run stopped by user' when status is stopped", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        lastRunResult={{ status: "stopped", time: new Date().toISOString() }}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("Last run stopped by user")).toBeInTheDocument();
  });

  it("shows 'Last run completed successfully' for success status", () => {
    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        lastRunResult={{ status: "success", time: new Date().toISOString() }}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText("Last run completed successfully")).toBeInTheDocument();
  });

  it("does not trigger onClick for non-Enter/Space keys (onKeyDown false branch, line 58)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AgentCard
        agent={mockAgent}
        isRunning={false}
        onRun={vi.fn()}
        onStop={vi.fn()}
        onClick={onClick}
      />
    );

    const card = screen.getByText("Coverage Agent").closest("[role='button']")!;
    (card as HTMLElement).focus();
    // Press Tab key, which should NOT trigger onClick
    await user.keyboard("{Tab}");
    expect(onClick).not.toHaveBeenCalled();
  });
});
