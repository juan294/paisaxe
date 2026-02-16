import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddCostModal, EditCostModal } from "./modals";
import type { ServiceCost } from "@/types/costs-analytics";

describe("AddCostModal", () => {
  const defaultProps = {
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    dateRange: { from: "2026-02-01", to: "2026-02-28" },
  };

  it("renders the modal title", () => {
    render(<AddCostModal {...defaultProps} />);
    expect(screen.getByText("Add Manual Cost")).toBeInTheDocument();
  });

  it("renders the form fields", () => {
    render(<AddCostModal {...defaultProps} />);
    expect(screen.getByLabelText("Service")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Cost (USD)")).toBeInTheDocument();
    expect(screen.getByLabelText("Period Start")).toBeInTheDocument();
    expect(screen.getByLabelText("Period End")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes (optional)")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<AddCostModal {...defaultProps} />);

    await user.click(screen.getByLabelText("Close add cost modal"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<AddCostModal {...defaultProps} />);

    await user.click(screen.getByText("Cancel"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("pre-fills service name when selecting a known service", async () => {
    const user = userEvent.setup();
    render(<AddCostModal {...defaultProps} />);

    await user.selectOptions(screen.getByLabelText("Service"), "anthropic");

    // The category select should now show "AI"
    const categorySelect = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(categorySelect.value).toBe("ai");
  });

  it("shows custom fields when 'custom' is selected", async () => {
    const user = userEvent.setup();
    render(<AddCostModal {...defaultProps} />);

    await user.selectOptions(screen.getByLabelText("Service"), "custom");

    expect(screen.getByLabelText("Service ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Service Name")).toBeInTheDocument();
  });

  it("submits form data on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddCostModal {...defaultProps} onSubmit={onSubmit} />);

    // Select a service
    await user.selectOptions(screen.getByLabelText("Service"), "anthropic");

    // Set cost
    const costInput = screen.getByLabelText("Cost (USD)");
    await user.clear(costInput);
    await user.type(costInput, "25.50");

    // Submit
    await user.click(screen.getByText("Add Cost"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0][0];
    expect(submittedData.serviceId).toBe("anthropic");
    expect(submittedData.serviceName).toBe("Anthropic Claude");
    expect(submittedData.category).toBe("ai");
    expect(submittedData.costUsd).toBe(25.5);
  });

  it("shows 'Adding...' while submitting", async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );
    render(<AddCostModal {...defaultProps} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText("Service"), "anthropic");
    await user.click(screen.getByText("Add Cost"));

    expect(screen.getByText("Adding...")).toBeInTheDocument();

    resolveSubmit!();
    await waitFor(() => {
      expect(screen.getByText("Add Cost")).toBeInTheDocument();
    });
  });

  it("initializes date range from props", () => {
    render(<AddCostModal {...defaultProps} />);

    const startInput = screen.getByLabelText("Period Start") as HTMLInputElement;
    const endInput = screen.getByLabelText("Period End") as HTMLInputElement;

    expect(startInput.value).toBe("2026-02-01");
    expect(endInput.value).toBe("2026-02-28");
  });
});

describe("EditCostModal", () => {
  const mockCost: ServiceCost = {
    serviceId: "anthropic",
    serviceName: "Anthropic Claude",
    category: "ai",
    costUsd: 15.99,
    costFormatted: "$15.99",
    source: "manual",
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd: "2026-02-28",
    notes: "Test notes",
  };

  const defaultProps = {
    cost: mockCost,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  it("renders the modal with service name", () => {
    render(<EditCostModal {...defaultProps} />);
    expect(screen.getByText("Edit Cost: Anthropic Claude")).toBeInTheDocument();
  });

  it("pre-fills cost and notes from existing cost", () => {
    render(<EditCostModal {...defaultProps} />);

    const costInput = screen.getByLabelText("Cost (USD)") as HTMLInputElement;
    const notesInput = screen.getByLabelText("Notes") as HTMLTextAreaElement;

    expect(costInput.value).toBe("15.99");
    expect(notesInput.value).toBe("Test notes");
  });

  it("handles cost with no notes", () => {
    const costWithoutNotes = { ...mockCost, notes: undefined };
    render(<EditCostModal {...defaultProps} cost={costWithoutNotes} />);

    const notesInput = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(notesInput.value).toBe("");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditCostModal {...defaultProps} />);

    await user.click(screen.getByLabelText("Close edit cost modal"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditCostModal {...defaultProps} />);

    await user.click(screen.getByText("Cancel"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("submits updated cost and notes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditCostModal {...defaultProps} onSave={onSave} />);

    const costInput = screen.getByLabelText("Cost (USD)");
    await user.clear(costInput);
    await user.type(costInput, "29.99");

    const notesInput = screen.getByLabelText("Notes");
    await user.clear(notesInput);
    await user.type(notesInput, "Updated notes");

    await user.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        "anthropic-2026-02-01",
        { costUsd: 29.99, notes: "Updated notes" }
      );
    });
  });

  it("shows 'Saving...' while submitting", async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const onSave = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );
    render(<EditCostModal {...defaultProps} onSave={onSave} />);

    await user.click(screen.getByText("Save Changes"));

    expect(screen.getByText("Saving...")).toBeInTheDocument();

    resolveSubmit!();
    await waitFor(() => {
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });
  });
});
