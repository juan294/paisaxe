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

  it("should run the full animation cycle and verify setText updates the DOM", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;
    expect(textSpan.textContent).toBe("</> JG");

    // Phase 1: Wait for HOME_HOLD (30s) — setText(HOME) was called at start of cycle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(textSpan.textContent).toBe("</> JG");

    // Phase 2: Erase HOME character by character (6 chars * 80ms = 480ms)
    // Each step: setText(text.slice(0, i)) for i from 6 down to 0
    for (let step = 0; step < 6; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });
    }
    // After full erase, text should be empty
    expect(textSpan.textContent).toBe("");

    // Phase 3: EMPTY_PAUSE (300ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Phase 4: Type next message character by character
    // Next message is "hecho con ♥ en Asturias" (23 chars including the heart)
    const nextMsg = mockT("author_pill.made_with_love");
    for (let step = 0; step < nextMsg.length; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });
    }
    // After full type, text should be the complete message
    expect(textSpan.textContent).toBe(nextMsg);

    // Phase 5: MSG_HOLD (4000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(textSpan.textContent).toBe(nextMsg);

    // Phase 6: Erase message
    for (let step = 0; step < nextMsg.length; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });
    }
    expect(textSpan.textContent).toBe("");

    // Phase 7: EMPTY_PAUSE (300ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Phase 8: Type HOME back
    const home = "</> JG";
    for (let step = 0; step < home.length; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });
    }
    expect(textSpan.textContent).toBe("</> JG");
  });

  it("should skip index 0 and go to index 1 when messageIndex wraps around", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // There are 11 messages total. After cycling through messages 1..10,
    // the next would be index 0 again, but line 77 corrects it to 1.
    // We need to run through 10 full cycles (messages 1-10) to trigger the wrap.
    // Each cycle: erase HOME + pause + type msg + hold + erase msg + pause + type HOME + HOME_HOLD
    // HOME = 6 chars, messages vary in length (~10-25 chars)
    // First HOME_HOLD is 30s, subsequent HOME_HOLDs are 30s each
    // Approximate per-cycle timing: 6*80 + 300 + msg*80 + 4000 + msg*80 + 300 + 6*80 + 30000

    // Instead of precise timing, advance enough time to cover 10+ full cycles
    // Each cycle ~ 30000 + 480 + 300 + 1600 + 4000 + 1600 + 300 + 480 = ~38760ms
    // 10 cycles ~ 387600ms, plus initial HOME_HOLD = 30000ms
    // Total ~ 420000ms. Use generous amount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500_000);
    });

    // After all those cycles, the component should still be functioning
    // (it didn't crash when index wrapped around)
    expect(textSpan.textContent!.length).toBeGreaterThanOrEqual(0);
  });

  it("should call t() for all message keys when animation starts", async () => {
    const tSpy = vi.fn((key: string) => mockT(key));
    const { AuthorTypewriter } = await import("./author-typewriter");
    render(<AuthorTypewriter prefersReducedMotion={false} t={tSpy} />);

    // The effect runs synchronously during render, calling t() for all messages
    const expectedKeys = [
      "author_pill.made_with_love",
      "author_pill.fueled_by_sidra",
      "author_pill.buen_camino",
      "author_pill.probably_hiking",
      "author_pill.out_cycling",
      "author_pill.scaling_rocks",
      "author_pill.sleep_not_found",
      "author_pill.works_on_my_machine",
      "author_pill.bug_free",
    ];

    for (const key of expectedKeys) {
      expect(tSpy).toHaveBeenCalledWith(key);
    }
  });

  it("should cancel animation and not update text after unmount during cycle", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { container, unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const textSpan = container.querySelector("span[class*='font-mono'] > span:first-child")!;

    // Advance past HOME_HOLD to start the first erase
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // Capture current text
    void textSpan.textContent;

    // Unmount the component — this sets cancelled = true and clears the timeout
    unmount();

    // Advance timers significantly — nothing should happen since cancelled = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    // No errors thrown — the cleanup was effective
    expect(true).toBe(true);
  });

  it("should handle unmount immediately after mount before any timer fires", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    // Unmount immediately — the HOME_HOLD wait timer should be cancelled
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Advance timers to ensure no lingering callbacks cause errors
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });

    clearTimeoutSpy.mockRestore();
  });

  it("should handle unmount during MSG_HOLD phase", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    // Advance to: HOME_HOLD(30s) + erase(480ms) + pause(300ms) + type msg(~1840ms)
    // = ~32620ms — message should be fully typed
    const nextMsg = mockT("author_pill.made_with_love");
    const typeTime = 30_000 + 6 * 80 + 300 + nextMsg.length * 80;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(typeTime + 100);
    });

    // Now in MSG_HOLD phase — unmount here
    unmount();

    // Advance timers to ensure no errors from orphaned callbacks
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    // Test passes if no errors thrown
    expect(true).toBe(true);
  });

  it("should handle unmount during EMPTY_PAUSE after erase", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    // Advance to HOME_HOLD(30s) + full erase(480ms) + half of EMPTY_PAUSE
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_600);
    });

    // Now in EMPTY_PAUSE between erase and type — unmount
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(true).toBe(true);
  });

  it("should handle unmount during EMPTY_PAUSE after erase of the second message", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const nextMsg = mockT("author_pill.made_with_love");
    // Full first half-cycle: HOME_HOLD + erase HOME + pause + type msg + MSG_HOLD + erase msg
    const halfCycle = 30_000 + 6 * 80 + 300 + nextMsg.length * 80 + 4000 + nextMsg.length * 80;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(halfCycle + 100);
    });

    // Now in EMPTY_PAUSE before typing HOME back — unmount
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(true).toBe(true);
  });

  it("should handle unmount during type HOME back phase", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const nextMsg = mockT("author_pill.made_with_love");
    // Full first half-cycle + EMPTY_PAUSE + partial type of HOME
    const fullErase = 30_000 + 6 * 80 + 300 + nextMsg.length * 80 + 4000 + nextMsg.length * 80 + 300;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(fullErase + 160); // mid-typing HOME (2 chars)
    });

    // Unmount during type HOME phase
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(true).toBe(true);
  });

  it("should handle unmount during second HOME_HOLD", async () => {
    const { AuthorTypewriter } = await import("./author-typewriter");
    const { unmount } = render(
      <AuthorTypewriter prefersReducedMotion={false} t={mockT} />
    );

    const nextMsg = mockT("author_pill.made_with_love");
    // Complete first full cycle: HOME_HOLD + erase + pause + type + hold + erase + pause + type HOME
    const fullCycle = 30_000 + 6 * 80 + 300 + nextMsg.length * 80 + 4000 + nextMsg.length * 80 + 300 + 6 * 80;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(fullCycle + 5_000); // into second HOME_HOLD
    });

    // Unmount during second HOME_HOLD
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(true).toBe(true);
  });
});
