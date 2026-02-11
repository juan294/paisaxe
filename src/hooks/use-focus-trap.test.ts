import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusTrap } from "./use-focus-trap";
import type { RefObject } from "react";

// Helper to create a container with focusable elements
function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  const btn1 = document.createElement("button");
  btn1.textContent = "First";
  const input = document.createElement("input");
  input.type = "text";
  const btn2 = document.createElement("button");
  btn2.textContent = "Last";

  container.appendChild(btn1);
  container.appendChild(input);
  container.appendChild(btn2);
  document.body.appendChild(container);

  return container;
}

function makeRef(el: HTMLElement | null): RefObject<HTMLElement | null> {
  return { current: el };
}

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = createContainer();
    // Make requestAnimationFrame synchronous for testing
    rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    rafSpy.mockRestore();
  });

  it("should focus the first focusable element when activated", () => {
    const ref = makeRef(container);
    renderHook(() => useFocusTrap(ref, true));

    const firstButton = container.querySelector("button");
    expect(document.activeElement).toBe(firstButton);
  });

  it("should not focus anything when inactive", () => {
    const ref = makeRef(container);
    // Focus body initially
    document.body.focus();

    renderHook(() => useFocusTrap(ref, false));

    // Focus should remain on body (or wherever it was)
    expect(document.activeElement).not.toBe(container.querySelector("button"));
  });

  it("should not move focus if focus is already inside the container", () => {
    const input = container.querySelector("input")!;
    input.focus();
    expect(document.activeElement).toBe(input);

    const ref = makeRef(container);
    renderHook(() => useFocusTrap(ref, true));

    // Focus should remain on the input, not jump to the first button
    expect(document.activeElement).toBe(input);
  });

  it("should wrap focus from last to first on Tab", () => {
    const ref = makeRef(container);
    renderHook(() => useFocusTrap(ref, true));

    const buttons = container.querySelectorAll("button");
    const lastButton = buttons[buttons.length - 1];

    // Focus the last element
    lastButton.focus();
    expect(document.activeElement).toBe(lastButton);

    // Press Tab on the last element
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);

    // Focus should wrap to the first focusable element
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("should wrap focus from first to last on Shift+Tab", () => {
    const ref = makeRef(container);
    renderHook(() => useFocusTrap(ref, true));

    const buttons = container.querySelectorAll("button");
    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];

    // Focus the first element
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    // Press Shift+Tab on the first element
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);

    // Focus should wrap to the last focusable element
    expect(document.activeElement).toBe(lastButton);
  });

  it("should not prevent Tab when focus is in the middle of the trap", () => {
    const ref = makeRef(container);
    renderHook(() => useFocusTrap(ref, true));

    const input = container.querySelector("input")!;
    input.focus();

    // Press Tab while on the middle element (should not preventDefault)
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    container.dispatchEvent(event);

    // Should NOT have prevented default — browser handles normal tab
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("should call onEscape when Escape key is pressed", () => {
    const onEscape = vi.fn();
    const ref = makeRef(container);

    renderHook(() => useFocusTrap(ref, true, onEscape));

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("should not call onEscape when Escape is pressed but no handler provided", () => {
    const ref = makeRef(container);

    // No onEscape callback — should not throw
    renderHook(() => useFocusTrap(ref, true));

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    // Should not throw
    expect(() => container.dispatchEvent(event)).not.toThrow();
  });

  it("should restore focus to the previously focused element on unmount", () => {
    // Focus an element outside the container first
    const externalButton = document.createElement("button");
    externalButton.textContent = "External";
    document.body.appendChild(externalButton);
    externalButton.focus();
    expect(document.activeElement).toBe(externalButton);

    const ref = makeRef(container);
    const { unmount } = renderHook(() => useFocusTrap(ref, true));

    // Focus should now be inside the container
    const firstButton = container.querySelector("button");
    expect(document.activeElement).toBe(firstButton);

    // Unmount the hook — focus should restore to the external button
    unmount();
    expect(document.activeElement).toBe(externalButton);
  });

  it("should clean up event listener on unmount", () => {
    const removeEventSpy = vi.spyOn(container, "removeEventListener");
    const ref = makeRef(container);

    const { unmount } = renderHook(() => useFocusTrap(ref, true));

    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeEventSpy.mockRestore();
  });

  it("should handle container with no focusable elements", () => {
    const emptyContainer = document.createElement("div");
    emptyContainer.textContent = "No focusable elements here";
    document.body.appendChild(emptyContainer);

    const ref = makeRef(emptyContainer);

    // Should not throw
    expect(() => {
      renderHook(() => useFocusTrap(ref, true));
    }).not.toThrow();
  });

  it("should handle null ref gracefully", () => {
    const ref = makeRef(null);

    // Should not throw
    expect(() => {
      renderHook(() => useFocusTrap(ref, true));
    }).not.toThrow();
  });

  it("should skip disabled buttons in focus trap", () => {
    // Create a container with a disabled button
    const customContainer = document.createElement("div");
    const btn1 = document.createElement("button");
    btn1.textContent = "Enabled";
    const disabledBtn = document.createElement("button");
    disabledBtn.textContent = "Disabled";
    disabledBtn.disabled = true;
    const btn2 = document.createElement("button");
    btn2.textContent = "Also Enabled";

    customContainer.appendChild(btn1);
    customContainer.appendChild(disabledBtn);
    customContainer.appendChild(btn2);
    document.body.appendChild(customContainer);

    const ref = makeRef(customContainer);
    renderHook(() => useFocusTrap(ref, true));

    // Focus last enabled element
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Tab from last should wrap to first (skipping disabled)
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    customContainer.dispatchEvent(event);

    expect(document.activeElement).toBe(btn1);
  });
});
