import type { ComponentProps } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryInfoPanel } from "./story-info-panel";
import { Story } from "@/types/immersive";
import { createMockT } from "@/test/i18n-mock";

const mockT = createMockT();

const mockStory: Story = {
  id: "story-1",
  title: "Lagos de Covadonga",
  subtitle: "Picos de Europa",
  description: "Beautiful glacial lakes in the mountains",
  image: "/images/lagos.jpg",
  category: "nature",
  sourcePdf: "nature-guide.pdf",
};

const localizedStory = {
  title: "Lagos de Covadonga",
  subtitle: "Picos de Europa",
  description: "Beautiful glacial lakes in the mountains",
};

// Shared render defaults — individual tests only spread this and override
// what they actually care about, instead of repeating the full prop list.
const defaultProps: ComponentProps<typeof StoryInfoPanel> = {
  story: mockStory,
  localizedStory,
  showInfo: true,
  t: mockT,
  onAskAbout: undefined,
  onToggleInfo: undefined,
  ast: false,
  locale: "es",
  isEnabled: (_flag) => false,
  questionPrompts: [],
  requiresAuth: false,
  onAuthRequired: undefined,
  onFavoritesNav: undefined,
  isFavorite: false,
};

function renderPanel(overrides: Partial<ComponentProps<typeof StoryInfoPanel>> = {}) {
  return render(<StoryInfoPanel {...defaultProps} {...overrides} />);
}

describe("StoryInfoPanel", () => {
  it("should render story title", () => {
    renderPanel();

    expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
  });

  it("should render story description", () => {
    renderPanel();

    expect(screen.getByText("Beautiful glacial lakes in the mountains")).toBeInTheDocument();
  });

  it("should render image source attribution when provided", () => {
    const storyWithSource = { ...mockStory, imageSource: "Photo by Juan" };
    renderPanel({ story: storyWithSource });

    expect(screen.getByText("Photo by Juan")).toBeInTheDocument();
  });

  it("should apply opacity-0 class when showInfo is false", () => {
    renderPanel({ showInfo: false });

    const panel = screen.getByTestId("story-info-panel");
    expect(panel).toHaveClass("opacity-0");
  });

  it("should remove hidden panel content from interaction and accessibility", () => {
    renderPanel({ showInfo: false });

    const panel = screen.getByTestId("story-info-panel");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveClass("pointer-events-none");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("should apply opacity-100 class when showInfo is true", () => {
    renderPanel({ showInfo: true });

    const panel = screen.getByTestId("story-info-panel");
    expect(panel).toHaveClass("opacity-100");
  });

  // UX-M2 (#634): reading the description text must NOT dismiss the panel.
  it("does not call onToggleInfo when the description text is clicked", () => {
    const onToggleInfo = vi.fn();
    renderPanel({ onToggleInfo });

    fireEvent.click(screen.getByText("Beautiful glacial lakes in the mountains"));
    fireEvent.click(screen.getByTestId("story-title"));
    expect(onToggleInfo).not.toHaveBeenCalled();
  });

  it("calls onToggleInfo when the dedicated hide-info button is clicked", () => {
    const onToggleInfo = vi.fn();
    renderPanel({ onToggleInfo });

    fireEvent.click(screen.getByTestId("hide-info-button"));
    expect(onToggleInfo).toHaveBeenCalledTimes(1);
  });

  // UX-H5 (#891): regression tests for the raw-key bug and the locale override bug.
  describe("asturianu labels (UX-H5, #891)", () => {
    it("respects the visitor's actual locale — flag ON but locale is 'en' must NOT show Asturian title/subtitle/labels", () => {
      const storyWithAsturianMetadata: Story = {
        ...mockStory,
        metadata: {
          asturianu_title: "Llagos de Cuaduonga",
          asturianu_subtitle: "Picos d'Europa (ast)",
        },
      };
      const localizedEnglishStory = {
        title: "Lakes of Covadonga",
        subtitle: "Picos de Europa",
        description: "Beautiful glacial lakes in the mountains",
      };

      renderPanel({
        story: storyWithAsturianMetadata,
        localizedStory: localizedEnglishStory,
        ast: true,
        locale: "en",
      });

      // Title/subtitle must follow the visitor's chosen locale, not the
      // Asturian metadata override, even though the flag (ast prop) is on.
      expect(screen.getByText("Lakes of Covadonga")).toBeInTheDocument();
      expect(screen.queryByText("Llagos de Cuaduonga")).not.toBeInTheDocument();
      expect(screen.queryByText("Picos d'Europa (ast)")).not.toBeInTheDocument();

      // Action labels must fall back to the `t()` translations, not getLabel().
      expect(screen.getByText(mockT("stories.ask_about"))).toBeInTheDocument();
      expect(screen.getByText(mockT("favorites.bookmarks"))).toBeInTheDocument();
      expect(screen.queryByText("Entrugame sobre esto")).not.toBeInTheDocument();
      expect(screen.queryByText("Guardaos")).not.toBeInTheDocument();
    });

    it("shows Asturian title/subtitle/labels — including the real 'saved' translation, never the raw 'bookmarks' key — only when ast is true AND locale is 'ast'", () => {
      const storyWithAsturianMetadata: Story = {
        ...mockStory,
        metadata: {
          asturianu_title: "Llagos de Cuaduonga",
          asturianu_subtitle: "Picos d'Europa (ast)",
        },
      };

      renderPanel({
        story: storyWithAsturianMetadata,
        ast: true,
        locale: "ast",
      });

      expect(screen.getByText("Llagos de Cuaduonga")).toBeInTheDocument();
      expect(screen.getByText("Picos d'Europa (ast)")).toBeInTheDocument();
      expect(screen.getByText("Entrugame sobre esto")).toBeInTheDocument();
      // Real Asturian translation ("Guardaos" — same as the "saved" label),
      // never the literal untranslated key "bookmarks".
      expect(screen.getByText("Guardaos")).toBeInTheDocument();
      expect(screen.queryByText("bookmarks")).not.toBeInTheDocument();
    });
  });
});
