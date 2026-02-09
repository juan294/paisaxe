import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/dynamic to resolve synchronously in tests.
// The loader function (e.g., () => import("@/components/admin/...")) is called,
// and since vi.mock replaces those modules, we use waitFor in tests.
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<{ default: React.ComponentType }>, _opts?: unknown) => {
      let Resolved: React.ComponentType | null = null;
      const pending = loader().then((mod) => {
        Resolved = mod.default || (mod as unknown as { default: React.ComponentType }).default;
      });
      return function DynamicWrapper(props: Record<string, unknown>) {
        const [ready, setReady] = React.useState(!!Resolved);
        React.useEffect(() => {
          if (!ready) {
            pending.then(() => setReady(true));
          }
        }, [ready]);
        if (!Resolved) return null;
        return React.createElement(Resolved, props);
      };
    },
  };
});

// Mock auth hooks — admin user
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@test.com" },
    isLoading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-admin-role", () => ({
  useAdminRole: () => ({
    isAdmin: true,
    isLoading: false,
  }),
}));

// Mock admin-api
vi.mock("@/lib/admin-api", () => ({
  fetchStories: vi.fn().mockResolvedValue({ data: [], error: null }),
  bulkUpdateStoryStatus: vi.fn(),
  bulkDeleteStories: vi.fn(),
}));

// Mock all tab panel components
vi.mock("@/components/admin/feature-toggles-panel", () => ({
  FeatureTogglesPanel: () => <div data-testid="features-panel">Features Panel</div>,
}));

vi.mock("@/components/admin/analytics-dashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="analytics-panel">Analytics Panel</div>,
}));

vi.mock("@/components/admin/marketing-dashboard", () => ({
  MarketingDashboard: () => <div data-testid="marketing-panel">Marketing Panel</div>,
}));

vi.mock("@/components/admin/suggestions-panel", () => ({
  SuggestionsPanel: () => <div data-testid="suggestions-panel">Suggestions Panel</div>,
}));

vi.mock("@/components/admin/agents-dashboard", () => ({
  AgentsDashboard: () => <div data-testid="agents-panel">Agents Panel</div>,
}));

// Mock dialog/toolbar components
vi.mock("@/components/admin/story-editor-dialog", () => ({
  StoryEditorDialog: () => null,
}));

vi.mock("@/components/admin/create-story-dialog", () => ({
  CreateStoryDialog: () => null,
}));

vi.mock("@/components/admin/selection-toolbar", () => ({
  SelectionToolbar: () => null,
}));

// Mock other admin components
vi.mock("@/components/admin/story-grid", () => ({
  StoryGrid: () => <div data-testid="story-grid">Story Grid</div>,
}));

vi.mock("@/components/admin/theme-provider", () => ({
  AdminThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/admin/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

describe("AdminPage top-level lazy-mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderAdmin() {
    const AdminPage = (await import("./page")).default;
    return render(<AdminPage />);
  }

  it("only renders the default tab (analytics) content initially", async () => {
    await renderAdmin();

    // Wait for dynamic import to resolve
    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Other tab panels should NOT be in the DOM
    expect(screen.queryByTestId("features-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marketing-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
  });

  it("mounts a new tab's content when switching to it", async () => {
    const user = userEvent.setup();
    await renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Features not mounted yet
    expect(screen.queryByTestId("features-panel")).not.toBeInTheDocument();

    // Click the Features tab
    await user.click(screen.getByRole("tab", { name: /Features/i }));

    // Features should now be mounted
    await waitFor(() => {
      expect(screen.getByTestId("features-panel")).toBeInTheDocument();
    });
  });

  it("preserves previously visited tab content when switching away", async () => {
    const user = userEvent.setup();
    await renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Visit Features
    await user.click(screen.getByRole("tab", { name: /Features/i }));
    await waitFor(() => {
      expect(screen.getByTestId("features-panel")).toBeInTheDocument();
    });

    // Switch to Marketing
    await user.click(screen.getByRole("tab", { name: /Marketing/i }));

    // Wait for Marketing to mount
    await waitFor(() => {
      expect(screen.getByTestId("marketing-panel")).toBeInTheDocument();
    });

    // Features should still be in the DOM (hidden)
    expect(screen.getByTestId("features-panel")).toBeInTheDocument();
    // Analytics (default) should also still be mounted
    expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
  });
});
