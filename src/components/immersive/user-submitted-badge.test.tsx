import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserSubmittedBadge } from "./user-submitted-badge";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "suggestions.community_pick": "Community Pick",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

describe("UserSubmittedBadge", () => {
  it("renders the badge text", () => {
    render(<UserSubmittedBadge />);
    expect(screen.getByText("Community Pick")).toBeInTheDocument();
  });

  it("renders with correct title attribute", () => {
    render(<UserSubmittedBadge />);
    const badge = screen.getByTitle("Community Pick");
    expect(badge).toBeInTheDocument();
  });

  it("renders Users icon", () => {
    const { container } = render(<UserSubmittedBadge />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("h-3", "w-3");
  });

  it("applies default styling classes", () => {
    render(<UserSubmittedBadge />);
    const badge = screen.getByTitle("Community Pick");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("gap-1");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("bg-amber-500/20");
    expect(badge).toHaveClass("text-amber-200");
  });

  it("accepts and applies custom className", () => {
    render(<UserSubmittedBadge className="custom-class" />);
    const badge = screen.getByTitle("Community Pick");
    expect(badge).toHaveClass("custom-class");
  });

  it("renders as a span element", () => {
    render(<UserSubmittedBadge />);
    const badge = screen.getByTitle("Community Pick");
    expect(badge.tagName).toBe("SPAN");
  });
});
