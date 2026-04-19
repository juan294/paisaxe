import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryToolbar } from "./story-toolbar";
import { createMockT } from "@/test/i18n-mock";

const mockT = createMockT();

describe("StoryToolbar", () => {
  let onPrev: (() => void) & ReturnType<typeof vi.fn>;
  let onNext: (() => void) & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPrev = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
    onNext = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
  });

  it("should render prev button", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    const prevButton = screen.getByTestId("prev-story-button");
    expect(prevButton).toBeInTheDocument();
  });

  it("should render next button", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    const nextButton = screen.getByTestId("next-story-button");
    expect(nextButton).toBeInTheDocument();
  });

  it("should call onPrev when prev button is clicked", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByTestId("prev-story-button"));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("should call onNext when next button is clicked", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByTestId("next-story-button"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("should stop click propagation on prev button", () => {
    const parentClick = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
    render(
      <div onClick={parentClick}>
        <StoryToolbar
          onPrev={onPrev}
          onNext={onNext}
          t={mockT}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId("prev-story-button"));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("should stop click propagation on next button", () => {
    const parentClick = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
    render(
      <div onClick={parentClick}>
        <StoryToolbar
          onPrev={onPrev}
          onNext={onNext}
          t={mockT}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId("next-story-button"));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
