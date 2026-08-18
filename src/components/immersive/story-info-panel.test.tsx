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

describe("StoryInfoPanel", () => {
  it("should render story title", () => {
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={true}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={undefined}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
  });

  it("should render story description", () => {
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={true}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={undefined}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    expect(screen.getByText("Beautiful glacial lakes in the mountains")).toBeInTheDocument();
  });

  it("should render image source attribution when provided", () => {
    const storyWithSource = { ...mockStory, imageSource: "Photo by Juan" };
    render(
      <StoryInfoPanel
        story={storyWithSource}
        localizedStory={localizedStory}
        showInfo={true}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={undefined}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    expect(screen.getByText("Photo by Juan")).toBeInTheDocument();
  });

  it("should apply opacity-0 class when showInfo is false", () => {
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={false}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={undefined}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    const panel = screen.getByTestId("story-info-panel");
    expect(panel).toHaveClass("opacity-0");
  });

  it("should remove hidden panel content from interaction and accessibility", () => {
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={false}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={undefined}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    const panel = screen.getByTestId("story-info-panel");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveClass("pointer-events-none");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("should apply opacity-100 class when showInfo is true", () => {
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={true}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={undefined}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    const panel = screen.getByTestId("story-info-panel");
    expect(panel).toHaveClass("opacity-100");
  });

  // UX-M2 (#634): reading the description text must NOT dismiss the panel.
  it("does not call onToggleInfo when the description text is clicked", () => {
    const onToggleInfo = vi.fn();
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={true}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={onToggleInfo}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    fireEvent.click(screen.getByText("Beautiful glacial lakes in the mountains"));
    fireEvent.click(screen.getByTestId("story-title"));
    expect(onToggleInfo).not.toHaveBeenCalled();
  });

  it("calls onToggleInfo when the dedicated hide-info button is clicked", () => {
    const onToggleInfo = vi.fn();
    render(
      <StoryInfoPanel
        story={mockStory}
        localizedStory={localizedStory}
        showInfo={true}
        t={mockT}
        onAskAbout={undefined}
        onToggleInfo={onToggleInfo}
        ast={false}
        locale="es"
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
      />
    );

    fireEvent.click(screen.getByTestId("hide-info-button"));
    expect(onToggleInfo).toHaveBeenCalledTimes(1);
  });

  // UX-H5 (#891): regression tests for the raw-key bug and the locale override bug.
  describe("asturianu labels (UX-H5, #891)", () => {
    it("never renders the raw 'bookmarks' key — the second action button shows real Asturian text when ast is active", () => {
      render(
        <StoryInfoPanel
          story={mockStory}
          localizedStory={localizedStory}
          showInfo={true}
          t={mockT}
          onAskAbout={undefined}
          onToggleInfo={undefined}
          ast={true}
          locale="ast"
          isEnabled={(_flag) => false}
          questionPrompts={[]}
          requiresAuth={false}
          onAuthRequired={undefined}
          onFavoritesNav={undefined}
          isFavorite={false}
        />
      );

      // Real Asturian translation ("Guardaos" — same as the "saved" label),
      // never the literal untranslated key "bookmarks".
      expect(screen.getByText("Guardaos")).toBeInTheDocument();
      expect(screen.queryByText("bookmarks")).not.toBeInTheDocument();
    });

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

      render(
        <StoryInfoPanel
          story={storyWithAsturianMetadata}
          localizedStory={localizedEnglishStory}
          showInfo={true}
          t={mockT}
          onAskAbout={undefined}
          onToggleInfo={undefined}
          ast={true}
          locale="en"
          isEnabled={(_flag) => false}
          questionPrompts={[]}
          requiresAuth={false}
          onAuthRequired={undefined}
          onFavoritesNav={undefined}
          isFavorite={false}
        />
      );

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

    it("shows Asturian title/subtitle/labels only when ast is true AND locale is 'ast'", () => {
      const storyWithAsturianMetadata: Story = {
        ...mockStory,
        metadata: {
          asturianu_title: "Llagos de Cuaduonga",
          asturianu_subtitle: "Picos d'Europa (ast)",
        },
      };

      render(
        <StoryInfoPanel
          story={storyWithAsturianMetadata}
          localizedStory={localizedStory}
          showInfo={true}
          t={mockT}
          onAskAbout={undefined}
          onToggleInfo={undefined}
          ast={true}
          locale="ast"
          isEnabled={(_flag) => false}
          questionPrompts={[]}
          requiresAuth={false}
          onAuthRequired={undefined}
          onFavoritesNav={undefined}
          isFavorite={false}
        />
      );

      expect(screen.getByText("Llagos de Cuaduonga")).toBeInTheDocument();
      expect(screen.getByText("Picos d'Europa (ast)")).toBeInTheDocument();
      expect(screen.getByText("Entrugame sobre esto")).toBeInTheDocument();
      expect(screen.getByText("Guardaos")).toBeInTheDocument();
    });
  });
});
