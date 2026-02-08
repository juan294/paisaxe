import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryViewer } from "./story-viewer";
import type { Story } from "@/types/immersive";

// Mock all heavy dependencies
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    isEnabled: () => false,
  }),
}));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/hooks/use-favorites", () => ({
  useFavorites: () => ({
    requiresAuth: false,
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    signInWithGoogle: vi.fn(),
  }),
}));

vi.mock("@/lib/related-stories", () => ({
  getRelatedStories: () => [],
}));

vi.mock("@/lib/localize-story", () => ({
  getLocalizedStory: (story: Story) => ({
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
  }),
}));

vi.mock("@/lib/asturianu", () => ({
  getLabel: () => null,
}));

// Mock child components to reduce complexity
vi.mock("./bookmark-button", () => ({
  BookmarkButton: () => null,
}));
vi.mock("./category-filter-badge", () => ({
  CategoryFilterBadge: () => null,
}));
vi.mock("@/components/auth/auth-button", () => ({
  AuthButton: () => null,
}));
vi.mock("./related-stories", () => ({
  RelatedStories: () => null,
}));
vi.mock("./question-prompts", () => ({
  QuestionPrompts: () => null,
}));
vi.mock("./surprise-me-button", () => ({
  SurpriseMeButton: () => null,
}));
vi.mock("./freshness-badge", () => ({
  FreshnessBadge: () => null,
}));
vi.mock("./share-button", () => ({
  ShareButton: () => null,
}));
vi.mock("./language-switcher", () => ({
  LanguageSwitcher: () => null,
}));
vi.mock("./suggest-place-button", () => ({
  SuggestPlaceButton: () => null,
}));
vi.mock("./user-submitted-badge", () => ({
  UserSubmittedBadge: () => null,
}));
vi.mock("./toolbar-overflow-menu", () => ({
  ToolbarOverflowMenu: () => null,
  ToolbarOverflowItem: () => null,
}));
vi.mock("./fullscreen-button", () => ({
  FullscreenButton: () => null,
}));
vi.mock("./navigation-hint", () => ({
  NavigationHint: () => null,
}));

function makeStory(id: string, title: string): Story {
  return {
    id,
    title,
    subtitle: `Subtitle for ${title}`,
    description: `Description for ${title}`,
    image: `/images/${id}.jpg`,
    category: "nature",
    sourcePdf: "test.pdf",
  };
}

const stories = [
  makeStory("1", "Story One"),
  makeStory("2", "Story Two"),
  makeStory("3", "Story Three"),
  makeStory("4", "Story Four"),
  makeStory("5", "Story Five"),
];

const defaultProps = {
  stories,
  allStories: stories,
  currentIndex: 2,
  onIndexChange: vi.fn(),
  onAskAbout: vi.fn(),
  chatOpen: false,
  selectedCategory: null,
  selectedLocation: null,
  selectedDuration: null,
  onCategoryChange: vi.fn(),
  onLocationChange: vi.fn(),
  onDurationChange: vi.fn(),
  onClearFilters: vi.fn(),
};

describe("StoryViewer progress bar segments keyboard accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock matchMedia for the component
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(pointer: fine)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("should have role='button' on progress bar segments", () => {
    render(<StoryViewer {...defaultProps} />);

    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    expect(segments.length).toBe(5); // 5 stories = 5 segments
  });

  it("should have tabIndex={0} on progress bar segments", () => {
    render(<StoryViewer {...defaultProps} />);

    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    segments.forEach((segment) => {
      expect(segment).toHaveAttribute("tabindex", "0");
    });
  });

  it("should have descriptive aria-labels on progress bar segments", () => {
    render(<StoryViewer {...defaultProps} />);

    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');
    // Segment labels should describe position (using translation key)
    segments.forEach((segment) => {
      expect(segment).toHaveAttribute("aria-label");
      const label = segment.getAttribute("aria-label");
      expect(label).toBeTruthy();
    });
  });

  it("should trigger onIndexChange when Enter is pressed on a segment", () => {
    const onIndexChange = vi.fn();
    render(<StoryViewer {...defaultProps} onIndexChange={onIndexChange} />);

    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');

    // Press Enter on the first segment
    fireEvent.keyDown(segments[0], { key: "Enter" });
    expect(onIndexChange).toHaveBeenCalled();
  });

  it("should trigger onIndexChange when Space is pressed on a segment", () => {
    const onIndexChange = vi.fn();
    render(<StoryViewer {...defaultProps} onIndexChange={onIndexChange} />);

    const progressbar = screen.getByRole("progressbar");
    const segments = progressbar.querySelectorAll('[role="button"]');

    // Press Space on the first segment
    fireEvent.keyDown(segments[0], { key: " " });
    expect(onIndexChange).toHaveBeenCalled();
  });
});
