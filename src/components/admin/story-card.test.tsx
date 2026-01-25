import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryCard } from "./story-card";
import type { AdminStory } from "@/types/admin";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

describe("StoryCard", () => {
  const mockStory: AdminStory = {
    id: "story-1",
    slug: "test-story",
    title: "Test Story",
    subtitle: "Test Subtitle",
    description: "Test description",
    category: "nature",
    image: "/images/test.jpg",
    displayOrder: 1,
    curationStatus: "needs_curation",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render story with image", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      const image = screen.getByAltText("Test Story");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/images/test.jpg");
    });

    it("should render story without image", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      render(<StoryCard story={storyWithoutImage} onEdit={mockOnEdit} />);
      expect(screen.getByText("Test Story")).toBeInTheDocument();
      expect(screen.getByText(/No image/i)).toBeInTheDocument();
    });

    it("should render category label", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      // Labels are in Spanish: "Naturaleza" for nature
      expect(screen.getByText("Naturaleza")).toBeInTheDocument();
    });

    it("should show title on hover overlay for stories with images", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      expect(screen.getByText("Test Story")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onEdit when card is clicked", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      const card = screen.getByRole("button");
      fireEvent.click(card);
      expect(mockOnEdit).toHaveBeenCalledTimes(1);
      expect(mockOnEdit).toHaveBeenCalledWith(mockStory);
    });

    it("should call onEdit for story without image", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      render(<StoryCard story={storyWithoutImage} onEdit={mockOnEdit} />);
      const card = screen.getByRole("button");
      fireEvent.click(card);
      expect(mockOnEdit).toHaveBeenCalledWith(storyWithoutImage);
    });
  });

  describe("curation status", () => {
    it("should show pending indicator for needs_curation status", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should show needs curation badge for stories without image", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      render(<StoryCard story={storyWithoutImage} onEdit={mockOnEdit} />);
      expect(screen.getByText("Needs curation")).toBeInTheDocument();
    });
  });

  describe("column span", () => {
    it("should have default span of 1", () => {
      const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      const button = container.querySelector("button");
      expect(button).not.toHaveClass("sm:col-span-2");
    });

    it("should span 2 columns when span prop is 2", () => {
      const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} span={2} />);
      const button = container.querySelector("button");
      expect(button).toHaveClass("sm:col-span-2");
    });

    it("should have wider aspect ratio when span is 2", () => {
      const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} span={2} />);
      const imageContainer = container.querySelector(".aspect-\\[21\\/9\\]");
      expect(imageContainer).toBeInTheDocument();
    });

    it("should have standard aspect ratio when span is 1", () => {
      const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} span={1} />);
      const imageContainer = container.querySelector(".aspect-\\[4\\/3\\]");
      expect(imageContainer).toBeInTheDocument();
    });
  });

  describe("hover effects", () => {
    it("should have group class for hover effects", () => {
      const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      const button = container.querySelector("button");
      expect(button).toHaveClass("group");
    });
  });

  describe("no image state", () => {
    it("should display click to add text for stories without image", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      render(<StoryCard story={storyWithoutImage} onEdit={mockOnEdit} />);
      expect(screen.getByText(/Click to add/i)).toBeInTheDocument();
    });

    it("should not show needs curation badge for approved stories without image", () => {
      const approvedWithoutImage = { ...mockStory, image: "", curationStatus: "approved" as const };
      render(<StoryCard story={approvedWithoutImage} onEdit={mockOnEdit} />);
      expect(screen.queryByText("Needs curation")).not.toBeInTheDocument();
    });
  });
});
