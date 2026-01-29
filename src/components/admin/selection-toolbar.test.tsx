import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectionToolbar } from "./selection-toolbar";

describe("SelectionToolbar", () => {
  const defaultProps = {
    selectedCount: 3,
    onMarkApproved: vi.fn(),
    onMarkPending: vi.fn(),
    onClearSelection: vi.fn(),
  };

  it("should not render when selectedCount is 0", () => {
    render(<SelectionToolbar {...defaultProps} selectedCount={0} />);
    expect(screen.queryByText("selected")).not.toBeInTheDocument();
  });

  it("should render selection count", () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("should render Mark Approved button", () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /mark approved/i })).toBeInTheDocument();
  });

  it("should render Mark Pending button", () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /mark pending/i })).toBeInTheDocument();
  });

  it("should call onMarkApproved when clicking Mark Approved", () => {
    const onMarkApproved = vi.fn();
    render(<SelectionToolbar {...defaultProps} onMarkApproved={onMarkApproved} />);

    fireEvent.click(screen.getByRole("button", { name: /mark approved/i }));
    expect(onMarkApproved).toHaveBeenCalledTimes(1);
  });

  it("should call onMarkPending when clicking Mark Pending", () => {
    const onMarkPending = vi.fn();
    render(<SelectionToolbar {...defaultProps} onMarkPending={onMarkPending} />);

    fireEvent.click(screen.getByRole("button", { name: /mark pending/i }));
    expect(onMarkPending).toHaveBeenCalledTimes(1);
  });

  it("should call onClearSelection when clicking X button", () => {
    const onClearSelection = vi.fn();
    render(<SelectionToolbar {...defaultProps} onClearSelection={onClearSelection} />);

    // Find the X button (it's next to the selection count)
    const buttons = screen.getAllByRole("button");
    const clearButton = buttons.find(btn => !btn.textContent?.includes("Mark"));
    expect(clearButton).toBeDefined();

    fireEvent.click(clearButton!);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("should disable buttons when loading", () => {
    render(<SelectionToolbar {...defaultProps} isLoading />);

    expect(screen.getByRole("button", { name: /mark approved/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /mark pending/i })).toBeDisabled();
  });

  it("should update count when selectedCount changes", () => {
    const { rerender } = render(<SelectionToolbar {...defaultProps} selectedCount={5} />);
    expect(screen.getByText("5 selected")).toBeInTheDocument();

    rerender(<SelectionToolbar {...defaultProps} selectedCount={10} />);
    expect(screen.getByText("10 selected")).toBeInTheDocument();
  });
});
