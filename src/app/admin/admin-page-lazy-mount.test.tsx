import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act, fireEvent } from "@testing-library/react";

/**
 * FE-M3 regression: Tab panels are unmounted when not active.
 *
 * Previously tabs were kept alive with display:none after first visit.
 * Now each tab panel is only in the DOM when its tab is active.
 * This prevents idle panels from polling/fetching.
 *
 * These tests exercise AdminPage (page.tsx -> AdminShell) directly
 * without the next/dynamic mock, since AdminShell handles tab routing.
 */

// Mock next/navigation for URL-backed tab state.
// Return a stable searchParams reference so the sync useEffect doesn't
// re-fire on every render and reset the active tab back to "analytics".
const stableSearchParams = { get: (_key: string) => null as string | null };
vi.mock("next/navigation", () => ({
  useSearchParams: () => stableSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

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
  approveAllPendingStories: vi.fn(),
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

// Import AdminShell directly to avoid next/dynamic complexity in this test
import { AdminShell } from "@/components/admin/admin-shell";

describe("AdminPage tab unmount behavior (FE-M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("only renders the default tab (analytics) content initially", async () => {
    render(<AdminShell />);

    // Wait for dynamic import to load analytics
    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Other tab panels must NOT be in the DOM
    expect(screen.queryByTestId("features-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marketing-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("agents-panel")).not.toBeInTheDocument();
  });

  it("mounts a new tab's content when switching to it", async () => {
    render(<AdminShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Features not mounted yet
    expect(screen.queryByTestId("features-panel")).not.toBeInTheDocument();

    // Click the Features tab
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Features/i }));
    });

    // Features should now be mounted
    await waitFor(() => {
      expect(screen.getByTestId("features-panel")).toBeInTheDocument();
    });
  });

  it("unmounts previous tab content when switching away (FE-M3 core behavior)", async () => {
    render(<AdminShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Switch to Features
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Features/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("features-panel")).toBeInTheDocument();
    });

    // Analytics should be UNMOUNTED (not just hidden) — FE-M3 regression check
    expect(screen.queryByTestId("analytics-panel")).not.toBeInTheDocument();
  });

  it("only one tab panel is in the DOM at a time", async () => {
    render(<AdminShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Navigate to Marketing
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Marketing/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-panel")).toBeInTheDocument();
    });

    // Only marketing should be mounted — all others gone
    expect(screen.queryByTestId("analytics-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("features-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("suggestions-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("agents-panel")).not.toBeInTheDocument();
  });

  it("re-mounts a previously visited tab when returning to it", async () => {
    render(<AdminShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Visit Features
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Features/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("features-panel")).toBeInTheDocument();
    });

    // Return to Analytics
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Analytics/i }));
    });

    await waitFor(() => {
      // Analytics is re-mounted when we come back
      expect(screen.getByTestId("analytics-panel")).toBeInTheDocument();
    });

    // Features is unmounted
    expect(screen.queryByTestId("features-panel")).not.toBeInTheDocument();
  });
});
