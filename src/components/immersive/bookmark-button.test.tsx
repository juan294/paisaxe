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
