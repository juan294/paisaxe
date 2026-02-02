import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SurpriseMeButton } from "./surprise-me-button";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "stories.surprise": "Surprise me!",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

describe("SurpriseMeButton", () => {
  const mockOnJumpTo = vi.fn();

  beforeEach(() => {
    mockOnJumpTo.mockClear();
    // Mock Math.random for predictable tests
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders button with aria-label", () => {
    render(
      <SurpriseMeButton
        totalStories={5}
        currentIndex={0}
        viewedIndices={new Set()}
        onJumpTo={mockOnJumpTo}
      />
    );
    const button = screen.getByRole("button", { name: "Surprise me!" });
    expect(button).toBeInTheDocument();
  });

  it("renders button with title", () => {
    render(
      <SurpriseMeButton
        totalStories={5}
        currentIndex={0}
        viewedIndices={new Set()}
        onJumpTo={mockOnJumpTo}
      />
    );
    const button = screen.getByTitle("Surprise me!");
    expect(button).toBeInTheDocument();
  });

  it("renders Shuffle icon", () => {
    const { container } = render(
      <SurpriseMeButton
        totalStories={5}
        currentIndex={0}
        viewedIndices={new Set()}
        onJumpTo={mockOnJumpTo}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("h-5", "w-5");
  });

  it("jumps to an unviewed story when clicked", () => {
    render(
      <SurpriseMeButton
        totalStories={5}
        currentIndex={0}
        viewedIndices={new Set([0, 1])}
        onJumpTo={mockOnJumpTo}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    // With viewed indices [0,1], current 0, unviewed are [2,3,4]
    // Math.random() = 0.5 -> floor(0.5 * 3) = 1 -> index 3
    expect(mockOnJumpTo).toHaveBeenCalledWith(3);
  });

  it("jumps to any story except current when all are viewed", () => {
    render(
      <SurpriseMeButton
        totalStories={3}
        currentIndex={1}
        viewedIndices={new Set([0, 1, 2])}
        onJumpTo={mockOnJumpTo}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    // All viewed, candidates are [0, 2] (excluding current 1)
    // Math.random() = 0.5 -> floor(0.5 * 2) = 1 -> index 2
    expect(mockOnJumpTo).toHaveBeenCalledWith(2);
  });

  it("does nothing when only one story exists", () => {
    render(
      <SurpriseMeButton
        totalStories={1}
        currentIndex={0}
        viewedIndices={new Set()}
        onJumpTo={mockOnJumpTo}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(mockOnJumpTo).not.toHaveBeenCalled();
  });

  it("stops event propagation on click", () => {
    const parentHandler = vi.fn();
    render(
      <div onClick={parentHandler}>
        <SurpriseMeButton
          totalStories={5}
          currentIndex={0}
          viewedIndices={new Set()}
          onJumpTo={mockOnJumpTo}
        />
      </div>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it("applies correct styling classes", () => {
    render(
      <SurpriseMeButton
        totalStories={5}
        currentIndex={0}
        viewedIndices={new Set()}
        onJumpTo={mockOnJumpTo}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("p-2");
    expect(button).toHaveClass("rounded-full");
    expect(button).toHaveClass("bg-white/10");
  });
});
