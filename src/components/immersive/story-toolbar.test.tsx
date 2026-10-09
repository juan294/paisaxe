import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { StoryToolbar } from "./story-toolbar";
import { createMockT } from "@/test/i18n-mock";

const mockT = createMockT();

describe("StoryToolbar", () => {
  let onPrev: (() => void) & ReturnType<typeof vi.fn>;
  let onNext: (() => void) & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPrev = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
    onNext = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
  });

  it("should render prev button", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    const prevButton = screen.getByTestId("prev-story-button");
    expect(prevButton).toBeInTheDocument();
  });

  it("should render next button", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    const nextButton = screen.getByTestId("next-story-button");
    expect(nextButton).toBeInTheDocument();
  });

  it("should call onPrev when prev button is clicked", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByTestId("prev-story-button"));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("should call onNext when next button is clicked", () => {
    render(
      <StoryToolbar
        onPrev={onPrev}
        onNext={onNext}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByTestId("next-story-button"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("should stop click propagation on prev button", () => {
    const parentClick = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
    render(
      <div onClick={parentClick}>
        <StoryToolbar
          onPrev={onPrev}
          onNext={onNext}
          t={mockT}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId("prev-story-button"));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("should stop click propagation on next button", () => {
    const parentClick = vi.fn() as (() => void) & ReturnType<typeof vi.fn>;
    render(
      <div onClick={parentClick}>
        <StoryToolbar
          onPrev={onPrev}
          onNext={onNext}
          t={mockT}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId("next-story-button"));
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe("Phase 6 navigation readiness", () => {
  it("server-renders both native mobile tap zones disabled with announced recovery", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<StoryToolbar onPrev={vi.fn()} onNext={vi.fn()} t={mockT} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toBeDisabled();
      // These same native buttons are the mobile tap zones, not separate divs.
      expect(button.className).toContain("w-20");
    }
    const loading = container.querySelector('[role="status"]');
    expect(loading).not.toBeNull();
    expect(loading?.textContent).toMatch(/cargando|preparando/i);
    const recovery = Array.from(container.querySelectorAll("a")).find((link) =>
      /recargar|reload/i.test(link.textContent ?? ""));
    expect(recovery).toBeDefined();
    expect(recovery?.getAttribute("href")).toBeTruthy();
    expect(recovery?.closest("noscript, [hidden], .sr-only")).toBeNull();
    expect(container.textContent).toMatch(/JavaScript/i);
  });

  it("automatically enables hydrated native controls and delivers exactly one action per click", async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const toolbar = <StoryToolbar onPrev={onPrev} onNext={onNext} t={mockT} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(toolbar);
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      const next = container.querySelector<HTMLButtonElement>('[data-testid="next-story-button"]')!;
      const prev = container.querySelector<HTMLButtonElement>('[data-testid="prev-story-button"]')!;
      expect(next).toBeDisabled();
      expect(prev).toBeDisabled();
      next.click();
      expect(onNext).not.toHaveBeenCalled();
      await act(async () => { root = hydrateRoot(container, toolbar); });
      expect(next).toBeEnabled();
      expect(prev).toBeEnabled();
      const readyStatus = container.querySelector('[role="status"]');
      expect(readyStatus?.textContent).toMatch(/navegación lista/i);
      expect(readyStatus).toHaveAttribute("aria-live", "polite");
      act(() => next.click());
      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onPrev).not.toHaveBeenCalled();
      act(() => prev.click());
      expect(onPrev).toHaveBeenCalledTimes(1);
      expect(onNext).toHaveBeenCalledTimes(1);
    } finally {
      if (root) act(() => root!.unmount());
      container.remove();
    }
  });
});
