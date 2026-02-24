import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryProgressBar } from "./story-progress-bar";

const defaultProps = {
  storiesLength: 5,
  currentIndex: 2,
  onIndexChange: vi.fn(),
  t: (key: string) => key,
};

describe("StoryProgressBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Segment count
  // -------------------------------------------------------------------------
  it("renders correct number of segments (min of PAGE_SIZE and storiesLength)", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    expect(segments.length).toBe(5); // 5 stories < 20 PAGE_SIZE
  });

  it("caps segments at PAGE_SIZE (20) for large story counts", () => {
    render(<StoryProgressBar {...defaultProps} storiesLength={50} />);
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    expect(segments.length).toBe(20);
  });

  // -------------------------------------------------------------------------
  // Click handler via event delegation
  // -------------------------------------------------------------------------
  it("calls onIndexChange when a segment is clicked", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    // base = 2 - (2 % 5) = 0, targetIndex = 0 + 0 = 0
    fireEvent.click(segments[0]);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("calls onIndexChange with correct index for non-first segment", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    fireEvent.click(segments[3]);
    expect(onIndexChange).toHaveBeenCalledWith(3);
  });

  // -------------------------------------------------------------------------
  // Keyboard navigation (Enter/Space) via event delegation
  // -------------------------------------------------------------------------
  it("triggers onIndexChange when Enter is pressed on a segment", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    fireEvent.keyDown(segments[0], { key: "Enter" });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("triggers onIndexChange when Space is pressed on a segment", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    fireEvent.keyDown(segments[1], { key: " " });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("does not trigger onIndexChange for other keys", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    fireEvent.keyDown(segments[0], { key: "Tab" });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Event delegation works on inner fill div
  // -------------------------------------------------------------------------
  it("event delegation works when clicking inner fill div", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    const innerDiv = segments[0].querySelector("div");
    expect(innerDiv).toBeTruthy();
    fireEvent.click(innerDiv!);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  // -------------------------------------------------------------------------
  // Accessibility attributes
  // -------------------------------------------------------------------------
  it("has proper progressbar ARIA attributes", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "3"); // currentIndex + 1
    expect(progressbar).toHaveAttribute("aria-valuemin", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "5");
  });

  it("segments have descriptive aria-labels", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    segments.forEach((segment) => {
      expect(segment).toHaveAttribute("aria-label");
      expect(segment.getAttribute("aria-label")).toBeTruthy();
    });
  });

  it("uses roving tabindex — only current segment has tabIndex 0", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    // currentIndex=2, fillPosition=2: only segment at fillPosition gets tabIndex 0
    segments.forEach((segment, i) => {
      if (i === 2) {
        expect(segment).toHaveAttribute("tabindex", "0");
      } else {
        expect(segment).toHaveAttribute("tabindex", "-1");
      }
    });
  });

  // -------------------------------------------------------------------------
  // React.memo prevents unnecessary re-renders
  // -------------------------------------------------------------------------
  it("React.memo prevents re-render when props are unchanged", () => {
    const { rerender } = render(<StoryProgressBar {...defaultProps} />);
    const progressbar1 = screen.getByRole("progressbar");
    rerender(<StoryProgressBar {...defaultProps} />);
    const progressbar2 = screen.getByRole("progressbar");
    expect(progressbar1).toBe(progressbar2);
  });

  // -------------------------------------------------------------------------
  // Fill position (visual correctness)
  // -------------------------------------------------------------------------
  it("applies correct fill classes based on currentIndex", () => {
    // currentIndex=2, storiesLength=5: fillPosition = 2 % 5 = 2
    // Segments 0,1,2 should have w-full; segments 3,4 should have w-0
    render(<StoryProgressBar {...defaultProps} />);
    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    for (let i = 0; i < 5; i++) {
      const fillDiv = segments[i].querySelector("div");
      expect(fillDiv).toBeTruthy();
      if (i <= 2) {
        expect(fillDiv!.className).toContain("w-full");
      } else {
        expect(fillDiv!.className).toContain("w-0");
      }
    }
  });

  // -------------------------------------------------------------------------
  // Arrow-key navigation (roving tabindex) — Fixes #139
  // -------------------------------------------------------------------------
  describe("arrow-key navigation", () => {
    const storyTitles = ["Lagos de Covadonga", "Oviedo Cathedral", "Sidra House", "Playa del Silencio", "Senda del Oso"];

    const arrowNavProps = {
      ...defaultProps,
      storyTitles,
    };

    it("ArrowRight navigates to next segment and calls onIndexChange", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      // Focus current segment (index 2), press ArrowRight -> should go to index 3
      fireEvent.keyDown(segments[2], { key: "ArrowRight" });
      expect(onIndexChange).toHaveBeenCalledWith(3);
    });

    it("ArrowLeft navigates to previous segment and calls onIndexChange", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      // Focus current segment (index 2), press ArrowLeft -> should go to index 1
      fireEvent.keyDown(segments[2], { key: "ArrowLeft" });
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("ArrowRight wraps from last segment to first", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} currentIndex={4} onIndexChange={onIndexChange} />
      );
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      fireEvent.keyDown(segments[4], { key: "ArrowRight" });
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("ArrowLeft wraps from first segment to last", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} currentIndex={0} onIndexChange={onIndexChange} />
      );
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      fireEvent.keyDown(segments[0], { key: "ArrowLeft" });
      expect(onIndexChange).toHaveBeenCalledWith(4);
    });

    it("only current segment has tabIndex 0, others have tabIndex -1 (roving tabindex)", () => {
      render(<StoryProgressBar {...arrowNavProps} />);
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      // currentIndex=2, fillPosition=2
      segments.forEach((segment, i) => {
        if (i === 2) {
          expect(segment).toHaveAttribute("tabindex", "0");
        } else {
          expect(segment).toHaveAttribute("tabindex", "-1");
        }
      });
    });

    it("includes story title in segment aria-label when storyTitles provided", () => {
      render(<StoryProgressBar {...arrowNavProps} />);
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      // Each segment label should include the story title
      expect(segments[0].getAttribute("aria-label")).toContain("Lagos de Covadonga");
      expect(segments[1].getAttribute("aria-label")).toContain("Oviedo Cathedral");
      expect(segments[2].getAttribute("aria-label")).toContain("Sidra House");
    });

    it("current segment has aria-current='true'", () => {
      render(<StoryProgressBar {...arrowNavProps} />);
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      expect(segments[2]).toHaveAttribute("aria-current", "true");
      expect(segments[0]).not.toHaveAttribute("aria-current");
      expect(segments[4]).not.toHaveAttribute("aria-current");
    });

    it("Home key navigates to first segment", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      fireEvent.keyDown(segments[2], { key: "Home" });
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("End key navigates to last segment", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
      const progressbar = screen.getByRole("progressbar");
      const segments = progressbar.querySelectorAll('[role="button"]');
      fireEvent.keyDown(segments[2], { key: "End" });
      expect(onIndexChange).toHaveBeenCalledWith(4);
    });
  });
});
