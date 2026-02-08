import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { StoryViewer } from "./story-viewer";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ReactNode } from "react";
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

// Mock Supabase browser client
vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}));

// Mock feature flags - all disabled by default, controllable per-test
const mockIsEnabled = vi.fn().mockReturnValue(false);
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    flags: [],
    isLoading: false,
    isEnabled: (...args: unknown[]) => mockIsEnabled(...args),
  }),
}));

// Mock useFavorites
const mockToggleFavorite = vi.fn();
const mockIsFavorite = vi.fn().mockReturnValue(false);
vi.mock("@/hooks/use-favorites", () => ({
  useFavorites: () => ({
    favorites: [],
    isFavorite: mockIsFavorite,
    toggleFavorite: mockToggleFavorite,
    isLoading: false,
    requiresAuth: false,
  }),
}));

// Mock useReducedMotion
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock window.matchMedia for FullscreenButton
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Wrapper component for tests
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const renderWithAuth = async (ui: ReactNode) => {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui, { wrapper: TestWrapper });
  });
  return result!;
};

// Mock next/image — captures blur placeholder props for verification
vi.mock("next/image", () => ({
  default: ({ src, alt, className, fill, priority, placeholder, blurDataURL }: {
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    placeholder?: string;
    blurDataURL?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-fill={fill}
      data-priority={priority}
      data-placeholder={placeholder}
      data-blur-data-url={blurDataURL}
    />
  ),
}));

const mockStories: Story[] = [
  {
    id: "story-1",
    title: "Lagos de Covadonga",
    subtitle: "Picos de Europa",
    description: "Beautiful glacial lakes in the mountains",
    image: "/images/lagos.jpg",
    category: "nature",
    sourcePdf: "nature-guide.pdf",
  },
  {
    id: "story-2",
    title: "Oviedo Cathedral",
    subtitle: "Historic City",
    description: "Gothic cathedral in the heart of Oviedo",
    image: "/images/cathedral.jpg",
    category: "culture",
    sourcePdf: "culture-guide.pdf",
  },
  {
    id: "story-3",
    title: "Sidra House",
    subtitle: "Gastronomia",
    description: "Traditional cider house experience",
    image: "/images/sidra.jpg",
    category: "food",
    sourcePdf: "food-guide.pdf",
  },
];

describe("StoryViewer", () => {
  let onIndexChange = vi.fn<(index: number) => void>();
  let onAskAbout = vi.fn<(initialMessage?: string) => void>();
  let onCategoryChange = vi.fn<(category: StoryCategory | null) => void>();
  let onLocationChange = vi.fn<(location: StoryLocation | null) => void>();
  let onDurationChange = vi.fn<(duration: StoryDuration | null) => void>();
  let onClearFilters = vi.fn<() => void>();

  const getDefaultProps = (overrides = {}) => ({
    stories: mockStories,
    allStories: mockStories,
    currentIndex: 0,
    onIndexChange,
    onAskAbout,
    selectedCategory: null,
    selectedLocation: null,
    selectedDuration: null,
    onCategoryChange,
    onLocationChange,
    onDurationChange,
    onClearFilters,
    ...overrides,
  });

  beforeEach(() => {
    onIndexChange = vi.fn<(index: number) => void>();
    onAskAbout = vi.fn<(initialMessage?: string) => void>();
    onCategoryChange = vi.fn<(category: StoryCategory | null) => void>();
    onLocationChange = vi.fn<(location: StoryLocation | null) => void>();
    onDurationChange = vi.fn<(duration: StoryDuration | null) => void>();
    onClearFilters = vi.fn<() => void>();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Reset matchMedia mock to default (matches: false for all queries)
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  describe("rendering", () => {
    it("should render the current story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
      expect(screen.getByText("Beautiful glacial lakes in the mountains")).toBeInTheDocument();
    });

    it("should render progress bar segments capped at story count", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // With 3 stories (< PAGE_SIZE), should show 3 segments
      const progressbar = screen.getByRole("progressbar");
      const progressBars = progressbar.querySelectorAll('[role="button"]');
      expect(progressBars).toHaveLength(3);
    });

    it("should cycle progress bar position based on current index", async () => {
      // At index 1 of 3 stories, position 1 should be filled (segments 0 and 1)
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      const progressbar = screen.getByRole("progressbar");
      const progressBars = progressbar.querySelectorAll('[role="button"]');

      // First two segments should have filled inner div (w-full)
      const filled0 = progressBars[0]?.querySelector("div");
      const filled1 = progressBars[1]?.querySelector("div");
      const filled2 = progressBars[2]?.querySelector("div");

      expect(filled0?.classList.contains("w-full")).toBe(true);
      expect(filled1?.classList.contains("w-full")).toBe(true);
      expect(filled2?.classList.contains("w-0")).toBe(true);
    });

    it("should render category badge", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Multiple elements may have category text (story badge + filter dropdown)
      expect(screen.getAllByText("Naturaleza").length).toBeGreaterThanOrEqual(1);
    });

    it("should render ask button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      expect(screen.getByRole("button", { name: "Preguntar sobre esto" })).toBeInTheDocument();
    });

    it("should render navigation arrows", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      // Find buttons with ChevronLeft and ChevronRight icons
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(3); // prev, next, autoplay, ask
    });

    it("should render keyboard hints", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      expect(screen.getByText(/navegar/)).toBeInTheDocument();
    });

    it("should render story image with blur placeholder", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const img = screen.getByAltText("Lagos de Covadonga");
      expect(img).toHaveAttribute("data-placeholder", "blur");
    });

    it("should use darkPlaceholder fallback when story has no blurDataUrl", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const img = screen.getByAltText("Lagos de Covadonga");
      // Should use the dark SVG placeholder as fallback
      expect(img.getAttribute("data-blur-data-url")).toMatch(/^data:image\/svg\+xml/);
    });

    it("should use story blurDataUrl when available", async () => {
      const storiesWithBlur = mockStories.map((s, i) =>
        i === 0 ? { ...s, blurDataUrl: "data:image/webp;base64,mockblur" } : s
      );
      await renderWithAuth(
        <StoryViewer {...getDefaultProps({ stories: storiesWithBlur })} />
      );

      const img = screen.getByAltText("Lagos de Covadonga");
      expect(img).toHaveAttribute("data-blur-data-url", "data:image/webp;base64,mockblur");
    });
  });

  describe("navigation", () => {
    it("should wrap to last story when pressing prev on first story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Find prev button by position class (left-0 on mobile)
      const prevButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("left-0")
      );
      expect(prevButton).toBeDefined();
      expect(prevButton).not.toBeDisabled();

      fireEvent.click(prevButton!);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onIndexChange).toHaveBeenCalledWith(2); // last story index
    });

    it("should wrap to first story when pressing next on last story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 2 })} />);

      // Find next button by position class (right-0 on mobile)
      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("right-0")
      );
      expect(nextButton).toBeDefined();
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(nextButton!);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onIndexChange).toHaveBeenCalledWith(0); // first story index
    });

    it("should call onIndexChange when clicking next", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Use base class right-0 (not sm:right-4 which jsdom can't match)
      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("right-0")
      );
      expect(nextButton).toBeDefined();

      fireEvent.click(nextButton!);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("should call onIndexChange when clicking prev", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      // Use base class left-0 (not sm:left-4 which jsdom can't match)
      const prevButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("left-0")
      );
      expect(prevButton).toBeDefined();

      fireEvent.click(prevButton!);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("should navigate with keyboard right arrow", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      fireEvent.keyDown(window, { key: "ArrowRight" });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("should navigate with keyboard left arrow", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("should navigate with spacebar", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      fireEvent.keyDown(window, { key: " " });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("should wrap to first story with right arrow on last story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 2 })} />);

      fireEvent.keyDown(window, { key: "ArrowRight" });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("should wrap to last story with left arrow on first story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(2);
    });

    it("should toggle info visibility with i key", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Info should be visible initially
      const title = screen.getByText("Lagos de Covadonga");
      const contentArea = title.closest("article[class*='bottom-0']");
      expect(contentArea).toHaveClass("opacity-100");

      fireEvent.keyDown(window, { key: "i" });

      // After pressing i, info should be hidden
      expect(contentArea).toHaveClass("opacity-0");
    });

    it("should jump to specific story when clicking progress bar", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const progressbar = screen.getByRole("progressbar");
      const progressBars = progressbar.querySelectorAll('[role="button"]');

      if (progressBars[2]) {
        fireEvent.click(progressBars[2]);
        expect(onIndexChange).toHaveBeenCalledWith(2);
      }
    });
  });

  describe("ask button", () => {
    it("should call onAskAbout when clicking ask button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      fireEvent.click(screen.getByRole("button", { name: "Preguntar sobre esto" }));
      expect(onAskAbout).toHaveBeenCalled();
    });
  });

  describe("auto-play (non-ambient)", () => {
    beforeEach(() => {
      // Enable autoplay_button but NOT ambient_discovery — tests the simple toggle path
      mockIsEnabled.mockImplementation((flag: string) => flag === "autoplay_button");
    });

    afterEach(() => {
      mockIsEnabled.mockReturnValue(false);
    });

    it("should auto-advance when auto-play is enabled", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const autoPlayButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector(".lucide-play")
      );
      expect(autoPlayButton).toBeDefined();

      fireEvent.click(autoPlayButton!);

      // Advance time by 6 seconds (non-ambient interval)
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("should wrap to first story when auto-play reaches the end", async () => {
      await renderWithAuth(
        <StoryViewer {...getDefaultProps({ currentIndex: 2 })} />
      );

      const autoPlayButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector(".lucide-play")
      );
      expect(autoPlayButton).toBeDefined();

      fireEvent.click(autoPlayButton!);

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("should stop auto-play on second click and show play icon", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const autoPlayButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector(".lucide-play")
      );
      expect(autoPlayButton).toBeDefined();

      // Start
      fireEvent.click(autoPlayButton!);
      expect(autoPlayButton!.querySelector(".lucide-pause")).toBeTruthy();

      // Stop
      fireEvent.click(autoPlayButton!);
      expect(autoPlayButton!.querySelector(".lucide-play")).toBeTruthy();

      // Should NOT auto-advance
      onIndexChange.mockClear();
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).not.toHaveBeenCalled();
    });
  });

  describe("info toggle", () => {
    it("should toggle info visibility when clicking screen on desktop (pointer: fine)", async () => {
      // Simulate desktop device with pointer: fine
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: query === "(pointer: fine)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const mainContainer = screen.getByRole("main");
      fireEvent.click(mainContainer);

      // After clicking on desktop, info should be hidden
      const bottomContent = screen
        .getByText("Lagos de Covadonga")
        .closest("article[class*='bottom-0']");
      expect(bottomContent).toHaveClass("opacity-0");
    });

    it("should NOT toggle info when clicking main on mobile (pointer: coarse)", async () => {
      // Default matchMedia mock returns matches: false for all queries,
      // simulating a touch/coarse device where (pointer: fine) is false
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const mainContainer = screen.getByRole("main");
      fireEvent.click(mainContainer);

      // On mobile, clicking main should NOT toggle info — tap zones handle navigation
      const bottomContent = screen
        .getByText("Lagos de Covadonga")
        .closest("article[class*='bottom-0']");
      expect(bottomContent).toHaveClass("opacity-100");
    });

    it("should toggle info when clicking the article content area", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // The article element is the content overlay at the bottom
      const article = screen
        .getByText("Lagos de Covadonga")
        .closest("article[class*='bottom-0']");
      expect(article).not.toBeNull();

      fireEvent.click(article!);

      // After clicking article content, info should be hidden
      expect(article).toHaveClass("opacity-0");
    });

    it("should show upper-right toolbar controls initially", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Find the upper-right controls nav by its aria-label
      const controlsNav = screen.getByRole("navigation", { name: "Controles de historias" });
      expect(controlsNav).toHaveClass("opacity-100");
    });

    it("should hide upper-right toolbar controls when toggling info off with i key", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const controlsNav = screen.getByRole("navigation", { name: "Controles de historias" });
      expect(controlsNav).toHaveClass("opacity-100");

      fireEvent.keyDown(window, { key: "i" });

      // After pressing i, upper-right controls should be hidden
      expect(controlsNav).toHaveClass("opacity-0");
    });

    it("should hide upper-right toolbar controls when clicking screen on desktop", async () => {
      // Simulate desktop device with pointer: fine
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: query === "(pointer: fine)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const controlsNav = screen.getByRole("navigation", { name: "Controles de historias" });
      const mainContainer = screen.getByRole("main");

      fireEvent.click(mainContainer);

      // After clicking on desktop, upper-right controls should be hidden
      expect(controlsNav).toHaveClass("opacity-0");
    });

    it("should show upper-right toolbar controls again when toggling info back on", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const controlsNav = screen.getByRole("navigation", { name: "Controles de historias" });

      // First toggle off
      fireEvent.keyDown(window, { key: "i" });
      expect(controlsNav).toHaveClass("opacity-0");

      // Then toggle back on
      fireEvent.keyDown(window, { key: "i" });
      expect(controlsNav).toHaveClass("opacity-100");
    });

    it("should have pointer-events-none on upper-right toolbar when hidden", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const controlsNav = screen.getByRole("navigation", { name: "Controles de historias" });

      fireEvent.keyDown(window, { key: "i" });

      // When hidden, should have pointer-events-none to prevent interaction
      expect(controlsNav).toHaveClass("pointer-events-none");
    });
  });

  describe("mobile tap zones", () => {
    it("should have left nav button with touch-nav-left class for 30% width", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const prevButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("touch-nav-left")
      );
      expect(prevButton).toBeDefined();
      expect(prevButton).toHaveClass("left-0");
    });

    it("should have right nav button with touch-nav-right class for 70% width", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("touch-nav-right")
      );
      expect(nextButton).toBeDefined();
      expect(nextButton).toHaveClass("right-0");
    });

    it("should not toggle info when clicking nav buttons (stopPropagation)", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("touch-nav-right")
      );
      expect(nextButton).toBeDefined();

      fireEvent.click(nextButton!);

      // Info should still be visible — nav button click should not toggle info
      const bottomContent = screen
        .getByText("Lagos de Covadonga")
        .closest("article[class*='bottom-0']");
      expect(bottomContent).toHaveClass("opacity-100");
    });
  });

  describe("empty stories", () => {
    it("should return null when story is undefined", async () => {
      const { container } = await renderWithAuth(
        <StoryViewer {...getDefaultProps({ stories: [] })} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("category labels", () => {
    it("should display correct category label for nature", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Multiple elements may have category text (story badge + filter dropdown)
      expect(screen.getAllByText("Naturaleza").length).toBeGreaterThanOrEqual(1);
    });

    it("should display correct category label for culture", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      // Multiple elements may have category text (story badge + filter dropdown)
      expect(screen.getAllByText("Cultura").length).toBeGreaterThanOrEqual(1);
    });

    it("should display correct category label for food", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 2 })} />);

      // Multiple elements may have category text (story badge + filter dropdown)
      expect(screen.getAllByText("Gastronomia").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ambient toggle", () => {
    beforeEach(() => {
      mockIsEnabled.mockImplementation(
        (flag: string) => flag === "autoplay_button" || flag === "ambient_discovery"
      );
    });

    afterEach(() => {
      mockIsEnabled.mockReturnValue(false);
    });

    it("should start auto-rotation and show pause icon on first click", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Find the ambient button by its Play icon
      const ambientButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector(".lucide-play")
      );
      expect(ambientButton).toBeDefined();

      fireEvent.click(ambientButton!);

      // After clicking, should show Pause icon (auto-play started)
      expect(ambientButton!.querySelector(".lucide-pause")).toBeTruthy();
      expect(ambientButton!.querySelector(".lucide-play")).toBeFalsy();

      // Stories should auto-advance after the interval
      act(() => {
        vi.advanceTimersByTime(12000); // ambient uses 12s interval
      });
      act(() => {
        vi.advanceTimersByTime(300); // transition delay
      });

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("should stop auto-rotation and show play icon on second click", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const ambientButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector(".lucide-play")
      );
      expect(ambientButton).toBeDefined();

      // First click — start
      fireEvent.click(ambientButton!);
      expect(ambientButton!.querySelector(".lucide-pause")).toBeTruthy();

      // Second click — stop
      fireEvent.click(ambientButton!);

      // Should show Play icon again (auto-play stopped)
      expect(ambientButton!.querySelector(".lucide-play")).toBeTruthy();
      expect(ambientButton!.querySelector(".lucide-pause")).toBeFalsy();

      // Stories should NOT auto-advance after the interval
      onIndexChange.mockClear();
      act(() => {
        vi.advanceTimersByTime(12000);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onIndexChange).not.toHaveBeenCalled();
    });
  });

  describe("bookmark toggle", () => {
    beforeEach(() => {
      mockToggleFavorite.mockClear();
      mockIsFavorite.mockReturnValue(false);
    });

    it("should toggle favorite for the current story when clicking bookmark button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // The toolbar bookmark button should have "Guardar" label (toggle mode, not navigation)
      const bookmarkBtn = screen.getByRole("button", { name: "Guardar" });
      expect(bookmarkBtn).toBeInTheDocument();

      fireEvent.click(bookmarkBtn);

      expect(mockToggleFavorite).toHaveBeenCalledWith("story-1");
    });

    it("should show filled bookmark icon when current story is favorited", async () => {
      mockIsFavorite.mockReturnValue(true);

      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // When favorited, the button label should indicate removal
      const bookmarkBtn = screen.getByRole("button", { name: "Quitar de guardados" });
      expect(bookmarkBtn).toBeInTheDocument();

      // The SVG should have fill-white class
      const svg = bookmarkBtn.querySelector("svg");
      expect(svg?.classList.contains("fill-white")).toBe(true);
    });

    it("should toggle favorite for the correct story at different index", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      const bookmarkBtn = screen.getByRole("button", { name: "Guardar" });
      fireEvent.click(bookmarkBtn);

      expect(mockToggleFavorite).toHaveBeenCalledWith("story-2");
    });
  });

  describe("author pill", () => {
    it("should render the pill with initial '</> JG' text", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      expect(screen.getByText(/<\/> JG/)).toBeInTheDocument();
    });

    it("should render the pill with aria-label for accessibility", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      expect(screen.getByLabelText("Made by Juan González")).toBeInTheDocument();
    });

    it("should render blinking cursor", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // The cursor character ▌ is inside a span with animate-cursor-blink
      const pillContainer = screen.getByLabelText("Made by Juan González");
      const cursorSpan = pillContainer.querySelector(".animate-cursor-blink");
      expect(cursorSpan).toBeInTheDocument();
    });

    it("should not animate cursor when prefers-reduced-motion is enabled", async () => {
      // Override useReducedMotion mock
      const reducedMotionModule = await import("@/hooks/use-reduced-motion");
      vi.spyOn(reducedMotionModule, "useReducedMotion").mockReturnValue(true);

      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const pillContainer = screen.getByLabelText("Made by Juan González");
      // When reduced motion is preferred, cursor should NOT have animation class
      const cursorSpan = pillContainer.querySelector(".animate-cursor-blink");
      expect(cursorSpan).toBeNull();

      // Restore
      vi.restoreAllMocks();
    });

    it("should render social links in the popover", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const xLink = screen.getByLabelText("X (Twitter)");
      const linkedinLink = screen.getByLabelText("LinkedIn");
      const mediumLink = screen.getByLabelText("Medium");

      expect(xLink).toHaveAttribute("href", "https://x.com/JuanG294");
      expect(linkedinLink).toHaveAttribute("href", "https://www.linkedin.com/in/juanagonzalezp/");
      expect(mediumLink).toHaveAttribute("href", "https://medium.com/@juang294");
    });

    it("should open social links in new tab", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const xLink = screen.getByLabelText("X (Twitter)");
      const linkedinLink = screen.getByLabelText("LinkedIn");
      const mediumLink = screen.getByLabelText("Medium");

      expect(xLink).toHaveAttribute("target", "_blank");
      expect(linkedinLink).toHaveAttribute("target", "_blank");
      expect(mediumLink).toHaveAttribute("target", "_blank");
    });

    it("should have noopener noreferrer on social links", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const xLink = screen.getByLabelText("X (Twitter)");
      expect(xLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should display author name in popover", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // The author name is rendered with HTML entity
      expect(screen.getByText("Juan González")).toBeInTheDocument();
    });

    it("should stop click propagation to prevent info toggle", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const pillContainer = screen.getByLabelText("Made by Juan González");
      // Click the pill's parent group div
      const groupDiv = pillContainer.closest(".group");
      expect(groupDiv).not.toBeNull();

      fireEvent.click(groupDiv!);

      // Info should still be visible — pill click should NOT toggle info
      const bottomContent = screen
        .getByText("Lagos de Covadonga")
        .closest("article[class*='bottom-0']");
      expect(bottomContent).toHaveClass("opacity-100");
    });

    it("should clean up typewriter timers on unmount", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Unmounting should call clearTimeout to prevent leaked timers
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("should show static text when prefers-reduced-motion is enabled", async () => {
      // The module is already mocked at top level — override the return value
      const reducedMotionModule = await import("@/hooks/use-reduced-motion");
      vi.spyOn(reducedMotionModule, "useReducedMotion").mockReturnValue(true);

      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // With reduced motion, typewriter stays at initial "</> JG" — no animation
      expect(screen.getByText(/<\/> JG/)).toBeInTheDocument();

      // Advance time — should NOT cycle
      await act(async () => {
        await vi.advanceTimersByTimeAsync(35_000);
      });

      // Still shows initial text
      expect(screen.getByText(/<\/> JG/)).toBeInTheDocument();

      // Restore
      vi.restoreAllMocks();
    });

    it("should be hidden on mobile (has md:block and hidden classes)", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const pillContainer = screen.getByLabelText("Made by Juan González");
      const outerDiv = pillContainer.closest(".group");
      expect(outerDiv).toHaveClass("hidden");
      expect(outerDiv).toHaveClass("md:block");
    });
  });
});
