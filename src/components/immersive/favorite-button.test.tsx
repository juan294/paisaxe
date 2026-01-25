import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FavoriteButton } from "./favorite-button";

describe("FavoriteButton", () => {
  const defaultProps = {
    isFavorite: false,
    onToggle: vi.fn(),
  };

  describe("rendering", () => {
    it("should render with 'Guardar' text when not favorited", () => {
      render(<FavoriteButton {...defaultProps} />);

      expect(screen.getByText("Guardar")).toBeInTheDocument();
    });

    it("should render with 'Guardado' text when favorited", () => {
      render(<FavoriteButton {...defaultProps} isFavorite={true} />);

      expect(screen.getByText("Guardado")).toBeInTheDocument();
    });

    it("should have correct aria-label when not favorited", () => {
      render(<FavoriteButton {...defaultProps} />);

      expect(screen.getByLabelText("Agregar a favoritos")).toBeInTheDocument();
    });

    it("should have correct aria-label when favorited", () => {
      render(<FavoriteButton {...defaultProps} isFavorite={true} />);

      expect(screen.getByLabelText("Quitar de favoritos")).toBeInTheDocument();
    });

    it("should show filled heart when favorited", () => {
      const { container } = render(
        <FavoriteButton {...defaultProps} isFavorite={true} />
      );

      const heartIcon = container.querySelector("svg");
      expect(heartIcon).toHaveClass("fill-red-500");
      expect(heartIcon).toHaveClass("text-red-500");
    });

    it("should show unfilled heart when not favorited", () => {
      const { container } = render(<FavoriteButton {...defaultProps} />);

      const heartIcon = container.querySelector("svg");
      expect(heartIcon).not.toHaveClass("fill-red-500");
    });
  });

  describe("interactions", () => {
    it("should call onToggle when clicked", () => {
      const onToggle = vi.fn();
      render(<FavoriteButton {...defaultProps} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole("button"));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("should stop event propagation on click", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <FavoriteButton {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByRole("button"));

      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      render(<FavoriteButton {...defaultProps} className="custom-class" />);

      expect(screen.getByRole("button")).toHaveClass("custom-class");
    });

    it("should have glass morphism styling", () => {
      render(<FavoriteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-white/20");
      expect(button).toHaveClass("backdrop-blur-sm");
      expect(button).toHaveClass("rounded-full");
    });
  });
});
