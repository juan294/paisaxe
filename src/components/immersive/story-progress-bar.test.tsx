import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
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

  // UX-M6 (#479): list items must carry a stable, story-position-derived key
  // (data-story-index) rather than the volatile within-page index.
  it("renders list items keyed by the absolute story index (stable key)", () => {
    const { container } = render(<StoryProgressBar {...defaultProps} />);
    const items = container.querySelectorAll("li[data-story-index]");
    expect(items).toHaveLength(5);
    const indices = Array.from(items).map((el) => el.getAttribute("data-story-index"));
    expect(indices).toEqual(["0", "1", "2", "3", "4"]);
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

  // The former overflow tests encoded invalid buttons as expected UI and
  // asserted inert End/wrap. The approved contract requires a valid partial
  // window instead: only existing stories, with focus and absolute selection.
  describe("Phase 6 partial-page roving contract", () => {
    function StatefulProgress({ count, initialIndex, onSelect }: {
      count: number; initialIndex: number; onSelect: (index: number) => void;
    }) {
      const [currentIndex, setCurrentIndex] = useState(initialIndex);
      return <StoryProgressBar {...defaultProps} storiesLength={count} currentIndex={currentIndex}
        onIndexChange={(index) => { onSelect(index); setCurrentIndex(index); }} />;
    }

    it.each([
      { count: 25, currentIndex: 20, indices: [20, 21, 22, 23, 24], active: 0 },
      { count: 47, currentIndex: 42, indices: [40, 41, 42, 43, 44, 45, 46], active: 2 },
    ])("renders only valid absolute indices for $count stories at $currentIndex", ({ count, currentIndex, indices, active }) => {
      render(<StoryProgressBar {...defaultProps} storiesLength={count} currentIndex={currentIndex} />);
      const buttons = getSegments();
      expect(buttons).toHaveLength(indices.length);
      expect(buttons.map((button) => Number(button.closest("li")?.dataset.storyIndex))).toEqual(indices);
      expect(buttons[active]).toHaveAttribute("aria-current", "page");
      expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([buttons[active]]);
    });

    it.each([
      { key: "End", from: 0, expected: 24, focused: 4 },
      { key: "Home", from: 4, expected: 20, focused: 0 },
      { key: "ArrowLeft", from: 0, expected: 24, focused: 4 },
      { key: "ArrowRight", from: 4, expected: 20, focused: 0 },
      { key: "Enter", from: 4, expected: 24, focused: 4 },
      { key: " ", from: 4, expected: 24, focused: 4 },
    ])("$key on the partial window selects absolute $expected once and owns propagation", ({ key, from, expected, focused }) => {
      const onSelect = vi.fn();
      const parentKeyDown = vi.fn();
      render(<div onKeyDown={parentKeyDown}><StatefulProgress count={25} initialIndex={20 + from} onSelect={onSelect} /></div>);
      const target = getSegments()[from]!;
      target.focus();
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      fireEvent(target, event);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(expected);
      expect(event.defaultPrevented).toBe(true);
      expect(parentKeyDown).not.toHaveBeenCalled();
      expect(getSegments()[focused]).toHaveFocus();
      expect(getSegments()[focused]).toHaveAttribute("tabindex", "0");
      expect(getSegments()[focused]).toHaveAttribute("aria-current", "page");
    });

    it("maps a partial-page inner-fill click to its absolute story and stops bubbling", () => {
      const onSelect = vi.fn();
      const parentClick = vi.fn();
      render(<div onClick={parentClick}><StatefulProgress count={25} initialIndex={20} onSelect={onSelect} /></div>);
      fireEvent.click(getSegments()[4]!.querySelector("span")!);
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(24);
      expect(parentClick).not.toHaveBeenCalled();
      expect(getSegments()[4]).toHaveAttribute("aria-current", "page");
    });

    it("rapid keys use the current focused index and keep one local tab stop", () => {
      const onSelect = vi.fn();
      render(<StatefulProgress count={25} initialIndex={20} onSelect={onSelect} />);
      getSegments()[0]!.focus();
      for (const [key, absolute] of [
        ["End", 24], ["ArrowRight", 20], ["ArrowRight", 21],
        ["ArrowLeft", 20], ["ArrowLeft", 24], ["Home", 20],
      ] as const) {
        fireEvent.keyDown(document.activeElement!, { key });
        const current = getSegments().filter((button) => button.tabIndex === 0);
        expect(current).toHaveLength(1);
        expect(current[0]).toHaveFocus();
        expect(current[0]?.closest("li")).toHaveAttribute("data-story-index", String(absolute));
      }
      expect(onSelect.mock.calls.map(([index]) => index)).toEqual([24, 20, 21, 20, 24, 20]);
    });

    it("is inert for an empty set and preserves outside focus", () => {
      const onSelect = vi.fn();
      render(<><button>Outside focus</button><StoryProgressBar {...defaultProps} storiesLength={0} currentIndex={0} onIndexChange={onSelect} /></>);
      const outside = screen.getByRole("button", { name: "Outside focus" });
      outside.focus();
      expect(within(getProgressNav()).queryAllByRole("button")).toHaveLength(0);
      for (const key of ["ArrowRight", "ArrowLeft", "Home", "End", "Enter", " "]) {
        fireEvent.keyDown(getProgressNav(), { key });
      }
      expect(onSelect).not.toHaveBeenCalled();
      expect(outside).toHaveFocus();
    });

    it.each([{ count: 1, absolute: 0 }, { count: 21, absolute: 20 }])(
      "one visible item in $count stories wraps only to absolute $absolute", ({ count, absolute }) => {
        const onSelect = vi.fn();
        render(<StatefulProgress count={count} initialIndex={absolute} onSelect={onSelect} />);
        expect(getSegments()).toHaveLength(1);
        const button = getSegments()[0]!;
        button.focus();
        for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) fireEvent.keyDown(button, { key });
        expect(onSelect.mock.calls.map(([index]) => index)).toEqual([absolute, absolute, absolute, absolute]);
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute("tabindex", "0");
      }
    );

    it("replaces the page refs when the story set shrinks, without focusing removed segments", () => {
      const onIndexChange = vi.fn();
      const view = render(<StoryProgressBar {...defaultProps} storiesLength={50} currentIndex={39} onIndexChange={onIndexChange} />);
      const removedLast = getSegments()[19]!;
      view.rerender(<StoryProgressBar {...defaultProps} storiesLength={25} currentIndex={22} onIndexChange={onIndexChange} />);
      const target = getSegments()[2]!;
      target.focus();
      fireEvent.keyDown(target, { key: "End" });
      expect(onIndexChange).toHaveBeenCalledExactlyOnceWith(24);
      expect(removedLast).not.toBeInTheDocument();
      expect(getSegments()[4]).toHaveFocus();
    });

    it("retains horizontal-only story behavior and lets unclaimed vertical/Tab keys bubble", () => {
      const onIndexChange = vi.fn();
      const parent = vi.fn();
      render(<div onKeyDown={parent}><StoryProgressBar {...defaultProps} onIndexChange={onIndexChange} /></div>);
      const button = getSegments()[2]!;
      button.focus();
      for (const key of ["ArrowDown", "ArrowUp", "Tab"]) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        fireEvent(button, event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onIndexChange).not.toHaveBeenCalled();
      expect(parent).toHaveBeenCalledTimes(3);
      expect(button).toHaveFocus();
    });
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
