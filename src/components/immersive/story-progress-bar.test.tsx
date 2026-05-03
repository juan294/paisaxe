import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StoryProgressBar } from "./story-progress-bar";

const defaultProps = {
  storiesLength: 5,
  currentIndex: 2,
  onIndexChange: vi.fn(),
  t: (key: string) => key,
};

function getProgressNav() {
  return screen.getByRole("navigation", { name: "accessibility.story_progress" });
}

function getSegments() {
  return within(getProgressNav()).getAllByRole("button");
}

describe("StoryProgressBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Segment count
  // -------------------------------------------------------------------------
  it("uses navigation buttons instead of interactive descendants inside a progressbar", () => {
    render(<StoryProgressBar {...defaultProps} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "accessibility.story_progress" });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("renders correct number of segments (min of PAGE_SIZE and storiesLength)", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
    expect(segments.length).toBe(5); // 5 stories < 20 PAGE_SIZE
  });

  it("caps segments at PAGE_SIZE (20) for large story counts", () => {
    render(<StoryProgressBar {...defaultProps} storiesLength={50} />);
    const segments = getSegments();
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
    const segments = getSegments();
    // base = 2 - (2 % 5) = 0, targetIndex = 0 + 0 = 0
    fireEvent.click(segments[0]);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("calls onIndexChange with correct index for non-first segment", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const segments = getSegments();
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
    const segments = getSegments();
    fireEvent.keyDown(segments[0], { key: "Enter" });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("triggers onIndexChange when Space is pressed on a segment", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const segments = getSegments();
    fireEvent.keyDown(segments[1], { key: " " });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("does not trigger onIndexChange for other keys", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    const segments = getSegments();
    fireEvent.keyDown(segments[0], { key: "Tab" });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Click/keydown on navigation container (no segment target)
  // -------------------------------------------------------------------------
  it("does not call onIndexChange when clicking the navigation container directly", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    fireEvent.click(getProgressNav());
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("does not call onIndexChange when pressing a key on the navigation container directly", () => {
    const onIndexChange = vi.fn();
    render(
      <StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} />
    );
    fireEvent.keyDown(getProgressNav(), { key: "Enter" });
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
    const segments = getSegments();
    const innerDiv = segments[0].querySelector("span[aria-hidden='true']");
    expect(innerDiv).toBeTruthy();
    fireEvent.click(innerDiv!);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  // -------------------------------------------------------------------------
  // Accessibility attributes
  // -------------------------------------------------------------------------
  it("has proper navigation labelling and current item", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const nav = getProgressNav();
    expect(nav).toHaveAttribute("aria-label", "accessibility.story_progress");
    expect(getSegments()[2]).toHaveAttribute("aria-current", "page");
  });

  it("segments have descriptive aria-labels", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
    segments.forEach((segment) => {
      expect(segment).toHaveAttribute("aria-label");
      expect(segment.getAttribute("aria-label")).toBeTruthy();
    });
  });

  it("uses roving tabindex — only current segment has tabIndex 0", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
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
    const progressbar1 = getProgressNav();
    rerender(<StoryProgressBar {...defaultProps} />);
    const progressbar2 = getProgressNav();
    expect(progressbar1).toBe(progressbar2);
  });

  // -------------------------------------------------------------------------
  // Fill position (visual correctness)
  // -------------------------------------------------------------------------
  it("applies correct fill classes based on currentIndex", () => {
    // currentIndex=2, storiesLength=5: fillPosition = 2 % 5 = 2
    // Segments 0,1,2 should have w-full; segments 3,4 should have w-0
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
    for (let i = 0; i < 5; i++) {
      const fillDiv = segments[i].querySelector("span[aria-hidden='true']");
      expect(fillDiv).toBeTruthy();
      if (i <= 2) {
        expect(fillDiv!.className).toContain("w-full");
      } else {
        expect(fillDiv!.className).toContain("w-0");
      }
    }
  });

  // -------------------------------------------------------------------------
  // Segment label with and without storyTitles (line 128 branch)
  // -------------------------------------------------------------------------
  it("returns base label without story title when storyTitles is not provided", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
    // Without storyTitles, label should NOT contain a story title, just the base label
    const label = segments[0].getAttribute("aria-label");
    expect(label).toBeTruthy();
    // Should just be the base label (the t() key with replacements)
    expect(label).toBe("accessibility.go_to_story");
  });

  // -------------------------------------------------------------------------
  // Boundary guards in handleKeyDown/handleClick (lines 42,62,75,86,98,110)
  // When storiesLength > PAGE_SIZE, the last page may have segments that map
  // to indices beyond storiesLength. E.g., storiesLength=25, currentIndex=22:
  //   segmentCount=20, base=20, so segments 5-19 map to indices 25-39 (out of bounds).
  // The guards prevent onIndexChange from being called for those segments.
  //
  // Line 86 (Home guard) is genuinely unreachable because base is always derived
  // from a valid currentIndex, so base is always < storiesLength.
  //
  // Lines 38/52 (`if (!target) return`) are also defensive — event delegation
  // always finds [data-segment-index] via closest() from the segment or its fill div.
  // -------------------------------------------------------------------------
  describe("boundary guards with multi-page overflow", () => {
    // storiesLength=25, currentIndex=22 -> segmentCount=20, base=20, fillPosition=2
    // Segments 5-19 map to indices 25-39 which are out of bounds.
    const overflowProps = {
      storiesLength: 25,
      currentIndex: 22,
      onIndexChange: vi.fn(),
      t: (key: string) => key,
    };

    beforeEach(() => {
      overflowProps.onIndexChange = vi.fn();
    });

    it("does NOT call onIndexChange when clicking an out-of-bounds segment (line 42)", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // Segment 5 -> targetIndex = 20 + 5 = 25 >= 25 -> guard prevents call
      fireEvent.click(segments[5]);
      expect(overflowProps.onIndexChange).not.toHaveBeenCalled();
    });

    it("does NOT call onIndexChange on ArrowRight into out-of-bounds (line 62)", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // Segment 4 -> ArrowRight -> nextIdx=5, targetIndex=25 >= 25 -> guard
      fireEvent.keyDown(segments[4], { key: "ArrowRight" });
      expect(overflowProps.onIndexChange).not.toHaveBeenCalled();
    });

    it("does NOT call onIndexChange on ArrowLeft wrapping to out-of-bounds (line 75)", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // Segment 0 -> ArrowLeft -> prevIdx=19, targetIndex=20+19=39 >= 25 -> guard
      fireEvent.keyDown(segments[0], { key: "ArrowLeft" });
      expect(overflowProps.onIndexChange).not.toHaveBeenCalled();
    });

    it("does NOT call onIndexChange on End key when last segment is out-of-bounds (line 98)", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // End -> lastIdx=19, targetIndex=20+19=39 >= 25 -> guard
      fireEvent.keyDown(segments[2], { key: "End" });
      expect(overflowProps.onIndexChange).not.toHaveBeenCalled();
    });

    it("does NOT call onIndexChange on Enter for out-of-bounds segment (line 110)", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // Segment 10 -> Enter -> targetIndex=20+10=30 >= 25 -> guard
      fireEvent.keyDown(segments[10], { key: "Enter" });
      expect(overflowProps.onIndexChange).not.toHaveBeenCalled();
    });

    it("does NOT call onIndexChange on Space for out-of-bounds segment (line 110)", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // Segment 6 -> Space -> targetIndex=20+6=26 >= 25 -> guard
      fireEvent.keyDown(segments[6], { key: " " });
      expect(overflowProps.onIndexChange).not.toHaveBeenCalled();
    });

    it("still calls onIndexChange for in-bounds segments on the last page", () => {
      render(<StoryProgressBar {...overflowProps} />);
    const segments = getSegments();
      // Segment 4 -> targetIndex=20+4=24 < 25 -> valid
      fireEvent.click(segments[4]);
      expect(overflowProps.onIndexChange).toHaveBeenCalledWith(24);
    });

    // Line 86 (Home guard): base is always derived from a valid currentIndex,
    // so base is always >= 0 and < storiesLength. The false branch of this guard
    // is genuinely unreachable via the component's public API.
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
    const segments = getSegments();
      // Focus current segment (index 2), press ArrowRight -> should go to index 3
      fireEvent.keyDown(segments[2], { key: "ArrowRight" });
      expect(onIndexChange).toHaveBeenCalledWith(3);
    });

    it("ArrowLeft navigates to previous segment and calls onIndexChange", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
    const segments = getSegments();
      // Focus current segment (index 2), press ArrowLeft -> should go to index 1
      fireEvent.keyDown(segments[2], { key: "ArrowLeft" });
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("ArrowRight wraps from last segment to first", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} currentIndex={4} onIndexChange={onIndexChange} />
      );
    const segments = getSegments();
      fireEvent.keyDown(segments[4], { key: "ArrowRight" });
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("ArrowLeft wraps from first segment to last", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} currentIndex={0} onIndexChange={onIndexChange} />
      );
    const segments = getSegments();
      fireEvent.keyDown(segments[0], { key: "ArrowLeft" });
      expect(onIndexChange).toHaveBeenCalledWith(4);
    });

    it("only current segment has tabIndex 0, others have tabIndex -1 (roving tabindex)", () => {
      render(<StoryProgressBar {...arrowNavProps} />);
    const segments = getSegments();
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
    const segments = getSegments();
      // Each segment label should include the story title
      expect(segments[0].getAttribute("aria-label")).toContain("Lagos de Covadonga");
      expect(segments[1].getAttribute("aria-label")).toContain("Oviedo Cathedral");
      expect(segments[2].getAttribute("aria-label")).toContain("Sidra House");
    });

    // UX-M10 (#520): Touch affordance — segments must be at least h-1.5, contrast bg-white/40
  it("UX-M10: segments use h-1.5 default height for better touch affordance", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
    // All segments must have h-1.5 (not the old h-1)
    segments.forEach((segment) => {
      expect(segment.className).toContain("h-1.5");
    });
  });

  it("UX-M10: segments use bg-white/40 inactive contrast (not bg-white/30)", () => {
    render(<StoryProgressBar {...defaultProps} />);
    const segments = getSegments();
    segments.forEach((segment) => {
      expect(segment.className).toContain("bg-white/40");
    });
  });

  it("current segment has aria-current='true'", () => {
      render(<StoryProgressBar {...arrowNavProps} />);
    const segments = getSegments();
      expect(segments[2]).toHaveAttribute("aria-current", "page");
      expect(segments[0]).not.toHaveAttribute("aria-current");
      expect(segments[4]).not.toHaveAttribute("aria-current");
    });

    it("Home key navigates to first segment", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
    const segments = getSegments();
      fireEvent.keyDown(segments[2], { key: "Home" });
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("End key navigates to last segment", () => {
      const onIndexChange = vi.fn();
      render(
        <StoryProgressBar {...arrowNavProps} onIndexChange={onIndexChange} />
      );
    const segments = getSegments();
      fireEvent.keyDown(segments[2], { key: "End" });
      expect(onIndexChange).toHaveBeenCalledWith(4);
    });
  });
});
