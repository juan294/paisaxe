import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsTabs } from "./analytics-tabs";

describe("AnalyticsTabs", () => {
  it("should render tabs in the correct order: Visitors, Voice, GitHub, Costs, Revenue", () => {
    render(
      <AnalyticsTabs activeTab="visitors" onTabChange={vi.fn()}>
        <div>content</div>
      </AnalyticsTabs>
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveTextContent("Visitors");
    expect(tabs[1]).toHaveTextContent("Voice");
    expect(tabs[2]).toHaveTextContent("GitHub");
    expect(tabs[3]).toHaveTextContent("Costs");
    expect(tabs[4]).toHaveTextContent("Revenue");
  });

  it("should render correct keyboard shortcuts", () => {
    render(
      <AnalyticsTabs activeTab="visitors" onTabChange={vi.fn()}>
        <div>content</div>
      </AnalyticsTabs>
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("⌘U");
    expect(tabs[1]).toHaveTextContent("⌘I");
    expect(tabs[2]).toHaveTextContent("⌘O");
    expect(tabs[3]).toHaveTextContent("⌘P");
    expect(tabs[4]).toHaveTextContent("⌘L");
  });

  it("should highlight the active tab", () => {
    render(
      <AnalyticsTabs activeTab="costs" onTabChange={vi.fn()}>
        <div>content</div>
      </AnalyticsTabs>
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[3]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  });

  it("should call onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();

    render(
      <AnalyticsTabs activeTab="visitors" onTabChange={onTabChange}>
        <div>content</div>
      </AnalyticsTabs>
    );

    const tabs = screen.getAllByRole("tab");
    tabs[3].click();

    expect(onTabChange).toHaveBeenCalledWith("costs");
  });
});
