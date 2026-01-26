import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FavoritesPage from "./page";

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
    mockUseFavorites.mockReturnValue({
      favorites: [],
      toggleFavorite: mockToggleFavorite,
      isLoading: false,
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

      expect(screen.getByText("Cargando...")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show empty state when no favorites", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("No tienes guardados todavía")).toBeInTheDocument();
      });
    });

    it("should show explore button in empty state", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Explorar historias")).toBeInTheDocument();
      });
    });

    it("should link to immersive page from explore button", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        const link = screen.getByText("Explorar historias");
        expect(link.closest("a")).toHaveAttribute("href", "/immersive");
      });
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
        expect(screen.getByText("1 lugar")).toBeInTheDocument();
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
        expect(screen.getByText("2 lugares")).toBeInTheDocument();
      });
    });

    it("should call toggleFavorite when clicking remove button", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText("Quitar de guardados");
      fireEvent.click(removeButton);

      expect(mockToggleFavorite).toHaveBeenCalledWith("story-1");
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
        expect(screen.getByText("Guardados")).toBeInTheDocument();
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
});
