import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { createMatchMedia } from "@/test/match-media";

const HOME = "JG";
const FIRST_MSG = "hecho con ♥ en Asturias";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MESSAGE_TYPED_AT = 30_000 + HOME.length * 80 + 300 + FIRST_MSG.length * 80;
const MESSAGE_ERASED_AT = MESSAGE_TYPED_AT + 4_000 + FIRST_MSG.length * 80;

function mockMatchMedia(reducedMotion: boolean) {
  const media = createMatchMedia({ [REDUCED_MOTION]: reducedMotion });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn(media.matchMedia),
  });
  return media;
}

describe("AuthorTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("renders with initial text 'JG'", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    expect(screen.getByText(/JG/)).toBeInTheDocument();
  });

  it("renders blinking cursor with aria-hidden", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    const pill = screen.getByLabelText("Made by Juan González");
    const cursor = pill.querySelector("[aria-hidden='true']");
    expect(cursor).toBeInTheDocument();
    expect(cursor?.textContent).toContain("▌");
  });

  it("cursor has animate-cursor-blink class (CSS hides it under reduced motion)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    const pill = screen.getByLabelText("Made by Juan González");
    expect(pill.querySelector(".animate-cursor-blink")).toBeInTheDocument();
  });

  it("renders all four social links", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    expect(screen.getByLabelText("X (Twitter)")).toHaveAttribute("href", "https://x.com/JuanG294");
    expect(screen.getByLabelText("LinkedIn")).toHaveAttribute("href", "https://www.linkedin.com/in/juanagonzalezp/");
    expect(screen.getByLabelText("Medium")).toHaveAttribute("href", "https://medium.com/@juang294");
    expect(screen.getByLabelText("GitHub")).toHaveAttribute("href", "https://github.com/juan294");
  });

  it("opens social links in a new tab with noopener noreferrer", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    const x = screen.getByLabelText("X (Twitter)");
    expect(x).toHaveAttribute("target", "_blank");
    expect(x).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays author name in popover", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    expect(screen.getByText("Juan González")).toBeInTheDocument();
  });

  it("reveals the social popover on keyboard focus, matching the hover reveal (#906)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    const popover = screen.getByLabelText("X (Twitter)").closest(
      "div.absolute.bottom-full"
    )!;
    // The popover must pair every hover-reveal utility with a focus-within
    // counterpart, so tabbing to a social link also makes it visible.
    expect(popover).toHaveClass("group-hover:opacity-100");
    expect(popover).toHaveClass("group-focus-within:opacity-100");
    expect(popover).toHaveClass("group-hover:pointer-events-auto");
    expect(popover).toHaveClass("group-focus-within:pointer-events-auto");
  });

  it("gives each social link a visible focus-visible ring (#906)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    for (const label of ["X (Twitter)", "LinkedIn", "Medium", "GitHub"]) {
      const link = screen.getByLabelText(label);
      expect(link).toHaveClass("focus-visible:outline-none");
      expect(link).toHaveClass("focus-visible:ring-2");
    }
  });

  it("does not start animation when prefers-reduced-motion is set", async () => {
    mockMatchMedia(true);
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });

    expect(textSpan.textContent).toBe(HOME);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops the active cycle when reduced motion is enabled and restarts when disabled", async () => {
    const media = mockMatchMedia(false);
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    await act(async () => vi.advanceTimersByTimeAsync(31_000));
    expect(textSpan.textContent).not.toBe(HOME);
    act(() => media.setMatches(REDUCED_MOTION, true));
    expect(textSpan.textContent).toBe(HOME);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(textSpan.textContent).toBe(HOME);

    act(() => media.setMatches(REDUCED_MOTION, false));
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => vi.advanceTimersByTimeAsync(29_999));
    expect(textSpan.textContent).toBe(HOME);
    await act(async () => vi.advanceTimersByTimeAsync(1_001));
    expect(textSpan.textContent).not.toBe(HOME);
  });

  it("starts after an initially reduced-motion visitor permits motion", async () => {
    const media = mockMatchMedia(true);
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    expect(vi.getTimerCount()).toBe(0);
    act(() => media.setMatches(REDUCED_MOTION, false));
    await act(async () => vi.advanceTimersByTimeAsync(31_000));
    expect(textSpan.textContent).not.toBe(HOME);
  });

  it("keeps only the final cycle after rapid reduced-motion changes", async () => {
    const media = mockMatchMedia(false);
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    await act(async () => vi.advanceTimersByTimeAsync(29_000));
    for (const matches of [true, false, true, false]) {
      act(() => media.setMatches(REDUCED_MOTION, matches));
    }
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(textSpan.textContent).toBe(HOME);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(textSpan.textContent).not.toBe(HOME);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("unsubscribes from motion changes and clears the active timer on unmount", async () => {
    const media = mockMatchMedia(false);
    const query = media.matchMedia(REDUCED_MOTION);
    const add = vi.spyOn(query, "addEventListener");
    const remove = vi.spyOn(query, "removeEventListener");
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(<AuthorTypewriter />);
    expect(add).toHaveBeenCalledWith("change", expect.any(Function));
    const handler = add.mock.calls[0][1];
    unmount();
    expect(remove).toHaveBeenCalledWith("change", handler);
    expect(vi.getTimerCount()).toBe(0);
    act(() => media.setMatches(REDUCED_MOTION, true));
    act(() => media.setMatches(REDUCED_MOTION, false));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("hides on mobile via hidden / md:block classes", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    const wrapper = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(wrapper).toHaveClass("hidden");
    expect(wrapper).toHaveClass("md:block");
  });

  it("is visually hidden when visible=false", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter visible={false} />);
    const wrapper = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(wrapper).toHaveClass("opacity-0");
    expect(wrapper).toHaveClass("pointer-events-none");
  });

  it("is visible when visible=true", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter visible={true} />);
    const wrapper = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(wrapper).toHaveClass("opacity-100");
    expect(wrapper).not.toHaveClass("pointer-events-none");
  });

  it("defaults to visible when prop omitted", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter />);
    const wrapper = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(wrapper).toHaveClass("opacity-100");
  });

  it("cycles to the next message after HOME_HOLD and back to HOME", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    expect(textSpan.textContent).toBe(HOME);

    // HOME_HOLD (30s) → erase HOME (2 chars × 80ms = 160ms) → EMPTY_PAUSE (300ms)
    // → type FIRST_MSG (FIRST_MSG.length × 80ms)
    const tilNextMsgComplete = 30_000 + 2 * 80 + 300 + FIRST_MSG.length * 80 + 50;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(tilNextMsgComplete);
    });
    expect(textSpan.textContent).toBe(FIRST_MSG);

    // MSG_HOLD (4000ms) → erase msg → EMPTY_PAUSE (300ms) → type HOME
    const tilHomeAgain = 4000 + FIRST_MSG.length * 80 + 300 + HOME.length * 80 + 50;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(tilHomeAgain);
    });
    expect(textSpan.textContent).toBe(HOME);
  });

  it("cycles through every message and wraps to the first without an extra home cycle", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    for (const message of [
      FIRST_MSG,
      "a base de sidra",
      "¡buen Camino!",
      "seguramente 🏔️ rn",
      "seguramente 🚴 rn",
      "escalando alguna pared",
      "404: sueño no encontrado",
      FIRST_MSG,
    ]) {
      await act(async () => vi.advanceTimersByTimeAsync(
        30_000 + HOME.length * 80 + 300 + message.length * 80
      ));
      expect(textSpan.textContent).toBe(message);
      await act(async () => vi.advanceTimersByTimeAsync(
        4_000 + message.length * 80 + 300 + HOME.length * 80
      ));
      expect(textSpan.textContent).toBe(HOME);
    }
  });

  it.each([
    ["home hold", 0],
    ["erasing home", 30_080],
    ["empty pause", 30_200],
    ["typing message", 31_000],
    ["message hold", 33_000],
    ["erasing message", 36_500],
    ["return pause", MESSAGE_ERASED_AT + 100],
    ["typing home", MESSAGE_ERASED_AT + 300 + 80],
  ])("clears timers and prevents detached text changes during %s", async (_stage, elapsed) => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container, unmount } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    await act(async () => vi.advanceTimersByTimeAsync(elapsed));
    expect(vi.getTimerCount()).toBe(1);
    const textAtUnmount = textSpan.textContent;
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(textSpan.textContent).toBe(textAtUnmount);
  });

  it.each([
    ["home hold", 30_000],
    ["home erasure step", 30_080],
    ["home erased", 30_160],
    ["empty pause", 30_460],
    ["message typing step", 30_540],
    ["message typed", MESSAGE_TYPED_AT],
    ["message hold", MESSAGE_TYPED_AT + 4_000],
    ["message erasure step", MESSAGE_TYPED_AT + 4_080],
    ["message erased", MESSAGE_ERASED_AT],
    ["return pause", MESSAGE_ERASED_AT + 300],
    ["home typing step", MESSAGE_ERASED_AT + 380],
    ["home typed", MESSAGE_ERASED_AT + 460],
  ])("cancels an already-resolved %s before its continuation runs", async (_stage, boundary) => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container, unmount } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    await act(async () => vi.advanceTimersByTimeAsync(boundary - 1));
    const textAtUnmount = textSpan.textContent;
    // Resolve the clock's promise, then unmount before the queued continuation.
    act(() => {
      vi.advanceTimersByTime(1);
      unmount();
    });
    await act(async () => {});
    expect(vi.getTimerCount()).toBe(0);
    expect(textSpan.textContent).toBe(textAtUnmount);
  });

  it("stops click propagation on the wrapper", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const outerHandler = vi.fn();
    const { container } = render(
      <div onClick={outerHandler}>
        <AuthorTypewriter />
      </div>
    );
    const wrapper = container.querySelector(".group")!;
    fireEvent.click(wrapper);
    expect(outerHandler).not.toHaveBeenCalled();
  });

  it("does not restart the cycle when the parent re-renders (regression for #issue)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");

    function Parent({ rerenderKey }: { rerenderKey: number }) {
      // rerenderKey forces a re-render but should NOT reset the cycle
      void rerenderKey;
      return <AuthorTypewriter />;
    }

    const { container, rerender } = render(<Parent rerenderKey={0} />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // Advance most of HOME_HOLD
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });

    // Force a parent re-render
    rerender(<Parent rerenderKey={1} />);

    // Advance the last second of HOME_HOLD + erase + pause + start of typing
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    // Cycle should have progressed — text is no longer "JG"
    // (with the old buggy deps array, this would still be "JG" because the parent
    // re-render reset the 30s timer)
    expect(textSpan.textContent).not.toBe(HOME);
  });
});
