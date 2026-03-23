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

// Mock child config panels to avoid rendering their internals
vi.mock("./visitor-voice-config-panel", () => ({
  VisitorVoiceConfigPanel: ({ flag, onUpdate }: { flag: FeatureFlag; onUpdate?: (f: FeatureFlag) => void }) => (
    <div data-testid="visitor-voice-config">
      Voice config for {flag.flagKey}
      {onUpdate && (
        <button data-testid="trigger-flag-update" onClick={() => onUpdate({ ...flag, enabled: !flag.enabled })}>
          Update Flag
        </button>
      )}
    </div>
  ),
}));

vi.mock("./maintenance-config-panel", () => ({
  MaintenanceConfigPanel: ({ flag }: { flag: FeatureFlag }) => (
    <div data-testid="maintenance-config">Maintenance config for {flag.flagKey}</div>
  ),
}));

vi.mock("./tunnel-control-panel", () => ({
  TunnelTableRow: ({ onRunningChange }: { onRunningChange?: (running: boolean) => void; rowNumber?: number }) => (
    <tr data-testid="tunnel-row">
      <td>
        Tunnel
        {onRunningChange && (
          <button data-testid="trigger-tunnel-running" onClick={() => onRunningChange(true)}>
            Set Running
          </button>
        )}
      </td>
    </tr>
  ),
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

    it("shows error when updateFeatureFlag returns an error", async () => {
      vi.mocked(updateFeatureFlag).mockResolvedValue({
        data: undefined,
        error: "Update failed: server error",
      });

      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Wait for flags to load (Discovery tab with Contextual Prompts)
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Click the toggle for Contextual Prompts
      const toggle = screen.getByRole("switch", { name: /toggle contextual prompts/i });
      await user.click(toggle);

      // Error message should appear
      await waitFor(() => {
        expect(screen.getByText("Update failed: server error")).toBeInTheDocument();
      });
    });
  });

  describe("configurable flag expansion", () => {
    it("expands visitor_voice_agent config panel when Settings button is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Wait for flags to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Switch to Voice tab where visitor_voice_agent lives
      const voiceTab = screen.getByRole("button", { name: /voice/i });
      await user.click(voiceTab);

      // Verify the Visitor Voice Agent flag is visible
      expect(screen.getByText("Visitor Voice Agent")).toBeInTheDocument();

      // Config panel should NOT be visible yet
      expect(screen.queryByTestId("visitor-voice-config")).not.toBeInTheDocument();

      // Click the Settings button to expand
      const settingsBtn = screen.getByRole("button", { name: /configure visitor voice agent/i });
      expect(settingsBtn).toHaveAttribute("aria-expanded", "false");
      await user.click(settingsBtn);

      // Config panel should now be visible
      expect(screen.getByTestId("visitor-voice-config")).toBeInTheDocument();
      expect(settingsBtn).toHaveAttribute("aria-expanded", "true");
    });

    it("collapses the config panel when Settings button is clicked again", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Switch to Voice tab
      const voiceTab = screen.getByRole("button", { name: /voice/i });
      await user.click(voiceTab);

      // Click Settings to expand
      const settingsBtn = screen.getByRole("button", { name: /configure visitor voice agent/i });
      await user.click(settingsBtn);
      expect(screen.getByTestId("visitor-voice-config")).toBeInTheDocument();

      // Click Settings again to collapse
      await user.click(settingsBtn);
      expect(screen.queryByTestId("visitor-voice-config")).not.toBeInTheDocument();
      expect(settingsBtn).toHaveAttribute("aria-expanded", "false");
    });

    it("expands maintenance_mode config panel when Settings button is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Switch to System tab where maintenance_mode lives
      const systemTab = screen.getByRole("button", { name: /system/i });
      await user.click(systemTab);

      // Verify the Maintenance Mode flag is visible
      expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();

      // Click the Settings button to expand
      const settingsBtn = screen.getByRole("button", { name: /configure maintenance mode/i });
      await user.click(settingsBtn);

      // Config panel should now be visible
      expect(screen.getByTestId("maintenance-config")).toBeInTheDocument();
    });
  });

  describe("search by category label (line 218-220)", () => {
    it("matches flags by category label in search (line 220 categoryLabel branch)", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Default is Discovery tab, wait for it to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Search for "discovery" which is the category label, not present in flag labels or descriptions
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "discovery");

      // Both discovery flags should match via category label
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      expect(screen.getByText("Related Stories")).toBeInTheDocument();
    });
  });

  describe("edge case branches", () => {
    it("shows dash for flags without description (line 358 fallback)", async () => {
      // Add a flag with no description to the discovery category
      const flagsWithNoDesc = [
        ...mockFlags.slice(0, 1).map(f => ({ ...f, description: null })),
        ...mockFlags.slice(1),
      ];
      vi.mocked(fetchFeatureFlags).mockResolvedValue({
        data: flagsWithNoDesc as FeatureFlag[],
        error: undefined,
      });

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        // The dash should be shown for the flag with null description
        expect(screen.getByText("—")).toBeInTheDocument();
      });
    });

    it("filters flags with null description using ?? false in search (line 218-219)", async () => {
      const user = userEvent.setup();
      // Flag with null description
      const flagsWithNullDesc = [
        { ...mockFlags[0], description: null },
        ...mockFlags.slice(1),
      ];
      vi.mocked(fetchFeatureFlags).mockResolvedValue({
        data: flagsWithNullDesc as FeatureFlag[],
        error: undefined,
      });

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Search for something that would match the null description
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "some text not in label");

      // Both flags should be filtered out (null description should not cause crash)
      expect(screen.queryByText("Contextual Prompts")).not.toBeInTheDocument();
    });

    it("shows 'Loading...' text when isLoading is true during refresh (line 255)", async () => {
      const user = userEvent.setup();
      // First load resolves, second (refresh) hangs
      vi.mocked(fetchFeatureFlags)
        .mockResolvedValueOnce({ data: mockFlags, error: undefined })
        .mockImplementationOnce(() => new Promise(() => {}));

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Refresh")).toBeInTheDocument();
      });

      // Click refresh - it should hang and show "Loading..."
      await user.click(screen.getByText("Refresh"));

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("handles flags with unknown categories (line 84 - category miss)", async () => {
      // Add a flag that maps to no category in FLAG_CATEGORIES
      const flagsWithUnknown = [
        ...mockFlags,
        {
          id: "99",
          flagKey: "unknown_flag_key" as never,
          enabled: true,
          label: "Unknown Flag",
          description: "A flag with no category mapping",
          config: {},
          environment: "production",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(fetchFeatureFlags).mockResolvedValue({
        data: flagsWithUnknown as FeatureFlag[],
        error: undefined,
      });

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // The unknown flag should not appear in any category - not causing an error
      // It should not be in Discovery
      expect(screen.queryByText("Unknown Flag")).not.toBeInTheDocument();

      // Total count should still be correct (unknown flag not counted in categories)
      // 2 enabled out of 6 total (5 known + tunnel), unknown not counted
      expect(screen.getByText("2/6 Active")).toBeInTheDocument();
    });

    it("handles loadFlags returning neither error nor data (line 115 else-if false branch)", async () => {
      // When fetchFeatureFlags returns { error: undefined, data: undefined },
      // neither the error branch nor the data branch executes.
      vi.mocked(fetchFeatureFlags).mockResolvedValue({
        data: undefined,
        error: undefined,
      });

      render(<FeatureTogglesPanel />);

      // Should finish loading without error and show empty state
      await waitFor(() => {
        // No error shown
        expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
        // All categories show 0/0 since no flags loaded (plus 0/1 for system with tunnel)
        expect(screen.getByText("0/1 Active")).toBeInTheDocument();
      });
    });

    it("handles handleToggle returning neither error nor data (line 131 else-if false branch)", async () => {
      const user = userEvent.setup();
      // updateFeatureFlag returns neither error nor data
      vi.mocked(updateFeatureFlag).mockResolvedValue({
        data: undefined,
        error: undefined,
      });

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Click toggle — handleToggle will get { data: undefined, error: undefined }
      const toggle = screen.getByRole("switch", { name: /toggle contextual prompts/i });
      await user.click(toggle);

      // No error shown, flags unchanged
      await waitFor(() => {
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      });
      // Flag should still be in original state (not updated since no data returned)
      expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
    });

    it("shows 'No flags in this category' when category has no flags and no search", async () => {
      const user = userEvent.setup();
      // Only provide discovery flags, no social flags
      const discoveryOnlyFlags = mockFlags.filter(f =>
        ["contextual_prompts", "related_stories"].includes(f.flagKey)
      );
      vi.mocked(fetchFeatureFlags).mockResolvedValue({
        data: discoveryOnlyFlags,
        error: undefined,
      });

      render(<FeatureTogglesPanel />);

      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Switch to Social tab which has no flags
      const socialTab = screen.getByRole("button", { name: /social/i });
      await user.click(socialTab);

      expect(screen.getByText("No flags in this category")).toBeInTheDocument();
    });
  });

  describe("handleFlagUpdate and tunnel state", () => {
    it("updates flag state when handleFlagUpdate is called via config panel", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Wait for flags to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Switch to Voice tab where visitor_voice_agent lives
      const voiceTab = screen.getByRole("button", { name: /voice/i });
      await user.click(voiceTab);

      // Expand visitor_voice_agent config panel
      const settingsBtn = screen.getByRole("button", { name: /configure visitor voice agent/i });
      await user.click(settingsBtn);

      // Config panel should be visible with the Update Flag button
      expect(screen.getByTestId("visitor-voice-config")).toBeInTheDocument();

      // visitor_voice_agent is initially disabled (enabled: false)
      // The toggle should reflect that
      const toggle = screen.getByRole("switch", { name: /toggle visitor voice agent/i });
      expect(toggle).toHaveAttribute("aria-checked", "false");

      // Click "Update Flag" which calls onUpdate with enabled toggled to true
      const updateBtn = screen.getByTestId("trigger-flag-update");
      await user.click(updateBtn);

      // The flag state should now be updated — toggle should reflect enabled: true
      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-checked", "true");
      });
    });

    it("increments enabled count when tunnel is running", async () => {
      const user = userEvent.setup();
      render(<FeatureTogglesPanel />);

      // Wait for flags to load
      await waitFor(() => {
        expect(screen.getByText("Contextual Prompts")).toBeInTheDocument();
      });

      // Initially 2/6 Active (contextual_prompts + ambient_discovery enabled, tunnel not running)
      expect(screen.getByText("2/6 Active")).toBeInTheDocument();

      // Switch to System tab where tunnel row lives
      const systemTab = screen.getByRole("button", { name: /system/i });
      await user.click(systemTab);

      // Click "Set Running" which calls onRunningChange(true)
      const setRunningBtn = screen.getByTestId("trigger-tunnel-running");
      await user.click(setRunningBtn);

      // Count should now be 3/6 Active (2 flags + tunnel running)
      await waitFor(() => {
        expect(screen.getByText("3/6 Active")).toBeInTheDocument();
      });
    });
  });
});
