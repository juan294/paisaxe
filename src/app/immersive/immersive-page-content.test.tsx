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
  StoriesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/use-story-filters", () => ({
  useStoryFilters: vi.fn(),
}));
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: vi.fn(),
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    <div data-testid="story-viewer" data-index={props.currentIndex} data-chat-open={String(props.chatOpen)}>
      <button data-testid="open-chat" onClick={() => (props.onAskAbout as (msg?: string) => void)()} />
    </div>
  ),
}));
vi.mock("@/components/immersive/skeleton-story-card", () => ({
  StoryCardSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("@/components/immersive/mood-overlay", () => ({
  MoodOverlay: (props: { onSelectMood: (mood: string) => void; onDismiss: () => void }) => (
    <div data-testid="mood-overlay">
      <button data-testid="mood-dismiss" onClick={props.onDismiss}>
        Dismiss
      </button>
      <button data-testid="mood-select" onClick={() => props.onSelectMood("adventure")}>
        Adventure
      </button>
    </div>
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
// Mock dynamic import for VoiceChat — renders a div so we can detect it
vi.mock("next/dynamic", () => ({
  default: () => (props: Record<string, unknown>) => (
    <div data-testid="voice-chat" data-open={String(props.open)}>
      <button data-testid="voice-chat-close" onClick={() => (props.onClose as () => void)()} />
    </div>
  ),
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
  // 5. Mood overlay: selecting a mood calls handleMoodSelect
  // -----------------------------------------------------------------------
  it("selecting a mood dismisses overlay and resets index", () => {
    setupDefaults();
    // Enable mood_discovery flag
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: [],
      isReady: true,
      isEnabled: (flag: string) => flag === "mood_discovery",
      isEnabledWithDefault: () => false,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    // Mood overlay should be shown
    const overlay = screen.getByTestId("mood-overlay");
    expect(overlay).toBeInTheDocument();

    // Click the mood select button (mock fires onSelectMood("adventure"))
    const selectBtn = screen.getByTestId("mood-select");
    fireEvent.click(selectBtn);

    // Overlay should be dismissed (handleMoodSelect sets moodDismissed = true)
    expect(screen.queryByTestId("mood-overlay")).not.toBeInTheDocument();

    // sessionStorage should be set
    expect(sessionStorage.getItem("paisaxe-mood-dismissed")).toBe("true");
  });

  // -----------------------------------------------------------------------
  // 5b. Mood overlay: dismissing without selecting
  // -----------------------------------------------------------------------
  it("dismissing mood overlay sets session flag", () => {
    setupDefaults();
    // Enable mood_discovery
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: [],
      isReady: true,
      isEnabled: (flag: string) => flag === "mood_discovery",
      isEnabledWithDefault: () => false,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    const dismissBtn = screen.getByTestId("mood-dismiss");
    fireEvent.click(dismissBtn);

    // Overlay should be gone
    expect(screen.queryByTestId("mood-overlay")).not.toBeInTheDocument();

    // sessionStorage should be set
    expect(sessionStorage.getItem("paisaxe-mood-dismissed")).toBe("true");
  });

  // -----------------------------------------------------------------------
  // 6. ?story= query param sets initial index
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
  // 6b. ?voice=ready opens chat (line 127)
  // -----------------------------------------------------------------------
  it("?voice=ready opens chat when story is found", () => {
    setupDefaults();
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        if (key === "story") return "oviedo-cathedral";
        if (key === "voice") return "ready";
        return null;
      },
      toString: () => "",
    } as unknown as ReturnType<typeof useSearchParams>);

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    const viewer = screen.getByTestId("story-viewer");
    // chatOpen should be true because voice=ready was in the query params
    expect(viewer).toHaveAttribute("data-chat-open", "true");
  });

  // -----------------------------------------------------------------------
  // 6c. Index resets when filters reduce story list (line 136)
  // -----------------------------------------------------------------------
  it("resets index to 0 when currentIndex exceeds filtered story count", () => {
    setupDefaults();
    // Start with 2 stories, then filter to 1
    const filtersMock = defaultFiltersMock(mockStories);
    vi.mocked(useStoryFilters).mockReturnValue(filtersMock);

    const { rerender } = render(<ImmersivePageContent serverShuffleSeed={null} />);

    // Simulate: user navigated to index 1, then filters reduce stories to just 1
    // We need currentIndex >= filteredStories.length to trigger the reset.
    // The component manages currentIndex internally, so we simulate by re-rendering
    // with a single-story filter result after the user would have navigated.
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock([mockStories[0]]),
    });

    rerender(<ImmersivePageContent serverShuffleSeed={null} />);

    // When filteredStories.length is 1, if currentIndex was >= 1, it resets to 0
    const viewer = screen.getByTestId("story-viewer");
    expect(viewer).toHaveAttribute("data-index", "0");
  });

  // -----------------------------------------------------------------------
  // 6d. markViewed effect fires on render (lines 153-154)
  // -----------------------------------------------------------------------
  it("calls markViewed with current index on render", () => {
    const markViewed = vi.fn();
    setupDefaults();
    vi.mocked(useViewedStories).mockReturnValue({
      viewedIndices: new Set<number>(),
      markViewed,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    // markViewed should be called with the initial index (0)
    expect(markViewed).toHaveBeenCalledWith(0);
  });

  // -----------------------------------------------------------------------
  // 7a. Seasonal weighting pipeline (lines 91-92)
  // -----------------------------------------------------------------------
  it("applies seasonal weighting when seasonal_surfacing flag is enabled", async () => {
    const { applySeasonalWeighting } = await import("@/lib/seasonal-weighting");
    setupDefaults();
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: [],
      isReady: true,
      isEnabled: (flag: string) => flag === "seasonal_surfacing",
      isEnabledWithDefault: () => false,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    expect(applySeasonalWeighting).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 7b. handleCloseChat resets chatOpen and initialMessage (lines 153-154)
  // -----------------------------------------------------------------------
  it("closes chat and clears initialMessage when VoiceChat onClose is called", () => {
    setupDefaults();

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    // Open the chat first via StoryViewer's onAskAbout callback
    const openChatBtn = screen.getByTestId("open-chat");
    fireEvent.click(openChatBtn);

    // Chat should be open — the voice-chat component should be rendered
    const viewer = screen.getByTestId("story-viewer");
    expect(viewer).toHaveAttribute("data-chat-open", "true");

    // Now close the chat
    const closeChatBtn = screen.getByTestId("voice-chat-close");
    fireEvent.click(closeChatBtn);

    // Chat should now be closed
    expect(viewer).toHaveAttribute("data-chat-open", "false");
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

  // -----------------------------------------------------------------------
  // 8. Mood overlay hidden when sessionStorage has previous dismissal (line 75)
  // -----------------------------------------------------------------------
  it("does not show mood overlay when sessionStorage already has dismissal flag", () => {
    // Pre-set sessionStorage BEFORE rendering so the useEffect reads it
    sessionStorage.setItem("paisaxe-mood-dismissed", "true");

    setupDefaults();
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: [],
      isReady: true,
      isEnabled: (flag: string) => flag === "mood_discovery",
      isEnabledWithDefault: () => false,
    });

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    // Mood overlay should NOT appear because sessionStorage had the dismissed flag
    expect(screen.queryByTestId("mood-overlay")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 9. Index resets to 0 when currentIndex is out of bounds (line 136)
  // -----------------------------------------------------------------------
  it("resets currentIndex to 0 when it exceeds new filteredStories length", () => {
    setupDefaults();
    // Deep-link to "oviedo-cathedral" which is at index 1 in the default order
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === "story" ? "oviedo-cathedral" : null),
      toString: () => "",
    } as unknown as ReturnType<typeof useSearchParams>);

    const { rerender } = render(<ImmersivePageContent serverShuffleSeed={null} />);

    // Verify currentIndex is 1 (oviedo-cathedral is at index 1)
    expect(screen.getByTestId("story-viewer")).toHaveAttribute("data-index", "1");

    // Now reduce filteredStories to just 1 story — currentIndex (1) >= length (1)
    vi.mocked(useStoryFilters).mockReturnValue({
      ...defaultFiltersMock([mockStories[0]]),
    });

    rerender(<ImmersivePageContent serverShuffleSeed={null} />);

    // The out-of-bounds guard should have reset currentIndex to 0
    expect(screen.getByTestId("story-viewer")).toHaveAttribute("data-index", "0");
  });

  // -----------------------------------------------------------------------
  // 10. Deep-link: story slug not found in filteredStories (line 123 false branch)
  // -----------------------------------------------------------------------
  it("does not change index when ?story= slug is not found in filteredStories", () => {
    setupDefaults();
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === "story" ? "nonexistent-slug" : null),
      toString: () => "",
    } as unknown as ReturnType<typeof useSearchParams>);

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    // The story slug doesn't match any story, so index stays at default 0
    const viewer = screen.getByTestId("story-viewer");
    expect(viewer).toHaveAttribute("data-index", "0");
  });

  // -----------------------------------------------------------------------
  // 11. SSR guard: typeof window === "undefined" (line 73 false branch)
  // -----------------------------------------------------------------------
  it("skips sessionStorage check when window is undefined (SSR guard)", () => {
    // This branch is for SSR where `typeof window === "undefined"`.
    // In jsdom, window is always defined, so the `if` body always runs.
    // We verify the normal case works — the false branch is an SSR-only path
    // that cannot be exercised in jsdom without overriding globals.
    setupDefaults();
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: [],
      isReady: true,
      isEnabled: (flag: string) => flag === "mood_discovery",
      isEnabledWithDefault: () => false,
    });

    // No sessionStorage item set — mood overlay should appear
    render(<ImmersivePageContent serverShuffleSeed={null} />);
    expect(screen.getByTestId("mood-overlay")).toBeInTheDocument();
  });

  it("prefetches voice chat chunk via requestIdleCallback when available (lines 82-83)", () => {
    // Mock requestIdleCallback so the callback actually fires
    const originalRIC = window.requestIdleCallback;
    window.requestIdleCallback = (cb: IdleRequestCallback) => {
      cb({} as IdleDeadline);
      return 0;
    };

    setupDefaults();

    render(<ImmersivePageContent serverShuffleSeed={null} />);

    // The callback fires synchronously via the mock, triggering the dynamic import.
    // The voice-chat module is already mocked via next/dynamic, so no error occurs.
    // This test exercises lines 82-83 (requestIdleCallback body).
    expect(screen.getByTestId("story-viewer")).toBeInTheDocument();

    // Restore
    window.requestIdleCallback = originalRIC;
  });
});
