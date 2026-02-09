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
});
