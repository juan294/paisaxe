import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useStoryKeyboardNav } from "./use-story-keyboard-nav";

type MockFn = (() => void) & ReturnType<typeof vi.fn>;

describe("useStoryKeyboardNav", () => {
  let onNext: MockFn;
  let onPrev: MockFn;
  let onToggleInfo: MockFn;

  beforeEach(() => {
    onNext = vi.fn() as MockFn;
    onPrev = vi.fn() as MockFn;
    onToggleInfo = vi.fn() as MockFn;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call onNext when ArrowRight is pressed", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    fireEvent.keyDown(document.body, { key: "ArrowRight" });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("should handle document capture events once when they also bubble to window", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    const button = document.createElement("button");
    document.body.appendChild(button);

    fireEvent.keyDown(button, { key: "ArrowRight" });

    document.body.removeChild(button);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("should handle shortcuts before focused child controls can stop propagation", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    const button = document.createElement("button");
    button.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(button);

    fireEvent.keyDown(button, { key: "i" });

    document.body.removeChild(button);
    expect(onToggleInfo).toHaveBeenCalledTimes(1);
  });

  it("should call onNext when Space is pressed", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    fireEvent.keyDown(document.body, { key: " " });

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("should call onPrev when ArrowLeft is pressed", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    fireEvent.keyDown(document.body, { key: "ArrowLeft" });

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("should call onToggleInfo when i is pressed", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    fireEvent.keyDown(document.body, { key: "i" });

    expect(onToggleInfo).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("should not call any handler when chatOpen is true", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: true })
    );

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: " " });
    fireEvent.keyDown(document.body, { key: "i" });

    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
    expect(onToggleInfo).not.toHaveBeenCalled();
  });

  it("should not navigate when keydown target is INPUT", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "ArrowRight" });
    document.body.removeChild(input);

    expect(onNext).not.toHaveBeenCalled();
  });

  it("should not navigate when keydown target is TEXTAREA", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: "ArrowRight" });
    document.body.removeChild(textarea);

    expect(onNext).not.toHaveBeenCalled();
  });

  it("should not navigate when keydown target is contentEditable", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    const child = document.createElement("span");
    div.appendChild(child);
    fireEvent.keyDown(child, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it("should ignore unrecognized keys without calling handlers", () => {
    renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    fireEvent.keyDown(document.body, { key: "k" });

    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
    expect(onToggleInfo).not.toHaveBeenCalled();
  });

  it("should remove event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false })
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      { capture: true }
    );
  });

  it("should use the current chat state when it changes", () => {
    let chatOpen = false;
    const { rerender } = renderHook(({ chatOpen: c }) =>
      useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: c }),
      { initialProps: { chatOpen } }
    );

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(1);

    // Now close chat
    chatOpen = true;
    rerender({ chatOpen });
    onNext.mockClear();

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
  });
});

// Real DOM dispatch starts at a focused element and reaches document capture.
// Production has no window-only synthetic dispatcher (consumer inventory, Phase 6).
describe("story keyboard ownership", () => {
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

  it("keeps exactly one capture listener through callback and disabled-state rerenders", () => {
    const documentAdd = vi.spyOn(document, "addEventListener");
    const documentRemove = vi.spyOn(document, "removeEventListener");
    const windowAdd = vi.spyOn(window, "addEventListener");
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderHook(({ onNext, chatOpen }) =>
      useStoryKeyboardNav({ onNext, onPrev: vi.fn(), onToggleInfo: vi.fn(), chatOpen }),
      { initialProps: { onNext: first, chatOpen: false } });
    const keyAdds = () => documentAdd.mock.calls.filter(([type]) => type === "keydown");
    expect(keyAdds()).toHaveLength(1);
    expect(keyAdds()[0]?.[2]).toEqual({ capture: true });
    expect(windowAdd.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);
    const listener = keyAdds()[0]?.[1];
    rerender({ onNext: latest, chatOpen: false });
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    rerender({ onNext: latest, chatOpen: true });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(latest).toHaveBeenCalledTimes(1);
    rerender({ onNext: latest, chatOpen: false });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(latest).toHaveBeenCalledTimes(2);
    expect(keyAdds()).toHaveLength(1);
    expect(documentRemove.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);
    unmount();
    expect(documentRemove).toHaveBeenCalledWith("keydown", listener, { capture: true });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(latest).toHaveBeenCalledTimes(2);
  });

  it("calls the latest previous/info callbacks without reinstalling navigation", () => {
    const oldPrev = vi.fn();
    const oldInfo = vi.fn();
    const latestPrev = vi.fn();
    const latestInfo = vi.fn();
    const { rerender } = renderHook(({ onPrev, onToggleInfo }) =>
      useStoryKeyboardNav({ onNext: vi.fn(), onPrev, onToggleInfo, chatOpen: false }),
      { initialProps: { onPrev: oldPrev, onToggleInfo: oldInfo } });
    rerender({ onPrev: latestPrev, onToggleInfo: latestInfo });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "i" });
    expect(oldPrev).not.toHaveBeenCalled();
    expect(oldInfo).not.toHaveBeenCalled();
    expect(latestPrev).toHaveBeenCalledTimes(1);
    expect(latestInfo).toHaveBeenCalledTimes(1);
  });

  it.each([
    '<form><button>Form action</button></form>',
    '<div contenteditable="true"><span>Editable descendant</span></div>',
    '<div role="dialog" aria-modal="true"><button>Dialog action</button></div>',
    '<div role="menu"><button role="menuitem">Menu action</button></div>',
    '<div role="tablist"><button role="tab">Local tab</button></div>',
  ])("preserves local focus ownership for %s", (markup) => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onToggleInfo = vi.fn();
    renderHook(() => useStoryKeyboardNav({ onNext, onPrev, onToggleInfo, chatOpen: false }));
    document.body.insertAdjacentHTML("beforeend", markup);
    const target = document.body.lastElementChild!.lastElementChild!;
    for (const key of ["ArrowRight", "ArrowLeft", " ", "i"]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
    expect(onToggleInfo).not.toHaveBeenCalled();
  });

  it("respects an already prevented shortcut without claiming it", () => {
    const onNext = vi.fn();
    renderHook(() => useStoryKeyboardNav({ onNext, onPrev: vi.fn(), onToggleInfo: vi.fn(), chatOpen: false }));
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    event.preventDefault();
    document.body.dispatchEvent(event);
    expect(onNext).not.toHaveBeenCalled();
  });
});
