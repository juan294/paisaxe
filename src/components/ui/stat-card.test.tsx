import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatCard } from "./stat-card";

vi.mock("lucide-react", () => ({
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
}));

describe("StatCard", () => {
  const baseProps = {
    icon: <span data-testid="stat-icon" />,
    value: 42,
    label: "Pending",
    variant: "warning" as const,
    onClick: vi.fn(),
  };

  it("renders value and label", () => {
    render(<StatCard {...baseProps} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<StatCard {...baseProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies active styles when isActive=true", () => {
    render(<StatCard {...baseProps} isActive={true} />);
    const btn = screen.getByRole("button");
    // active variant for 'warning' uses activeBg — class includes 'bg-[#8b7355]'
    expect(btn.className).toMatch(/bg-\[#8b7355\]/);
  });

  it("applies inactive styles when isActive=false", () => {
    render(<StatCard {...baseProps} isActive={false} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-white/);
  });

  it("passes ariaLabel to button", () => {
    render(<StatCard {...baseProps} ariaLabel="Filter: pending" />);
    expect(screen.getByRole("button", { name: "Filter: pending" })).toBeInTheDocument();
  });

  it("renders all four variants without error", () => {
    const variants = ["default", "warning", "success", "purple"] as const;
    for (const variant of variants) {
      const { unmount } = render(<StatCard {...baseProps} variant={variant} />);
      unmount();
    }
  });
});
