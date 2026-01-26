import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarkButton } from "./bookmark-button";

describe("BookmarkButton", () => {
  let onToggle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggle = vi.fn();
  });

  it("renders with correct title when not bookmarked", () => {
    render(<BookmarkButton isFavorite={false} onToggle={onToggle} />);
    expect(screen.getByTitle("Agregar a guardados")).toBeInTheDocument();
  });

  it("renders with correct title when bookmarked", () => {
    render(<BookmarkButton isFavorite={true} onToggle={onToggle} />);
    expect(screen.getByTitle("Quitar de guardados")).toBeInTheDocument();
  });

  it("shows 'Guardado' toast when adding to favorites", async () => {
    const user = userEvent.setup();
    render(<BookmarkButton isFavorite={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Guardado");
  });

  it("shows 'Eliminado' toast when removing from favorites", async () => {
    const user = userEvent.setup();
    render(<BookmarkButton isFavorite={true} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveClass("opacity-100");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Eliminado");
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
