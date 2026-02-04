import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureTogglesPanel } from "./feature-toggles-panel";
import type { FeatureFlag } from "@/types/feature-flags";

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  fetchFeatureFlags: vi.fn(),
  updateFeatureFlag: vi.fn(),
}));

// Import mocked functions
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";

const mockFlags: FeatureFlag[] = [
  {
    id: "1",
    flagKey: "contextual_prompts",
    enabled: true,
    label: "Contextual Prompts",
    description: "Show prompts based on context",
    config: {},
    environment: "production",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    flagKey: "related_stories",
    enabled: false,
    label: "Related Stories",
    description: "Display related content suggestions",
    config: {},
    environment: "production",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "3",
    flagKey: "ambient_discovery",
    enabled: true,
    label: "Ambient Discovery",
    description: "Background discovery mode",
    config: {},
    environment: "production",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "4",
    flagKey: "visitor_voice_agent",
    enabled: false,
    label: "Visitor Voice Agent",
    description: "Enable voice assistant for visitors",
    config: {},
    environment: "production",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "5",
    flagKey: "maintenance_mode",
    enabled: false,
    label: "Maintenance Mode",
    description: "Put the site in maintenance mode",
    config: {},
    environment: "production",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "6",
    flagKey: "coverage_agent_enabled",
    enabled: true,
    label: "Coverage Agent",
    description: "Automated test coverage agent",
    config: {},
    environment: "production",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

describe("FeatureTogglesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFeatureFlags).mockResolvedValue({
      data: mockFlags,
      error: undefined,
    });
    vi.mocked(updateFeatureFlag).mockResolvedValue({
      data: mockFlags[0],
      error: undefined,
    });
  });

  describe("search functionality", () => {
    it("renders a search input", async () => {
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });
    });

    it("filters flags by label when searching", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Search for coverage
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "coverage");

      // Only "Coverage Agent" should be visible
      expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
    });

    it("filters flags by description when searching", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Search for "test coverage" (from description)
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "test coverage");

      // "Coverage Agent" should be visible
      expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Switch to Experience tab (where Ambient Discovery is)
      const experienceTab = screen.getByRole("button", { name: /experience/i });
      await user.click(experienceTab);

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "AMBIENT");

      expect(screen.getByText("Ambient Discovery")).toBeInTheDocument();
    });

    it("shows no results message when search has no matches", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "xyznonexistent");

      expect(screen.getByText(/no flags/i)).toBeInTheDocument();
    });

    it("combines search with category filter", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Click on Discovery category
      const discoveryTab = screen.getByRole("button", { name: /discovery/i });
      await user.click(discoveryTab);

      // Should show discovery flags
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();

      // Now search within Discovery
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "contextual");

      // Only Contextual Prompts should remain
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.queryByText("Related Stories")).not.toBeInTheDocument();
    });

    it("clears search when input is emptied", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "coverage");

      // Coverage Agent should still be visible (matches search)
      expect(screen.getByText("Coverage Agent")).toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // Coverage Agent should still be visible (in Agents category)
      expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
    });
  });

  describe("basic functionality", () => {
    it("renders loading state initially", () => {
      render(<FeatureTogglesPanel />);
      // Loading spinner is an SVG with animate-spin class
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("defaults to Agents tab and shows agent flags", async () => {
      render(<FeatureTogglesPanel />);

      // Should show Coverage Agent (Agents category) by default
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Should NOT show flags from other categories
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
      expect(screen.queryByText("Maintenance Mode")).not.toBeInTheDocument();
    });

    it("shows different flags when switching category tabs", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Click on Discovery tab
      const discoveryTab = screen.getByRole("button", { name: /discovery/i });
      await user.click(discoveryTab);

      // Should show discovery flags
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.queryByText("Coverage Agent")).not.toBeInTheDocument();
    });

    it("displays correct enabled/total count", async () => {
      render(<FeatureTogglesPanel />);

      // 3 enabled flags + 7 total (6 flags + 1 tunnel assumed available in dev)
      await waitFor(() => {
        expect(screen.getByText("3/7 Active")).toBeInTheDocument();
      });
    });

    it("toggles flag when switch is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab with Coverage Agent (which is enabled/true in mock)
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Find the toggle specifically labeled for Coverage Agent
      const coverageToggle = screen.getByRole("switch", { name: /toggle coverage agent/i });
      await user.click(coverageToggle);

      // Coverage Agent is initially true, so clicking toggle should disable it (false)
      expect(updateFeatureFlag).toHaveBeenCalledWith("coverage_agent_enabled", false);
    });

    it("filters by category when tab is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Agents tab
      await waitFor(() => {
        expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
      });

      // Click on Discovery category tab
      const discoveryTab = screen.getByRole("button", { name: /discovery/i });
      await user.click(discoveryTab);

      // Should only show discovery flags
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.queryByText("Coverage Agent")).not.toBeInTheDocument();
      expect(screen.queryByText("Visitor Voice Agent")).not.toBeInTheDocument();
    });

    it("shows error message when fetch fails", async () => {
      vi.mocked(fetchFeatureFlags).mockResolvedValue({
        data: undefined,
        error: "Failed to fetch flags",
      });

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Failed to fetch flags")).toBeInTheDocument();
      });
    });
  });
});
