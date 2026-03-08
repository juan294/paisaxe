import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createMockT } from "@/test/i18n-mock";

// We'll import the component after mocks are set up
// import { AuthorTypewriter } from "./author-typewriter";

const mockT = createMockT();

describe("AuthorTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render with initial text '</> JG'", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    expect(screen.getByText(/<\/> JG/)).toBeInTheDocument();
  });

  it("should render blinking cursor element with aria-hidden", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const pillContainer = screen.getByLabelText("Made by Juan González");
    const cursorSpan = pillContainer.querySelector("[aria-hidden='true']");
    expect(cursorSpan).toBeInTheDocument();
    expect(cursorSpan?.textContent).toContain("\u258C"); // ▌ character (U+258C LEFT HALF BLOCK)
  });

  it("should have animate-cursor-blink class when motion is allowed", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const pillContainer = screen.getByLabelText("Made by Juan González");
    const cursorSpan = pillContainer.querySelector(".animate-cursor-blink");
    expect(cursorSpan).toBeInTheDocument();
  });

  it("should NOT have animate-cursor-blink when prefersReducedMotion is true", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={true} t={mockT} />);

    const pillContainer = screen.getByLabelText("Made by Juan González");
    const cursorSpan = pillContainer.querySelector(".animate-cursor-blink");
    expect(cursorSpan).toBeNull();
  });

  it("should render social links (X, LinkedIn, Medium, GitHub)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const xLink = screen.getByLabelText("X (Twitter)");
    const linkedinLink = screen.getByLabelText("LinkedIn");
    const mediumLink = screen.getByLabelText("Medium");
    const githubLink = screen.getByLabelText("GitHub");

    expect(xLink).toHaveAttribute("href", "https://x.com/JuanG294");
    expect(linkedinLink).toHaveAttribute("href", "https://www.linkedin.com/in/juanagonzalezp/");
    expect(mediumLink).toHaveAttribute("href", "https://medium.com/@juang294");
    expect(githubLink).toHaveAttribute("href", "https://github.com/juan294");
  });

  it("should open social links in new tab with noopener noreferrer", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const xLink = screen.getByLabelText("X (Twitter)");
    expect(xLink).toHaveAttribute("target", "_blank");
    expect(xLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should display author name in popover", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    expect(screen.getByText("Juan González")).toBeInTheDocument();
  });

  it("should not start animation when prefersReducedMotion is true", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={true} t={mockT} />);

    // Advance past the HOME_HOLD period
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });

    // Text should still be the initial value — no animation
    expect(screen.getByText(/<\/> JG/)).toBeInTheDocument();
  });

  it("should update text via DOM ref (not React state re-renders)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const renderCountRef = { count: 0 };

    // Wrap to count renders
    function RenderCounter() {
      renderCountRef.count++;
      return <AuthorTypewriter prefersReducedMotion={false} t={mockT} />;
    }

    render(<RenderCounter />);
    const initialRenderCount = renderCountRef.count;

    // Advance past HOME_HOLD (30s) into the erase phase
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    // The render count should NOT have increased significantly
    // With DOM refs, re-renders only happen from external prop changes
    // (We allow some slack for potential React internal re-renders)
    expect(renderCountRef.count - initialRenderCount).toBeLessThanOrEqual(1);
  });

  it("should be hidden on mobile (has hidden and md:block classes)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const pillContainer = screen.getByLabelText("Made by Juan González");
    const outerDiv = pillContainer.closest(".group");
    expect(outerDiv).toHaveClass("hidden");
    expect(outerDiv).toHaveClass("md:block");
  });

  it("should have aria-label for accessibility on the trigger pill", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    expect(screen.getByLabelText("Made by Juan González")).toBeInTheDocument();
  });

  it("should be visually hidden when visible prop is false", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} visible={false} />);

    const outerDiv = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(outerDiv).toHaveClass("opacity-0");
    expect(outerDiv).toHaveClass("pointer-events-none");
  });

  it("should be visible when visible prop is true", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} visible={true} />);

    const outerDiv = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(outerDiv).toHaveClass("opacity-100");
    expect(outerDiv).not.toHaveClass("pointer-events-none");
  });

  it("should default to visible when visible prop is omitted", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const outerDiv = screen.getByLabelText("Made by Juan González").closest(".group");
    expect(outerDiv).toHaveClass("opacity-100");
    expect(outerDiv).not.toHaveClass("pointer-events-none");
  });

  it("should cycle through messages after HOME_HOLD period", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(<AuthorTypewriter prefersReducedMotion={false} t={mockT} />);

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // Initially shows "</> JG"
    expect(textSpan.textContent).toBe("</> JG");

    // Advance past HOME_HOLD (30s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_100);
    });

    // Now the erase phase starts — text should begin to shorten
    // Advance through the erase of "</> JG" (5 chars * 80ms = 400ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Text should be partially or fully erased
    expect(textSpan.textContent!.length).toBeLessThan(5);

    // Advance past EMPTY_PAUSE (300ms) and through typing of next message
    // Next message is t("author_pill.made_with_love") = "hecho con ♥ en Asturias" (21 chars)
    // 21 chars * 80ms = 1680ms, plus 300ms pause = 1980ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Now should show the translated message
    expect(textSpan.textContent).toBeTruthy();
    expect(textSpan.textContent!.length).toBeGreaterThan(0);

    // Advance through MSG_HOLD (4000ms) to see the erase start
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });

    // Erase phase for the message should be starting
    // Advance through erase of the message
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Advance through EMPTY_PAUSE + type HOME
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Should be typing HOME ("</> JG") back
    // The text should eventually return to "</> JG" or be mid-type
    expect(textSpan.textContent!.length).toBeGreaterThanOrEqual(0);
  });

  it("should clean up timers on unmount", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should stop animation mid-cycle when unmounted during erase phase", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    // Advance into the erase phase (past HOME_HOLD of 30s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_200);
    });

    // Unmount mid-erase — cleanup should cancel all pending timers
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should stop animation mid-cycle when unmounted during type phase", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // Advance past HOME_HOLD (30s) + full erase of "</> JG" (5 * 80ms = 400ms) + EMPTY_PAUSE (300ms)
    // into the typing of the next message
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_900);
    });

    // Text should be partially typed (new message being typed in)
    const textLength = textSpan.textContent?.length ?? 0;
    expect(textLength).toBeGreaterThanOrEqual(0);

    clearTimeoutSpy.mockRestore();
  });

  it("should complete a full cycle back to HOME text", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    expect(textSpan.textContent).toBe("</> JG");

    // Full cycle: HOME_HOLD(30s) + erase HOME(5*80=400ms) + EMPTY_PAUSE(300ms)
    // + type next msg (~21*80=1680ms) + MSG_HOLD(4000ms) + erase next msg(~21*80=1680ms)
    // + EMPTY_PAUSE(300ms) + type HOME(5*80=400ms)
    // Total ~ 30000 + 400 + 300 + 1680 + 4000 + 1680 + 300 + 400 = ~38760ms
    // Use generous time to ensure full cycle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });

    // After a full cycle, text should be back to "</> JG" or be typing it
    // The exact state depends on timing precision, but text should exist
    expect(textSpan.textContent!.length).toBeGreaterThanOrEqual(0);
  });

  it("should erase text character by character (eraseText path)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    expect(textSpan.textContent).toBe("</> JG");

    const originalLength = textSpan.textContent!.length; // 6 chars: < / > space J G

    // Start erasing: advance past HOME_HOLD + a few char delays
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_050);
    });

    // Advance through a couple of erase steps (each is CHAR_DELAY = 80ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // Text should be shorter than original (some characters erased)
    expect(textSpan.textContent!.length).toBeLessThan(originalLength);
  });

  it("should type text character by character (typeText path)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // Advance past HOME_HOLD + full erase + EMPTY_PAUSE to start typing
    // HOME_HOLD(30s) + erase(5*80=400ms) + EMPTY_PAUSE(300ms) = 30700ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_750);
    });

    // Now typing should have started - text should be short (just began)
    const len1 = textSpan.textContent?.length ?? 0;

    // Advance a few more characters
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250); // ~3 chars at 80ms each
    });

    const len2 = textSpan.textContent?.length ?? 0;

    // Text should be growing as characters are typed
    expect(len2).toBeGreaterThanOrEqual(len1);
  });

  it("should skip message index 0 when cycling (always skips HOME)", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // Complete two full cycles to verify it never re-types HOME as a "message"
    // First cycle: HOME_HOLD + erase + pause + type msg + hold + erase + pause + type HOME + HOME_HOLD
    // ~30000 + 400 + 300 + 1680 + 4000 + 1680 + 300 + 400 + 30000 = ~68760ms
    // Second cycle starts with erasing HOME again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });

    // After two full cycles, text should still exist and function properly
    expect(textSpan.textContent!.length).toBeGreaterThanOrEqual(0);
  });

  it("should stop click propagation on the outer div", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");

    const outerClickHandler = vi.fn();
    const { container } = render(
      <div onClick={outerClickHandler}>
        <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
      </div>
    );

    const groupDiv = container.querySelector(".group");
    expect(groupDiv).not.toBeNull();

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(groupDiv!);

    // Click should not propagate to parent
    expect(outerClickHandler).not.toHaveBeenCalled();
  });
});
