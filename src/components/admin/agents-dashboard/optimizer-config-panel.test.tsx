import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OptimizerConfigPanel } from "./optimizer-config-panel";
import type { FeatureFlag } from "@/types/feature-flags";

vi.mock("@/lib/admin-api", () => ({
  updateFeatureFlagConfig: vi.fn(),
}));

import { updateFeatureFlagConfig } from "@/lib/admin-api";

const baseFlagFactory = (configOverride?: Record<string, unknown>): FeatureFlag => ({
  id: "uuid-1",
  flagKey: "maintenance_mode" as FeatureFlag["flagKey"],
  enabled: true,
  label: "Subscription Optimizer",
  description: "Analyzes service subscriptions",
  config: configOverride ?? {},
  environment: "production",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-02-09T00:00:00Z",
});

describe("OptimizerConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders service registry table as read-only", () => {
    render(
      <OptimizerConfigPanel flag={baseFlagFactory()} onUpdate={vi.fn()} />
    );

    expect(screen.getByText("Service Registry")).toBeInTheDocument();
    // Should show service names from the registry
    expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
  });

  it("renders usage metrics form with default values", () => {
    render(
      <OptimizerConfigPanel flag={baseFlagFactory()} onUpdate={vi.fn()} />
    );

    expect(screen.getByText("Usage Metrics")).toBeInTheDocument();
    const voiceInput = screen.getByLabelText("Voice Minutes");
    expect(voiceInput).toBeInTheDocument();
    expect((voiceInput as HTMLInputElement).value).toBe("15");
  });

  it("renders usage metrics from saved config", () => {
    const flag = baseFlagFactory({
      optimizer: { usageMetrics: { voiceMinutes: 42, visitors: 8000 } },
    });
    render(
      <OptimizerConfigPanel flag={flag} onUpdate={vi.fn()} />
    );

    const voiceInput = screen.getByLabelText("Voice Minutes");
    expect((voiceInput as HTMLInputElement).value).toBe("42");
    const visitorsInput = screen.getByLabelText("Visitors");
    expect((visitorsInput as HTMLInputElement).value).toBe("8000");
  });

  it("save button is disabled when no changes exist", () => {
    render(
      <OptimizerConfigPanel flag={baseFlagFactory()} onUpdate={vi.fn()} />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it("save button enables after editing a metric", async () => {
    render(
      <OptimizerConfigPanel flag={baseFlagFactory()} onUpdate={vi.fn()} />
    );

    const voiceInput = screen.getByLabelText("Voice Minutes");
    fireEvent.change(voiceInput, { target: { value: "50" } });

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("calls updateFeatureFlagConfig on save", async () => {
    const updatedFlag = baseFlagFactory({
      optimizer: { usageMetrics: { voiceMinutes: 50 } },
    });
    vi.mocked(updateFeatureFlagConfig).mockResolvedValue({
      data: updatedFlag,
    });

    const onUpdate = vi.fn();
    render(
      <OptimizerConfigPanel flag={baseFlagFactory()} onUpdate={onUpdate} />
    );

    const voiceInput = screen.getByLabelText("Voice Minutes");
    fireEvent.change(voiceInput, { target: { value: "50" } });

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateFeatureFlagConfig).toHaveBeenCalledWith(
        "maintenance_mode",
        expect.objectContaining({
          optimizer: expect.objectContaining({
            usageMetrics: expect.objectContaining({ voiceMinutes: 50 }),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(updatedFlag);
    });
  });
});
