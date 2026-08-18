import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareButton } from "./share-button";
import { createMockT } from "@/test/i18n-mock";
import type { Story } from "@/types/immersive";

// Mock i18n. UX-H6 (#892): mutable locale so a test can exercise a
// non-Spanish visitor sharing a story (share text must be localized, not
// the raw Spanish title/subtitle).
const mockT = createMockT();
let mockLocale = "es";
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
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
  let writeTextMock = vi.fn<(data: string) => Promise<void>>();

  beforeEach(() => {
    mockLocale = "es";
    writeTextMock = vi.fn<(data: string) => Promise<void>>().mockResolvedValue(undefined);
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

  it("stops event propagation on click", async () => {
    const parentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={parentClick}>
        <ShareButton story={mockStory} />
      </div>
    );

    await user.click(screen.getByTitle("Compartir"));

    expect(parentClick).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when native share throws non-AbortError", async () => {
    const shareFn = vi.fn().mockRejectedValue(new Error("Share failed"));
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

    // After share fails with non-AbortError, it should fall back to clipboard
    // and show the toast
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Enlace copiado");
  });

  it("does not fallback to clipboard when user cancels share (AbortError)", async () => {
    const abortError = new Error("User cancelled");
    abortError.name = "AbortError";
    const shareFn = vi.fn().mockRejectedValue(abortError);
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

    // Wait a tick for the error handler to run
    await waitFor(() => {
      expect(shareFn).toHaveBeenCalled();
    });

    // Toast should NOT appear for AbortError (user cancelled)
    expect(screen.getByRole("status")).toHaveClass("opacity-0");
  });

  it("clears existing timeout on rapid consecutive clicks", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareButton story={mockStory} />);

    const button = screen.getByTitle("Compartir");

    // Click once to start the first timeout
    await user.click(button);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });

    // Click again quickly — this should hit line 19 (clearTimeout on existing timer)
    await user.click(button);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });

    // After 1500ms the toast should disappear (only the second timer fires)
    vi.advanceTimersByTime(1500);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-0");
    });

    vi.useRealTimers();
  });

  it("renders and works when slug is not available", async () => {
    const storyWithoutSlug: Story = {
      ...mockStory,
      slug: undefined,
    };

    const user = userEvent.setup();
    render(<ShareButton story={storyWithoutSlug} />);

    await user.click(screen.getByTitle("Compartir"));

    // Should still show the toast (copy succeeded using story.id as fallback)
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Enlace copiado");
  });

  // UX-L3 (#523): Show error feedback when ALL clipboard paths fail.
  // Note: userEvent.setup() intercepts clipboard by default; we use
  // fireEvent to click the button so our navigator.clipboard mock is used.
  it("UX-L3: shows error toast when both share and clipboard fail", async () => {
    // Simulate both native share and clipboard failing
    const shareError = new Error("Share failed");
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(shareError),
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
    // Clipboard also fails — set directly on navigator.clipboard so our mock is used
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard denied")) },
      writable: true,
      configurable: true,
    });

    const { fireEvent: fe } = await import("@testing-library/react");
    render(<ShareButton story={mockStory} />);
    fe.click(screen.getByTitle("Compartir"));

    // Error feedback must be shown
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
  });

  it("UX-L3: shows error toast when clipboard fails on desktop (no native share)", async () => {
    // Desktop: no native share, clipboard fails
    // Set directly on navigator.clipboard to bypass userEvent clipboard intercept
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard API not available")) },
      writable: true,
      configurable: true,
    });

    const { fireEvent: fe } = await import("@testing-library/react");
    render(<ShareButton story={mockStory} />);
    fe.click(screen.getByTitle("Compartir"));

    // Error feedback must be shown
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
  });

  // UX-H6 (#892): getLocalizedStory was bypassed here — a French visitor
  // sharing a story got the raw Spanish title/subtitle in the native share
  // sheet instead of their own language.
  it("UX-H6: shares the localized title/subtitle for a non-Spanish locale", async () => {
    mockLocale = "fr";
    const storyWithFrenchTranslation: Story = {
      ...mockStory,
      metadata: {
        translations: {
          fr: {
            title: "Histoire de Test",
            subtitle: "Sous-titre de Test",
            description: "Une histoire de test",
          },
        },
      },
    };

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
    render(<ShareButton story={storyWithFrenchTranslation} />);

    await user.click(screen.getByTitle("Compartir"));

    expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Histoire de Test",
        text: "Histoire de Test - Sous-titre de Test",
      })
    );
  });

  it("UX-H6: falls back to Spanish share text when no translation exists for the active locale", async () => {
    mockLocale = "de";

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
        text: "Test Story - Test Subtitle",
      })
    );
  });
});
