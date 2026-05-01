import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

const HOME = "JG";
const FIRST_MSG = "hecho con ♥ en Asturias";

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce") ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("AuthorTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("does not start animation when prefers-reduced-motion is set", async () => {
    mockMatchMedia(true);
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter />);
    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });

    expect(textSpan.textContent).toBe(HOME);
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

  it("cleans up timers on unmount", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const { unmount } = render(<AuthorTypewriter />);
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("does not throw when timers fire after unmount", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(<AuthorTypewriter />);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // No errors → cancelled guard works
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
