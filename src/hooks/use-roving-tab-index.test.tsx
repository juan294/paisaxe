import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { useRovingTabIndex } from "./use-roving-tab-index";

// Real primitive with native controls. Consumer policy (selection and events)
// stays in this harness just as it stays in progress/pricing integration tests.
function RovingControls({ count, orientation = "horizontal", onSelect }: {
  count: number;
  orientation?: "horizontal" | "both";
  onSelect: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { itemRefs, getTabIndex, focusForKey } = useRovingTabIndex({ count, activeIndex, orientation });
  return <>
    <button>Outside</button>
    <div data-testid="controls">
      {Array.from({ length: count }, (_, index) => <button
        key={index}
        ref={(element) => { itemRefs.current[index] = element; }}
        tabIndex={getTabIndex(index)}
        onKeyDown={(event) => {
          const next = focusForKey(event.key, index);
          if (next === null) return;
          setActiveIndex(next);
          onSelect(next);
        }}
      >Item {index}</button>)}
    </div>
  </>;
}

const item = (index: number) => screen.getByRole("button", { name: `Item ${index}` });

describe("useRovingTabIndex", () => {
  it("wraps/Home/End rapidly using current focus and one active tab stop", () => {
    const onSelect = vi.fn();
    render(<RovingControls count={3} onSelect={onSelect} />);
    item(0).focus();
    for (const [key, expected] of [
      ["ArrowLeft", 2], ["ArrowRight", 0], ["End", 2],
      ["Home", 0], ["ArrowRight", 1], ["ArrowRight", 2],
    ] as const) {
      fireEvent.keyDown(document.activeElement!, { key });
      expect(item(expected)).toHaveFocus();
      expect(item(expected)).toHaveAttribute("tabindex", "0");
      expect(screen.getAllByRole("button").filter((button) => button.tabIndex === 0 && button.textContent?.startsWith("Item"))).toEqual([item(expected)]);
    }
    expect(onSelect.mock.calls.map(([index]) => index)).toEqual([2, 0, 2, 0, 1, 2]);
  });

  it("keeps one item selected and focused for every supported key", () => {
    const onSelect = vi.fn();
    render(<RovingControls count={1} orientation="both" onSelect={onSelect} />);
    item(0).focus();
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) fireEvent.keyDown(item(0), { key });
    expect(onSelect.mock.calls.map(([index]) => index)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(item(0)).toHaveFocus();
  });

  it("returns no index for an empty set without stealing outside focus", () => {
    render(<button>Outside</button>);
    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    const { result } = renderHook(() => useRovingTabIndex({ count: 0, activeIndex: 0 }));
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(result.current.focusForKey(key, 0)).toBeNull();
    }
    expect(result.current.getTabIndex(0)).toBe(-1);
    expect(outside).toHaveFocus();
  });

  it("rejects source indices outside the current set", () => {
    const { result } = renderHook(() => useRovingTabIndex({ count: 3, activeIndex: 0 }));
    expect(result.current.focusForKey("Home", -1)).toBeNull();
    expect(result.current.focusForKey("End", 3)).toBeNull();
    expect(result.current.getTabIndex(-1)).toBe(-1);
    expect(result.current.getTabIndex(3)).toBe(-1);
  });

  it("supports vertical keys only when opted in, without claiming event policy", () => {
    const onSelect = vi.fn();
    const view = render(<RovingControls count={3} onSelect={onSelect} />);
    item(0).focus();
    fireEvent.keyDown(item(0), { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(item(0)).toHaveFocus();
    view.rerender(<RovingControls count={3} orientation="both" onSelect={onSelect} />);
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    fireEvent(item(0), event);
    expect(item(1)).toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
    fireEvent.keyDown(item(1), { key: "ArrowUp" });
    expect(item(0)).toHaveFocus();
    expect(onSelect.mock.calls.map(([index]) => index)).toEqual([1, 0]);
  });

  it("does not interpret activation or Tab as roving selection", () => {
    const onSelect = vi.fn();
    render(<RovingControls count={3} onSelect={onSelect} />);
    item(0).focus();
    for (const key of ["Enter", " ", "Tab"]) fireEvent.keyDown(item(0), { key });
    expect(onSelect).not.toHaveBeenCalled();
    expect(item(0)).toHaveFocus();
  });

  it("uses the new count after shrinking and never focuses a removed last control", () => {
    const onSelect = vi.fn();
    const view = render(<RovingControls count={3} onSelect={onSelect} />);
    const removed = item(2);
    view.rerender(<RovingControls count={1} onSelect={onSelect} />);
    item(0).focus();
    fireEvent.keyDown(item(0), { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(0);
    expect(removed).not.toBeInTheDocument();
    expect(item(0)).toHaveFocus();
  });
});
