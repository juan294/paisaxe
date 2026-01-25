import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { StoryViewer } from "./story-viewer";
import { Story } from "@/types/immersive";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ReactNode } from "react";

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
  let onIndexChange: ReturnType<typeof vi.fn>;
  let onAskAbout: ReturnType<typeof vi.fn>;
  let onCategoryChange: ReturnType<typeof vi.fn>;
  let onLocationChange: ReturnType<typeof vi.fn>;
  let onDurationChange: ReturnType<typeof vi.fn>;
  let onClearFilters: ReturnType<typeof vi.fn>;

  const getDefaultProps = (overrides = {}) => ({
    stories: mockStories,
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
    onIndexChange = vi.fn();
    onAskAbout = vi.fn();
    onCategoryChange = vi.fn();
    onLocationChange = vi.fn();
    onDurationChange = vi.fn();
    onClearFilters = vi.fn();
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

    it("should render progress bars for all stories", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // There should be 3 progress bar segments
      const progressBars = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("flex-1") && el.classList.contains("h-1")
      );
      expect(progressBars).toHaveLength(3);
    });

    it("should render category badge", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      expect(screen.getByText("Naturaleza")).toBeInTheDocument();
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
    it("should disable prev button on first story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const prevButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("left-4")
      );
      expect(prevButton).toBeDisabled();
    });

    it("should disable next button on last story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 2 })} />);

      const nextButton = screen.getAllByRole("button").find(
        (btn) => btn.classList.contains("right-4") && btn.classList.contains("top-1/2")
      );
      expect(nextButton).toBeDisabled();
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

    it("should toggle info visibility with i key", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Info should be visible initially
      const title = screen.getByText("Lagos de Covadonga");
      expect(title.closest("div")?.closest("div")).toHaveClass("opacity-100");

      fireEvent.keyDown(window, { key: "i" });

      // After pressing i, info should be hidden
      expect(title.closest("div")?.closest("div")).toHaveClass("opacity-0");
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

  describe("info toggle", () => {
    it("should toggle info visibility when clicking screen", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const container = screen.getByText("Lagos de Covadonga").closest(".relative.h-screen");

      if (container) {
        fireEvent.click(container);

        // After clicking, info should be hidden
        const bottomContent = screen
          .getByText("Lagos de Covadonga")
          .closest("div[class*='bottom-0']");
        expect(bottomContent).toHaveClass("opacity-0");
      }
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

      expect(screen.getByText("Naturaleza")).toBeInTheDocument();
    });

    it("should display correct category label for culture", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 1 })} />);

      expect(screen.getByText("Cultura")).toBeInTheDocument();
    });

    it("should display correct category label for food", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps({ currentIndex: 2 })} />);

      expect(screen.getByText("Gastronomia")).toBeInTheDocument();
    });
  });
});
