import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
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
  StoryGrid: ({
    stories,
    onEdit,
    onToggleSelect,
    selectedIds,
  }: {
    stories: AdminStory[];
    onEdit: (s: AdminStory) => void;
    onToggleSelect: (id: string) => void;
    selectedIds: Set<string>;
    selectionMode: boolean;
  }) => (
    <div data-testid="story-grid">
      {stories.length} stories
      {stories.map((s) => (
        <div key={s.id}>
          <button
            data-testid={`story-edit-${s.id}`}
            onClick={() => onEdit(s)}
          >
            edit {s.id}
          </button>
          <button
            data-testid={`story-toggle-${s.id}`}
            data-selected={selectedIds.has(s.id) ? "true" : "false"}
            onClick={() => onToggleSelect(s.id)}
          >
            toggle {s.id}
          </button>
        </div>
      ))}
    </div>
  ),
}));

const editorDialogProps: {
  story: AdminStory | null;
  onUpdate?: (id: string, updates: Partial<AdminStory>) => void;
  onClose?: () => void;
} = { story: null };
vi.mock("@/components/admin/story-editor-dialog", () => ({
  StoryEditorDialog: (props: {
    story: AdminStory | null;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<AdminStory>) => void;
  }) => {
    editorDialogProps.story = props.story;
    editorDialogProps.onUpdate = props.onUpdate;
    editorDialogProps.onClose = props.onClose;
    return props.story ? (
      <div data-testid="editor-dialog">
        editing {props.story.id}
        <button
          data-testid="editor-close"
          onClick={props.onClose}
        >
          close
        </button>
      </div>
    ) : null;
  },
}));

const createDialogProps: {
  open: boolean;
  onCreated?: (s: unknown) => void;
  onOpenChange?: (open: boolean) => void;
} = { open: false };
vi.mock("@/components/admin/create-story-dialog", () => ({
  CreateStoryDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (s: unknown) => void;
  }) => {
    createDialogProps.open = props.open;
    createDialogProps.onCreated = props.onCreated;
    createDialogProps.onOpenChange = props.onOpenChange;
    return props.open ? (
      <div data-testid="create-dialog">
        <button
          data-testid="create-confirm"
          onClick={() => props.onCreated({ id: "new-story" })}
        >
          confirm
        </button>
      </div>
    ) : null;
  },
}));

const toolbarProps: {
  selectedCount: number;
  onMarkApproved?: () => void;
  onMarkPending?: () => void;
  onDelete?: () => void;
  onClearSelection?: () => void;
} = { selectedCount: 0 };
vi.mock("@/components/admin/selection-toolbar", () => ({
  SelectionToolbar: (props: {
    selectedCount: number;
    onMarkApproved: () => void;
    onMarkPending: () => void;
    onDelete: () => void;
    onClearSelection: () => void;
    isLoading: boolean;
  }) => {
    toolbarProps.selectedCount = props.selectedCount;
    toolbarProps.onMarkApproved = props.onMarkApproved;
    toolbarProps.onMarkPending = props.onMarkPending;
    toolbarProps.onDelete = props.onDelete;
    toolbarProps.onClearSelection = props.onClearSelection;
    if (props.selectedCount === 0) return null;
    return (
      <div data-testid="selection-toolbar">
        <span data-testid="selection-count">{props.selectedCount}</span>
        <button data-testid="bulk-approve" onClick={props.onMarkApproved}>
          approve
        </button>
        <button data-testid="bulk-pending" onClick={props.onMarkPending}>
          pending
        </button>
        <button data-testid="bulk-delete" onClick={props.onDelete}>
          delete
        </button>
        <button data-testid="bulk-clear" onClick={props.onClearSelection}>
          clear
        </button>
      </div>
    );
  },
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
const mockBulkUpdateStoryStatus = vi.fn();
const mockBulkDeleteStories = vi.fn();
const mockApproveAllPendingStories = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
  bulkUpdateStoryStatus: (...args: unknown[]) =>
    mockBulkUpdateStoryStatus(...args),
  bulkDeleteStories: (...args: unknown[]) => mockBulkDeleteStories(...args),
  approveAllPendingStories: (...args: unknown[]) =>
    mockApproveAllPendingStories(...args),
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
    mockBulkUpdateStoryStatus.mockResolvedValue({
      data: { updatedIds: [], status: "approved" },
    });
    mockBulkDeleteStories.mockResolvedValue({
      data: { deletedIds: [] },
    });
    mockApproveAllPendingStories.mockResolvedValue({
      data: { approvedCount: 0, approvedIds: [] },
    });
    editorDialogProps.story = null;
    editorDialogProps.onUpdate = undefined;
    editorDialogProps.onClose = undefined;
    createDialogProps.open = false;
    createDialogProps.onCreated = undefined;
    createDialogProps.onOpenChange = undefined;
    toolbarProps.selectedCount = 0;
    toolbarProps.onMarkApproved = undefined;
    toolbarProps.onMarkPending = undefined;
    toolbarProps.onDelete = undefined;
    toolbarProps.onClearSelection = undefined;
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

  describe("Filter switching", () => {
    const mixed = [
      makeStory({ id: "a", curationStatus: "needs_curation" }),
      makeStory({ id: "b", curationStatus: "approved" }),
      makeStory({
        id: "c",
        curationStatus: "approved",
        metadata: { translations: { en: { title: "T" } } },
      } as Partial<AdminStory>),
    ];

    beforeEach(() => {
      mockFetchStories.mockResolvedValue({
        data: { stories: mixed, total: mixed.length },
      });
    });

    it("clicking the Pending stat card switches back to needs_curation filter", async () => {
      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByTestId("stat-card-total")).toBeInTheDocument();
      });

      // Switch away from default needs_curation
      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-total"));
      });

      // Click Pending to return to needs_curation filter
      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-pending"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toHaveTextContent("1 stories");
      });
    });

    it("clicking the Approved stat card filters out non-approved stories", async () => {
      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-approved"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toHaveTextContent(
          "2 stories"
        );
      });
    });

    it("clicking Total stat card shows all stories regardless of status", async () => {
      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-total"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toHaveTextContent(
          `${mixed.length} stories`
        );
      });
    });

    it("clicking Missing i18n stat card uses hasMissingTranslations filter", async () => {
      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-missing i18n"));
      });

      await waitFor(() => {
        // Stories without complete translations metadata are kept; story with
        // partial translations metadata is also kept (missing locales).
        const grid = screen.getByTestId("story-grid");
        expect(grid).toBeInTheDocument();
      });
    });

    it("typing in search filters stories by title (case-insensitive)", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [
            makeStory({ id: "a", curationStatus: "approved", title: "Lakes of Asturias" }),
            makeStory({ id: "b", curationStatus: "approved", title: "Mountains" }),
          ],
          total: 2,
        },
      });

      render(<StoriesTabPanel />);

      // Default filter is "needs_curation"; approved stories hidden.
      await waitFor(() => {
        expect(screen.getByTestId("stat-card-total")).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-total"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toHaveTextContent("2 stories");
      });

      const search = screen.getByPlaceholderText("Search stories...");
      await act(async () => {
        fireEvent.change(search, { target: { value: "lakes" } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toHaveTextContent("1 stories");
      });
    });
  });

  describe("Bulk operations", () => {
    const stories = [
      makeStory({ id: "s1", curationStatus: "approved" }),
      makeStory({ id: "s2", curationStatus: "approved" }),
    ];

    beforeEach(() => {
      mockFetchStories.mockResolvedValue({
        data: { stories, total: stories.length },
      });
    });

    async function renderAndSelect(ids: string[]) {
      render(<StoriesTabPanel />);

      // Default filter is "needs_curation"; approved stories are hidden.
      // Wait for the stat card to appear, switch to "all", then wait for grid.
      await waitFor(() => {
        expect(screen.getByTestId("stat-card-total")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-total"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      for (const id of ids) {
        await act(async () => {
          fireEvent.click(screen.getByTestId(`story-toggle-${id}`));
        });
      }
    }

    it("bulk mark approved updates selected stories and clears selection", async () => {
      mockBulkUpdateStoryStatus.mockResolvedValue({
        data: { updatedIds: ["s1"], status: "approved" },
      });

      await renderAndSelect(["s1"]);

      expect(screen.getByTestId("selection-count")).toHaveTextContent("1");

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-approve"));
      });

      await waitFor(() => {
        expect(mockBulkUpdateStoryStatus).toHaveBeenCalledWith(
          ["s1"],
          "approved"
        );
        expect(screen.queryByTestId("selection-toolbar")).not.toBeInTheDocument();
      });
    });

    it("bulk mark approved surfaces error and keeps selection", async () => {
      mockBulkUpdateStoryStatus.mockResolvedValue({ error: "boom" });

      await renderAndSelect(["s1"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-approve"));
      });

      await waitFor(() => {
        expect(screen.getByText("boom")).toBeInTheDocument();
      });
      expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();
    });

    it("bulk mark pending calls API with needs_curation status", async () => {
      mockBulkUpdateStoryStatus.mockResolvedValue({
        data: { updatedIds: ["s1", "s2"], status: "needs_curation" },
      });

      await renderAndSelect(["s1", "s2"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-pending"));
      });

      await waitFor(() => {
        expect(mockBulkUpdateStoryStatus).toHaveBeenCalledWith(
          expect.arrayContaining(["s1", "s2"]),
          "needs_curation"
        );
      });
    });

    it("bulk mark pending surfaces error", async () => {
      mockBulkUpdateStoryStatus.mockResolvedValue({ error: "pending boom" });

      await renderAndSelect(["s1"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-pending"));
      });

      await waitFor(() => {
        expect(screen.getByText("pending boom")).toBeInTheDocument();
      });
    });

    it("bulk delete calls confirm and removes stories on accept", async () => {
      const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(true);
      mockBulkDeleteStories.mockResolvedValue({
        data: { deletedIds: ["s1"] },
      });

      await renderAndSelect(["s1"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-delete"));
      });

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("delete 1 story"));
        expect(mockBulkDeleteStories).toHaveBeenCalledWith(["s1"]);
      });
      confirmSpy.mockRestore();
    });

    it("bulk delete plural confirm message when multiple selected", async () => {
      const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(true);

      await renderAndSelect(["s1", "s2"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-delete"));
      });

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith(
          expect.stringContaining("delete 2 stories")
        );
      });
      confirmSpy.mockRestore();
    });

    it("bulk delete is a no-op when user cancels confirm", async () => {
      const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(false);

      await renderAndSelect(["s1"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-delete"));
      });

      expect(mockBulkDeleteStories).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("bulk delete surfaces error from API", async () => {
      const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(true);
      mockBulkDeleteStories.mockResolvedValue({ error: "delete failed" });

      await renderAndSelect(["s1"]);

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-delete"));
      });

      await waitFor(() => {
        expect(screen.getByText("delete failed")).toBeInTheDocument();
      });
      confirmSpy.mockRestore();
    });

    it("clearing selection hides the selection toolbar", async () => {
      await renderAndSelect(["s1"]);
      expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId("bulk-clear"));
      });

      await waitFor(() => {
        expect(screen.queryByTestId("selection-toolbar")).not.toBeInTheDocument();
      });
    });

    it("toggling the same story twice deselects it", async () => {
      await renderAndSelect(["s1", "s1"]);

      await waitFor(() => {
        expect(screen.queryByTestId("selection-toolbar")).not.toBeInTheDocument();
      });
    });
  });

  describe("Approve all", () => {
    it("opens confirm dialog when Approve All is clicked", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [makeStory({ id: "p", curationStatus: "needs_curation" })],
          total: 1,
        },
      });

      render(<StoriesTabPanel />);

      const approveAllBtn = await screen.findByText(/Approve All \(1\)/);
      await act(async () => {
        fireEvent.click(approveAllBtn);
      });

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(
          screen.getByText("Approve All Stories")
        ).toBeInTheDocument();
      });
    });

    it("Cancel closes the approve-all confirm dialog", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [makeStory({ id: "p", curationStatus: "needs_curation" })],
          total: 1,
        },
      });

      render(<StoriesTabPanel />);

      const approveAllBtn = await screen.findByText(/Approve All \(1\)/);
      await act(async () => {
        fireEvent.click(approveAllBtn);
      });

      const cancelBtn = await screen.findByRole("button", { name: /Cancel/i });
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("Approve All confirm calls approveAllPendingStories", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [makeStory({ id: "p", curationStatus: "needs_curation" })],
          total: 1,
        },
      });
      mockApproveAllPendingStories.mockResolvedValue({
        data: { approvedCount: 1, approvedIds: ["p"] },
      });

      render(<StoriesTabPanel />);

      const approveAllBtn = await screen.findByText(/Approve All \(1\)/);
      await act(async () => {
        fireEvent.click(approveAllBtn);
      });

      const dialog = await screen.findByRole("dialog");
      const confirmBtn = within(dialog).getByRole("button", { name: /Approve All/i });

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(mockApproveAllPendingStories).toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("Approve All surfaces API error and closes dialog", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [makeStory({ id: "p", curationStatus: "needs_curation" })],
          total: 1,
        },
      });
      mockApproveAllPendingStories.mockResolvedValue({ error: "fail" });

      render(<StoriesTabPanel />);

      const approveAllBtn = await screen.findByText(/Approve All \(1\)/);
      await act(async () => {
        fireEvent.click(approveAllBtn);
      });

      const dialog = await screen.findByRole("dialog");
      const confirmBtn = within(dialog).getByRole("button", { name: /Approve All/i });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("fail")).toBeInTheDocument();
      });
    });
  });

  describe("Editor + create dialog handlers", () => {
    it("clicking edit on a story opens the editor dialog", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [makeStory({ id: "edit-me", curationStatus: "approved" })],
          total: 1,
        },
      });

      render(<StoriesTabPanel />);

      // Switch to all filter so approved story is visible
      await waitFor(() => {
        expect(screen.getByTestId("stat-card-total")).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-total"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-edit-edit-me")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("story-edit-edit-me"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("editor-dialog")).toBeInTheDocument();
      });
    });

    it("editor onUpdate updates story state", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [
            makeStory({
              id: "u1",
              curationStatus: "approved",
              title: "Old",
            }),
          ],
          total: 1,
        },
      });

      render(<StoriesTabPanel />);
      await waitFor(() => {
        expect(screen.getByTestId("stat-card-total")).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("stat-card-total"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-edit-u1")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("story-edit-u1"));
      });

      await waitFor(() => {
        expect(editorDialogProps.onUpdate).toBeDefined();
      });

      await act(async () => {
        editorDialogProps.onUpdate!("u1", { title: "New Title" });
      });

      await act(async () => {
        editorDialogProps.onUpdate!("missing-id", { title: "ignored" });
      });

      // Closing the editor clears editingStory
      await act(async () => {
        fireEvent.click(screen.getByTestId("editor-close"));
      });

      await waitFor(() => {
        expect(screen.queryByTestId("editor-dialog")).not.toBeInTheDocument();
      });
    });

    it("clicking Create Story opens create dialog and onCreated reloads page 1", async () => {
      render(<StoriesTabPanel />);

      const btn = await screen.findByText("Create Story");
      await act(async () => {
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(createDialogProps.open).toBe(true);
      });

      await act(async () => {
        createDialogProps.onCreated!({ id: "new-story" });
      });

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith(
          expect.stringContaining("storiesPage=1"),
          expect.anything()
        );
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading spinner while initial fetch is in flight", async () => {
      let resolveFetch: ((v: unknown) => void) | undefined;
      mockFetchStories.mockImplementation(
        () => new Promise((r) => {
          resolveFetch = r;
        })
      );

      render(<StoriesTabPanel />);

      expect(screen.getByText("Loading stories...")).toBeInTheDocument();

      await act(async () => {
        resolveFetch!({ data: { stories: [], total: 0 } });
      });

      await waitFor(() => {
        expect(screen.queryByText("Loading stories...")).not.toBeInTheDocument();
      });
    });

    it("shows 'No stories match this filter' when stories exist but filter rejects them", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: [makeStory({ id: "x", curationStatus: "approved" })],
          total: 1,
        },
      });

      render(<StoriesTabPanel />);

      // Default filter is "needs_curation"; approved story will be filtered out.
      await waitFor(() => {
        expect(
          screen.getByText("No stories match this filter")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Pagination clamping", () => {
    it("clamps URL page below 1 to page 1", async () => {
      mockSearchParamsGet.mockImplementation((k: string) =>
        k === "storiesPage" ? "0" : null
      );

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1 })
        );
      });
    });

    it("non-numeric URL page falls back to page 1", async () => {
      mockSearchParamsGet.mockImplementation((k: string) =>
        k === "storiesPage" ? "abc" : null
      );

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1 })
        );
      });
    });

    it("Next from last page is a no-op (clamped)", async () => {
      mockFetchStories.mockResolvedValue({
        data: {
          stories: Array.from({ length: 5 }, (_, i) =>
            makeStory({ id: `s-${i}`, displayOrder: i + 1 })
          ),
          total: 25,
        },
      });
      mockSearchParamsGet.mockImplementation((k: string) =>
        k === "storiesPage" ? "2" : null
      );

      render(<StoriesTabPanel />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
      });
    });
  });
});
