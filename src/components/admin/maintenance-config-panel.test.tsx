import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaintenanceConfigPanel } from "./maintenance-config-panel";
import type { FeatureFlag } from "@/types/feature-flags";

vi.mock("@/lib/admin-api", () => ({
  updateFeatureFlagConfig: vi.fn(),
}));

import * as adminApi from "@/lib/admin-api";

const mockFlag: FeatureFlag = {
  id: "1",
  flagKey: "maintenance_mode",
  label: "Maintenance Mode",
  description: "Show maintenance page to all visitors",
  enabled: false,
  config: {
    title: "Under Maintenance",
    message: "We are updating the site.",
    show_tagline: true,
  },
  environment: "production",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

describe("MaintenanceConfigPanel", () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields with current config", () => {
    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    expect(screen.getByLabelText("Display Title")).toHaveValue("Under Maintenance");
    expect(screen.getByLabelText("Additional Message (optional)")).toHaveValue("We are updating the site.");
  });

  it("renders preview section", () => {
    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    expect(screen.getByText("Preview")).toBeInTheDocument();
    // Preview renders tagline when show_tagline is true
    expect(screen.getByText("Look. Ask. Discover.")).toBeInTheDocument();
  });

  it("disables save button when no changes", () => {
    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const saveButton = screen.getByText("Save");
    expect(saveButton.closest("button")).toBeDisabled();
    expect(screen.getByText("No changes to save")).toBeInTheDocument();
  });

  it("enables save button when config changes", async () => {
    const user = userEvent.setup();
    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const titleInput = screen.getByLabelText("Display Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");

    const saveButton = screen.getByText("Save");
    expect(saveButton.closest("button")).not.toBeDisabled();
  });

  it("calls API and onUpdate when saved", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.updateFeatureFlagConfig).mockResolvedValue({
      data: { ...mockFlag, config: { title: "New Title", message: "We are updating the site.", show_tagline: true } },
    });

    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const titleInput = screen.getByLabelText("Display Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(adminApi.updateFeatureFlagConfig).toHaveBeenCalledWith("maintenance_mode", {
        title: "New Title",
        message: "We are updating the site.",
        show_tagline: true,
      });
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it("resets to defaults on Reset click", async () => {
    const user = userEvent.setup();
    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const titleInput = screen.getByLabelText("Display Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Changed");

    await user.click(screen.getByText("Reset"));

    // Reset goes to DEFAULT_CONFIG, not the flag config
    expect(screen.getByLabelText("Display Title")).toHaveValue("Pr\u00f3ximamente");
    expect(screen.getByLabelText("Additional Message (optional)")).toHaveValue("");
  });

  it("toggles show-tagline switch", async () => {
    const user = userEvent.setup();
    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    // Save should be enabled after toggling
    const saveButton = screen.getByText("Save");
    expect(saveButton.closest("button")).not.toBeDisabled();
  });

  it("shows error on save failure", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.updateFeatureFlagConfig).mockResolvedValue({
      error: "Save failed",
    });

    render(<MaintenanceConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const titleInput = screen.getByLabelText("Display Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });

  it("renders with empty config using defaults", () => {
    const emptyFlag: FeatureFlag = {
      ...mockFlag,
      config: {},
    };

    render(<MaintenanceConfigPanel flag={emptyFlag} onUpdate={onUpdate} />);

    expect(screen.getByLabelText("Display Title")).toHaveValue("Pr\u00f3ximamente");
    expect(screen.getByLabelText("Additional Message (optional)")).toHaveValue("");
  });
});
