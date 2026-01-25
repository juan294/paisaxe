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

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock useFavorites hook
const mockToggleFavorite = vi.fn();
const mockUseFavorites = vi.fn();

vi.mock("@/hooks/use-favorites", () => ({
  useFavorites: () => mockUseFavorites(),
}));

// Mock stories data
vi.mock("@/lib/stories-data", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getStoriesFromDB: vi.fn().mockResolvedValue([
      {
        id: "story-1",
        slug: "lagos-covadonga",
        title: "Lagos de Covadonga",
        subtitle: "Picos de Europa",
        description: "Beautiful glacial lakes",
        image: "/images/lagos.jpg",
        category: "nature",
        sourcePdf: "nature.pdf",
      },
      {
        id: "story-2",
        slug: "catedral-oviedo",
        title: "Catedral de Oviedo",
        subtitle: "Arte Romanico",
        description: "Historic cathedral",
        image: "/images/catedral.jpg",
        category: "culture",
        sourcePdf: "culture.pdf",
      },
    ]),
  };
});

describe("FavoritesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFavorites.mockReturnValue({
      favorites: [],
      toggleFavorite: mockToggleFavorite,
      isLoading: false,
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

      expect(screen.getByText("Cargando favoritos...")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show empty state when no favorites", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("No tienes favoritos todavia")).toBeInTheDocument();
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
        expect(screen.getByText("1 historia")).toBeInTheDocument();
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
        expect(screen.getByText("2 historias")).toBeInTheDocument();
      });
    });

    it("should call toggleFavorite when clicking remove button", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText("Quitar de favoritos");
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
        expect(screen.getByText("Mis Favoritos")).toBeInTheDocument();
      });
    });

    it("should have back button linking to immersive", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        const backLink = screen.getByRole("link", { name: "" });
        // The back button is an anchor with ArrowLeft icon
        expect(backLink).toHaveAttribute("href", "/immersive");
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

    it("should display story subtitle", async () => {
      render(<FavoritesPage />);

      await waitFor(() => {
        expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
      });
    });
  });
});
