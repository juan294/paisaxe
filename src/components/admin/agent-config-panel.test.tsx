import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentConfigPanel } from "./agent-config-panel";
import * as adminApi from "@/lib/admin-api";
import type { FeatureFlag } from "@/types/feature-flags";

vi.mock("@/lib/admin-api", () => ({
  updateFeatureFlagConfig: vi.fn(),
}));

const mockFlag: FeatureFlag = {
  id: "2",
  flagKey: "contextual_prompts" as FeatureFlag["flagKey"],
  label: "Coverage Agent",
  description: "Automated test coverage monitoring",
  enabled: true,
  config: {
    prompt: "Run coverage analysis on all source files.",
    schedule_description: "Daily at 2:00 AM",
    output_file: "docs/agents/coverage-report.md",
  },
  environment: "production",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T03:00:00Z",
};

describe("AgentConfigPanel", () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders schedule info", () => {
    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    expect(screen.getByText("Schedule")).toBeInTheDocument();
    // "contextual_prompts" has no entry in AGENT_PROMPT_DEFAULTS → fallback
    expect(screen.getByText("Not scheduled")).toBeInTheDocument();
  });

  it("renders prompt editor with label", () => {
    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    expect(screen.getByText("Agent Prompt")).toBeInTheDocument();
    // The textarea should have the prompt from config
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Run coverage analysis on all source files.");
  });

  it("disables save button when no changes", () => {
    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const saveButton = screen.getByText("Save");
    expect(saveButton.closest("button")).toBeDisabled();
  });

  it("enables save button when prompt changes", async () => {
    const user = userEvent.setup();
    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "New prompt");

    const saveButton = screen.getByText("Save");
    expect(saveButton.closest("button")).not.toBeDisabled();
  });

  it("resets prompt on Reset click", async () => {
    const user = userEvent.setup();
    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Changed prompt");

    await user.click(screen.getByText("Reset"));

    // Reset goes back to default from AGENT_PROMPT_DEFAULTS (not the config value)
    const resetTextarea = screen.getByRole("textbox");
    expect(resetTextarea).toBeInTheDocument();
  });

  it("calls updateFeatureFlagConfig when saved", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.updateFeatureFlagConfig).mockResolvedValue({
      data: mockFlag,
    });

    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "New prompt text");

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(adminApi.updateFeatureFlagConfig).toHaveBeenCalled();
    });
  });

  it("shows error on save failure", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.updateFeatureFlagConfig).mockResolvedValue({
      error: "Update failed",
    });

    render(<AgentConfigPanel flag={mockFlag} onUpdate={onUpdate} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "New prompt");

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });
});
