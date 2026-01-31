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

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

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

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "maintenance");

      // Only "Maintenance Mode" should be visible
      expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "AMBIENT");

      expect(screen.getByText("Ambient Discovery")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
    });

    it("shows no results message when search has no matches", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

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

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
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

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "voice");

      // Only voice flag visible
      expect(screen.getByText("Visitor Voice Agent")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // All flags should be visible again
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Visitor Voice Agent")).toBeInTheDocument();
    });
  });

  describe("basic functionality", () => {
    it("renders loading state initially", () => {
      render(<FeatureTogglesPanel />);
      // Loading spinner is an SVG with animate-spin class
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("renders flags after loading", async () => {
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      expect(screen.getByText("Related Stories")).toBeInTheDocument();
      expect(screen.getByText("Ambient Discovery")).toBeInTheDocument();
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

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      const toggleButtons = screen.getAllByRole("switch");
      await user.click(toggleButtons[0]);

      expect(updateFeatureFlag).toHaveBeenCalledWith("contextual_prompts", false);
    });

    it("filters by category when tab is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Click on System category tab (use title attribute to be specific)
      const systemTab = screen.getByTitle("Administrative controls");
      await user.click(systemTab);

      // Should only show system flags (maintenance mode)
      expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
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
