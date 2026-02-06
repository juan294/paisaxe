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

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Search for "related"
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "related");

      // Only "Related Stories" should be visible
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
    });

    it("filters flags by description when searching", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Search for "content suggestions" (from description of Related Stories)
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "content suggestions");

      // "Related Stories" should be visible
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
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

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "xyznonexistent");

      expect(screen.getByText(/no flags/i)).toBeInTheDocument();
    });

    it("combines search with category filter", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Should show discovery flags by default
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

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "contextual");

      // Only Contextual Prompts should be visible
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.queryByText("Related Stories")).not.toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // Both discovery flags should be visible again
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
    });
  });

  describe("basic functionality", () => {
    it("renders loading state initially", () => {
      render(<FeatureTogglesPanel />);
      // Loading spinner is an SVG with animate-spin class
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("defaults to Discovery tab and shows discovery flags", async () => {
      render(<FeatureTogglesPanel />);

      // Should show Discovery flags (contextual_prompts, related_stories) by default
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });
      expect(screen.getByText("Related Stories")).toBeInTheDocument();

      // Should NOT show flags from other categories
      expect(screen.queryByText("Ambient Discovery")).not.toBeInTheDocument();
      expect(screen.queryByText("Maintenance Mode")).not.toBeInTheDocument();
    });

    it("shows different flags when switching category tabs", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Click on Experience tab
      const experienceTab = screen.getByRole("button", { name: /experience/i });
      await user.click(experienceTab);

      // Should show experience flags
      expect(screen.getByText("Ambient Discovery")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
    });

    it("displays correct enabled/total count", async () => {
      render(<FeatureTogglesPanel />);

      // 2 enabled flags (contextual_prompts + ambient_discovery) / 6 total (5 flags + tunnel)
      await waitFor(() => {
        expect(screen.getByText("2/6 Active")).toBeInTheDocument();
      });
    });

    it("toggles flag when switch is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Discovery tab with Contextual Prompts (which is enabled/true in mock)
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Find the toggle specifically labeled for Contextual Prompts
      const toggle = screen.getByRole("switch", { name: /toggle contextual prompts/i });
      await user.click(toggle);

      // Contextual Prompts is initially true, so clicking toggle should disable it (false)
      expect(updateFeatureFlag).toHaveBeenCalledWith("contextual_prompts", false);
    });

    it("filters by category when tab is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Discovery tab
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Click on Voice category tab
      const voiceTab = screen.getByRole("button", { name: /voice/i });
      await user.click(voiceTab);

      // Should only show voice flags
      expect(screen.getByText("Visitor Voice Agent")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
      expect(screen.queryByText("Ambient Discovery")).not.toBeInTheDocument();
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
