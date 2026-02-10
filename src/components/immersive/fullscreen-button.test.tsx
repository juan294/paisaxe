import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { FullscreenButton } from "./fullscreen-button";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Helper to set up matchMedia mock
const mockMatchMedia = (standalone: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? standalone : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("FullscreenButton", () => {
  const originalUserAgent = navigator.userAgent;
  const originalPlatform = navigator.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to not standalone
    mockMatchMedia(false);
    // Mock iOS detection to false by default (desktop behavior)
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  it("should not render when in standalone mode", async () => {
    mockMatchMedia(true);

    await act(async () => {
      render(<FullscreenButton />);
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should render button on iOS device", async () => {
    // Mock iOS device
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: "iPhone",
      configurable: true,
    });

    await act(async () => {
      render(<FullscreenButton />);
    });

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /fullscreen.toggle/i });
      expect(button).toBeInTheDocument();
    });
  });

  it("should show iOS instructions modal when clicking on iOS device", async () => {
    // Mock iOS device
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: "iPhone",
      configurable: true,
    });

    await act(async () => {
      render(<FullscreenButton />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /fullscreen.toggle/i })).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /fullscreen.toggle/i });

    await act(async () => {
      fireEvent.click(button);
    });

    // Should show iOS instructions modal
    await waitFor(() => {
      expect(screen.getByText("fullscreen.install_title")).toBeInTheDocument();
      expect(screen.getByText("fullscreen.install_description")).toBeInTheDocument();
    });
  });

  it("should close iOS instructions modal when clicking 'Got it'", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: "iPhone",
      configurable: true,
    });

    await act(async () => {
      render(<FullscreenButton />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /fullscreen.toggle/i })).toBeInTheDocument();
    });

    // Open modal
    const toggleButton = screen.getByRole("button", { name: /fullscreen.toggle/i });
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      expect(screen.getByText("fullscreen.install_title")).toBeInTheDocument();
    });

    // Click Got it button
    const gotItButton = screen.getByRole("button", { name: /fullscreen.got_it/i });
    await act(async () => {
      fireEvent.click(gotItButton);
    });

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText("fullscreen.install_title")).not.toBeInTheDocument();
    });
  });

  it("should render installation steps in iOS modal", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
      configurable: true,
    });

    await act(async () => {
      render(<FullscreenButton />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /fullscreen.toggle/i })).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /fullscreen.toggle/i });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      // Should show all 3 steps
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("fullscreen.step_tap")).toBeInTheDocument();
      expect(screen.getByText("fullscreen.step_add_home")).toBeInTheDocument();
      expect(screen.getByText("fullscreen.step_open")).toBeInTheDocument();
    });
  });

  // --- Desktop Fullscreen API tests ---
  // jsdom does not provide the Fullscreen API, so we mock it on document/documentElement.

  describe("desktop fullscreen behavior", () => {
    afterEach(() => {
      // Clean up fullscreen API mocks
      delete (document.documentElement as unknown as Record<string, unknown>).requestFullscreen;
      delete (document as unknown as Record<string, unknown>).exitFullscreen;
      delete (document as unknown as Record<string, unknown>).fullscreenElement;
    });

    it("should not render when not iOS and fullscreen API is not supported", async () => {
      // Default beforeEach sets Windows UA (non-iOS) and matchMedia(false) (not standalone).
      // document.documentElement.requestFullscreen is undefined in jsdom by default,
      // so supportsFullscreen will be false => component returns null.

      await act(async () => {
        render(<FullscreenButton />);
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should render button when fullscreen API is supported on desktop", async () => {
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });

      await act(async () => {
        render(<FullscreenButton />);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /fullscreen.toggle/i })
        ).toBeInTheDocument();
      });
    });

    it("should call requestFullscreen when clicking and not currently fullscreen", async () => {
      const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: requestFullscreenMock,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document, "fullscreenElement", {
        value: null,
        writable: true,
        configurable: true,
      });

      await act(async () => {
        render(<FullscreenButton />);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /fullscreen.toggle/i })
        ).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /fullscreen.toggle/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(requestFullscreenMock).toHaveBeenCalledOnce();
    });

    it("should call exitFullscreen when clicking and already fullscreen", async () => {
      const exitFullscreenMock = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document, "exitFullscreen", {
        value: exitFullscreenMock,
        writable: true,
        configurable: true,
      });
      // Simulate already being in fullscreen
      Object.defineProperty(document, "fullscreenElement", {
        value: document.documentElement,
        writable: true,
        configurable: true,
      });

      await act(async () => {
        render(<FullscreenButton />);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /fullscreen.toggle/i })
        ).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /fullscreen.toggle/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(exitFullscreenMock).toHaveBeenCalledOnce();
    });

    it("should update isFullscreen state when fullscreenchange event fires", async () => {
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document, "fullscreenElement", {
        value: null,
        writable: true,
        configurable: true,
      });

      await act(async () => {
        render(<FullscreenButton />);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /fullscreen.toggle/i })
        ).toBeInTheDocument();
      });

      // Initially not fullscreen: Maximize icon visible (no "hidden" class), X icon hidden
      const button = screen.getByRole("button", { name: /fullscreen.toggle/i });
      const svgs = button.querySelectorAll("svg");
      // First SVG is Maximize, second is X
      expect(svgs[0]).not.toHaveClass("hidden");
      expect(svgs[1]).toHaveClass("hidden");

      // Simulate entering fullscreen
      Object.defineProperty(document, "fullscreenElement", {
        value: document.documentElement,
        writable: true,
        configurable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event("fullscreenchange"));
      });

      // After fullscreen: Maximize icon hidden, X icon visible
      const updatedSvgs = button.querySelectorAll("svg");
      expect(updatedSvgs[0]).toHaveClass("hidden");
      expect(updatedSvgs[1]).not.toHaveClass("hidden");
    });
  });
});
