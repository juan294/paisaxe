import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminTabs, TABS } from "./admin-tabs";

describe("AdminTabs", () => {
  it("should render all tabs", () => {
    const onTabChange = vi.fn();
    render(<AdminTabs activeTab="stories" onTabChange={onTabChange} />);

    TABS.forEach((tab) => {
      expect(screen.getByRole("tab", { name: new RegExp(tab.label, "i") })).toBeInTheDocument();
    });
  });

  it("should call onTabChange when clicking a tab", () => {
    const onTabChange = vi.fn();
    render(<AdminTabs activeTab="stories" onTabChange={onTabChange} />);

    const analyticsTab = screen.getByRole("tab", { name: /Analytics/i });
    fireEvent.click(analyticsTab);

    expect(onTabChange).toHaveBeenCalledWith("analytics");
  });

  it("should mark active tab with aria-selected", () => {
    const onTabChange = vi.fn();
    render(<AdminTabs activeTab="features" onTabChange={onTabChange} />);

    const featuresTab = screen.getByRole("tab", { name: /Features/i });
    const storiesTab = screen.getByRole("tab", { name: /Stories/i });

    expect(featuresTab).toHaveAttribute("aria-selected", "true");
    expect(storiesTab).toHaveAttribute("aria-selected", "false");
  });

  it("should render keyboard shortcuts", () => {
    const onTabChange = vi.fn();
    render(<AdminTabs activeTab="stories" onTabChange={onTabChange} />);

    expect(screen.getByText("⌘1")).toBeInTheDocument();
    expect(screen.getByText("⌘2")).toBeInTheDocument();
    expect(screen.getByText("⌘3")).toBeInTheDocument();
    expect(screen.getByText("⌘4")).toBeInTheDocument();
    expect(screen.getByText("⌘5")).toBeInTheDocument();
  });

  it("should have tablist role on nav element", () => {
    const onTabChange = vi.fn();
    render(<AdminTabs activeTab="stories" onTabChange={onTabChange} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("should update active state when activeTab prop changes", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <AdminTabs activeTab="stories" onTabChange={onTabChange} />
    );

    expect(screen.getByRole("tab", { name: /Stories/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    rerender(<AdminTabs activeTab="marketing" onTabChange={onTabChange} />);

    expect(screen.getByRole("tab", { name: /Stories/i })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: /Marketing/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

describe("TABS export — development branch (line 22)", () => {
  it("should include the Agents tab when NODE_ENV is 'development'", async () => {
    vi.resetModules();
    // Stub NODE_ENV to development before importing the module
    vi.stubEnv("NODE_ENV", "development");

    const { TABS: devTabs } = await import("./admin-tabs");

    expect(devTabs.find((t) => t.value === "agents")).toBeDefined();
    expect(devTabs).toHaveLength(6); // all 6 tabs including Agents

    vi.unstubAllEnvs();
  });

  it("should exclude the Agents tab when NODE_ENV is not 'development'", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");

    const { TABS: prodTabs } = await import("./admin-tabs");

    expect(prodTabs.find((t) => t.value === "agents")).toBeUndefined();
    expect(prodTabs).toHaveLength(5); // 5 tabs without Agents

    vi.unstubAllEnvs();
  });
});
