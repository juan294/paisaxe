import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityItem } from "./activity-item";
import type { AgentActivityItem } from "@/types/agents-dashboard";

const mockItem: AgentActivityItem = {
  agentName: "Coverage Agent",
  health: "green",
  summary: "Completed coverage scan with 85% coverage",
  timestamp: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min ago
};

describe("ActivityItem", () => {
  it("renders agent name", () => {
    render(<ActivityItem item={mockItem} isLast={false} />);

    expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
  });

  it("renders summary text", () => {
    render(<ActivityItem item={mockItem} isLast={false} />);

    expect(screen.getByText("Completed coverage scan with 85% coverage")).toBeInTheDocument();
  });

  it("renders relative time", () => {
    render(<ActivityItem item={mockItem} isLast={false} />);

    expect(screen.getByText("30m ago")).toBeInTheDocument();
  });

  it("shows timeline connector line when not last", () => {
    const { container } = render(<ActivityItem item={mockItem} isLast={false} />);

    // The timeline line is a div with a specific class in the flex column
    const lineElements = container.querySelectorAll(".flex-1");
    expect(lineElements.length).toBeGreaterThan(0);
  });

  it("hides timeline connector line when last", () => {
    const { container } = render(<ActivityItem item={mockItem} isLast={true} />);

    // When isLast, the padding-bottom should be different
    const itemDiv = container.querySelector(".pb-0");
    expect(itemDiv).toBeInTheDocument();
  });
});
