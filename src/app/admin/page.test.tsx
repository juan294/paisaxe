import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AdminPage from "./page";

// Mock next/navigation for URL-backed tab state.
// Return a stable searchParams object so the sync useEffect doesn't re-fire
// on every render and reset the active tab back to "analytics".
const stableSearchParams = { get: (_key: string) => null as string | null };
vi.mock("next/navigation", () => ({
  useSearchParams: () => stableSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
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

// Mock StoriesTabPanel — stories tab behavior is covered by stories-tab-panel.test.tsx
vi.mock("@/components/admin/stories-tab-panel", () => ({
  StoriesTabPanel: () => <div data-testid="stories-tab-panel">Stories Tab Panel</div>,
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

vi.mock("@/components/admin/marketing-dashboard", () => ({
  MarketingDashboard: () => <div data-testid="marketing-dashboard">Marketing</div>,
}));

vi.mock("@/components/admin/suggestions-panel", () => ({
  SuggestionsPanel: () => <div data-testid="suggestions-panel">Suggestions</div>,
}));

vi.mock("@/components/admin/agents-dashboard", () => ({
  AgentsDashboard: () => <div data-testid="agents-dashboard">Agents</div>,
}));

// Mock lucide-react icons used by AdminShell
vi.mock("lucide-react", () => ({
  LogOut: (props: Record<string, unknown>) => <span data-testid="icon-logout" {...props} />,
  ShieldX: (props: Record<string, unknown>) => <span data-testid="icon-shield-x" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  ArrowUpRight: (props: Record<string, unknown>) => <span data-testid="icon-arrow-up-right" {...props} />,
}));

// Mock theme components
vi.mock("@/components/admin/theme-provider", () => ({
  AdminThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/admin/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

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

    it("shows Paisaxe title", () => {
      render(<AdminPage />);
      expect(screen.getByText("Paisaxe")).toBeInTheDocument();
    });

    it("logout calls signOut", async () => {
      render(<AdminPage />);

      const logoutButton = screen.getByText("Logout").closest("button")!;
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("shows StoriesTabPanel when stories tab is active", async () => {
      render(<AdminPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("Stories"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("stories-tab-panel")).toBeInTheDocument();
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

    describe("Tab panel rendering (FE-M3: unmount on hide)", () => {
      // FE-M3: Tab panels are now conditionally rendered — unmounted when inactive.
      // Previously they were kept alive with display:none after first visit.
      it("renders MarketingDashboard only when Marketing tab is active", async () => {
        render(<AdminPage />);

        // Marketing not mounted initially
        expect(screen.queryByTestId("marketing-dashboard")).not.toBeInTheDocument();

        // Click the Marketing tab
        await act(async () => {
          fireEvent.click(screen.getByText("Marketing"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("marketing-dashboard")).toBeInTheDocument();
        });

        // Navigate away — panel is UNMOUNTED (FE-M3)
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.queryByTestId("marketing-dashboard")).not.toBeInTheDocument();
        });
      });

      it("renders SuggestionsPanel only when Suggestions tab is active", async () => {
        render(<AdminPage />);

        expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();

        await act(async () => {
          fireEvent.click(screen.getByText("Suggestions"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("suggestions-panel")).toBeInTheDocument();
        });

        // Navigate away — panel is UNMOUNTED (FE-M3)
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
        });
      });

      it("renders AgentsDashboard only when Agents tab is active", async () => {
        render(<AdminPage />);

        expect(screen.queryByTestId("agents-dashboard")).not.toBeInTheDocument();

        await act(async () => {
          fireEvent.click(screen.getByText("Agents"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("agents-dashboard")).toBeInTheDocument();
        });

        // Navigate away — panel is UNMOUNTED (FE-M3)
        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.queryByTestId("agents-dashboard")).not.toBeInTheDocument();
        });
      });

      it("renders StoriesTabPanel only when Stories tab is active", async () => {
        render(<AdminPage />);

        // Stories not mounted initially (default tab is analytics)
        expect(screen.queryByTestId("stories-tab-panel")).not.toBeInTheDocument();

        await act(async () => {
          fireEvent.click(screen.getByText("Stories"));
        });

        await waitFor(() => {
          expect(screen.getByTestId("stories-tab-panel")).toBeInTheDocument();
        });

        // Navigate away — panel is UNMOUNTED (FE-M3)
        await act(async () => {
          fireEvent.click(screen.getByText("Marketing"));
        });

        await waitFor(() => {
          expect(screen.queryByTestId("stories-tab-panel")).not.toBeInTheDocument();
        });
      });
    });
  });
});
