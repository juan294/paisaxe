import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FreshnessBadge } from "./freshness-badge";

// Mock the freshness check
vi.mock("@/lib/freshness", () => ({
  isNewStory: vi.fn((createdAt: string) => {
    // For testing: consider stories created after 2026-01-01 as "new"
    return new Date(createdAt) > new Date("2026-01-01");
  }),
}));

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "stories.new_badge": "New",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

describe("FreshnessBadge", () => {
  it("renders 'New' badge for new stories", () => {
    render(<FreshnessBadge storyId="test-1" createdAt="2026-01-15T00:00:00Z" />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("returns null for old stories", () => {
    const { container } = render(
      <FreshnessBadge storyId="test-2" createdAt="2020-01-01T00:00:00Z" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when createdAt is undefined", () => {
    const { container } = render(<FreshnessBadge storyId="test-3" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with correct styling classes", () => {
    render(<FreshnessBadge storyId="test-4" createdAt="2026-01-15T00:00:00Z" />);
    const badge = screen.getByText("New");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("bg-emerald-500/80");
    expect(badge).toHaveClass("text-white");
    expect(badge).toHaveClass("rounded-full");
  });
});
