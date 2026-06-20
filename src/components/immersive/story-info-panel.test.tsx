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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
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
        isEnabled={(_flag) => false}
        questionPrompts={[]}
        requiresAuth={false}
        onAuthRequired={undefined}
        onFavoritesNav={undefined}
        isFavorite={false}
        onToggleFavorite={undefined}
      />
    );

    fireEvent.click(screen.getByTestId("hide-info-button"));
    expect(onToggleInfo).toHaveBeenCalledTimes(1);
  });
});
