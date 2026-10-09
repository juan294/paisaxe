import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarkButton } from "./bookmark-button";
import { createMockT } from "@/test/i18n-mock";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

describe("BookmarkButton", () => {
  let onToggle = vi.fn<() => void>();
  let onAuthRequired = vi.fn<() => void>();

  beforeEach(() => {
    onToggle = vi.fn<() => void>();
    onAuthRequired = vi.fn<() => void>();
    mockPush.mockClear();
  });

  it.each(["toggle", "auth", "navigation"] as const)(
    "blocks %s and feedback while disabled, then resumes when enabled",
    async (mode) => {
      const user = userEvent.setup();
      const props = {
        requiresAuth: mode === "auth",
        isNavigationMode: mode === "navigation",
        onToggle,
        onAuthRequired,
      };
      const view = render(<BookmarkButton {...props} disabled />);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      await user.click(button);
      expect(onToggle).not.toHaveBeenCalled();
      expect(onAuthRequired).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.queryByText("Guardado en favoritos")).not.toBeInTheDocument();
      expect(screen.queryByText("Eliminado de favoritos")).not.toBeInTheDocument();

      view.rerender(<BookmarkButton {...props} disabled={false} />);
      expect(button).toBeEnabled();
      await user.click(button);
      if (mode === "toggle") {
        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status")).toHaveTextContent("Guardado en favoritos");
        expect(onAuthRequired).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      } else if (mode === "auth") {
        expect(onAuthRequired).toHaveBeenCalledTimes(1);
        expect(onToggle).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      } else {
        expect(mockPush).toHaveBeenCalledExactlyOnceWith("/favorites");
        expect(onToggle).not.toHaveBeenCalled();
        expect(onAuthRequired).not.toHaveBeenCalled();
      }
    },
  );

  describe("toggle mode (default)", () => {
    it("renders with correct title when not bookmarked", () => {
      render(<BookmarkButton isFavorite={false} onToggle={onToggle} />);
      expect(screen.getByTitle("Guardar")).toBeInTheDocument();
    });

    it("renders with correct title when bookmarked", () => {
      render(<BookmarkButton isFavorite={true} onToggle={onToggle} />);
      expect(screen.getByTitle("Quitar de guardados")).toBeInTheDocument();
    });

    it("shows translated toast when adding to favorites", async () => {
      const user = userEvent.setup();
      render(<BookmarkButton isFavorite={false} onToggle={onToggle} />);

      await user.click(screen.getByRole("button"));

      expect(onToggle).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveClass("opacity-100");
      });
      expect(screen.getByRole("status")).toHaveTextContent("Guardado en favoritos");
    });

    it("shows translated toast when removing from favorites", async () => {
      const user = userEvent.setup();
      render(<BookmarkButton isFavorite={true} onToggle={onToggle} />);

      await user.click(screen.getByRole("button"));

      expect(onToggle).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveClass("opacity-100");
      });
      expect(screen.getByRole("status")).toHaveTextContent("Eliminado de favoritos");
    });

    it("hides toast after timeout", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<BookmarkButton isFavorite={false} onToggle={onToggle} />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveClass("opacity-100");
      });

      vi.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveClass("opacity-0");
      });

      vi.useRealTimers();
    });
  });

  describe("navigation mode", () => {
    it("renders with 'Bookmarks' title", () => {
      render(<BookmarkButton isNavigationMode />);
      expect(screen.getByTitle("Guardados")).toBeInTheDocument();
    });

    it("navigates to /favorites when logged in", async () => {
      const user = userEvent.setup();
      render(<BookmarkButton isNavigationMode />);

      await user.click(screen.getByRole("button"));

      expect(mockPush).toHaveBeenCalledWith("/favorites");
    });

    it("does not show toast in navigation mode", async () => {
      const user = userEvent.setup();
      render(<BookmarkButton isNavigationMode />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("triggers auth when requiresAuth is true", async () => {
      const user = userEvent.setup();
      render(
        <BookmarkButton
          isNavigationMode
          requiresAuth
          onAuthRequired={onAuthRequired}
        />
      );

      await user.click(screen.getByRole("button"));

      expect(onAuthRequired).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("clears previous toast timer when toggling rapidly", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<BookmarkButton isFavorite={false} onToggle={onToggle} />);

    const button = screen.getByRole("button");

    // Click once to show toast (sets a timer)
    await user.click(button);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });

    // Click again before the 1500ms timeout expires (should clear previous timer)
    await user.click(button);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });

    // Verify onToggle was called twice
    expect(onToggle).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("stops event propagation", async () => {
    const parentHandler = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={parentHandler}>
        <BookmarkButton isFavorite={false} onToggle={onToggle} />
      </div>
    );

    await user.click(screen.getByRole("button"));

    expect(parentHandler).not.toHaveBeenCalled();
  });
});
