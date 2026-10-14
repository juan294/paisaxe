import { requiredValue } from "@/test/required-value";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { StoryCard } from "./story-card";
import type { AdminStory } from "@/types/admin";
import { PLACEHOLDER_PREFIX } from "@/lib/unsplash-placeholders";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// Mock PlaceholderBadge to verify it renders
vi.mock("./placeholder-badge", () => ({
  PlaceholderBadge: ({ className }: { className?: string }) => (
    <span data-testid="placeholder-badge" className={className}>Placeholder</span>
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
      expect(screen.getByText("Pending")).toBeInTheDocument();
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

  describe("selection mode", () => {
    it("should toggle selection when clicked in selection mode", () => {
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={mockStory}
          onEdit={mockOnEdit}
          selectionMode={true}
          onToggleSelect={onToggleSelect}
        />
      );

      const card = screen.getByRole("button");
      fireEvent.click(card);

      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it("should toggle selection on checkbox click", () => {
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={mockStory}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
    });

    it("should toggle selection on keyboard Enter", () => {
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={mockStory}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.keyDown(checkbox, { key: "Enter" });

      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
    });

    it("should toggle selection on keyboard Space", () => {
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={mockStory}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.keyDown(checkbox, { key: " " });

      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
    });

    it("should show selected state with ring", () => {
      const { container } = render(
        <StoryCard
          story={mockStory}
          onEdit={mockOnEdit}
          isSelected={true}
          onToggleSelect={vi.fn()}
        />
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("ring-2");
    });

    it("should show checkbox for stories without images in selection mode", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={storyWithoutImage}
          onEdit={mockOnEdit}
          selectionMode={true}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);

      // Click on the checkbox in no-image state
      fireEvent.click(requiredValue(checkboxes[0], "src/components/admin/story-card.test.tsx: checkboxes[0]"));
      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
    });

    it("should toggle select on Enter in no-image checkbox", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={storyWithoutImage}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.keyDown(checkbox, { key: "Enter" });
      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
    });

    it("should toggle select on Space in no-image checkbox", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={storyWithoutImage}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.keyDown(checkbox, { key: " " });
      expect(onToggleSelect).toHaveBeenCalledWith("story-1");
    });

    it("should not toggle select on unrelated key in no-image checkbox", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={storyWithoutImage}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.keyDown(checkbox, { key: "Tab" });
      expect(onToggleSelect).not.toHaveBeenCalled();
    });

    it("should show check icon when selected in no-image state", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      render(
        <StoryCard
          story={storyWithoutImage}
          onEdit={mockOnEdit}
          isSelected={true}
          onToggleSelect={vi.fn()}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "true");
      // Check icon should be rendered inside the checkbox
      const checkIcon = checkbox.querySelector("svg");
      expect(checkIcon).toBeInTheDocument();
    });

    it("should not show check icon when not selected in no-image state", () => {
      const storyWithoutImage = { ...mockStory, image: "" };
      render(
        <StoryCard
          story={storyWithoutImage}
          onEdit={mockOnEdit}
          isSelected={false}
          onToggleSelect={vi.fn()}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "false");
      // No check icon when not selected
      const checkIcon = checkbox.querySelector("svg");
      expect(checkIcon).not.toBeInTheDocument();
    });

    it("should not toggle on unrelated key in image checkbox", () => {
      const onToggleSelect = vi.fn();
      render(
        <StoryCard
          story={mockStory}
          onEdit={mockOnEdit}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.keyDown(checkbox, { key: "Escape" });
      expect(onToggleSelect).not.toHaveBeenCalled();
    });
  });

  describe("translation badges", () => {
    it("should show i18n badge when metadata is missing", () => {
      const storyNoMetadata = { ...mockStory, metadata: undefined };
      render(<StoryCard story={storyNoMetadata} onEdit={mockOnEdit} />);
      expect(screen.getByText("i18n")).toBeInTheDocument();
    });

    it("should show i18n badge when translations are incomplete", () => {
      const storyPartialTranslations: AdminStory = {
        ...mockStory,
        metadata: {
          translations: {
            en: { title: "Test", subtitle: "", description: "", questionPrompts: [], status: "draft" as const },
          },
          translation_status: {
            en: { status: "draft" as const, lastUpdated: "2026-01-01" },
          },
        },
      };
      render(<StoryCard story={storyPartialTranslations} onEdit={mockOnEdit} />);
      expect(screen.getByText("i18n")).toBeInTheDocument();
    });

    it("should not show i18n badge when all translations are complete", () => {
      const completeTranslation = { title: "T", subtitle: "S", description: "D", questionPrompts: [], status: "complete" as const };
      const allLocales = ["en", "fr", "de", "pt", "ast"];
      const translations: Record<string, typeof completeTranslation> = {};
      const translationStatus: Record<string, { status: "complete"; lastUpdated: string }> = {};
      for (const locale of allLocales) {
        translations[locale] = completeTranslation;
        translationStatus[locale] = { status: "complete", lastUpdated: "2026-01-01" };
      }
      const storyComplete: AdminStory = {
        ...mockStory,
        metadata: { translations, translation_status: translationStatus },
      };
      render(<StoryCard story={storyComplete} onEdit={mockOnEdit} />);
      expect(screen.queryByText("i18n")).not.toBeInTheDocument();
    });

    it("should show i18n badge when metadata exists but translations are missing", () => {
      // metadata exists with no translations or translation_status keys
      // triggers the || {} fallbacks at lines 20-21
      const storyEmptyMetadata: AdminStory = {
        ...mockStory,
        metadata: {},
      };
      render(<StoryCard story={storyEmptyMetadata} onEdit={mockOnEdit} />);
      expect(screen.getByText("i18n")).toBeInTheDocument();
    });

    it("should show i18n badge when translations exist but some have no content", () => {
      // Tests the hasContent false branch (line 28-32) where translation object
      // exists but all fields are empty strings
      const storyEmptyTranslations: AdminStory = {
        ...mockStory,
        metadata: {
          translations: {
            en: { title: "", subtitle: "", description: "", questionPrompts: [], status: "draft" as const },
          },
          translation_status: {
            en: { status: "complete", lastUpdated: "2026-01-01" },
          },
        },
      };
      render(<StoryCard story={storyEmptyTranslations} onEdit={mockOnEdit} />);
      expect(screen.getByText("i18n")).toBeInTheDocument();
    });

    it("should show i18n badge when translation has content but status is not complete", () => {
      // Tests the `localeStatus?.status !== "complete"` branch at line 34
      const completeTranslation = { title: "T", subtitle: "S", description: "D", questionPrompts: [], status: "complete" as const };
      const allLocales = ["en", "fr", "de", "pt", "ast"];
      const translations: Record<string, typeof completeTranslation> = {};
      const translationStatus: Record<string, { status: string; lastUpdated: string }> = {};
      for (const locale of allLocales) {
        translations[locale] = completeTranslation;
        translationStatus[locale] = { status: "complete", lastUpdated: "2026-01-01" };
      }
      // Set one locale to "pending" status
      translationStatus["en"] = { status: "pending", lastUpdated: "2026-01-01" };
      const storyPending: AdminStory = {
        ...mockStory,
        metadata: { translations, translation_status: translationStatus },
      };
      render(<StoryCard story={storyPending} onEdit={mockOnEdit} />);
      expect(screen.getByText("i18n")).toBeInTheDocument();
    });

    it("should show i18n badge in no-image state too", () => {
      const storyNoImage = { ...mockStory, image: "", metadata: undefined };
      render(<StoryCard story={storyNoImage} onEdit={mockOnEdit} />);
      expect(screen.getByText("i18n")).toBeInTheDocument();
    });
  });

  describe("subtitle display", () => {
    it("should show subtitle when present", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
    });

    it("should not show subtitle when empty", () => {
      const storyNoSubtitle = { ...mockStory, subtitle: "" };
      render(<StoryCard story={storyNoSubtitle} onEdit={mockOnEdit} />);
      expect(screen.queryByText("Test Subtitle")).not.toBeInTheDocument();
    });
  });

  describe("hover effects", () => {
    it("should have group class for hover effects", () => {
      const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      const button = container.querySelector("button");
      expect(button).toHaveClass("group");
    });
  });

  describe.each([
    { state: "with an image", image: "/images/test.jpg" },
    { state: "without an image", image: "" },
  ])("keyboard and pointer access $state", ({ image }) => {
    const story = { ...mockStory, image };

    it("gives selection its own accessible name and keyboard focus", async () => {
      const user = userEvent.setup();
      render(<StoryCard story={story} onEdit={mockOnEdit} onToggleSelect={vi.fn()} />);

      const card = screen.getByRole("button");
      const checkbox = screen.getByRole("checkbox", { name: "Seleccionar Test Story" });
      await user.tab();
      expect(card).toHaveFocus();
      await user.tab();
      expect(checkbox).toHaveFocus();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it.each(["click", "Enter", "Space"])(
      "%s selects once and keeps focus without opening the editor",
      async (activation) => {
        const user = userEvent.setup();
        const onToggleSelect = vi.fn();
        function SelectionHarness() {
          const [selected, setSelected] = useState(false);
          return (
            <StoryCard
              story={story}
              onEdit={mockOnEdit}
              isSelected={selected}
              onToggleSelect={(id) => {
                onToggleSelect(id);
                setSelected((value) => !value);
              }}
            />
          );
        }
        render(<SelectionHarness />);
        const checkbox = screen.getByRole("checkbox");

        if (activation === "click") {
          await user.click(checkbox);
        } else {
          await user.tab();
          await user.tab();
          expect(checkbox).toHaveFocus();
          await user.keyboard(activation === "Enter" ? "{Enter}" : " ");
        }

        expect(onToggleSelect).toHaveBeenCalledTimes(1);
        expect(onToggleSelect).toHaveBeenCalledWith(story.id);
        expect(checkbox).toHaveAttribute("aria-checked", "true");
        expect(checkbox).toHaveFocus();
        expect(mockOnEdit).not.toHaveBeenCalled();
      },
    );

    it.each(["{Enter}", " "])("%j opens the focused card exactly once", async (key) => {
      const user = userEvent.setup();
      const onToggleSelect = vi.fn();
      render(<StoryCard story={story} onEdit={mockOnEdit} onToggleSelect={onToggleSelect} />);
      await user.tab();
      expect(screen.getByRole("button")).toHaveFocus();

      await user.keyboard(key);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
      expect(mockOnEdit).toHaveBeenCalledWith(story);
      expect(onToggleSelect).not.toHaveBeenCalled();
    });

    it.each(["{Enter}", " "])("%j selects the focused card once in selection mode", async (key) => {
      const user = userEvent.setup();
      const onToggleSelect = vi.fn();
      render(
        <StoryCard story={story} onEdit={mockOnEdit} onToggleSelect={onToggleSelect} selectionMode />,
      );
      await user.tab();
      expect(screen.getByRole("button")).toHaveFocus();

      await user.keyboard(key);

      expect(onToggleSelect).toHaveBeenCalledTimes(1);
      expect(onToggleSelect).toHaveBeenCalledWith(story.id);
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it("provides focus and coarse-pointer visibility for unselected controls", () => {
      render(<StoryCard story={story} onEdit={mockOnEdit} onToggleSelect={vi.fn()} />);

      // jsdom does not apply Tailwind pseudo/media rules. This pins the access
      // contract; the real /admin browser journey must prove computed visibility.
      expect(screen.getByRole("button")).toHaveClass("focus-visible:ring-2");
      expect(screen.getByRole("checkbox")).toHaveClass(
        "group-focus-within:opacity-100",
        "pointer-coarse:opacity-100",
        "focus-visible:ring-2",
      );
    });
  });

  it("reveals every image overlay on card focus and coarse pointers", () => {
    const { container } = render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
    const overlays = container.querySelectorAll(".opacity-0");
    // Gradient, title/subtitle, and edit indicator must all remain readable.
    expect(overlays).toHaveLength(3);
    for (const overlay of overlays) {
      expect(overlay).toHaveClass("group-focus-within:opacity-100", "pointer-coarse:opacity-100");
    }
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
      expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    });
  });

  describe("placeholder badge", () => {
    it("should show placeholder badge when story has placeholder imageSource", () => {
      const placeholderStory: AdminStory = {
        ...mockStory,
        image: "https://images.unsplash.com/photo-123?w=1920",
        imageSource: `${PLACEHOLDER_PREFIX}Photo by Test on Unsplash`,
      };
      render(<StoryCard story={placeholderStory} onEdit={mockOnEdit} />);
      expect(screen.getByTestId("placeholder-badge")).toBeInTheDocument();
    });

    it("should not show placeholder badge for regular images", () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} />);
      expect(screen.queryByTestId("placeholder-badge")).not.toBeInTheDocument();
    });

    it("should not show placeholder badge when imageSource is a normal attribution", () => {
      const normalStory: AdminStory = {
        ...mockStory,
        imageSource: "Turismo de Asturias",
      };
      render(<StoryCard story={normalStory} onEdit={mockOnEdit} />);
      expect(screen.queryByTestId("placeholder-badge")).not.toBeInTheDocument();
    });

    it("should not show placeholder badge for stories without images", () => {
      const noImageStory: AdminStory = {
        ...mockStory,
        image: "",
        imageSource: undefined,
      };
      render(<StoryCard story={noImageStory} onEdit={mockOnEdit} />);
      expect(screen.queryByTestId("placeholder-badge")).not.toBeInTheDocument();
    });
  });
});
