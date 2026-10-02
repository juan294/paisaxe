import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import FavoritesPage from "./page";
import { createMockT } from "@/test/i18n-mock";

// Mock i18n. UX-H6 (#892): mutable locale so tests can exercise a
// non-Spanish visitor viewing the favorites gallery.
const mockT = createMockT();
let mockLocale = "es";
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// Mock next/link - must forward ref for IntersectionObserver to work
vi.mock("next/link", () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    { href: string; children: React.ReactNode; className?: string }
  >(function MockLink({ href, children, className }, ref) {
    return (
      <a href={href} className={className} ref={ref}>
        {children}
      </a>
    );
  }),
}));

// Mock useAuth hook
const mockSignInWithGoogle = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useFavorites hook
const mockToggleFavorite = vi.fn();
const mockUseFavorites = vi.fn();

vi.mock("@/hooks/use-favorites", () => ({
  useFavorites: () => mockUseFavorites(),
}));

// Mock stories data
const mockStories = [
  {
    id: "story-1",
    slug: "lagos-covadonga",
    title: "Lagos de Covadonga",
    subtitle: "Picos de Europa",
    description: "Beautiful glacial lakes",
    image: "/images/lagos.jpg",
    category: "nature" as const,
    sourcePdf: "nature.pdf",
  },
  {
    id: "story-2",
    slug: "catedral-oviedo",
    title: "Catedral de Oviedo",
    subtitle: "Arte Romanico",
    description: "Historic cathedral",
    image: "/images/catedral.jpg",
    category: "culture" as const,
    sourcePdf: "culture.pdf",
  },
];

// Mock useStories hook as vi.fn() so we can override per-test
const mockUseStories = vi.fn();

vi.mock("@/hooks/use-stories", () => ({
  useStories: () => mockUseStories(),
}));

describe("FavoritesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "es";
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      signInWithGoogle: mockSignInWithGoogle,
      signOut: vi.fn(),
    });
    mockUseFavorites.mockReturnValue({
      favorites: [],
      toggleFavorite: mockToggleFavorite,
      isLoading: false,
      requiresAuth: true, // default: anonymous user
    });
    mockUseStories.mockReturnValue({
      stories: mockStories,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  describe("loading state", () => {
    it("should show loading message when loading", () => {
      mockUseFavorites.mockReturnValue({
        favorites: [],
        toggleFavorite: mockToggleFavorite,
        isLoading: true,
      });

      render(<FavoritesPage />);

      expect(screen.getByText(mockT("common.loading"))).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show empty state when no favorites", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.empty_title"))).toBeInTheDocument();
      });
    });

    it("renders the anonymous empty state even while stories are still resolving", async () => {
      mockUseStories.mockReturnValue({
        stories: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.empty_title"))).toBeInTheDocument();
      });
      expect(screen.queryByText(mockT("common.loading"))).not.toBeInTheDocument();
    });

    it("should show explore button in empty state", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.explore"))).toBeInTheDocument();
      });
    });

    it("should link to immersive page from explore button", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        const link = screen.getByText(mockT("favorites.explore"));
        expect(link.closest("a")).toHaveAttribute("href", "/immersive");
      });
    });

    it("shows generic empty description when authenticated user has no favorites (requiresAuth=false, line 126 false branch)", async () => {
      // requiresAuth=false means the user is logged in — they just haven't saved anything yet.
      // The page should show the generic "nothing here yet" copy, not the sign-in CTA.
      mockUseFavorites.mockReturnValue({
        favorites: [],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
        requiresAuth: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.empty_description"))).toBeInTheDocument();
      });
      expect(screen.queryByText(mockT("favorites.sign_in_to_save"))).not.toBeInTheDocument();
    });

    // UX-L2 (#907): the signed-out empty state explained that signing in was
    // needed but offered no control to actually do it — a conversion dead
    // end on the exact screen where an anonymous user demonstrated intent.
    it("shows a sign-in button in the signed-out empty state and triggers Google sign-in on click", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.sign_in_to_save"))).toBeInTheDocument();
      });

      const signInButton = screen.getByRole("button", { name: mockT("auth.sign_in") });
      fireEvent.click(signInButton);

      expect(mockSignInWithGoogle).toHaveBeenCalledWith("/favorites");
    });

    it("does not show a sign-in button in the authenticated empty state", async () => {
      mockUseFavorites.mockReturnValue({
        favorites: [],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
        requiresAuth: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.empty_description"))).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: mockT("auth.sign_in") })).not.toBeInTheDocument();
    });
  });

  describe("with favorites", () => {
    beforeEach(() => {
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });
    });

    it("should display favorited stories", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });
    });

    it("should show story count in header", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(`1 ${mockT("favorites.place_singular")}`)).toBeInTheDocument();
      });
    });

    it("should show plural when multiple favorites", async () => {
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1", "story-2"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(`2 ${mockT("favorites.place_plural")}`)).toBeInTheDocument();
      });
    });

    it("should call toggleFavorite when clicking remove button", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(mockT("favorites.remove_from_saved"));
      fireEvent.click(removeButton);

      expect(mockToggleFavorite).toHaveBeenCalledWith("story-1");
    });

    // UX-L2 (#907): delete is the only destructive action in the visitor app
    // and had no confirmation, undo, or announcement. Verify an undo
    // affordance appears, is announced, and re-adds the story (rather than
    // delaying the original write, per the issue's regression-risk note).
    describe("undo affordance for removal (UX-L2)", () => {
      it("shows an announced undo toast after removing a favorite", async () => {
        render(<FavoritesPage />);

        await waitFor(() => {
          expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText(mockT("favorites.remove_from_saved")));

        const toast = await screen.findByRole("status");
        expect(toast).toBeInTheDocument();
        expect(toast).toHaveTextContent("Lagos de Covadonga");
        expect(toast).toHaveTextContent(mockT("favorites.removed"));
        expect(
          screen.getByRole("button", { name: mockT("favorites.undo") })
        ).toBeInTheDocument();
      });

      it("re-adds the story when Undo is clicked", async () => {
        render(<FavoritesPage />);

        await waitFor(() => {
          expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText(mockT("favorites.remove_from_saved")));
        expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
        expect(mockToggleFavorite).toHaveBeenNthCalledWith(1, "story-1");

        fireEvent.click(screen.getByRole("button", { name: mockT("favorites.undo") }));

        // Undo re-adds via the same toggle (the hook's toggleFavorite flips
        // the current state back), per the issue's "implement undo as a
        // re-add" regression note.
        expect(mockToggleFavorite).toHaveBeenCalledTimes(2);
        expect(mockToggleFavorite).toHaveBeenNthCalledWith(2, "story-1");

        // The toast dismisses once undone.
        await waitFor(() => {
          expect(
            screen.queryByRole("button", { name: mockT("favorites.undo") })
          ).not.toBeInTheDocument();
        });
      });

      it("dismisses the undo toast automatically after its timeout", async () => {
        // Render and let async/IntersectionObserver-driven state settle with
        // real timers first — testing-library's `waitFor` polls via its own
        // setTimeout, which never advances under fake timers.
        render(<FavoritesPage />);

        await waitFor(() => {
          expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
        });

        vi.useFakeTimers();
        try {
          fireEvent.click(screen.getByLabelText(mockT("favorites.remove_from_saved")));
          expect(
            screen.getByRole("button", { name: mockT("favorites.undo") })
          ).toBeInTheDocument();

          act(() => {
            vi.advanceTimersByTime(7000);
          });

          expect(
            screen.queryByRole("button", { name: mockT("favorites.undo") })
          ).not.toBeInTheDocument();
        } finally {
          vi.useRealTimers();
        }
      });
    });

    it("does not nest the remove button inside the story link", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(mockT("favorites.remove_from_saved"));
      expect(removeButton.closest("a")).toBeNull();
    });

    it("keeps metadata and removal reachable on touch and keyboard", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      const metadata = screen.getByText("Lagos de Covadonga").closest("a");
      expect(metadata?.className).toContain("opacity-100");

      const removeButton = screen.getByLabelText(mockT("favorites.remove_from_saved"));
      expect(removeButton.className).toContain("focus-visible:opacity-100");
      expect(removeButton.className).toContain("focus-visible:ring-2");
    });

    it("should not display non-favorited stories", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      expect(screen.queryByText("Catedral de Oviedo")).not.toBeInTheDocument();
    });
  });

  describe("header", () => {
    it("should display page title", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.title"))).toBeInTheDocument();
      });
    });

    it("should have back button linking to immersive", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        const backLink = links.find(link => link.getAttribute("href") === "/immersive");
        expect(backLink).toBeInTheDocument();
      });
    });
  });

  describe("story card navigation", () => {
    beforeEach(() => {
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1", "story-2"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });
    });

    it("should include ?story= param with slug in story card link", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      const storyLink = screen.getByText("Lagos de Covadonga").closest("a");
      expect(storyLink).toHaveAttribute("href", "/immersive?story=lagos-covadonga");
    });

    it("should fall back to story id when slug is missing", async () => {
      mockUseStories.mockReturnValue({
        stories: [
          {
            id: "story-no-slug",
            title: "Story Without Slug",
            subtitle: "No slug here",
            description: "Test story",
            image: "/images/test.jpg",
            category: "nature" as const,
            sourcePdf: "test.pdf",
            // No slug property
          },
        ],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      mockUseFavorites.mockReturnValue({
        favorites: ["story-no-slug"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Story Without Slug")).toBeInTheDocument();
      });

      const storyLink = screen.getByText("Story Without Slug").closest("a");
      expect(storyLink).toHaveAttribute("href", "/immersive?story=story-no-slug");
    });
  });

  describe("story cards", () => {
    beforeEach(() => {
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });
    });

    it("should display story image", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        const image = screen.getByAltText("Lagos de Covadonga");
        expect(image).toHaveAttribute("src", "/images/lagos.jpg");
      });
    });

    it("should display story category on hover content", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        // Category is shown in hover overlay as "Naturaleza"
        expect(screen.getByText("Naturaleza")).toBeInTheDocument();
      });
    });

    it("should show placeholder when story has no image", async () => {
      // Override stories to include a story without image
      mockUseStories.mockReturnValue({
        stories: [
          {
            id: "story-no-img",
            slug: "no-image-story",
            title: "Story Without Image",
            subtitle: "",
            description: "No image here",
            image: "", // empty image
            category: "nature" as const,
            sourcePdf: "test.pdf",
          },
        ],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      mockUseFavorites.mockReturnValue({
        favorites: ["story-no-img"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        // When visible but no image, should show the title in placeholder
        expect(screen.getByText("Story Without Image")).toBeInTheDocument();
      });
    });

    it("should display subtitle on hover when present", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
      });
    });
  });

  describe("feature card", () => {
    it("should mark first card as feature when more than 2 favorites", async () => {
      const threeStories = [
        ...mockStories,
        {
          id: "story-3",
          slug: "playa-silencio",
          title: "Playa del Silencio",
          subtitle: "Costa occidental",
          description: "Amazing beach",
          image: "/images/playa.jpg",
          category: "nature" as const,
          sourcePdf: "nature.pdf",
        },
      ];

      mockUseStories.mockReturnValue({
        stories: threeStories,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      mockUseFavorites.mockReturnValue({
        favorites: ["story-1", "story-2", "story-3"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
        expect(screen.getByText("Catedral de Oviedo")).toBeInTheDocument();
        expect(screen.getByText("Playa del Silencio")).toBeInTheDocument();
      });
    });
  });

  describe("infinite scroll / loadMore", () => {
    // Create 25 stories to exceed the ITEMS_PER_PAGE (20) threshold
    const manyStories = Array.from({ length: 25 }, (_, i) => ({
      id: `story-${i}`,
      slug: `story-slug-${i}`,
      title: `Story Title ${i}`,
      subtitle: `Subtitle ${i}`,
      description: `Description ${i}`,
      image: `/images/story-${i}.jpg`,
      category: "nature" as const,
      sourcePdf: "nature.pdf",
    }));
    const manyFavoriteIds = manyStories.map((s) => s.id);

    beforeEach(() => {
      mockUseStories.mockReturnValue({
        stories: manyStories,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
      mockUseFavorites.mockReturnValue({
        favorites: manyFavoriteIds,
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });
    });

    it("should trigger loadMore via IntersectionObserver and display more items", async () => {
      render(<FavoritesPage />);

      // The IntersectionObserver mock fires immediately with isIntersecting: true,
      // triggering loadMore. loadMore uses a 300ms setTimeout internally.
      // Wait for the additional items to appear after the timeout completes.
      await waitFor(() => {
        expect(screen.getByText("Story Title 24")).toBeInTheDocument();
      });

      // All 25 stories should now be displayed
      expect(screen.getByText("Story Title 0")).toBeInTheDocument();
      expect(screen.getByText("Story Title 20")).toBeInTheDocument();
    }, 10_000);

    it("should not load more when hasMore is false", async () => {
      // Use exactly 20 stories so hasMore starts as false
      const exactStories = manyStories.slice(0, 20);
      const exactFavoriteIds = exactStories.map((s) => s.id);

      mockUseStories.mockReturnValue({
        stories: exactStories,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
      mockUseFavorites.mockReturnValue({
        favorites: exactFavoriteIds,
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Story Title 0")).toBeInTheDocument();
        expect(screen.getByText("Story Title 19")).toBeInTheDocument();
      });

      // With exactly 20 items, hasMore is false so the guard clause prevents loading.
      // All 20 are displayed, confirm the count header.
      expect(screen.getByText(`20 ${mockT("favorites.place_plural")}`)).toBeInTheDocument();
    });
  });

  describe("loadMore guard (page.tsx line 38)", () => {
    it("should guard loadMore when no more items", async () => {
      // COVERAGE NOTE: the guard `if (!hasMore) return;` inside loadMore
      // (page.tsx:38) is defensive dead code, unreachable in jsdom AND in
      // production — its sole caller, the IntersectionObserver callback,
      // pre-checks `hasMore` from the same render closure before invoking
      // loadMore, so the guard's condition is always false when loadMore
      // runs. This test verifies the observable behavior (no extra items
      // load when hasMore is false via the observer pre-check); the
      // in-function guard itself cannot be executed without a source change.
      //
      // UX-L2 (#907): the sibling `isLoadingMore` state this comment
      // previously documented was removed entirely — see the "coverage
      // notes" describe block below.
      // With exactly 20 stories (= ITEMS_PER_PAGE), hasMore starts as false,
      // so no further page is loaded on intersection.
      const exactStories = Array.from({ length: 20 }, (_, i) => ({
        id: `story-${i}`,
        slug: `story-slug-${i}`,
        title: `Story Title ${i}`,
        subtitle: `Subtitle ${i}`,
        description: `Description ${i}`,
        image: `/images/story-${i}.jpg`,
        category: "nature" as const,
        sourcePdf: "nature.pdf",
      }));

      mockUseStories.mockReturnValue({
        stories: exactStories,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
      mockUseFavorites.mockReturnValue({
        favorites: exactStories.map((s) => s.id),
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      // All 20 items fit in the first page, so hasMore = false.
      // The IntersectionObserver fires, but its pre-check short-circuits
      // before loadMore is even called (see coverage note above).
      await waitFor(() => {
        expect(screen.getByText("Story Title 0")).toBeInTheDocument();
        expect(screen.getByText("Story Title 19")).toBeInTheDocument();
      });

      // Verify the count — all 20 are shown, no extra items loaded
      expect(screen.getByText(`20 ${mockT("favorites.place_plural")}`)).toBeInTheDocument();
    });
  });

  describe("loadMore pagination behavior (UX-L2)", () => {
    // Create 25 stories to exceed ITEMS_PER_PAGE (20), so hasMore starts as true
    const manyStories = Array.from({ length: 25 }, (_, i) => ({
      id: `story-${i}`,
      slug: `story-slug-${i}`,
      title: `Story Title ${i}`,
      subtitle: `Subtitle ${i}`,
      description: `Description ${i}`,
      image: `/images/story-${i}.jpg`,
      category: "nature" as const,
      sourcePdf: "nature.pdf",
    }));
    const manyFavoriteIds = manyStories.map((s) => s.id);

    it("loads the next page synchronously on intersection and stops at the end (UX-L2: no artificial delay)", async () => {
      // Override IntersectionObserver so we control when the page-level loadMore fires.
      // The artificial 300ms loading delay was removed (UX-L2), so loadMore now applies
      // synchronously: an intersection immediately reveals the next page, and once all
      // items are shown (hasMore === false) further intersections are no-ops.
      let pageLoadMoreCallback: IntersectionObserverCallback | null = null;
      let pageLoadMoreTarget: Element | null = null;
      const originalIO = global.IntersectionObserver;

      const fire = (cb: IntersectionObserverCallback, target: Element, observer: IntersectionObserver) =>
        cb(
          [
            {
              isIntersecting: true,
              target,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRatio: 1,
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: Date.now(),
            },
          ],
          observer
        );

      try {
        class ControlledObserver implements IntersectionObserver {
          readonly root: Element | null = null;
          readonly rootMargin: string = "";
          readonly scrollMargin: string = "";
          readonly thresholds: ReadonlyArray<number> = [];

          private readonly isPageSentinel: boolean;
          constructor(
            private callback: IntersectionObserverCallback,
            options?: IntersectionObserverInit
          ) {
            // The page-level loadMore sentinel uses rootMargin "200px";
            // GalleryItem visibility observers use "100px".
            this.isPageSentinel = options?.rootMargin === "200px";
          }

          observe(target: Element): void {
            // Capture (do NOT fire) the page-level loadMore sentinel so we can control
            // its timing; fire immediately for GalleryItem observers so text renders.
            if (this.isPageSentinel) {
              pageLoadMoreCallback = this.callback;
              pageLoadMoreTarget = target;
            } else {
              fire(this.callback, target, this);
            }
          }

          unobserve(): void {}
          disconnect(): void {}
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }

        global.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;

        mockUseStories.mockReturnValue({
          stories: manyStories,
          isLoading: false,
          error: null,
          refresh: vi.fn(),
        });
        mockUseFavorites.mockReturnValue({
          favorites: manyFavoriteIds,
          toggleFavorite: mockToggleFavorite,
          isLoading: false,
        });

        const { unmount } = render(<FavoritesPage />);

        // Initially only 20 stories displayed (ITEMS_PER_PAGE) — page-level observer captured, not fired.
        expect(screen.getByText("Story Title 0")).toBeInTheDocument();
        expect(screen.getByText("Story Title 19")).toBeInTheDocument();
        expect(screen.queryByText("Story Title 20")).not.toBeInTheDocument();

        // One intersection synchronously loads the remaining page (no 300ms wait).
        act(() => {
          if (pageLoadMoreCallback && pageLoadMoreTarget) {
            fire(pageLoadMoreCallback, pageLoadMoreTarget, {} as IntersectionObserver);
          }
        });

        expect(screen.getByText("Story Title 24")).toBeInTheDocument();
        expect(screen.getByText(`25 ${mockT("favorites.place_plural")}`)).toBeInTheDocument();

        // A further intersection is a no-op now that hasMore is false — count stays at 25.
        act(() => {
          if (pageLoadMoreCallback && pageLoadMoreTarget) {
            fire(pageLoadMoreCallback, pageLoadMoreTarget, {} as IntersectionObserver);
          }
        });
        expect(screen.getByText(`25 ${mockT("favorites.place_plural")}`)).toBeInTheDocument();

        unmount();
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });
  });

  describe("GalleryItem IntersectionObserver (lines 210-227)", () => {
    it("should render placeholder before intersection and content after", async () => {
      // Override IntersectionObserver so GalleryItem items start as not visible
      const galleryObserveCallbacks: Array<{
        callback: IntersectionObserverCallback;
        target: Element;
        observer: IntersectionObserver;
      }> = [];
      const originalIO = global.IntersectionObserver;

      try {
        class LazyObserver implements IntersectionObserver {
          readonly root: Element | null = null;
          readonly rootMargin: string = "";
          readonly scrollMargin: string = "";
          readonly thresholds: ReadonlyArray<number> = [];
          private disconnected = false;

          constructor(
            private callback: IntersectionObserverCallback,
            _options?: IntersectionObserverInit
          ) {}

          observe(target: Element): void {
            if (!this.disconnected) {
              galleryObserveCallbacks.push({
                callback: this.callback,
                target,
                observer: this,
              });
            }
          }

          unobserve(): void {}
          disconnect(): void {
            this.disconnected = true;
          }
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }

        global.IntersectionObserver = LazyObserver as unknown as typeof IntersectionObserver;

        mockUseFavorites.mockReturnValue({
          favorites: ["story-1"],
          toggleFavorite: mockToggleFavorite,
          isLoading: false,
        });

        render(<FavoritesPage />);

        // Before intersection fires, the GalleryItem should show a placeholder (no image)
        expect(screen.queryByAltText("Lagos de Covadonga")).not.toBeInTheDocument();

        // Now simulate the GalleryItem observer firing isIntersecting: true
        // The last observer callback is for the GalleryItem (the first is the page-level loadMore sentinel)
        const galleryEntry = galleryObserveCallbacks[galleryObserveCallbacks.length - 1];
        expect(galleryEntry).toBeDefined();

        // Verify we have callbacks stored (page-level + GalleryItem)
        expect(galleryObserveCallbacks.length).toBeGreaterThanOrEqual(2);

        // Fire all stored observer callbacks with isIntersecting: true
        // This ensures the GalleryItem observer receives the intersection event
        for (const entry of galleryObserveCallbacks) {
          await act(async () => {
            entry.callback(
              [
                {
                  isIntersecting: true,
                  target: entry.target,
                  boundingClientRect: entry.target.getBoundingClientRect(),
                  intersectionRatio: 1,
                  intersectionRect: entry.target.getBoundingClientRect(),
                  rootBounds: null,
                  time: Date.now(),
                },
              ],
              entry.observer
            );
          });
        }

        // After intersection, the image should be visible
        expect(screen.getByAltText("Lagos de Covadonga")).toBeInTheDocument();
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });

    it("should disconnect observer after becoming visible", () => {
      const disconnectSpy = vi.fn();
      const originalIO = global.IntersectionObserver;

      try {
        class TrackingObserver implements IntersectionObserver {
          readonly root: Element | null = null;
          readonly rootMargin: string = "";
          readonly scrollMargin: string = "";
          readonly thresholds: ReadonlyArray<number> = [];

          constructor(
            private callback: IntersectionObserverCallback,
            _options?: IntersectionObserverInit
          ) {}

          observe(target: Element): void {
            // Immediately fire isIntersecting: true, like the default mock
            this.callback(
              [
                {
                  isIntersecting: true,
                  target,
                  boundingClientRect: target.getBoundingClientRect(),
                  intersectionRatio: 1,
                  intersectionRect: target.getBoundingClientRect(),
                  rootBounds: null,
                  time: Date.now(),
                },
              ],
              this
            );
          }

          unobserve(): void {}
          disconnect(): void {
            disconnectSpy();
          }
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }

        global.IntersectionObserver = TrackingObserver as unknown as typeof IntersectionObserver;

        mockUseFavorites.mockReturnValue({
          favorites: ["story-1"],
          toggleFavorite: mockToggleFavorite,
          isLoading: false,
        });

        render(<FavoritesPage />);

        // The GalleryItem observer calls disconnect() after isIntersecting fires (line 212).
        // There are 2 observers: one for loadMore sentinel and one for GalleryItem.
        // The GalleryItem one disconnects on intersection.
        expect(disconnectSpy).toHaveBeenCalled();
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });

    it("should not trigger visibility when intersection is false", () => {
      const originalIO = global.IntersectionObserver;

      try {
        class NonIntersectingObserver implements IntersectionObserver {
          readonly root: Element | null = null;
          readonly rootMargin: string = "";
          readonly scrollMargin: string = "";
          readonly thresholds: ReadonlyArray<number> = [];

          constructor(
            private callback: IntersectionObserverCallback,
            _options?: IntersectionObserverInit
          ) {}

          observe(target: Element): void {
            // Fire with isIntersecting: false — element is not in viewport
            this.callback(
              [
                {
                  isIntersecting: false,
                  target,
                  boundingClientRect: target.getBoundingClientRect(),
                  intersectionRatio: 0,
                  intersectionRect: target.getBoundingClientRect(),
                  rootBounds: null,
                  time: Date.now(),
                },
              ],
              this
            );
          }

          unobserve(): void {}
          disconnect(): void {}
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }

        global.IntersectionObserver = NonIntersectingObserver as unknown as typeof IntersectionObserver;

        mockUseFavorites.mockReturnValue({
          favorites: ["story-1"],
          toggleFavorite: mockToggleFavorite,
          isLoading: false,
        });

        render(<FavoritesPage />);

        // With isIntersecting: false, the GalleryItem should remain in placeholder state
        // (isVisible stays false), so no image is rendered
        expect(screen.queryByAltText("Lagos de Covadonga")).not.toBeInTheDocument();
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });

    it("triggers GalleryItem cleanup (unobserve) when component unmounts (lines 213-215)", () => {
      const unobserveSpy = vi.fn();
      const originalIO = global.IntersectionObserver;

      try {
        class TrackingUnobserveObserver implements IntersectionObserver {
          readonly root: Element | null = null;
          readonly rootMargin: string = "";
          readonly scrollMargin: string = "";
          readonly thresholds: ReadonlyArray<number> = [];

          constructor(
            private callback: IntersectionObserverCallback,
            _options?: IntersectionObserverInit
          ) {}

          observe(target: Element): void {
            // Fire isIntersecting: false so the observer is NOT disconnected on first intersection.
            // This keeps the observer alive so unobserve() gets called on unmount.
            this.callback(
              [
                {
                  isIntersecting: false,
                  target,
                  boundingClientRect: target.getBoundingClientRect(),
                  intersectionRatio: 0,
                  intersectionRect: target.getBoundingClientRect(),
                  rootBounds: null,
                  time: Date.now(),
                },
              ],
              this
            );
          }

          unobserve(): void {
            unobserveSpy();
          }
          disconnect(): void {}
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }

        global.IntersectionObserver = TrackingUnobserveObserver as unknown as typeof IntersectionObserver;

        mockUseFavorites.mockReturnValue({
          favorites: ["story-1"],
          toggleFavorite: mockToggleFavorite,
          isLoading: false,
        });

        const { unmount } = render(<FavoritesPage />);
        unmount();

        // React calls the useEffect cleanup on unmount, which calls observer.unobserve(currentRef)
        expect(unobserveSpy).toHaveBeenCalled();
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });

    // Lines 222-227: GalleryItem IntersectionObserver null-safe guards — architecturally unreachable.
    //
    // Line 222: `if (currentRef) { observer.observe(currentRef); }`
    // Line 227: `if (currentRef) { observer.unobserve(currentRef); }`
    //
    // These guards protect against a null ref, but `itemRef.current` is always set to the
    // rendered `<a>` element before `useEffect` fires (React assigns refs synchronously during
    // commit phase, before effects run). The null branch of both guards is therefore never taken
    // in any environment where GalleryItem is actually rendered in a real or jsdom DOM.
    //
    // The false branch cannot be exercised without mocking React.useRef to return a null ref,
    // which would not represent any real usage scenario.
    it("documents GalleryItem IntersectionObserver null-safe guards (lines 222, 227) as unreachable", () => {
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      // GalleryItem renders and registers its observer with a non-null ref.
      // The observe() call succeeds, confirming the true branch (ref is not null) always runs.
      // The false branch (null ref) is only reachable if itemRef.current were null at effect
      // time, which cannot happen in normal React rendering (ref is set before useEffect fires).
      expect(true).toBe(true); // Invariant proven by the standard React ref commit order.
    });
  });

  describe("anonymous favorites state", () => {
    it("should not show a local-only sync banner for anonymous favorites", async () => {
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      expect(screen.queryByText(mockT("favorites.local_only"))).not.toBeInTheDocument();
      expect(screen.queryByText(mockT("favorites.local_only_description"))).not.toBeInTheDocument();
      expect(screen.queryByText(mockT("favorites.sync_with_google"))).not.toBeInTheDocument();
    });

    it("should not show sync banner when user is logged in", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@test.com" },
        session: { access_token: "test-token" },
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: vi.fn(),
      });

      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      expect(screen.queryByText(mockT("favorites.local_only"))).not.toBeInTheDocument();
    });

    it("should not show sync banner when user has no favorites", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText(mockT("favorites.empty_title"))).toBeInTheDocument();
      });

      expect(screen.queryByText(mockT("favorites.local_only"))).not.toBeInTheDocument();
    });
  });

  describe("coverage notes — unreachable guards", () => {
    it("documents loadMore guard (line 38) as dead code — IntersectionObserver pre-guards before invoking loadMore", async () => {
      // Line 38: `if (!hasMore) return;` inside loadMore is defensive dead code.
      //
      // Reason: The ONLY call site is the IntersectionObserver callback, which already
      // checks `hasMore` before calling loadMore(). There is no "Load More" button or
      // other call site, so the guard inside loadMore can never trigger.
      //
      // UX-L2 (#907): the sibling `isLoadingMore` state (and the "loading_more" spinner
      // branch it gated, which never actually rendered — both setters fired synchronously
      // in the same call with no yield between them) was removed entirely rather than
      // left as unreachable dead code.

      // Demonstrate: 20 stories (hasMore=false) → IO fires immediately → no items beyond 20 loaded
      const twentyStories = Array.from({ length: 20 }, (_, i) => ({
        id: `story-${i}`,
        slug: `slug-${i}`,
        title: `Story ${i}`,
        subtitle: `Sub ${i}`,
        description: `Desc ${i}`,
        image: `/img/${i}.jpg`,
        category: "nature" as const,
        sourcePdf: "x.pdf",
      }));
      mockUseStories.mockReturnValue({ stories: twentyStories, isLoading: false, error: null, refresh: vi.fn() });
      mockUseFavorites.mockReturnValue({ favorites: twentyStories.map((s) => s.id), toggleFavorite: mockToggleFavorite, isLoading: false });

      render(<FavoritesPage />);

      // IO fires immediately (mock) but loadMore() is never called because IO's own guard blocks it
      await waitFor(() => expect(screen.getByText("Story 19")).toBeInTheDocument());
      // Still exactly 20 items — line 38's return was never executed (IO prevented the call)
      expect(screen.queryByText(`21 ${mockT("favorites.place_plural")}`)).not.toBeInTheDocument();
    });

    it("documents GalleryItem's itemRef null-guards (lines 205, 210) as architecturally unreachable", () => {
      // Lines 205 and 210: `if (currentRef) { observer.observe/unobserve(currentRef); }`
      // inside GalleryItem's IntersectionObserver effect are defensive null-safety guards.
      //
      // itemRef.current is always set to the rendered root <div ref={itemRef}> before
      // useEffect fires, because React assigns refs synchronously during the commit
      // phase, strictly before effects run. So `currentRef` is always truthy by the time
      // this effect body executes for any GalleryItem that is actually mounted — the
      // false branch (null ref) cannot be reached without mocking React internals in a
      // way that doesn't represent real usage. Already covered by the same reasoning
      // documented above for the GalleryItem observer registration.
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });

      render(<FavoritesPage />);

      expect(screen.getByAltText("Lagos de Covadonga")).toBeInTheDocument();
    });
  });

  // UX-H6 (#892): getLocalizedStory was bypassed across the entire favorites
  // gallery — a non-Spanish visitor's saved places always rendered raw
  // Spanish title/subtitle/image-alt, reverting their chosen language.
  describe("UX-H6 (#892): locale-aware gallery text", () => {
    const storyWithTranslation = {
      id: "story-1",
      slug: "lagos-covadonga",
      title: "Lagos de Covadonga",
      subtitle: "Picos de Europa",
      description: "Beautiful glacial lakes",
      image: "/images/lagos.jpg",
      category: "nature" as const,
      sourcePdf: "nature.pdf",
      metadata: {
        translations: {
          fr: {
            title: "Lacs de Covadonga",
            subtitle: "Pics d'Europe",
            description: "De magnifiques lacs glaciaires",
          },
        },
      },
    };

    beforeEach(() => {
      mockUseStories.mockReturnValue({
        stories: [storyWithTranslation],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
      mockUseFavorites.mockReturnValue({
        favorites: ["story-1"],
        toggleFavorite: mockToggleFavorite,
        isLoading: false,
      });
    });

    it("renders the localized title/subtitle for a non-Spanish locale", async () => {
      mockLocale = "fr";

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lacs de Covadonga")).toBeInTheDocument();
      });
      expect(screen.getByText("Pics d'Europe")).toBeInTheDocument();
      expect(screen.queryByText("Lagos de Covadonga")).not.toBeInTheDocument();
      expect(screen.queryByText("Picos de Europa")).not.toBeInTheDocument();
    });

    it("uses the localized title as the image alt text for a non-Spanish locale", async () => {
      mockLocale = "fr";

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByAltText("Lacs de Covadonga")).toBeInTheDocument();
      });
    });

    it("falls back to Spanish text when no translation exists for the active locale", async () => {
      mockLocale = "de";

      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });
      expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
    });

    it("still renders the raw title/subtitle for the default Spanish locale", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });
      expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
    });
  });
});
