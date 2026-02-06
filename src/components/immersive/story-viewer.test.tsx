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

// Mock feature flags - all disabled by default
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    flags: [],
    isLoading: false,
    isEnabled: () => false,
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

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, className, fill, priority }: {
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-fill={fill}
      data-priority={priority}
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
      const progressBars = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("flex-1") && el.classList.contains("h-1")
      );
      expect(progressBars).toHaveLength(3);
    });

    it("should cycle progress bar position based on current index", async () => {
      // At index 1 of 3 stories, position 1 should be filled (segments 0 and 1)
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      const progressBars = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("flex-1") && el.classList.contains("h-1")
      );

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

      if (prevButton) {
        fireEvent.click(prevButton);
        act(() => {
          vi.advanceTimersByTime(300);
        });
        expect(onIndexChange).toHaveBeenCalledWith(2); // last story index
      }
    });

    it("should wrap to first story when pressing next on last story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 2 })} />);

      // Find next button by position class (right-0 on mobile)
      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("right-0")
      );
      expect(nextButton).toBeDefined();
      expect(nextButton).not.toBeDisabled();

      if (nextButton) {
        fireEvent.click(nextButton);
        act(() => {
          vi.advanceTimersByTime(300);
        });
        expect(onIndexChange).toHaveBeenCalledWith(0); // first story index
      }
    });

    it("should call onIndexChange when clicking next", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("right-4") && btn.classList.contains("top-1/2")
      );

      if (nextButton) {
        fireEvent.click(nextButton);
        act(() => {
          vi.advanceTimersByTime(300);
        });
        expect(onIndexChange).toHaveBeenCalledWith(1);
      }
    });

    it("should call onIndexChange when clicking prev", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      const prevButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("left-4")
      );

      if (prevButton) {
        fireEvent.click(prevButton);
        act(() => {
          vi.advanceTimersByTime(300);
        });
        expect(onIndexChange).toHaveBeenCalledWith(0);
      }
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

      const progressBars = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("flex-1") && el.classList.contains("h-1")
      );

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

  describe("auto-play", () => {
    it("should auto-advance when auto-play is enabled", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Find and click the auto-play toggle
      const autoPlayButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("top-16") && btn.classList.contains("right-6")
      );

      if (autoPlayButton) {
        fireEvent.click(autoPlayButton);

        // Advance time by 6 seconds (auto-play interval)
        act(() => {
          vi.advanceTimersByTime(6000);
        });

        // Wait for transition timeout
        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(onIndexChange).toHaveBeenCalledWith(1);
      }
    });
  });

  describe("auto-play looping", () => {
    it("should wrap to first story when auto-play reaches the end", async () => {
      await renderWithAuth(
        <StoryViewer {...getDefaultProps({ currentIndex: 2 })} />
      );

      // Find and click the auto-play toggle in the top-right controls area
      const controlsArea = screen.getAllByRole("button");
      const autoPlayButton = controlsArea.find(
        (btn) => btn.querySelector("svg.lucide-play")
      );

      if (autoPlayButton) {
        fireEvent.click(autoPlayButton);

        // Advance time by auto-play interval
        act(() => {
          vi.advanceTimersByTime(6000);
        });

        // Wait for transition timeout
        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(onIndexChange).toHaveBeenCalledWith(0);
      }
    });
  });

  describe("info toggle", () => {
    it("should toggle info visibility when clicking screen", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const container = screen.getByText("Lagos de Covadonga").closest(".relative.h-screen");

      if (container) {
        fireEvent.click(container);

        // After clicking, info should be hidden
        const bottomContent = screen
          .getByText("Lagos de Covadonga")
          .closest("article[class*='bottom-0']");
        expect(bottomContent).toHaveClass("opacity-0");
      }
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

    it("should hide upper-right toolbar controls when clicking screen", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const controlsNav = screen.getByRole("navigation", { name: "Controles de historias" });
      const mainContainer = screen.getByRole("main");

      fireEvent.click(mainContainer);

      // After clicking, upper-right controls should be hidden
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
});
