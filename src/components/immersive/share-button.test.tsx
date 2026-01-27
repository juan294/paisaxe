import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareButton } from "./share-button";
import { createMockT } from "@/test/i18n-mock";
import type { Story } from "@/types/immersive";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// Mock analytics
vi.mock("@/hooks/use-analytics", () => ({
  useAnalytics: () => ({
    trackEvent: vi.fn(),
  }),
}));

const mockStory: Story = {
  id: "test-123",
  title: "Test Story",
  subtitle: "Test Subtitle",
  description: "A test story",
  image: "/test.jpg",
  category: "nature",
  sourcePdf: "test.pdf",
  slug: "test-story",
  displayOrder: 1,
  createdAt: new Date().toISOString(),
};

describe("ShareButton", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    // Default: no native share, clipboard available, desktop pointer
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: query !== "(pointer: coarse)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      }),
      writable: true,
      configurable: true,
    });
  });

  it("renders share button with hidden toast", () => {
    render(<ShareButton story={mockStory} />);
    expect(screen.getByTitle("Compartir")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("opacity-0");
  });

  it("shows toast after clipboard copy", async () => {
    const user = userEvent.setup();
    render(<ShareButton story={mockStory} />);

    await user.click(screen.getByTitle("Compartir"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Enlace copiado");
  });

  it("hides toast after timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareButton story={mockStory} />);

    await user.click(screen.getByTitle("Compartir"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });

    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-0");
    });

    vi.useRealTimers();
  });

  it("falls back to clipboard when native share is unavailable", async () => {
    const user = userEvent.setup();
    render(<ShareButton story={mockStory} />);

    await user.click(screen.getByTitle("Compartir"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
  });

  it("uses native share on touch devices when available", async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareFn,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: query === "(pointer: coarse)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      }),
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<ShareButton story={mockStory} />);

    await user.click(screen.getByTitle("Compartir"));

    expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Story",
        url: expect.stringContaining("/story/test-story"),
      })
    );
  });

  it("uses clipboard instead of native share on desktop", async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareFn,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<ShareButton story={mockStory} />);

    await user.click(screen.getByTitle("Compartir"));

    expect(shareFn).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
  });
});
