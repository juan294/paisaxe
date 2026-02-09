import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptimizerReportDialog } from "./optimizer-report-dialog";

describe("OptimizerReportDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <OptimizerReportDialog
        open={false}
        onOpenChange={vi.fn()}
        reportMarkdown="# Test"
        analyzedAt={null}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with report content when open", () => {
    render(
      <OptimizerReportDialog
        open={true}
        onOpenChange={vi.fn()}
        reportMarkdown="# Subscription Optimizer Report\n\n- Keep ElevenLabs"
        analyzedAt="2026-02-09T10:00:00.000Z"
      />
    );

    expect(screen.getByText("Subscription Optimizer Report")).toBeInTheDocument();
    expect(screen.getByText(/Keep ElevenLabs/)).toBeInTheDocument();
  });

  it("shows formatted timestamp when analyzedAt is provided", () => {
    render(
      <OptimizerReportDialog
        open={true}
        onOpenChange={vi.fn()}
        reportMarkdown="# Report"
        analyzedAt="2026-02-09T10:00:00.000Z"
      />
    );

    expect(screen.getByText(/Last analyzed/)).toBeInTheDocument();
  });

  it("shows no-report message when reportMarkdown is empty", () => {
    render(
      <OptimizerReportDialog
        open={true}
        onOpenChange={vi.fn()}
        reportMarkdown=""
        analyzedAt={null}
      />
    );

    expect(screen.getByText(/No report available/)).toBeInTheDocument();
  });

  it("calls onOpenChange when close button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <OptimizerReportDialog
        open={true}
        onOpenChange={onOpenChange}
        reportMarkdown="# Report"
        analyzedAt={null}
      />
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
