import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentTerminal } from "./terminal-display";
import type { AgentLogLine } from "@/types/agents-dashboard";

const baseLogs: AgentLogLine[] = [
  { timestamp: "2026-02-16T12:00:00Z", text: "Starting agent..." },
  { timestamp: "2026-02-16T12:00:01Z", text: "Processing data" },
  { timestamp: "2026-02-16T12:00:02Z", text: "Done" },
];

const defaultProps = {
  agentKey: "coverage_agent_enabled",
  agentName: "Coverage Agent",
  logs: baseLogs,
  finished: false,
  exitCode: null,
  stoppedByUser: false,
  startedAt: "2026-02-16T12:00:00Z",
  onClose: vi.fn(),
};

describe("AgentTerminal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T12:01:00Z"));
    defaultProps.onClose.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the agent name in the header", () => {
      render(<AgentTerminal {...defaultProps} />);
      expect(screen.getByText("Coverage Agent")).toBeInTheDocument();
    });

    it("renders log lines", () => {
      render(<AgentTerminal {...defaultProps} />);
      expect(screen.getByText("Starting agent...")).toBeInTheDocument();
      expect(screen.getByText("Processing data")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("renders timestamps for each log line", () => {
      render(<AgentTerminal {...defaultProps} />);
      // Each log line should have a timestamp element
      const timestamps = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timestamps.length).toBeGreaterThanOrEqual(3);
    });

    it("renders 'Waiting for output...' when logs are empty", () => {
      render(<AgentTerminal {...defaultProps} logs={[]} />);
      expect(screen.getByText("Waiting for output...")).toBeInTheDocument();
    });

    it("renders copy button with correct aria-label", () => {
      render(<AgentTerminal {...defaultProps} />);
      expect(screen.getByLabelText("Copy terminal output")).toBeInTheDocument();
    });

    it("renders close button with correct aria-label", () => {
      render(<AgentTerminal {...defaultProps} />);
      expect(screen.getByLabelText("Close terminal")).toBeInTheDocument();
    });
  });

  describe("status labels", () => {
    it("shows 'Running...' when not finished", () => {
      render(<AgentTerminal {...defaultProps} finished={false} />);
      expect(screen.getByText("Running...")).toBeInTheDocument();
    });

    it("shows 'Completed' when finished with exit code 0", () => {
      render(
        <AgentTerminal {...defaultProps} finished={true} exitCode={0} />
      );
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });

    it("shows 'Completed' when finished with null exit code", () => {
      render(
        <AgentTerminal {...defaultProps} finished={true} exitCode={null} />
      );
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });

    it("shows 'Failed (exit N)' when finished with non-zero exit code", () => {
      render(
        <AgentTerminal {...defaultProps} finished={true} exitCode={1} />
      );
      expect(screen.getByText("Failed (exit 1)")).toBeInTheDocument();
    });

    it("shows 'Failed (exit 127)' for exit code 127", () => {
      render(
        <AgentTerminal {...defaultProps} finished={true} exitCode={127} />
      );
      expect(screen.getByText("Failed (exit 127)")).toBeInTheDocument();
    });

    it("shows 'Stopped' when stopped by user", () => {
      render(
        <AgentTerminal
          {...defaultProps}
          finished={true}
          stoppedByUser={true}
          exitCode={1}
        />
      );
      expect(screen.getByText("Stopped")).toBeInTheDocument();
    });

    it("shows 'Stopped' when stopped by user (takes precedence over failed)", () => {
      render(
        <AgentTerminal
          {...defaultProps}
          finished={true}
          stoppedByUser={true}
          exitCode={130}
        />
      );
      // stoppedByUser takes priority over failure display
      expect(screen.getByText("Stopped")).toBeInTheDocument();
      expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
    });
  });

  describe("running animation dot", () => {
    it("shows pulsing dot when running", () => {
      const { container } = render(
        <AgentTerminal {...defaultProps} finished={false} />
      );
      const pulseDot = container.querySelector(".animate-pulse");
      expect(pulseDot).toBeInTheDocument();
    });

    it("does not show pulsing dot when finished", () => {
      const { container } = render(
        <AgentTerminal {...defaultProps} finished={true} exitCode={0} />
      );
      const pulseDot = container.querySelector(".animate-pulse");
      expect(pulseDot).not.toBeInTheDocument();
    });
  });

  describe("stderr styling", () => {
    it("applies red color class to stderr lines", () => {
      const stderrLogs: AgentLogLine[] = [
        { timestamp: "2026-02-16T12:00:00Z", text: "[stderr] Error occurred" },
      ];
      render(
        <AgentTerminal {...defaultProps} logs={stderrLogs} />
      );
      const stderrSpan = screen.getByText("[stderr] Error occurred");
      expect(stderrSpan.className).toContain("text-[#c97a7a]");
    });

    it("applies normal color class to stdout lines", () => {
      const stdoutLogs: AgentLogLine[] = [
        { timestamp: "2026-02-16T12:00:00Z", text: "Normal output" },
      ];
      render(<AgentTerminal {...defaultProps} logs={stdoutLogs} />);
      const stdoutSpan = screen.getByText("Normal output");
      expect(stdoutSpan.className).toContain("text-[#d4d0ca]");
    });
  });

  describe("elapsed time", () => {
    it("shows elapsed time", () => {
      render(<AgentTerminal {...defaultProps} />);
      // startedAt is 1 minute ago from the fake timer
      expect(screen.getByText("1:00")).toBeInTheDocument();
    });

    it("shows 0:00 when startedAt is null", () => {
      render(<AgentTerminal {...defaultProps} startedAt={null} />);
      expect(screen.getByText("0:00")).toBeInTheDocument();
    });

    it("updates elapsed time on interval when running", () => {
      render(
        <AgentTerminal
          {...defaultProps}
          finished={false}
          startedAt="2026-02-16T12:00:00Z"
        />
      );

      expect(screen.getByText("1:00")).toBeInTheDocument();

      // Advance 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText("1:05")).toBeInTheDocument();
    });

    it("stops updating elapsed time when finished", () => {
      const { rerender } = render(
        <AgentTerminal
          {...defaultProps}
          finished={false}
          startedAt="2026-02-16T12:00:00Z"
        />
      );

      expect(screen.getByText("1:00")).toBeInTheDocument();

      // Mark as finished
      rerender(
        <AgentTerminal
          {...defaultProps}
          finished={true}
          exitCode={0}
          startedAt="2026-02-16T12:00:00Z"
        />
      );

      // Advance time - should not change further (frozen at final value)
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // It computes final elapsed on mount when finished, so it should be 1:00
      expect(screen.getByText("1:00")).toBeInTheDocument();
    });
  });

  describe("close button", () => {
    it("calls onClose when close button is clicked", async () => {
      vi.useRealTimers(); // userEvent needs real timers
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<AgentTerminal {...defaultProps} onClose={onClose} />);
      await user.click(screen.getByLabelText("Close terminal"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("copy button", () => {
    it("copies terminal output to clipboard and shows confirmation", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      const { container } = render(<AgentTerminal {...defaultProps} />);

      // Before clicking: Copy icon is shown (lucide-copy), not Check icon
      expect(container.querySelector(".lucide-copy")).toBeInTheDocument();
      expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();

      await user.click(screen.getByLabelText("Copy terminal output"));

      // After clicking: Check icon appears confirming copy succeeded
      await waitFor(() => {
        expect(container.querySelector(".lucide-check")).toBeInTheDocument();
      });
    });

    it("shows copy icon again for empty logs (copy still triggers)", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      const { container } = render(<AgentTerminal {...defaultProps} logs={[]} />);

      expect(container.querySelector(".lucide-copy")).toBeInTheDocument();

      await user.click(screen.getByLabelText("Copy terminal output"));

      // Check icon appears confirming clipboard write resolved
      await waitFor(() => {
        expect(container.querySelector(".lucide-check")).toBeInTheDocument();
      });
    });

    it("resets check icon back to copy icon after 2s timeout (line 91)", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      const { container } = render(<AgentTerminal {...defaultProps} />);

      // Before clicking: Copy icon is shown
      expect(container.querySelector(".lucide-copy")).toBeInTheDocument();

      // Click copy button
      await user.click(screen.getByLabelText("Copy terminal output"));

      // After clicking: Check icon appears
      await waitFor(() => {
        expect(container.querySelector(".lucide-check")).toBeInTheDocument();
      });

      // Wait for the 2s setTimeout callback at line 91 to fire
      await waitFor(
        () => {
          expect(container.querySelector(".lucide-copy")).toBeInTheDocument();
          expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("auto-scroll", () => {
    it("scrolls to bottom when logs change", () => {
      const { rerender } = render(<AgentTerminal {...defaultProps} logs={[]} />);

      // Rerender with new logs — the useEffect should fire
      rerender(
        <AgentTerminal
          {...defaultProps}
          logs={[
            { timestamp: "2026-02-16T12:00:00Z", text: "New log line" },
          ]}
        />
      );

      // In jsdom, scrollTop and scrollHeight are 0, but we verify
      // the component doesn't crash and renders the new log
      expect(screen.getByText("New log line")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("renders with a single log line", () => {
      const singleLog: AgentLogLine[] = [
        { timestamp: "2026-02-16T12:00:00Z", text: "Only line" },
      ];
      render(<AgentTerminal {...defaultProps} logs={singleLog} />);
      expect(screen.getByText("Only line")).toBeInTheDocument();
    });

    it("renders with many log lines", () => {
      const manyLogs: AgentLogLine[] = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        text: `Line ${i}`,
      }));
      render(<AgentTerminal {...defaultProps} logs={manyLogs} />);
      expect(screen.getByText("Line 0")).toBeInTheDocument();
      expect(screen.getByText("Line 99")).toBeInTheDocument();
    });

    it("handles log line text with special characters", () => {
      const specialLogs: AgentLogLine[] = [
        { timestamp: "2026-02-16T12:00:00Z", text: "Error: <div> & 'quotes'" },
      ];
      render(<AgentTerminal {...defaultProps} logs={specialLogs} />);
      expect(
        screen.getByText("Error: <div> & 'quotes'")
      ).toBeInTheDocument();
    });

    it("handles multiline text in a log line", () => {
      const multilineLogs: AgentLogLine[] = [
        {
          timestamp: "2026-02-16T12:00:00Z",
          text: "line1\nline2\nline3",
        },
      ];
      render(<AgentTerminal {...defaultProps} logs={multilineLogs} />);
      // whitespace-pre-wrap preserves newlines in a single span
      const span = screen.getByText((_content, element) => {
        return element?.textContent === "line1\nline2\nline3";
      });
      expect(span).toBeInTheDocument();
    });
  });
});
