import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AdminPage from "./page";
import type { AdminStory } from "@/types/admin";

// Mock fetchStories
const mockFetchStories = vi.fn();

vi.mock("@/lib/admin-api", () => ({
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
}));

// Mock AdminLoginForm
const mockOnLogin = vi.fn();
vi.mock("@/components/admin/admin-login-form", () => ({
  AdminLoginForm: ({ onLogin }: { onLogin: (key: string) => void }) => {
    // Store the onLogin callback so tests can invoke it
    mockOnLogin.mockImplementation(onLogin);
    return (
      <div data-testid="login-form">
        <button onClick={() => onLogin("test-admin-key")}>Login</button>
      </div>
    );
  },
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
    adminKey: string;
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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  RefreshCw: ({ className, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-refresh" className={className as string} {...props} />
  ),
  LogOut: (props: Record<string, unknown>) => <span data-testid="icon-logout" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => (
    <span data-testid="icon-alert" {...props} />
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

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchStories.mockResolvedValue({ data: mockStories });
  });

  describe("Authentication", () => {
    it("shows login form when not authenticated", () => {
      render(<AdminPage />);
      expect(screen.getByTestId("login-form")).toBeInTheDocument();
    });

    it("after login, calls fetchStories", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith("test-admin-key", undefined);
      });
    });

    it("logout clears state and shows login form again", async () => {
      render(<AdminPage />);

      // Login first
      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByText("Logout").closest("button")!;
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      expect(screen.getByTestId("login-form")).toBeInTheDocument();
    });

    it("auth error (Invalid) redirects to login", async () => {
      mockFetchStories.mockResolvedValue({
        error: "Invalid admin key",
      });

      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("login-form")).toBeInTheDocument();
      });
    });

    it("auth error (Authorization) redirects to login", async () => {
      mockFetchStories.mockResolvedValue({
        error: "Authorization failed",
      });

      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("login-form")).toBeInTheDocument();
      });
    });
  });

  describe("Stories display", () => {
    it("shows stories grid after successful load", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
        expect(screen.getByText("Story One")).toBeInTheDocument();
        expect(screen.getByText("Story Two")).toBeInTheDocument();
        expect(screen.getByText("Story Three")).toBeInTheDocument();
      });
    });

    it("shows 'No stories found' when empty", async () => {
      mockFetchStories.mockResolvedValue({ data: [] });

      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByText("No stories found")).toBeInTheDocument();
      });
    });

    it("shows error message when fetchStories returns error", async () => {
      mockFetchStories.mockResolvedValue({
        error: "Something went wrong",
      });

      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading state while fetching", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchStories.mockReturnValue(promise);

      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      // Should show loading state
      expect(screen.getByText("Loading...")).toBeInTheDocument();

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ data: mockStories });
      });

      // Loading should be gone, stories visible
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      expect(screen.getByTestId("story-grid")).toBeInTheDocument();
    });
  });

  describe("Story counts", () => {
    it("shows story counts (total, pending, approved, with images)", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // Total: 3 stories
      expect(screen.getByText("3 total")).toBeInTheDocument();
      // Pending: 2 (story-1, story-3)
      expect(screen.getByText("2 pending")).toBeInTheDocument();
      // Approved: 1 (story-2)
      expect(screen.getByText("1 approved")).toBeInTheDocument();
      // With images: 2 (story-1, story-2 have images; story-3 has empty string)
      expect(screen.getByText("2 with images")).toBeInTheDocument();
    });
  });

  describe("Filter buttons", () => {
    it("filter buttons work (All, Pending, Approved)", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // Initially "All" filter is active
      // The filter buttons appear twice (desktop nav + mobile filters)
      // Find All buttons - there should be desktop and mobile versions
      const allButtons = screen.getAllByText(/^All$/);
      expect(allButtons.length).toBeGreaterThanOrEqual(1);

      // Click "Pending" filter
      mockFetchStories.mockClear();
      mockFetchStories.mockResolvedValue({ data: [mockStories[0], mockStories[2]] });

      const pendingButtons = screen.getAllByText(/^Pending/);
      await act(async () => {
        fireEvent.click(pendingButtons[0]);
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith("test-admin-key", "needs_curation");
      });

      // Click "Approved" filter
      mockFetchStories.mockClear();
      mockFetchStories.mockResolvedValue({ data: [mockStories[1]] });

      const approvedButtons = screen.getAllByText(/^Approved/);
      await act(async () => {
        fireEvent.click(approvedButtons[0]);
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith("test-admin-key", "approved");
      });
    });
  });

  describe("Refresh", () => {
    it("refresh button re-fetches stories", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("story-grid")).toBeInTheDocument();
      });

      // Clear mock to track next call
      mockFetchStories.mockClear();
      mockFetchStories.mockResolvedValue({ data: mockStories });

      // Click refresh button (contains the RefreshCw icon)
      const refreshIcon = screen.getByTestId("icon-refresh");
      const refreshButton = refreshIcon.closest("button")!;

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockFetchStories).toHaveBeenCalledWith("test-admin-key", undefined);
      });
    });
  });

  describe("Header", () => {
    it("shows Paisaxe Admin title", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Login"));
      });

      await waitFor(() => {
        expect(screen.getByText("Paisaxe Admin")).toBeInTheDocument();
      });
    });
  });
});
