import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryFilters } from "./story-filters";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";

describe("StoryFilters", () => {
  const defaultProps = {
    selectedCategory: null as StoryCategory | null,
    selectedLocation: null as StoryLocation | null,
    selectedDuration: null as StoryDuration | null,
    onCategoryChange: vi.fn(),
    onLocationChange: vi.fn(),
    onDurationChange: vi.fn(),
    onClearAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render filter toggle button", () => {
      render(<StoryFilters {...defaultProps} />);
      expect(screen.getByRole("button", { name: /filtros/i })).toBeInTheDocument();
    });

    it("should show filter panel when toggle is clicked", () => {
      render(<StoryFilters {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.getByText("Naturaleza")).toBeInTheDocument();
      expect(screen.getByText("Ciudades")).toBeInTheDocument();
      expect(screen.getByText("Gastronomía")).toBeInTheDocument();
    });

    it("should render all category options", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.getByText("Naturaleza")).toBeInTheDocument();
      expect(screen.getByText("Ciudades")).toBeInTheDocument();
      expect(screen.getByText("Gastronomía")).toBeInTheDocument();
      expect(screen.getByText("Cultura")).toBeInTheDocument();
      expect(screen.getByText("Actividades")).toBeInTheDocument();
    });

    it("should render all location options", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.getByText("Asturias Oriental")).toBeInTheDocument();
      expect(screen.getByText("Asturias Central")).toBeInTheDocument();
      expect(screen.getByText("Asturias Occidental")).toBeInTheDocument();
    });

    it("should render all duration options", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.getByText("Excursión de un día")).toBeInTheDocument();
      expect(screen.getByText("Fin de semana")).toBeInTheDocument();
      expect(screen.getByText("Una semana")).toBeInTheDocument();
    });
  });

  describe("category filtering", () => {
    it("should call onCategoryChange when category is selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByText("Naturaleza"));

      expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("nature");
    });

    it("should call onCategoryChange with null when same category is clicked again", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByText("Naturaleza"));

      expect(defaultProps.onCategoryChange).toHaveBeenCalledWith(null);
    });

    it("should highlight selected category", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      const natureButton = screen.getByText("Naturaleza").closest("button");
      expect(natureButton).toHaveAttribute("data-selected", "true");
    });
  });

  describe("location filtering", () => {
    it("should call onLocationChange when location is selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByText("Asturias Oriental"));

      expect(defaultProps.onLocationChange).toHaveBeenCalledWith("eastern");
    });

    it("should call onLocationChange with null when same location is clicked again", () => {
      render(<StoryFilters {...defaultProps} selectedLocation="eastern" />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByText("Asturias Oriental"));

      expect(defaultProps.onLocationChange).toHaveBeenCalledWith(null);
    });
  });

  describe("duration filtering", () => {
    it("should call onDurationChange when duration is selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByText("Fin de semana"));

      expect(defaultProps.onDurationChange).toHaveBeenCalledWith("weekend");
    });

    it("should call onDurationChange with null when same duration is clicked again", () => {
      render(<StoryFilters {...defaultProps} selectedDuration="weekend" />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByText("Fin de semana"));

      expect(defaultProps.onDurationChange).toHaveBeenCalledWith(null);
    });
  });

  describe("clear all filters", () => {
    it("should show clear button when any filter is active", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.getByRole("button", { name: /limpiar/i })).toBeInTheDocument();
    });

    it("should not show clear button when no filters are active", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.queryByRole("button", { name: /limpiar/i })).not.toBeInTheDocument();
    });

    it("should call onClearAll when clear button is clicked", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));

      expect(defaultProps.onClearAll).toHaveBeenCalled();
    });
  });

  describe("active filter count", () => {
    it("should show count badge when filters are active", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" selectedLocation="eastern" />);

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("should not show count badge when no filters are active", () => {
      render(<StoryFilters {...defaultProps} />);

      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have accessible labels for filter groups", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /filtros/i }));

      expect(screen.getByRole("group", { name: /categoría/i })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: /ubicación/i })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: /duración/i })).toBeInTheDocument();
    });
  });
});
