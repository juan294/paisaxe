import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AdminPage from "./page";
import type { AdminStory } from "@/types/admin";

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
      <button onClick={() => onTabChange("stories")} data-active={activeTab === "stories"}>Stories</button>
      <button onClick={() => onTabChange("toggles")} data-active={activeTab === "toggles"}>Toggles</button>
      <button onClick={() => onTabChange("analytics")} data-active={activeTab === "analytics"}>Analytics</button>
    </div>
  ),
}));

// Mock FeatureTogglesPanel and AnalyticsDashboard
vi.mock("@/components/admin/feature-toggles-panel", () => ({
  FeatureTogglesPanel: () => <div data-testid="feature-toggles-panel">Feature Toggles</div>,
}));

vi.mock("@/components/admin/analytics-dashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="analytics-dashboard">Analytics</div>,
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
}));

const mockStories: AdminStory[] = [
  {
    id: "story-1",
    slug: "story-one",
    title: "Story One",
    subtitle: "Subtitle 1",
    description: "Description 1",
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
    title: "Story Two",
    subtitle: "Subtitle 2",
    description: "Description 2",
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
    title: "Story Three",
    subtitle: "Subtitle 3",
    description: "Description 3",
    image: "",
    category: "nature" as AdminStory["category"],
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

    it("shows stories grid after successful load", async () => {
      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        expect(screen.getByText("Story One")).toBeInTheDocument();
        expect(screen.getByText("Story Two")).toBeInTheDocument();
        expect(screen.getByText("Story Three")).toBeInTheDocument();
      });
    });

    it("calls fetchStories without adminKey parameter", async () => {
      render(<AdminPage />);

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith(undefined);
      });
    });

    it("shows Paisaxe Admin title", async () => {
      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      expect(screen.getByText("Paisaxe Admin")).toBeInTheDocument();
    });

    it("shows 'No stories found' when empty", async () => {
      mockFetchStories.mockResolvedValue({ data: [] });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText("No stories found")).toBeInTheDocument();
      });
    });

    it("shows error message when fetchStories returns error", async () => {
      mockFetchStories.mockResolvedValue({
        error: "Something went wrong",
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("shows story counts (total, pending, approved, with images)", async () => {
      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      expect(screen.getByText("3 total")).toBeInTheDocument();
      expect(screen.getByText("2 pending")).toBeInTheDocument();
      expect(screen.getByText("1 approved")).toBeInTheDocument();
      expect(screen.getByText("2 with images")).toBeInTheDocument();
    });

    it("logout calls signOut", async () => {
      render(<AdminPage />);

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
      render(<AdminPage />);

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

      render(<AdminPage />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      await act(async () => {
        resolvePromise!({ data: mockStories });
      });

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      expect(screen.getByTestId("story-grid")).toBeInTheDocument();
    });

    it("filter buttons work (All, Pending, Approved)", async () => {
      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // Click "Pending" filter
      mockFetchStories.mockClear();
      mockFetchStories.mockResolvedValue({ data: [mockStories[0], mockStories[2]] });

      const pendingButtons = screen.getAllByText(/^Pending/);
      await act(async () => {
        fireEvent.click(pendingButtons[0]);
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith("needs_curation");
      });

      // Click "Approved" filter
      mockFetchStories.mockClear();
      mockFetchStories.mockResolvedValue({ data: [mockStories[1]] });

      const approvedButtons = screen.getAllByText(/^Approved/);
      await act(async () => {
        fireEvent.click(approvedButtons[0]);
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith("approved");
      });
    });
  });
});
