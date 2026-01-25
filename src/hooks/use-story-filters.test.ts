import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStoryFilters } from "./use-story-filters";
import type { Story } from "@/types/immersive";

const mockStories: Story[] = [
  {
    id: "1",
    title: "Nature Story",
    subtitle: "Sub",
    description: "Desc",
    image: "/img.png",
    category: "nature",
    sourcePdf: "test.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "2",
    title: "City Story",
    subtitle: "Sub",
    description: "Desc",
    image: "/img.png",
    category: "cities",
    sourcePdf: "test.pdf",
    location: "central",
    duration: "weekend",
  },
  {
    id: "3",
    title: "Food Story",
    subtitle: "Sub",
    description: "Desc",
    image: "/img.png",
    category: "food",
    sourcePdf: "test.pdf",
    location: "western",
    duration: "day-trip",
  },
  {
    id: "4",
    title: "Another Nature",
    subtitle: "Sub",
    description: "Desc",
    image: "/img.png",
    category: "nature",
    sourcePdf: "test.pdf",
    location: "central",
    duration: "week",
  },
];

describe("useStoryFilters", () => {
  describe("initial state", () => {
    it("should return all stories when no filters are active", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      expect(result.current.filteredStories).toEqual(mockStories);
      expect(result.current.selectedCategory).toBeNull();
      expect(result.current.selectedLocation).toBeNull();
      expect(result.current.selectedDuration).toBeNull();
    });
  });

  describe("category filtering", () => {
    it("should filter stories by category", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedCategory("nature");
      });

      expect(result.current.filteredStories).toHaveLength(2);
      expect(result.current.filteredStories.every(s => s.category === "nature")).toBe(true);
    });

    it("should return all stories when category is cleared", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedCategory("nature");
      });
      act(() => {
        result.current.setSelectedCategory(null);
      });

      expect(result.current.filteredStories).toEqual(mockStories);
    });
  });

  describe("location filtering", () => {
    it("should filter stories by location", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedLocation("central");
      });

      expect(result.current.filteredStories).toHaveLength(2);
      expect(result.current.filteredStories.every(s => s.location === "central")).toBe(true);
    });
  });

  describe("duration filtering", () => {
    it("should filter stories by duration", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedDuration("day-trip");
      });

      expect(result.current.filteredStories).toHaveLength(2);
      expect(result.current.filteredStories.every(s => s.duration === "day-trip")).toBe(true);
    });
  });

  describe("combined filtering", () => {
    it("should filter by multiple criteria (AND logic)", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedCategory("nature");
        result.current.setSelectedLocation("eastern");
      });

      expect(result.current.filteredStories).toHaveLength(1);
      expect(result.current.filteredStories[0].id).toBe("1");
    });

    it("should return empty array when no stories match combined filters", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedCategory("food");
        result.current.setSelectedLocation("eastern");
      });

      expect(result.current.filteredStories).toHaveLength(0);
    });
  });

  describe("clearAll", () => {
    it("should clear all filters", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedCategory("nature");
        result.current.setSelectedLocation("eastern");
        result.current.setSelectedDuration("day-trip");
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.selectedCategory).toBeNull();
      expect(result.current.selectedLocation).toBeNull();
      expect(result.current.selectedDuration).toBeNull();
      expect(result.current.filteredStories).toEqual(mockStories);
    });
  });

  describe("hasActiveFilters", () => {
    it("should return false when no filters are active", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("should return true when any filter is active", () => {
      const { result } = renderHook(() => useStoryFilters(mockStories));

      act(() => {
        result.current.setSelectedCategory("nature");
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe("story list updates", () => {
    it("should re-filter when stories change", () => {
      const { result, rerender } = renderHook(
        ({ stories }) => useStoryFilters(stories),
        { initialProps: { stories: mockStories } }
      );

      act(() => {
        result.current.setSelectedCategory("nature");
      });

      expect(result.current.filteredStories).toHaveLength(2);

      // Update stories to only have one nature story
      const newStories = mockStories.filter(s => s.id !== "4");
      rerender({ stories: newStories });

      expect(result.current.filteredStories).toHaveLength(1);
    });
  });
});
