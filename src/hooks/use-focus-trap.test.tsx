import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";

// ---------- test helpers ----------

function TestTrap({
  active,
  onEscape,
}: {
  active: boolean;
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, onEscape);

  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn1">First</button>
      <input data-testid="input1" />
      <button data-testid="btn2">Last</button>
    </div>
  );
}

function EmptyTrap({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);

  return (
    <div ref={ref} data-testid="trap-container">
      <span>No focusable elements here</span>
    </div>
  );
}

// ---------- suite ----------

describe("useFocusTrap", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("wraps focus from last element to first on Tab", () => {
    const { getByTestId } = render(<TestTrap active={true} />);
    const container = getByTestId("trap-container");
    const btn2 = getByTestId("btn2");

    // Focus the last button
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Press Tab on the container (event bubbles from focused child)
    fireEvent.keyDown(container, { key: "Tab", shiftKey: false });

    // Focus should wrap to the first focusable element
    expect(document.activeElement).toBe(getByTestId("btn1"));
  });

  it("wraps focus from first element to last on Shift+Tab", () => {
    const { getByTestId } = render(<TestTrap active={true} />);
    const container = getByTestId("trap-container");
    const btn1 = getByTestId("btn1");

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    fireEvent.keyDown(container, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(getByTestId("btn2"));
  });

  it("calls onEscape when Escape key is pressed", () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(
      <TestTrap active={true} onEscape={onEscape} />
    );
    const container = getByTestId("trap-container");

    fireEvent.keyDown(container, { key: "Escape" });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("ignores non-Tab and non-Escape keys", () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(
      <TestTrap active={true} onEscape={onEscape} />
    );
    const container = getByTestId("trap-container");
    const btn1 = getByTestId("btn1");

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    fireEvent.keyDown(container, { key: "Enter" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "a" });

    // Focus should not have moved
    expect(document.activeElement).toBe(btn1);
    // onEscape should not have been called
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("does not attach keydown handler when active is false", () => {
    const { getByTestId } = render(<TestTrap active={false} />);
    const container = getByTestId("trap-container");
    const btn2 = getByTestId("btn2");

    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Tab on last element should NOT wrap (no handler attached)
    fireEvent.keyDown(container, { key: "Tab", shiftKey: false });

    // Focus stays on btn2 — no wrapping behaviour
    expect(document.activeElement).toBe(btn2);
  });

  it("restores focus to previously focused element on cleanup", () => {
    // Create an external button and focus it before mounting the trap
    const outer = document.createElement("button");
    outer.textContent = "Outside";
    document.body.appendChild(outer);
    outer.focus();
    expect(document.activeElement).toBe(outer);

    const { unmount } = render(<TestTrap active={true} />);

    // After mounting, the trap should have moved focus inside
    // (requestAnimationFrame mock fires synchronously)
    expect(document.activeElement).not.toBe(outer);

    // Unmount the trap — focus should be restored to the outer button
    unmount();
    expect(document.activeElement).toBe(outer);

    document.body.removeChild(outer);
  });

  it("does not throw when container has no focusable elements and Tab is pressed", () => {
    const { getByTestId } = render(<EmptyTrap active={true} />);
    const container = getByTestId("trap-container");

    // Should not throw
    expect(() => {
      fireEvent.keyDown(container, { key: "Tab", shiftKey: false });
      fireEvent.keyDown(container, { key: "Tab", shiftKey: true });
    }).not.toThrow();
  });
});
