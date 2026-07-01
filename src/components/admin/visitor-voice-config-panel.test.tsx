import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisitorVoiceConfigPanel } from "./visitor-voice-config-panel";
import type { FeatureFlag } from "@/types/feature-flags";

// Mock admin-api
const mockUpdateFeatureFlagConfig = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  updateFeatureFlagConfig: (...args: unknown[]) => mockUpdateFeatureFlagConfig(...args),
}));

function makeMockFlag(config: {
  whitelisted_emails: string[];
  agent_id: string;
}): FeatureFlag {
  return {
    id: "flag-1",
    flagKey: "visitor_voice_agent",
    enabled: true,
    label: "Visitor Voice Agent",
    description: "Enable voice for whitelisted visitors",
    config,
    environment: "development",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("VisitorVoiceConfigPanel", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateFeatureFlagConfig.mockResolvedValue({ data: makeMockFlag({ whitelisted_emails: [], agent_id: "" }) });
  });

  describe("rendering", () => {
    it("should render agent ID input", () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      expect(screen.getByLabelText(/Agent ID/i)).toBeInTheDocument();
    });

    it("should render email input", () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      expect(screen.getByPlaceholderText(/user@example.com/i)).toBeInTheDocument();
    });

    it("should display existing agent ID", () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "agent-123" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      expect(screen.getByDisplayValue("agent-123")).toBeInTheDocument();
    });

    it("should display existing whitelisted emails", () => {
      const flag = makeMockFlag({
        whitelisted_emails: ["test1@example.com", "test2@example.com"],
        agent_id: "",
      });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      expect(screen.getByText("test1@example.com")).toBeInTheDocument();
      expect(screen.getByText("test2@example.com")).toBeInTheDocument();
    });

    it("should show empty state when no emails", () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/No whitelisted emails/i)).toBeInTheDocument();
    });
  });

  describe("adding emails", () => {
    it("should add email when clicking Add button", async () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "new@example.com");

      const addButton = screen.getByRole("button", { name: /Add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("new@example.com")).toBeInTheDocument();
      });
    });

    it("should add email when pressing Enter", async () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "enter@example.com{enter}");

      await waitFor(() => {
        expect(screen.getByText("enter@example.com")).toBeInTheDocument();
      });
    });

    it("should clear input after adding email", async () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i) as HTMLInputElement;
      await userEvent.type(input, "clear@example.com");

      const addButton = screen.getByRole("button", { name: /Add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("should not add duplicate emails", async () => {
      const flag = makeMockFlag({
        whitelisted_emails: ["existing@example.com"],
        agent_id: "",
      });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "existing@example.com");

      const addButton = screen.getByRole("button", { name: /Add/i });
      fireEvent.click(addButton);

      // Should only have one instance of the email
      const emails = screen.getAllByText("existing@example.com");
      expect(emails).toHaveLength(1);
    });

    it("should not add empty email", async () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const addButton = screen.getByRole("button", { name: /Add/i });
      fireEvent.click(addButton);

      // Should still show empty state
      expect(screen.getByText(/No whitelisted emails/i)).toBeInTheDocument();
    });

    it("should handle case-insensitive duplicate check", async () => {
      const flag = makeMockFlag({
        whitelisted_emails: ["TEST@example.com"],
        agent_id: "",
      });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "test@example.com");

      const addButton = screen.getByRole("button", { name: /Add/i });
      fireEvent.click(addButton);

      // Should only have one instance
      const emails = screen.getAllByText(/test@example\.com/i);
      expect(emails).toHaveLength(1);
    });
  });

  describe("removing emails", () => {
    it("should remove email when clicking remove button", async () => {
      const flag = makeMockFlag({
        whitelisted_emails: ["remove@example.com"],
        agent_id: "",
      });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      expect(screen.getByText("remove@example.com")).toBeInTheDocument();

      const removeButton = screen.getByRole("button", { name: /Remove remove@example.com/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText("remove@example.com")).not.toBeInTheDocument();
      });
    });
  });

  describe("saving config", () => {
    it("should auto-add pending email from input when Save is clicked", async () => {
      const updatedFlag = makeMockFlag({
        whitelisted_emails: ["pending@example.com"],
        agent_id: "",
      });
      mockUpdateFeatureFlagConfig.mockResolvedValue({ data: updatedFlag });

      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      // Type email but do NOT click Add
      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "pending@example.com");

      // Click Save directly
      const saveButton = screen.getByRole("button", { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateFeatureFlagConfig).toHaveBeenCalledWith("visitor_voice_agent", {
          whitelisted_emails: ["pending@example.com"],
          agent_id: "",
        });
      });
    });

    it("should auto-add pending email alongside existing emails on Save", async () => {
      const updatedFlag = makeMockFlag({
        whitelisted_emails: ["existing@example.com", "new@example.com"],
        agent_id: "agent-1",
      });
      mockUpdateFeatureFlagConfig.mockResolvedValue({ data: updatedFlag });

      const flag = makeMockFlag({
        whitelisted_emails: ["existing@example.com"],
        agent_id: "agent-1",
      });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      // Type a new email but don't click Add
      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "new@example.com");

      const saveButton = screen.getByRole("button", { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateFeatureFlagConfig).toHaveBeenCalledWith("visitor_voice_agent", {
          whitelisted_emails: ["existing@example.com", "new@example.com"],
          agent_id: "agent-1",
        });
      });
    });

    it("should not duplicate email when pending input matches existing on Save", async () => {
      const updatedFlag = makeMockFlag({
        whitelisted_emails: ["existing@example.com"],
        agent_id: "",
      });
      mockUpdateFeatureFlagConfig.mockResolvedValue({ data: updatedFlag });

      const flag = makeMockFlag({
        whitelisted_emails: ["existing@example.com"],
        agent_id: "",
      });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      // Type duplicate email
      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "existing@example.com");

      const saveButton = screen.getByRole("button", { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateFeatureFlagConfig).toHaveBeenCalledWith("visitor_voice_agent", {
          whitelisted_emails: ["existing@example.com"],
          agent_id: "",
        });
      });
    });

    it("should clear pending email input after Save auto-adds it", async () => {
      const updatedFlag = makeMockFlag({
        whitelisted_emails: ["pending@example.com"],
        agent_id: "",
      });
      mockUpdateFeatureFlagConfig.mockResolvedValue({ data: updatedFlag });

      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i) as HTMLInputElement;
      await userEvent.type(input, "pending@example.com");

      const saveButton = screen.getByRole("button", { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("should call updateFeatureFlagConfig when Save is clicked", async () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      // Add an email
      const emailInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(emailInput, "test@example.com");
      fireEvent.click(screen.getByRole("button", { name: /Add/i }));

      // Set agent ID
      const agentInput = screen.getByLabelText(/Agent ID/i);
      await userEvent.type(agentInput, "new-agent-id");

      // Click Save - use exact match to avoid matching "Remove save@..." button
      const saveButton = screen.getByRole("button", { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateFeatureFlagConfig).toHaveBeenCalledWith("visitor_voice_agent", {
          whitelisted_emails: ["test@example.com"],
          agent_id: "new-agent-id",
        });
      });
    });

    it("should call onUpdate after successful save", async () => {
      const updatedFlag = makeMockFlag({
        whitelisted_emails: ["saved@example.com"],
        agent_id: "saved-agent",
      });
      mockUpdateFeatureFlagConfig.mockResolvedValue({ data: updatedFlag });

      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(updatedFlag);
      });
    });

    it("should show error message on save failure", async () => {
      mockUpdateFeatureFlagConfig.mockResolvedValue({ error: "Failed to save" });

      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/i)).toBeInTheDocument();
      });
    });

    it("should not call onUpdate when result has no data and no error", async () => {
      // Covers line 87 false branch: `if (result.data)` when result.data is
      // falsy but result.error is also falsy (e.g. an empty success response).
      mockUpdateFeatureFlagConfig.mockResolvedValue({});

      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const saveButton = screen.getByRole("button", { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateFeatureFlagConfig).toHaveBeenCalled();
      });

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it("should disable Save button while saving", async () => {
      let resolvePromise: (value: unknown) => void;
      mockUpdateFeatureFlagConfig.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Resolve the promise
      resolvePromise!({ data: flag });
    });
  });

  describe("edge cases", () => {
    it("should handle missing config gracefully", () => {
      const flagWithNoConfig: FeatureFlag = {
        id: "flag-1",
        flagKey: "visitor_voice_agent",
        enabled: true,
        label: "Visitor Voice Agent",
        description: null,
        config: {},
        environment: "development",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };
      render(<VisitorVoiceConfigPanel flag={flagWithNoConfig} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/No whitelisted emails/i)).toBeInTheDocument();
    });

    it("should trim whitespace from email input", async () => {
      const flag = makeMockFlag({ whitelisted_emails: [], agent_id: "" });
      render(<VisitorVoiceConfigPanel flag={flag} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(input, "  trimmed@example.com  ");

      const addButton = screen.getByRole("button", { name: /Add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("trimmed@example.com")).toBeInTheDocument();
      });
    });
  });
});
