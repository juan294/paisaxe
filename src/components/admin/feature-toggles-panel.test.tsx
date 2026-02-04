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

      // Default is System tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      // Switch to Voice tab to see voice flags
      const voiceTab = screen.getByRole("button", { name: /voice/i });
      await user.click(voiceTab);

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "voice");

      // Only "Visitor Voice Agent" should be visible
      expect(screen.getByText("Visitor Voice Agent")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
      expect(screen.queryByText("Related Stories")).not.toBeInTheDocument();
    });

    it("filters flags by description when searching", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is System tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      // Search for maintenance (should find it in System tab)
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "maintenance");

      // "Maintenance Mode" should be visible
      expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is System tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
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

      // Default is System tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "xyznonexistent");

      expect(screen.getByText(/no flags/i)).toBeInTheDocument();
    });

    it("combines search with category filter", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is System tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
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

      // Default is System tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "maintenance");

      // Maintenance Mode should still be visible (matches search)
      expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // Maintenance Mode should still be visible (in System category)
      expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
    });
  });

  describe("basic functionality", () => {
    it("renders loading state initially", () => {
      render(<FeatureTogglesPanel />);
      // Loading spinner is an SVG with animate-spin class
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("defaults to System tab and shows system flags", async () => {
      render(<FeatureTogglesPanel />);

      // Should show Maintenance Mode (System category) by default
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      // Should NOT show flags from other categories
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
      expect(screen.queryByText("Related Stories")).not.toBeInTheDocument();
    });

    it("shows different flags when switching category tabs", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      // Click on Discovery tab
      const discoveryTab = screen.getByRole("button", { name: /discovery/i });
      await user.click(discoveryTab);

      // Should show discovery flags
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.queryByText("Maintenance Mode")).not.toBeInTheDocument();
    });

    it("displays correct enabled/total count", async () => {
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("2/5 Active")).toBeInTheDocument();
      });
    });

    it("toggles flag when switch is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is System tab with Maintenance Mode (which is disabled/false in mock)
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      // Find the toggle specifically labeled for Maintenance Mode
      const maintenanceToggle = screen.getByRole("switch", { name: /toggle maintenance mode/i });
      await user.click(maintenanceToggle);

      // Maintenance Mode is initially false, so clicking toggle should enable it (true)
      expect(updateFeatureFlag).toHaveBeenCalledWith("maintenance_mode", true);
    });

    it("filters by category when tab is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is System tab
      await waitFor(() => {
        expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      });

      // Click on Discovery category tab
      const discoveryTab = screen.getByRole("button", { name: /discovery/i });
      await user.click(discoveryTab);

      // Should only show discovery flags
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.queryByText("Maintenance Mode")).not.toBeInTheDocument();
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
