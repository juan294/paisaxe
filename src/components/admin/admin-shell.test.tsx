import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AdminShell } from "./admin-shell";

// Mock next/navigation (used after FE-H5 fix)
const mockRouterPush = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

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
vi.mock("@/lib/admin-api", () => ({
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
  bulkUpdateStoryStatus: vi.fn(),
  bulkDeleteStories: vi.fn(),
  approveAllPendingStories: vi.fn(),
}));

// Mock StoryGrid
vi.mock("@/components/admin/story-grid", () => ({
  StoryGrid: () => <div data-testid="story-grid">Story Grid</div>,
}));

// Mock AdminTabs
vi.mock("@/components/admin/admin-tabs", () => ({
  AdminTabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="admin-tabs">
      <button onClick={() => onTabChange("analytics")} data-active={activeTab === "analytics"}>
        Analytics
      </button>
      <button onClick={() => onTabChange("stories")} data-active={activeTab === "stories"}>
        Stories
      </button>
      <button onClick={() => onTabChange("features")} data-active={activeTab === "features"}>
        Features
      </button>
      <button onClick={() => onTabChange("marketing")} data-active={activeTab === "marketing"}>
        Marketing
      </button>
      <button onClick={() => onTabChange("suggestions")} data-active={activeTab === "suggestions"}>
        Suggestions
      </button>
      <button onClick={() => onTabChange("agents")} data-active={activeTab === "agents"}>
        Agents
      </button>
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

// Mock tab panel components
vi.mock("@/components/admin/feature-toggles-panel", () => ({
  FeatureTogglesPanel: () => <div data-testid="feature-toggles-panel">Feature Toggles</div>,
}));

vi.mock("@/components/admin/analytics-dashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="analytics-dashboard">Analytics</div>,
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

vi.mock("@/components/admin/story-editor-dialog", () => ({
  StoryEditorDialog: () => null,
}));

vi.mock("@/components/admin/create-story-dialog", () => ({
  CreateStoryDialog: () => null,
}));

vi.mock("@/components/admin/selection-toolbar", () => ({
  SelectionToolbar: () => null,
}));

vi.mock("@/components/admin/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

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

function setupAdminAuth() {
  mockUseAuth.mockReturnValue({
    user: { id: "user-1", email: "admin@example.com" },
    isLoading: false,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: mockSignOut,
  });
  mockUseAdminRole.mockReturnValue({ isAdmin: true, isLoading: false });
}

describe("AdminShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchStories.mockResolvedValue({ data: [] });
    // Default: no tab param in URL → defaults to "analytics"
    mockSearchParamsGet.mockReturnValue(null);
  });

  describe("Auth gating", () => {
    it("shows loading when auth is loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: true });

      render(<AdminShell />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows sign-in when not authenticated", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: false });

      render(<AdminShell />);
      expect(screen.getByText("Paisaxe Admin")).toBeInTheDocument();
      expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    });

    it("shows access denied for non-admin users", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-2", email: "user@example.com" },
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
      mockUseAdminRole.mockReturnValue({ isAdmin: false, isLoading: false });

      render(<AdminShell />);
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });
  });

  describe("Tab rendering (FE-M3: unmount on hide)", () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it("renders analytics tab by default", async () => {
      render(<AdminShell />);

      await waitFor(() => {
        expect(screen.getByTestId("analytics-dashboard")).toBeInTheDocument();
      });
    });

    it("unmounts analytics panel when switching away from it", async () => {
      render(<AdminShell />);

      await waitFor(() => {
        expect(screen.getByTestId("analytics-dashboard")).toBeInTheDocument();
      });

      // Switch to Stories tab
      await act(async () => {
        fireEvent.click(screen.getByText("Stories"));
      });

      // Analytics panel should be UNMOUNTED (not just hidden)
      await waitFor(() => {
        expect(screen.queryByTestId("analytics-dashboard")).not.toBeInTheDocument();
      });
    });

    it("unmounts features panel when switching away", async () => {
      render(<AdminShell />);

      // Navigate to Features
      await act(async () => {
        fireEvent.click(screen.getByText("Features"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("feature-toggles-panel")).toBeInTheDocument();
      });

      // Switch away
      await act(async () => {
        fireEvent.click(screen.getByText("Analytics"));
      });

      await waitFor(() => {
        expect(screen.queryByTestId("feature-toggles-panel")).not.toBeInTheDocument();
      });
    });

    it("unmounts marketing panel when switching away", async () => {
      render(<AdminShell />);

      await act(async () => {
        fireEvent.click(screen.getByText("Marketing"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("marketing-dashboard")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Analytics"));
      });

      await waitFor(() => {
        expect(screen.queryByTestId("marketing-dashboard")).not.toBeInTheDocument();
      });
    });

    it("unmounts suggestions panel when switching away", async () => {
      render(<AdminShell />);

      await act(async () => {
        fireEvent.click(screen.getByText("Suggestions"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestions-panel")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Analytics"));
      });

      await waitFor(() => {
        expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
      });
    });

    it("unmounts agents panel when switching away", async () => {
      render(<AdminShell />);

      await act(async () => {
        fireEvent.click(screen.getByText("Agents"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("agents-dashboard")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Analytics"));
      });

      await waitFor(() => {
        expect(screen.queryByTestId("agents-dashboard")).not.toBeInTheDocument();
      });
    });

    it("only one tab panel is mounted at a time", async () => {
      render(<AdminShell />);

      // Only analytics mounted initially
      await waitFor(() => {
        expect(screen.getByTestId("analytics-dashboard")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("feature-toggles-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("marketing-dashboard")).not.toBeInTheDocument();
      expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("agents-dashboard")).not.toBeInTheDocument();

      // Switch to marketing
      await act(async () => {
        fireEvent.click(screen.getByText("Marketing"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("marketing-dashboard")).toBeInTheDocument();
      });

      // Analytics should be gone, features/suggestions/agents not mounted
      expect(screen.queryByTestId("analytics-dashboard")).not.toBeInTheDocument();
      expect(screen.queryByTestId("feature-toggles-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
    });
  });

  describe("AR-M2: AdminShell provides header and tab orchestration", () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it("renders the Paisaxe brand in header", async () => {
      render(<AdminShell />);
      expect(screen.getByText("Paisaxe")).toBeInTheDocument();
    });

    it("renders admin tabs navigation", async () => {
      render(<AdminShell />);
      expect(screen.getByTestId("admin-tabs")).toBeInTheDocument();
    });

    it("shows logout button", async () => {
      render(<AdminShell />);
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });

    it("calls signOut when logout is clicked", async () => {
      render(<AdminShell />);

      const logoutButton = screen.getByText("Logout").closest("button")!;
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("FE-H5: activeTab derived from searchParams, tab change only calls router.push", () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it("derives activeTab from searchParams.get('tab')", async () => {
      mockSearchParamsGet.mockReturnValue("stories");

      render(<AdminShell />);

      // The stories panel content should be active (no analytics dashboard)
      await waitFor(() => {
        expect(screen.queryByTestId("analytics-dashboard")).not.toBeInTheDocument();
      });
    });

    it("defaults to 'analytics' tab when searchParams has no tab param", async () => {
      mockSearchParamsGet.mockReturnValue(null);

      render(<AdminShell />);

      await waitFor(() => {
        expect(screen.getByTestId("analytics-dashboard")).toBeInTheDocument();
      });
    });

    it("calls router.push (not double setState) when a tab is clicked", async () => {
      mockSearchParamsGet.mockReturnValue(null); // start on analytics

      render(<AdminShell />);

      await waitFor(() => {
        expect(screen.getByTestId("analytics-dashboard")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Features"));
      });

      // router.push must be called with the new tab in the URL
      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining("tab=features")
      );
    });

    it("does not call router.push on initial render", async () => {
      mockSearchParamsGet.mockReturnValue(null);

      render(<AdminShell />);

      await waitFor(() => {
        expect(screen.getByTestId("analytics-dashboard")).toBeInTheDocument();
      });

      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });
});
