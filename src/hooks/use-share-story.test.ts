import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useShareStory } from "./use-share-story";
import { createMockT } from "@/test/i18n-mock";
import type { Story } from "@/types/immersive";

// #908/#771: useShareStory consolidates the share logic that used to be
// duplicated between the desktop ShareButton and the mobile overflow menu's
// inline handler in story-viewer.tsx — both now call into this single hook.
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

describe("useShareStory", () => {
  let writeTextMock = vi.fn<(data: string) => Promise<void>>();

  beforeEach(() => {
    mockLocale = "es";
    writeTextMock = vi.fn<(data: string) => Promise<void>>().mockResolvedValue(undefined);
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

  it("starts with no toast", () => {
    const { result } = renderHook(() => useShareStory(mockStory));
    expect(result.current.toast).toBeNull();
  });

  it("copies the localized share URL to the clipboard and shows a success toast on desktop", async () => {
    const { result } = renderHook(() => useShareStory(mockStory));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("/story/test-story")
    );
    await waitFor(() => expect(result.current.toast).toBe("Enlace copiado"));
  });

  it("clears the toast automatically after the timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useShareStory(mockStory));

    await act(async () => {
      await result.current.handleShare();
    });
    expect(result.current.toast).toBe("Enlace copiado");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.toast).toBeNull();

    vi.useRealTimers();
  });

  it("shows an error toast when clipboard write fails on desktop", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useShareStory(mockStory));

    await act(async () => {
      await result.current.handleShare();
    });

    await waitFor(() => expect(result.current.toast).toBe("No se pudo copiar"));
  });

  it("uses navigator.share on touch devices when available", async () => {
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

    const { result } = renderHook(() => useShareStory(mockStory));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Story",
        text: "Test Story - Test Subtitle",
        url: expect.stringContaining("/story/test-story"),
      })
    );
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("does not fall back to clipboard when the user cancels the native share (AbortError)", async () => {
    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(abortError),
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

    const { result } = renderHook(() => useShareStory(mockStory));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(writeTextMock).not.toHaveBeenCalled();
    expect(result.current.toast).toBeNull();
  });

  it("falls back to clipboard when native share rejects with a non-AbortError", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new Error("share failed")),
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

    const { result } = renderHook(() => useShareStory(mockStory));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("/story/test-story")
    );
    await waitFor(() => expect(result.current.toast).toBe("Enlace copiado"));
  });

  it("shares the localized title/subtitle for a non-Spanish locale (UX-H6)", async () => {
    mockLocale = "fr";
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

    const { result } = renderHook(() => useShareStory(storyWithFrenchTranslation));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Histoire de Test",
        text: "Histoire de Test - Sous-titre de Test",
      })
    );
  });

  it("falls back to the story id in the share URL when slug is missing", async () => {
    const storyWithoutSlug: Story = { ...mockStory, slug: undefined };
    const { result } = renderHook(() => useShareStory(storyWithoutSlug));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("/story/test-123")
    );
  });
});
