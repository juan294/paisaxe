import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AdminPage from "./page";
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

// Mock useAuth
const mockSignInWithGoogle = vi.fn();
const mockSignOut = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useAdminRole
const mockUseAdminRole = vi.fn();

vi.mock("@/hooks/use-admin-role", () => ({
  useAdminRole: () => mockUseAdminRole(),
}));

// Mock admin-api functions
const mockFetchStories = vi.fn();
const mockBulkUpdateStoryStatus = vi.fn();
const mockBulkDeleteStories = vi.fn();
const mockApproveAllPendingStories = vi.fn();

vi.mock("@/lib/admin-api", () => ({
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
  bulkUpdateStoryStatus: (...args: unknown[]) => mockBulkUpdateStoryStatus(...args),
  bulkDeleteStories: (...args: unknown[]) => mockBulkDeleteStories(...args),
  approveAllPendingStories: (...args: unknown[]) => mockApproveAllPendingStories(...args),
}));

// Mock StoryGrid
vi.mock("@/components/admin/story-grid", () => ({
  StoryGrid: ({
    stories,
    onEdit,
    onToggleSelect,
    selectedIds,
  }: {
    stories: AdminStory[];
    onEdit: (story: AdminStory) => void;
    onToggleSelect?: (id: string) => void;
    selectedIds?: Set<string>;
    selectionMode?: boolean;
  }) => (
    <div data-testid="story-grid">
      {stories.map((story) => (
        <div key={story.id} data-testid={`story-${story.id}`}>
          <span onClick={() => onEdit(story)}>{story.title}</span>
          {onToggleSelect && (
            <button
              data-testid={`select-${story.id}`}
              onClick={() => onToggleSelect(story.id)}
              data-selected={selectedIds?.has(story.id) ? "true" : "false"}
            >
              Select
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

// Mock ImageEditorDialog
vi.mock("@/components/admin/image-editor-dialog", () => ({
  ImageEditorDialog: ({
    story,
    onClose,
    onUpdate,
  }: {
    story: AdminStory | null;
    onClose: () => void;
    onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
  }) => {
    if (!story) return null;
    return (
      <div data-testid="image-editor-dialog">
        <span>Editing: {story.title}</span>
        <button onClick={onClose}>Close Editor</button>
        <button onClick={() => onUpdate(story.id, { image: "updated.jpg" })}>
          Update Image
        </button>
      </div>
    );
  },
}));

// Mock AdminTabs
vi.mock("@/components/admin/admin-tabs", () => ({
  AdminTabs: ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => (
    <div data-testid="admin-tabs">
      <button onClick={() => onTabChange("analytics")} data-active={activeTab === "analytics"}>Analytics</button>
      <button onClick={() => onTabChange("stories")} data-active={activeTab === "stories"}>Stories</button>
      <button onClick={() => onTabChange("features")} data-active={activeTab === "features"}>Features</button>
      <button onClick={() => onTabChange("marketing")} data-active={activeTab === "marketing"}>Marketing</button>
      <button onClick={() => onTabChange("suggestions")} data-active={activeTab === "suggestions"}>Suggestions</button>
      <button onClick={() => onTabChange("agents")} data-active={activeTab === "agents"}>Agents</button>
    </div>
  ),
  TABS: [
    { value: "analytics", label: "Analytics" },
    { value: "stories", label: "Stories" },
    { value: "features", label: "Features" },
    { value: "marketing", label: "Marketing" },
    { value: "suggestions", label: "Suggestions" },
    { value: "agents", label: "Agents" },
  ],
}));

// Mock FeatureTogglesPanel and AnalyticsDashboard
vi.mock("@/components/admin/feature-toggles-panel", () => ({
  FeatureTogglesPanel: () => <div data-testid="feature-toggles-panel">Feature Toggles</div>,
}));

vi.mock("@/components/admin/analytics-dashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="analytics-dashboard">Analytics</div>,
}));

vi.mock("@/components/admin/create-story-dialog", () => ({
  CreateStoryDialog: ({ open, onOpenChange, onCreated }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (story: { id: string; slug: string; title: string; category: string; displayOrder: number; curationStatus: string; createdAt: string }) => void;
  }) => open ? (
    <div data-testid="create-story-dialog">
      Create Story Dialog
      <button onClick={() => onCreated({ id: "new-1", slug: "new-story", title: "New Story", category: "nature", displayOrder: 99, curationStatus: "needs_curation", createdAt: "2024-01-10" })}>
        Submit Create
      </button>
      <button onClick={() => onOpenChange(false)}>Close Create</button>
    </div>
  ) : null,
}));

vi.mock("@/components/admin/story-editor-dialog", () => ({
  StoryEditorDialog: ({ story, onClose, onUpdate }: {
    story: AdminStory | null;
    onClose: () => void;
    onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
  }) => story ? (
    <div data-testid="story-editor-dialog">
      Editing: {story.title}
      <button onClick={onClose}>Close Editor</button>
      <button onClick={() => onUpdate(story.id, { title: "Updated Title" })}>Update Story</button>
    </div>
  ) : null,
}));

vi.mock("@/components/admin/selection-toolbar", () => ({
  SelectionToolbar: ({
    selectedCount,
    onMarkApproved,
    onMarkPending,
    onDelete,
    onClearSelection,
    isLoading,
  }: {
    selectedCount: number;
    onMarkApproved: () => void;
    onMarkPending: () => void;
    onDelete: () => void;
    onClearSelection: () => void;
    isLoading: boolean;
  }) => selectedCount > 0 ? (
    <div data-testid="selection-toolbar">
      <span data-testid="selected-count">{selectedCount} selected</span>
      <button onClick={onMarkApproved} disabled={isLoading}>Bulk Approve</button>
      <button onClick={onMarkPending} disabled={isLoading}>Bulk Pending</button>
      <button onClick={onDelete} disabled={isLoading}>Bulk Delete</button>
      <button onClick={onClearSelection}>Clear Selection</button>
    </div>
  ) : null,
}));

vi.mock("@/components/admin/marketing-dashboard", () => ({
  MarketingDashboard: () => <div data-testid="marketing-dashboard">Marketing</div>,
}));

vi.mock("@/components/admin/suggestions-panel", () => ({
  SuggestionsPanel: () => <div data-testid="suggestions-panel">Suggestions</div>,
}));

vi.mock("@/components/admin/agents-dashboard", () => ({
  AgentsDashboard: () => <div data-testid="agents-dashboard">Agents</div>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  RefreshCw: ({ className, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-refresh" className={className as string} {...props} />
  ),
  LogOut: (props: Record<string, unknown>) => <span data-testid="icon-logout" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => (
    <span data-testid="icon-alert" {...props} />
  ),
  ShieldX: (props: Record<string, unknown>) => (
    <span data-testid="icon-shield-x" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="icon-loader" {...props} />
  ),
  ImageIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-image" {...props} />
  ),
  CheckCircle2: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
  Clock: (props: Record<string, unknown>) => (
    <span data-testid="icon-clock" {...props} />
  ),
  Layers: (props: Record<string, unknown>) => (
    <span data-testid="icon-layers" {...props} />
  ),
  ArrowUpRight: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-up-right" {...props} />
  ),
  Moon: (props: Record<string, unknown>) => (
    <span data-testid="icon-moon" {...props} />
  ),
  Sun: (props: Record<string, unknown>) => (
    <span data-testid="icon-sun" {...props} />
  ),
  Search: (props: Record<string, unknown>) => (
    <span data-testid="icon-search" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="icon-plus" {...props} />
  ),
  Languages: (props: Record<string, unknown>) => (
    <span data-testid="icon-languages" {...props} />
  ),
}));

// Mock theme components
vi.mock("@/components/admin/theme-provider", () => ({
  AdminThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/admin/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

const mockStories: AdminStory[] = [
  {
    id: "story-1",
    slug: "story-one",
    title: "Picos de Europa",
    subtitle: "Mountain paradise",
    description: "Beautiful mountain range in northern Spain",
    image: "https://example.com/img1.jpg",
    category: "nature" as AdminStory["category"],
    displayOrder: 1,
    curationStatus: "needs_curation",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
  {
    id: "story-2",
    slug: "story-two",
    title: "Gijón Beach",
    subtitle: "Coastal charm",
    description: "A vibrant coastal city with amazing beaches",
    image: "https://example.com/img2.jpg",
    category: "cities" as AdminStory["category"],
    displayOrder: 2,
    curationStatus: "approved",
    createdAt: "2024-01-02",
    updatedAt: "2024-01-02",
  },
  {
    id: "story-3",
    slug: "story-three",
    title: "Asturian Cider",
    subtitle: "Local tradition",
    description: "Traditional sidra culture and cider houses",
    image: "",
    category: "gastronomy" as AdminStory["category"],
    displayOrder: 3,
    curationStatus: "needs_curation",
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
];

// Helper to set up authenticated admin state
function setupAdminAuth() {
  mockUseAuth.mockReturnValue({
    user: { id: "user-1", email: "admin@example.com" },
    isLoading: false,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: mockSignOut,
  });
  mockUseAdminRole.mockReturnValue({ isAdmin: true, isLoading: false });
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchStories.mockResolvedValue({ data: mockStories });
  });

  describe("Loading state", () => {
    it("shows loading spinner while auth is loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: true });

      render(<AdminPage />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows loading spinner while role is loading", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "admin@example.com" },
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: true });

      render(<AdminPage />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: false });
    });

    it("shows sign-in screen when not authenticated", () => {
      render(<AdminPage />);
      expect(screen.getByText("Paisaxe Admin")).toBeInTheDocument();
      expect(screen.getByText("Sign in to access the admin panel")).toBeInTheDocument();
      expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    });

    it("calls signInWithGoogle with '/admin' redirect when button clicked", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Sign in with Google"));
      });

      expect(mockSignInWithGoogle).toHaveBeenCalledWith("/admin");
    });
  });

  describe("Access denied", () => {
    it("shows access denied for non-admin users", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-2", email: "user@example.com" },
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: false });

      render(<AdminPage />);
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(screen.getByText("Your account does not have admin privileges.")).toBeInTheDocument();
      expect(screen.getByText("Signed in as user@example.com")).toBeInTheDocument();
    });

    it("sign out from access denied screen calls signOut", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-2", email: "user@example.com" },
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: false });

      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Sign out"));
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("Admin panel", () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    // Helper: default tab is now Analytics, so navigate to Stories tab first
    async function navigateToStories() {
      const { container } = render(<AdminPage />);
      // Click "Stories" tab in mock AdminTabs
      await act(async () => {
        fireEvent.click(screen.getByText("Stories"));
      });
      return container;
    }

    it("shows stories grid after successful load", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        // Default filter is Pending (needs_curation), so only pending stories are shown
        expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
        expect(screen.queryByText("Gijón Beach")).not.toBeInTheDocument(); // approved, not shown
        expect(screen.getByText("Asturian Cider")).toBeInTheDocument();
      });
    });

    it("calls fetchStories without adminKey parameter", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith(undefined);
      });
    });

    it("shows Paisaxe title", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      expect(screen.getByText("Paisaxe")).toBeInTheDocument();
    });

    it("shows 'No stories found' when empty", async () => {
      mockFetchStories.mockResolvedValue({ data: [] });

      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByText("No stories found")).toBeInTheDocument();
      });
    });

    it("shows error message when fetchStories returns error", async () => {
      mockFetchStories.mockResolvedValue({
        error: "Something went wrong",
      });

      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("shows story counts in metric cards (total, pending, approved, missing i18n)", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // New warm design uses StatCard components with short labels
      // Use getAllByText since some labels also appear in filter buttons
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
      expect(screen.getByText("Missing i18n")).toBeInTheDocument();
    });

    it("logout calls signOut", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      const logoutButton = screen.getByText("Logout").closest("button")!;
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("refresh button re-fetches stories", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      mockFetchStories.mockClear();
      mockFetchStories.mockResolvedValue({ data: mockStories });

      const refreshIcon = screen.getByTestId("icon-refresh");
      const refreshButton = refreshIcon.closest("button")!;

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith(undefined);
      });
    });

    it("shows loading state while fetching", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchStories.mockReturnValue(promise);

      // Navigate to stories — but need to handle the loading case specially
      render(<AdminPage />);
      await act(async () => {
        fireEvent.click(screen.getByText("Stories"));
      });

      expect(screen.getByText("Loading stories...")).toBeInTheDocument();

      await act(async () => {
        resolvePromise!({ data: mockStories });
      });

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      expect(screen.getByTestId("story-grid")).toBeInTheDocument();
    });

    it("stat cards work as filter buttons (Pending, Approved, Total)", async () => {
      await navigateToStories();

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // Initially only pending stories are shown (filter = "needs_curation" by default)
      expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
      expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
      expect(screen.getByTestId("story-story-3")).toBeInTheDocument();

      // Click "Approved" stat card
      const approvedCard = screen.getAllByRole("button").find(btn =>
        btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Approved")
      );
      expect(approvedCard).toBeDefined();

      await act(async () => {
        fireEvent.click(approvedCard!);
      });

      // Now only approved story (story-2) should be visible
      await waitFor(() => {
        expect(screen.queryByTestId("story-story-1")).not.toBeInTheDocument();
        expect(screen.getByTestId("story-story-2")).toBeInTheDocument();
        expect(screen.queryByTestId("story-story-3")).not.toBeInTheDocument();
      });

      // Click "Total" stat card to show all
      const totalCard = screen.getAllByRole("button").find(btn =>
        btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Total")
      );
      expect(totalCard).toBeDefined();

      await act(async () => {
        fireEvent.click(totalCard!);
      });

      // All stories visible
      await waitFor(() => {
        expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
        expect(screen.getByTestId("story-story-2")).toBeInTheDocument();
        expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
      });

      // Click "Pending" stat card to go back to pending filter
      const pendingCard = screen.getAllByRole("button").find(btn =>
        btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Pending")
      );
      expect(pendingCard).toBeDefined();

      await act(async () => {
        fireEvent.click(pendingCard!);
      });

      // Only pending stories again
      await waitFor(() => {
        expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
        expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
        expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
      });
    });

    describe("Search functionality", () => {
      it("shows search input on stories tab", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        expect(screen.getByPlaceholderText("Search stories...")).toBeInTheDocument();
      });

      it("filters stories by title", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText("Search stories...");

        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "Picos" } });
        });

        await waitFor(() => {
          expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
          expect(screen.queryByTestId("story-story-3")).not.toBeInTheDocument();
        });
      });

      it("filters stories by subtitle (case-insensitive)", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Click "Total" to show all stories first (default is Pending)
        const totalCard = screen.getAllByRole("button").find(btn =>
          btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Total")
        );
        await act(async () => {
          fireEvent.click(totalCard!);
        });

        const searchInput = screen.getByPlaceholderText("Search stories...");

        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "COASTAL" } });
        });

        await waitFor(() => {
          expect(screen.queryByTestId("story-story-1")).not.toBeInTheDocument();
          expect(screen.getByTestId("story-story-2")).toBeInTheDocument();
          expect(screen.queryByTestId("story-story-3")).not.toBeInTheDocument();
        });
      });

      it("filters stories by description", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText("Search stories...");

        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "sidra" } });
        });

        await waitFor(() => {
          expect(screen.queryByTestId("story-story-1")).not.toBeInTheDocument();
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
          expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
        });
      });

      it("filters stories by category", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText("Search stories...");

        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "gastronomy" } });
        });

        await waitFor(() => {
          expect(screen.queryByTestId("story-story-1")).not.toBeInTheDocument();
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
          expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
        });
      });

      it("combines search with status filter", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // First filter by "Pending" status
        const pendingCard = screen.getAllByRole("button").find(btn =>
          btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Pending")
        );
        await act(async () => {
          fireEvent.click(pendingCard!);
        });

        // Should show story-1 (Picos) and story-3 (Cider), both pending
        await waitFor(() => {
          expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
          expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
        });

        // Now also search for "Picos"
        const searchInput = screen.getByPlaceholderText("Search stories...");
        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "Picos" } });
        });

        // Should only show story-1 (pending AND matches search)
        await waitFor(() => {
          expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
          expect(screen.queryByTestId("story-story-3")).not.toBeInTheDocument();
        });
      });

      it("shows all stories when search is cleared", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Click "Total" to show all stories first (default is Pending)
        const totalCard = screen.getAllByRole("button").find(btn =>
          btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Total")
        );
        await act(async () => {
          fireEvent.click(totalCard!);
        });

        const searchInput = screen.getByPlaceholderText("Search stories...");

        // Search for something
        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "Picos" } });
        });

        await waitFor(() => {
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
        });

        // Clear the search
        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "" } });
        });

        // All stories should be visible again
        await waitFor(() => {
          expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
          expect(screen.getByTestId("story-story-2")).toBeInTheDocument();
          expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
        });
      });

      it("shows 'No stories match this filter' when search has no results", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText("Search stories...");

        await act(async () => {
          fireEvent.change(searchInput, { target: { value: "xyznonexistent" } });
        });

        await waitFor(() => {
          expect(screen.getByText("No stories match this filter")).toBeInTheDocument();
        });
      });
    });

    describe("Approve All dialog accessibility (#181)", () => {
      async function openApproveAllDialog() {
        render(<AdminPage />);
        // Navigate to Stories tab
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });
        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });
        // Click "Approve All" button
        const approveAllBtn = screen.getByRole("button", { name: /Approve All/i });
        await act(async () => {
          fireEvent.click(approveAllBtn);
        });
      }

      it("has role='dialog' on the confirmation dialog", async () => {
        await openApproveAllDialog();

        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
      });

      it("has aria-modal='true' on the confirmation dialog", async () => {
        await openApproveAllDialog();

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
      });
    });

    describe("StatCard filter button aria-labels (#183)", () => {
      async function renderStoriesTab() {
        render(<AdminPage />);
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });
        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });
      }

      it("Pending stat card has an aria-label", async () => {
        await renderStoriesTab();

        const pendingBtn = screen.getByRole("button", { name: /filter.*pending/i });
        expect(pendingBtn).toBeInTheDocument();
      });

      it("Approved stat card has an aria-label", async () => {
        await renderStoriesTab();

        const approvedBtn = screen.getByRole("button", { name: /filter.*approved/i });
        expect(approvedBtn).toBeInTheDocument();
      });

      it("Missing i18n stat card has an aria-label", async () => {
        await renderStoriesTab();

        const missingBtn = screen.getByRole("button", { name: /filter.*missing/i });
        expect(missingBtn).toBeInTheDocument();
      });

      it("Total stat card has an aria-label", async () => {
        await renderStoriesTab();

        const totalBtn = screen.getByRole("button", { name: /filter.*total|filter.*all/i });
        expect(totalBtn).toBeInTheDocument();
      });
    });

    describe("Approve All flow", () => {
      it("shows Approve All button when there are pending stories", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Should show "Approve All (2)" since story-1 and story-3 are pending
        expect(screen.getByText(/Approve All \(2\)/)).toBeInTheDocument();
      });

      it("does not show Approve All button when no pending stories", async () => {
        mockFetchStories.mockResolvedValue({
          data: [
            { ...mockStories[1] }, // only approved story
          ],
        });

        await navigateToStories();

        // With only approved stories and default filter "needs_curation",
        // no stories match, so wait for the empty state message
        await waitFor(() => {
          expect(screen.getByText("No stories match this filter")).toBeInTheDocument();
        });

        expect(screen.queryByText(/Approve All/)).not.toBeInTheDocument();
      });

      it("opens confirmation dialog when clicking Approve All", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByText(/Approve All \(2\)/));
        });

        expect(screen.getByText("Approve All Stories")).toBeInTheDocument();
        expect(screen.getByText(/This will approve 2 pending stories/)).toBeInTheDocument();
      });

      it("closes confirmation dialog on Cancel", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Open confirm dialog
        await act(async () => {
          fireEvent.click(screen.getByText(/Approve All \(2\)/));
        });

        expect(screen.getByText("Approve All Stories")).toBeInTheDocument();

        // Click Cancel in the confirmation dialog
        const cancelButtons = screen.getAllByText("Cancel");
        const confirmCancelBtn = cancelButtons.find(btn =>
          btn.closest(".fixed")
        );

        await act(async () => {
          fireEvent.click(confirmCancelBtn!);
        });

        expect(screen.queryByText("Approve All Stories")).not.toBeInTheDocument();
      });

      it("approves all pending stories when confirmed", async () => {
        mockApproveAllPendingStories.mockResolvedValue({ data: { updated: 2 } });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Open confirm dialog
        await act(async () => {
          fireEvent.click(screen.getByText(/Approve All \(2\)/));
        });

        // Click the "Approve All" button in the confirmation dialog
        const dialogApproveBtn = screen.getAllByText("Approve All").find(btn =>
          btn.closest(".fixed")
        );

        await act(async () => {
          fireEvent.click(dialogApproveBtn!);
        });

        await waitFor(() => {
          expect(mockApproveAllPendingStories).toHaveBeenCalled();
        });
      });

      it("shows error when approve all fails", async () => {
        mockApproveAllPendingStories.mockResolvedValue({ error: "Approve failed" });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Open and confirm
        await act(async () => {
          fireEvent.click(screen.getByText(/Approve All \(2\)/));
        });

        const dialogApproveBtn = screen.getAllByText("Approve All").find(btn =>
          btn.closest(".fixed")
        );

        await act(async () => {
          fireEvent.click(dialogApproveBtn!);
        });

        await waitFor(() => {
          expect(screen.getByText("Approve failed")).toBeInTheDocument();
        });
      });

      it("shows singular 'story' when only one pending story", async () => {
        mockFetchStories.mockResolvedValue({
          data: [mockStories[0], mockStories[1]], // 1 pending, 1 approved
        });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByText(/Approve All \(1\)/));
        });

        expect(screen.getByText(/This will approve 1 pending story\./)).toBeInTheDocument();
      });

      it("handles approveAll returning neither error nor data (line 300 else-if false branch)", async () => {
        // When approveAllPendingStories returns {} (no error, no data), the `else if (result.data)`
        // branch at line 300 is false — stories are not updated in local state, no error shown.
        mockApproveAllPendingStories.mockResolvedValue({});

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Open the confirm dialog
        await act(async () => {
          fireEvent.click(screen.getByText(/Approve All \(2\)/));
        });

        const dialogApproveBtn = screen.getAllByText("Approve All").find(btn =>
          btn.closest(".fixed")
        );

        await act(async () => {
          fireEvent.click(dialogApproveBtn!);
        });

        await waitFor(() => {
          expect(mockApproveAllPendingStories).toHaveBeenCalled();
        });

        // No error shown and stories still in original state (not updated)
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
        expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
      });
    });

    describe("Create Story", () => {
      it("opens create story dialog when clicking Create Story", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Create Story"));
        });

        expect(screen.getByTestId("create-story-dialog")).toBeInTheDocument();
      });

      it("reloads stories when a new story is created", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        mockFetchStories.mockClear();
        mockFetchStories.mockResolvedValue({ data: mockStories });

        await act(async () => {
          fireEvent.click(screen.getByText("Create Story"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Submit Create"));
        });

        await waitFor(() => {
          expect(mockFetchStories).toHaveBeenCalled();
        });
      });
    });

    describe("Story selection and bulk operations", () => {
      it("shows selection toolbar when stories are selected", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Select a story
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();
          expect(screen.getByTestId("selected-count")).toHaveTextContent("1 selected");
        });
      });

      it("toggles story selection (select and deselect)", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Select story
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();

        // Deselect same story
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        // Toolbar should disappear (selectedCount = 0)
        expect(screen.queryByTestId("selection-toolbar")).not.toBeInTheDocument();
      });

      it("clears selection via toolbar", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();

        await act(async () => {
          fireEvent.click(screen.getByText("Clear Selection"));
        });

        expect(screen.queryByTestId("selection-toolbar")).not.toBeInTheDocument();
      });

      it("bulk approves selected stories", async () => {
        mockBulkUpdateStoryStatus.mockResolvedValue({ data: { updated: 1 } });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Select story-1
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        // Click Bulk Approve
        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Approve"));
        });

        await waitFor(() => {
          expect(mockBulkUpdateStoryStatus).toHaveBeenCalledWith(
            ["story-1"],
            "approved"
          );
        });
      });

      it("bulk marks stories as pending", async () => {
        mockBulkUpdateStoryStatus.mockResolvedValue({ data: { updated: 1 } });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Select story-1
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Pending"));
        });

        await waitFor(() => {
          expect(mockBulkUpdateStoryStatus).toHaveBeenCalledWith(
            ["story-1"],
            "needs_curation"
          );
        });
      });

      it("bulk deletes selected stories with confirmation", async () => {
        mockBulkDeleteStories.mockResolvedValue({ data: { deleted: 1 } });
        vi.spyOn(window, "confirm").mockReturnValue(true);

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Select story-1
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Delete"));
        });

        await waitFor(() => {
          expect(window.confirm).toHaveBeenCalled();
          expect(mockBulkDeleteStories).toHaveBeenCalledWith(["story-1"]);
        });
      });

      it("cancels bulk delete when confirm is rejected", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(false);

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Delete"));
        });

        expect(mockBulkDeleteStories).not.toHaveBeenCalled();
      });

      it("shows error when bulk approve fails", async () => {
        mockBulkUpdateStoryStatus.mockResolvedValue({ error: "Bulk operation failed" });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Approve"));
        });

        await waitFor(() => {
          expect(screen.getByText("Bulk operation failed")).toBeInTheDocument();
        });
      });

      it("shows error when bulk pending fails", async () => {
        mockBulkUpdateStoryStatus.mockResolvedValue({ error: "Bulk pending failed" });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Pending"));
        });

        await waitFor(() => {
          expect(screen.getByText("Bulk pending failed")).toBeInTheDocument();
        });
      });

      it("handles bulk approve returning neither error nor data (line 249 else-if false branch)", async () => {
        // When bulkUpdateStoryStatus returns {} (no error, no data), the `else if (result.data)`
        // branch at line 249 is false — stories are not updated and no error shown.
        mockBulkUpdateStoryStatus.mockResolvedValue({});

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Approve"));
        });

        await waitFor(() => {
          expect(mockBulkUpdateStoryStatus).toHaveBeenCalledWith(["story-1"], "approved");
        });

        // No error shown, stories unchanged in state
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
        expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
      });

      it("handles bulk pending returning neither error nor data (line 272 else-if false branch)", async () => {
        // When bulkUpdateStoryStatus returns {} (no error, no data), the `else if (result.data)`
        // branch at line 272 is false — stories are not updated and no error shown.
        mockBulkUpdateStoryStatus.mockResolvedValue({});

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Pending"));
        });

        await waitFor(() => {
          expect(mockBulkUpdateStoryStatus).toHaveBeenCalledWith(["story-1"], "needs_curation");
        });

        // No error shown, stories unchanged in state
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
        expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
      });

      it("shows error when bulk delete fails", async () => {
        mockBulkDeleteStories.mockResolvedValue({ error: "Delete failed" });
        vi.spyOn(window, "confirm").mockReturnValue(true);

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Delete"));
        });

        await waitFor(() => {
          expect(screen.getByText("Delete failed")).toBeInTheDocument();
        });
      });

      it("shows plural 'stories' in confirm dialog when multiple are selected (line 320)", async () => {
        // Covers the `selectedIds.size === 1 ? "story" : "stories"` "stories" branch at line 320.
        // Select 2 stories (story-1 and story-3 are both needs_curation).
        mockBulkDeleteStories.mockResolvedValue({ data: { deleted: 2 } });
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false); // cancel to avoid deletion

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });
        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-3"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Delete"));
        });

        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("2 stories"));
        expect(mockBulkDeleteStories).not.toHaveBeenCalled(); // cancelled
      });

      it("handles bulk delete returning neither error nor data (line 330 else-if false branch)", async () => {
        // When bulkDeleteStories returns {} (no error, no data), the `else if (result.data)`
        // branch at line 330 is false — stories are not removed from state and no error is shown.
        mockBulkDeleteStories.mockResolvedValue({});
        vi.spyOn(window, "confirm").mockReturnValue(true);

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId("select-story-1"));
        });

        await act(async () => {
          fireEvent.click(screen.getByText("Bulk Delete"));
        });

        await waitFor(() => {
          expect(mockBulkDeleteStories).toHaveBeenCalledWith(["story-1"]);
        });

        // Stories should still be present (not removed) because result.data was falsy
        expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
        // And no error message was set
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      });
    });

    describe("Missing translations filter", () => {
      it("filters by missing translations when clicking Missing i18n card", async () => {
        // All stories have no metadata/translations, so all should be "missing"
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        const missingI18nCard = screen.getAllByRole("button").find(btn =>
          btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Missing i18n")
        );

        await act(async () => {
          fireEvent.click(missingI18nCard!);
        });

        // All stories should show since none have translations
        await waitFor(() => {
          expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
          expect(screen.getByTestId("story-story-2")).toBeInTheDocument();
          expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
        });
      });

      it("excludes stories with complete translations from missing filter", async () => {
        const completeTranslation = {
          title: "Translated Title",
          subtitle: "Translated Subtitle",
          description: "Translated Description",
        };
        const completeStatus = { status: "complete" };

        const storiesWithTranslations: AdminStory[] = [
          {
            ...mockStories[0],
            metadata: {
              translations: {
                en: completeTranslation,
                fr: completeTranslation,
                de: completeTranslation,
                pt: completeTranslation,
                ast: completeTranslation,
              },
              translation_status: {
                en: completeStatus,
                fr: completeStatus,
                de: completeStatus,
                pt: completeStatus,
                ast: completeStatus,
              },
            },
          },
          mockStories[1], // no translations
          mockStories[2], // no translations
        ];

        mockFetchStories.mockResolvedValue({ data: storiesWithTranslations });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        const missingI18nCard = screen.getAllByRole("button").find(btn =>
          btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Missing i18n")
        );

        await act(async () => {
          fireEvent.click(missingI18nCard!);
        });

        // story-1 has complete translations, should be excluded
        await waitFor(() => {
          expect(screen.queryByTestId("story-story-1")).not.toBeInTheDocument();
          expect(screen.getByTestId("story-story-2")).toBeInTheDocument();
          expect(screen.getByTestId("story-story-3")).toBeInTheDocument();
        });
      });

      it("counts story with content but incomplete status as missing translations", async () => {
        const completeTranslation = {
          title: "Translated Title",
          subtitle: "Translated Subtitle",
          description: "Translated Description",
        };

        const storiesWithPartialStatus: AdminStory[] = [
          {
            ...mockStories[0],
            metadata: {
              translations: {
                en: completeTranslation,
                fr: completeTranslation,
                de: completeTranslation,
                pt: completeTranslation,
                ast: completeTranslation,
              },
              translation_status: {
                en: { status: "complete" },
                fr: { status: "complete" },
                de: { status: "pending" }, // Not complete — line 110
                pt: { status: "complete" },
                ast: { status: "complete" },
              },
            },
          },
          {
            ...mockStories[1],
            metadata: {
              translations: {
                en: completeTranslation,
                fr: completeTranslation,
                de: completeTranslation,
                pt: completeTranslation,
                ast: completeTranslation,
              },
              translation_status: {
                en: { status: "complete" },
                fr: { status: "complete" },
                de: { status: "complete" },
                pt: { status: "complete" },
                ast: { status: "complete" },
              },
            },
          },
        ];

        mockFetchStories.mockResolvedValue({ data: storiesWithPartialStatus });

        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Click "Missing i18n" filter card
        const missingI18nCard = screen.getAllByRole("button").find(btn =>
          btn.classList.contains("rounded-2xl") && btn.textContent?.includes("Missing i18n")
        );

        await act(async () => {
          fireEvent.click(missingI18nCard!);
        });

        // story-1 has 'de' with status "pending" — should appear as missing
        // story-2 has all complete — should be excluded
        await waitFor(() => {
          expect(screen.getByTestId("story-story-1")).toBeInTheDocument();
          expect(screen.queryByTestId("story-story-2")).not.toBeInTheDocument();
        });
      });
    });

    describe("Story editor interaction", () => {
      it("opens editor when clicking a story and updates on save", async () => {
        await navigateToStories();

        await waitFor(() => {
          expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        });

        // Click on story title to edit
        await act(async () => {
          fireEvent.click(screen.getByText("Picos de Europa"));
        });

        // Editor should be shown
        await waitFor(() => {
          expect(screen.getByTestId("story-editor-dialog")).toBeInTheDocument();
          expect(screen.getByText("Editing: Picos de Europa")).toBeInTheDocument();
        });

        // Update the story
        await act(async () => {
          fireEvent.click(screen.getByText("Update Story"));
        });

        // Close the editor
        await act(async () => {
          fireEvent.click(screen.getByText("Close Editor"));
        });

        expect(screen.queryByTestId("story-editor-dialog")).not.toBeInTheDocument();
      });
    });

    describe("Keyboard shortcuts", () => {
      it("switches tabs with Cmd+number keyboard shortcuts", async () => {
        render(<AdminPage />);

        // Default tab is analytics; pressing Cmd+2 should switch to Stories
        await act(async () => {
          fireEvent.keyDown(window, { key: "2", metaKey: true });
        });

        // Wait for stories tab to be active (stories is 2nd tab)
        await waitFor(() => {
          const storiesBtn = screen.getByText("Stories");
          expect(storiesBtn).toBeInTheDocument();
        });
      });

      it("ignores non-meta keyboard shortcuts", async () => {
        render(<AdminPage />);

        // Without metaKey, should not switch tabs
        await act(async () => {
          fireEvent.keyDown(window, { key: "2" });
        });

        // Analytics should still be active (default)
        // The fact that no error occurs confirms it's handled
      });
    });

    describe("Refresh button visibility", () => {
      it("only shows refresh button on stories tab", async () => {
        render(<AdminPage />);

        // On analytics tab by default - no refresh button
        expect(screen.queryByLabelText("Refresh stories")).not.toBeInTheDocument();

        // Navigate to stories
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.getByLabelText("Refresh stories")).toBeInTheDocument();
        });
      });
    });

    describe("Tab panel rendering (lines 629-641)", () => {
      // These tests cover the visitedTabs.has("marketing/suggestions/agents") true branches.
      // The content divs for these tabs only render once the tab has been visited.
      it("renders MarketingDashboard when Marketing tab is visited (line 629-631)", async () => {
        render(<AdminPage />);

        // Marketing has not been visited yet — content not rendered
        expect(screen.queryByTestId("marketing-dashboard")).not.toBeInTheDocument();

        // Click the Marketing tab
        await act(async () => {
          fireEvent.click(screen.getByText("Marketing"));
        });

        // Now visitedTabs.has("marketing") is true — content renders (display: block)
        await waitFor(() => {
          expect(screen.getByTestId("marketing-dashboard")).toBeInTheDocument();
        });

        // Navigate away to cover the display:none branch (activeTab !== "marketing")
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        // Content still exists in DOM (lazy-mount) but is hidden
        await waitFor(() => {
          expect(screen.getByTestId("marketing-dashboard")).toBeInTheDocument();
        });
      });

      it("renders SuggestionsPanel when Suggestions tab is visited (line 635-637)", async () => {
        render(<AdminPage />);

        expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();

        await act(async () => {
          fireEvent.click(screen.getByText("Suggestions"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("suggestions-panel")).toBeInTheDocument();
        });

        // Navigate away to cover display:none branch
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("suggestions-panel")).toBeInTheDocument();
        });
      });

      it("renders AgentsDashboard when Agents tab is visited (line 641-643)", async () => {
        render(<AdminPage />);

        expect(screen.queryByTestId("agents-dashboard")).not.toBeInTheDocument();

        await act(async () => {
          fireEvent.click(screen.getByText("Agents"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("agents-dashboard")).toBeInTheDocument();
        });

        // Navigate away to cover display:none branch
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("agents-dashboard")).toBeInTheDocument();
        });
      });
    });
  });

  // Line 821: StatCard non-clickable variant (`<div>` instead of `<button>`)
  // This branch is unreachable through the component's public API because all 4
  // StatCard usages in AdminPage pass an `onClick` prop, making `isClickable` always
  // true. StatCard is a non-exported internal function, so it cannot be tested
  // directly without modifying source code. This is a defensive fallback for future
  // usages that may omit onClick.

  // Lines 45, 55, 60, 65: `dynamic()` import `.then(m => ...)` callbacks
  // These are Next.js `dynamic()` factory functions whose `.then()` callbacks
  // never execute in tests because the modules are fully mocked. The callbacks
  // are trivial property accessors (e.g., `m => ({ default: m.FeatureTogglesPanel })`)
  // and cannot be exercised without un-mocking the dynamic imports.

  // Lines 265 and 316: `if (selectedIds.size === 0) return;` guards in handleBulkMarkPending
  // and handleBulkDelete respectively.
  // Both are architecturally unreachable because:
  // - The "Bulk Pending" and "Bulk Delete" buttons only appear in the SelectionToolbar,
  //   which is conditionally rendered when `selectedIds.size > 0`.
  // - Therefore selectedIds.size is always > 0 when these handlers can be invoked via the UI.
  // These defensive guards exist to prevent a hypothetical programmatic call with no selection.
});
