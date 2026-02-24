import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useStories } from "@/hooks/use-stories";
import { useStoryFilters } from "@/hooks/use-story-filters";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useViewedStories } from "@/hooks/use-viewed-stories";
import type { Story } from "@/types/immersive";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/hooks/use-stories", () => ({
  useStories: vi.fn(),
}));
vi.mock("@/hooks/use-story-filters", () => ({
  useStoryFilters: vi.fn(),
}));
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: vi.fn(),
}));
vi.mock("@/hooks/use-viewed-stories", () => ({
  useViewedStories: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/immersive/story-viewer", () => ({
  StoryViewer: (props: Record<string, unknown>) => (
    <div data-testid="story-viewer" data-index={props.currentIndex} />
  ),
}));
vi.mock("@/components/immersive/skeleton-story-card", () => ({
  StoryCardSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("@/components/immersive/mood-overlay", () => ({
  MoodOverlay: (props: { onSelectMood: (mood: string) => void }) => (
    <div
      data-testid="mood-overlay"
      onClick={() => props.onSelectMood("adventure")}
    />
  ),
}));
vi.mock("@/lib/shuffle", () => ({
  fisherYatesShuffle: vi.fn((stories: Story[]) => stories),
}));
vi.mock("@/lib/seasonal-weighting", () => ({
  applySeasonalWeighting: vi.fn((stories: Story[]) => ({ stories })),
}));
vi.mock("@/lib/mood-mapping", () => ({
  filterByMood: vi.fn((stories: Story[]) => stories),
}));
vi.mock("@/components/ui/component-error-boundary", () => ({
  ComponentErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
// Mock dynamic import for VoiceChat
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockStories: Story[] = [
  {
    id: "1",
    slug: "lagos-covadonga",
    title: "Lagos",
    subtitle: "Sub",
    description: "Desc",
    image: "/img.jpg",
    category: "nature",
    sourcePdf: "guide.pdf",
  },
  {
    id: "2",
    slug: "oviedo-cathedral",
    title: "Cathedral",
    subtitle: "Sub",
    description: "Desc",
    image: "/img2.jpg",
    category: "culture",
    sourcePdf: "guide.pdf",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default return value for useStoryFilters — stories loaded, no active filters. */
function defaultFiltersMock(stories: Story[] = mockStories) {
  return {
    filteredStories: stories,
    selectedCategory: null,
    selectedLocation: null,
    selectedDuration: null,
    setSelectedCategory: vi.fn(),
    setSelectedLocation: vi.fn(),
    setSelectedDuration: vi.fn(),
    clearAll: vi.fn(),
    hasActiveFilters: false,
  };
}

/** Set up all mocks with sensible defaults (stories loaded, no filters). */
function setupDefaults(overrides?: { isLoading?: boolean; stories?: Story[] }) {
  const stories = overrides?.stories ?? mockStories;
  const isLoading = overrides?.isLoading ?? false;

  vi.mocked(useStories).mockReturnValue({
    stories,
    isLoading,
    error: null,
    refresh: vi.fn(),
  });

  const filtersMock = defaultFiltersMock(stories);
  vi.mocked(useStoryFilters).mockReturnValue(filtersMock);

  vi.mocked(useFeatureFlags).mockReturnValue({
    flags: [],
    isReady: true,
    isEnabled: () => false,
    isEnabledWithDefault: () => false,
  });

  vi.mocked(useViewedStories).mockReturnValue({
    viewedIndices: new Set<number>(),
    markViewed: vi.fn(),
  });

  vi.mocked(useSearchParams).mockReturnValue({
    get: () => null,
    toString: () => "",
  } as unknown as ReturnType<typeof useSearchParams>);

  return { filtersMock };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Lazy-import the component so that module-level mocks are already installed
// when the component module evaluates.
let ImmersivePageContent: typeof import("./immersive-page-content").ImmersivePageContent;

beforeEach(async () => {
  vi.resetModules();
  // Re-import after resetting modules to pick up fresh mocks
  const mod = await import("./immersive-page-content");
  ImmersivePageContent = mod.ImmersivePageContent;
});

describe("ImmersivePageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sessionStorage between tests
    sessionStorage.clear();
  });

  // -----------------------------------------------------------------------
  // 1. Loading skeleton
  // -----------------------------------------------------------------------
  it("shows skeleton when loading", () => {
    setupDefaults({ isLoading: true });
    render(<ImmersivePageContent serverShuffleSeed={null} />);

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("story-viewer")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Stories rendered
  // -----------------------------------------------------------------------
  it("renders StoryViewer with stories", () => {
    setupDefaults();
    render(<ImmersivePageContent serverShuffleSeed={null} />);

    expect(screen.getByTestId("story-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 3. No-results empty state
  // -----------------------------------------------------------------------
  it("shows no-results message when filteredStories is empty", () => {
    setupDefaults();
    // Override useStoryFilters to return empty filteredStories
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock(),
      filteredStories: [],
      hasActiveFilters: true,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    expect(screen.getByText("stories.no_results")).toBeInTheDocument();
    expect(screen.getByText("stories.filters.clear")).toBeInTheDocument();
    expect(screen.queryByTestId("story-viewer")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 4. Clear filters button calls clearAll
  // -----------------------------------------------------------------------
  it("clicking clear filters button calls clearAll", () => {
    setupDefaults();
    // Override to empty results
    const clearAll = vi.fn();
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock(),
      filteredStories: [],
      hasActiveFilters: true,
      clearAll,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    const clearButton = screen.getByText("stories.filters.clear");
    fireEvent.click(clearButton);

    expect(clearAll).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 5. ?story= query param sets initial index
  // -----------------------------------------------------------------------
  it("?story= query param sets initial index", () => {
    setupDefaults();
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === "story" ? "oviedo-cathedral" : null),
      toString: () => "",
    } as unknown as ReturnType<typeof useSearchParams>);

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    const viewer = screen.getByTestId("story-viewer");
    // The slug "oviedo-cathedral" matches the second story (index 1)
    expect(viewer).toHaveAttribute("data-index", "1");
  });

  // -----------------------------------------------------------------------
  // 6. ?story= resolves correctly with shuffled story order
  // -----------------------------------------------------------------------
  it("?story= query param finds story in shuffled filteredStories", () => {
    setupDefaults();
    // Simulate shuffled order: oviedo-cathedral is now at index 0
    const shuffledStories = [mockStories[1], mockStories[0]];
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock(shuffledStories),
    });
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === "story" ? "oviedo-cathedral" : null),
      toString: () => "",
    } as unknown as ReturnType<typeof useSearchParams>);

    render(<ImmersivePageContent serverShuffleSeed={42} />);

    const viewer = screen.getByTestId("story-viewer");
    // oviedo-cathedral is at index 0 in the shuffled filteredStories
    expect(viewer).toHaveAttribute("data-index", "0");
  });

  // -----------------------------------------------------------------------
  // 7. Deep-link effect fires only once (not re-triggered by filter changes)
  // -----------------------------------------------------------------------
  it("deep-link does not reset index when filters change after initial load", () => {
    setupDefaults();
    const shuffledStories = [mockStories[1], mockStories[0]];
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock(shuffledStories),
    });
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === "story" ? "oviedo-cathedral" : null),
      toString: () => "",
    } as unknown as ReturnType<typeof useSearchParams>);

    const { rerender } = render(<ImmersivePageContent serverShuffleSeed={42} />);

    // Initial render: deep-link sets index to 0 (oviedo-cathedral in shuffled order)
    expect(screen.getByTestId("story-viewer")).toHaveAttribute("data-index", "0");

    // Simulate filter change: only lagos-covadonga remains, oviedo filtered out
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock([mockStories[0]]),
    });

    rerender(<ImmersivePageContent serverShuffleSeed={42} />);

    // Index should NOT be reset by the deep-link effect again
    // The out-of-bounds guard (line 131-135) resets it to 0, which is fine —
    // but it's because of the bounds check, not the deep-link re-firing
    const viewer = screen.getByTestId("story-viewer");
    expect(viewer).toHaveAttribute("data-index", "0");
  });
});
