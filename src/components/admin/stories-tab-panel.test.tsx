import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { StoriesTabPanel } from "./stories-tab-panel";
import type { AdminStory } from "@/types/admin";

// Mock matchMedia for next-themes
beforeAll(() => {
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
});

// Mock next/navigation
const mockRouterPush = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

// Mock dynamic imports
vi.mock("@/components/admin/story-grid", () => ({
  StoryGrid: ({ stories }: { stories: AdminStory[] }) => (
    <div data-testid="story-grid">{stories.length} stories</div>
  ),
}));

vi.mock("@/components/admin/story-editor-dialog", () => ({
  StoryEditorDialog: () => null,
}));

vi.mock("@/components/admin/create-story-dialog", () => ({
  CreateStoryDialog: () => null,
}));

vi.mock("@/components/admin/selection-toolbar", () => ({
  SelectionToolbar: () => null,
}));

vi.mock("@/components/ui/stat-card", () => ({
  StatCard: ({
    value,
    label,
    onClick,
    ariaLabel,
  }: {
    value: number;
    label: string;
    onClick: () => void;
    ariaLabel?: string;
    isActive?: boolean;
    variant: string;
    icon: React.ReactNode;
  }) => (
    <button aria-label={ariaLabel} onClick={onClick} data-testid={`stat-card-${label.toLowerCase()}`}>
      {label}: {value}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  RefreshCw: ({ className, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-refresh" className={className as string} {...props} />
  ),
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  ImageIcon: (props: Record<string, unknown>) => <span data-testid="icon-image" {...props} />,
  CheckCircle2: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
  Layers: (props: Record<string, unknown>) => <span data-testid="icon-layers" {...props} />,
  Search: (props: Record<string, unknown>) => <span data-testid="icon-search" {...props} />,
  Plus: (props: Record<string, unknown>) => <span data-testid="icon-plus" {...props} />,
  Languages: (props: Record<string, unknown>) => <span data-testid="icon-languages" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <span data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <span data-testid="icon-chevron-right" {...props} />,
}));

const mockFetchStories = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
  bulkUpdateStoryStatus: vi.fn().mockResolvedValue({ data: { updatedIds: [], status: "approved" } }),
  bulkDeleteStories: vi.fn().mockResolvedValue({ data: { deletedIds: [] } }),
  approveAllPendingStories: vi.fn().mockResolvedValue({ data: { approvedCount: 0, approvedIds: [] } }),
}));

function makeStory(overrides: Partial<AdminStory> = {}): AdminStory {
  return {
    id: "story-1",
    slug: "test-story",
    title: "Test Story",
    subtitle: "Sub",
    description: "Desc",
    image: "/img.jpg",
    category: "nature",
    displayOrder: 1,
    curationStatus: "approved",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("StoriesTabPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockFetchStories.mockResolvedValue({ data: { stories: [], total: 0 } });
  });

  describe("Rendering", () => {
    it("renders the content dashboard heading", async () => {
      render(<StoriesTabPanel />);
      await waitFor(() => {
        expect(screen.getByText("Content Dashboard")).toBeInTheDocument();
      });
    });

    it("renders search input", async () => {
      render(<StoriesTabPanel />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search stories...")).toBeInTheDocument();
      });
    });

    it("renders create story button", async () => {
      render(<StoriesTabPanel />);
      await waitFor(() => {
        expect(screen.getByText("Create Story")).toBeInTheDocument();
      });
    });

    it("shows empty state when no stories", async () => {
      mockFetchStories.mockResolvedValue({ data: { stories: [], total: 0 } });
      render(<StoriesTabPanel />);
      await waitFor(() => {
        expect(screen.getByText("No stories found")).toBeInTheDocument();
      });
    });

    it("renders story grid when stories exist matching the default filter", async () => {
      // Default filter is "needs_curation", so return a story with that status
      mockFetchStories.mockResolvedValue({
        data: { stories: [makeStory({ curationStatus: "needs_curation" })], total: 1 },
      });
      render(<StoriesTabPanel />);
      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });
    });
  });

  describe("PE-M5: Pagination controls", () => {
    it("does not render pagination when total <= pageSize (20)", async () => {
      const stories = Array.from({ length: 5 }, (_, i) =>
        makeStory({ id: `story-${i}`, curationStatus: "needs_curation", displayOrder: i + 1 })
      );
      mockFetchStories.mockResolvedValue({ data: { stories, total: 5 } });

      render(<StoriesTabPanel />);

      // Wait for load to settle — stat-card for needs_curation will show count 5
      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.queryByRole("button", { name: /Previous/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Next/i })).not.toBeInTheDocument();
    }, 15000);

    it("renders Prev and Next buttons when total > pageSize", async () => {
      const stories = Array.from({ length: 20 }, (_, i) =>
        makeStory({ id: `story-${i}`, displayOrder: i + 1 })
      );
      mockFetchStories.mockResolvedValue({ data: { stories, total: 40 } });

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
      });
    });

    it("Prev button is disabled on first page", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: Array.from({ length: 20 }, (_, i) =>
            makeStory({ id: `s-${i}`, displayOrder: i + 1 })
          ),
          total: 40,
        },
      });

      render(<StoriesTabPanel />);

      await waitFor(() => {
        const prevBtn = screen.getByRole("button", { name: /Previous/i });
        expect(prevBtn).toBeDisabled();
      });
    });

    it("Next button is disabled on last page", async () => {
      // total=25, pageSize=20 → page 2 has 5 stories, no next page
      mockFetchStories.mockResolvedValue({
        data: {
          stories: Array.from({ length: 5 }, (_, i) =>
            makeStory({ id: `s-${i}`, displayOrder: i + 1 })
          ),
          total: 25,
        },
      });
      // Start on page 2
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "storiesPage" ? "2" : null
      );

      render(<StoriesTabPanel />);

      await waitFor(() => {
        const nextBtn = screen.getByRole("button", { name: /Next/i });
        expect(nextBtn).toBeDisabled();
      });
    });

    it("clicking Next advances to page 2 via router.push", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: Array.from({ length: 20 }, (_, i) =>
            makeStory({ id: `s-${i}`, displayOrder: i + 1 })
          ),
          total: 40,
        },
      });

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      });

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining("storiesPage=2"),
        expect.anything()
      );
    });

    it("clicking Prev decrements page via router.push", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: Array.from({ length: 20 }, (_, i) =>
            makeStory({ id: `s-${i}`, displayOrder: i + 1 })
          ),
          total: 40,
        },
      });
      // Start on page 2
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "storiesPage" ? "2" : null
      );

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
      });

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining("storiesPage=1"),
        expect.anything()
      );
    });

    it("reads storiesPage from URL search params on mount", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "storiesPage" ? "3" : null
      );
      mockFetchStories.mockResolvedValue({ data: { stories: [], total: 60 } });

      render(<StoriesTabPanel />);

      await waitFor(() => {
        // fetchStories called with page=3
        expect(mockFetchStories).toHaveBeenCalledWith(
          expect.objectContaining({ page: 3 })
        );
      });
    });

    it("shows current page info when paginated", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: Array.from({ length: 20 }, (_, i) =>
            makeStory({ id: `s-${i}`, displayOrder: i + 1 })
          ),
          total: 40,
        },
      });

      render(<StoriesTabPanel />);

      await waitFor(() => {
        // "Page 1 of 2" or similar
        expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error handling", () => {
    it("shows error message when fetchStories fails", async () => {
      mockFetchStories.mockResolvedValue({ error: "Failed to load" });

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load")).toBeInTheDocument();
      });
    });
  });
});
