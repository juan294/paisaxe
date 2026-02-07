import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryFilters } from "./story-filters";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
  DURATION_LABELS,
} from "@/types/immersive";
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
      expect(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") })).toBeInTheDocument();
    });

    it("should show filter panel when toggle is clicked", () => {
      render(<StoryFilters {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.getByText(CATEGORY_LABELS.nature)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.cities)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.food)).toBeInTheDocument();
    });

    it("should render all category options", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.getByText(CATEGORY_LABELS.nature)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.cities)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.food)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.culture)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.activities)).toBeInTheDocument();
    });

    it("should render all location options", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.getByText(LOCATION_LABELS.eastern)).toBeInTheDocument();
      expect(screen.getByText(LOCATION_LABELS.central)).toBeInTheDocument();
      expect(screen.getByText(LOCATION_LABELS.western)).toBeInTheDocument();
    });

    it("should render all duration options", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.getByText(DURATION_LABELS["day-trip"])).toBeInTheDocument();
      expect(screen.getByText(DURATION_LABELS.weekend)).toBeInTheDocument();
      expect(screen.getByText(DURATION_LABELS.week)).toBeInTheDocument();
    });
  });

  describe("category filtering", () => {
    it("should call onCategoryChange when category is selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(CATEGORY_LABELS.nature));

      expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("nature");
    });

    it("should call onCategoryChange with null when same category is clicked again", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(CATEGORY_LABELS.nature));

      expect(defaultProps.onCategoryChange).toHaveBeenCalledWith(null);
    });

    it("should highlight selected category", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      const natureButton = screen.getByText(CATEGORY_LABELS.nature).closest("button");
      expect(natureButton).toHaveAttribute("data-selected", "true");
    });
  });

  describe("location filtering", () => {
    it("should call onLocationChange when location is selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(LOCATION_LABELS.eastern));

      expect(defaultProps.onLocationChange).toHaveBeenCalledWith("eastern");
    });

    it("should call onLocationChange with null when same location is clicked again", () => {
      render(<StoryFilters {...defaultProps} selectedLocation="eastern" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(LOCATION_LABELS.eastern));

      expect(defaultProps.onLocationChange).toHaveBeenCalledWith(null);
    });
  });

  describe("duration filtering", () => {
    it("should call onDurationChange when duration is selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(DURATION_LABELS.weekend));

      expect(defaultProps.onDurationChange).toHaveBeenCalledWith("weekend");
    });

    it("should call onDurationChange with null when same duration is clicked again", () => {
      render(<StoryFilters {...defaultProps} selectedDuration="weekend" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(DURATION_LABELS.weekend));

      expect(defaultProps.onDurationChange).toHaveBeenCalledWith(null);
    });
  });

  describe("clear all filters", () => {
    it("should show clear button when any filter is active", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.getByText(mockT("stories.filters.clear"))).toBeInTheDocument();
    });

    it("should not show clear button when no filters are active", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.queryByText(mockT("stories.filters.clear"))).not.toBeInTheDocument();
    });

    it("should call onClearAll when clear button is clicked", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      fireEvent.click(screen.getByText(mockT("stories.filters.clear")));

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
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      expect(screen.getByRole("group", { name: new RegExp(mockT("stories.filters.category"), "i") })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: new RegExp(mockT("stories.filters.location"), "i") })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: new RegExp(mockT("stories.filters.duration"), "i") })).toBeInTheDocument();
    });

    it("should render filter chips with aria-pressed=false when not selected", () => {
      render(<StoryFilters {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      const chips = screen.getAllByRole("button", { pressed: false });
      // 5 categories + 3 locations + 3 durations = 11 filter chips
      expect(chips.length).toBe(11);
    });

    it("should render selected filter chip with aria-pressed=true", () => {
      render(<StoryFilters {...defaultProps} selectedCategory="nature" />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(mockT("stories.filters.title"), "i") }));

      const pressedChips = screen.getAllByRole("button", { pressed: true });
      expect(pressedChips.length).toBe(1);
    });
  });
});
