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

// Mock fetchStories
const mockFetchStories = vi.fn();

vi.mock("@/lib/admin-api", () => ({
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
}));

// Mock StoryGrid
vi.mock("@/components/admin/story-grid", () => ({
  StoryGrid: ({
    stories,
    onEdit,
  }: {
    stories: AdminStory[];
    onEdit: (story: AdminStory) => void;
  }) => (
    <div data-testid="story-grid">
      {stories.map((story) => (
        <div key={story.id} data-testid={`story-${story.id}`} onClick={() => onEdit(story)}>
          {story.title}
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
  CreateStoryDialog: () => <div data-testid="create-story-dialog">Create Story Dialog</div>,
}));

vi.mock("@/components/admin/story-editor-dialog", () => ({
  StoryEditorDialog: () => <div data-testid="story-editor-dialog">Story Editor Dialog</div>,
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
  });
});
