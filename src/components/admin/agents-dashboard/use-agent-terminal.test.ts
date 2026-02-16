import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentTerminal } from "./use-agent-terminal";

vi.mock("@/lib/admin-api", () => ({
  fetchAgentLogs: vi.fn(),
}));

import { fetchAgentLogs } from "@/lib/admin-api";

const mockFetchAgentLogs = vi.mocked(fetchAgentLogs);

describe("useAgentTerminal", () => {
  const onFinished = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with no active terminal", () => {
    const { result } = renderHook(() => useAgentTerminal({ onFinished }));

    expect(result.current.activeTerminal).toBeNull();
    expect(result.current.terminalLogs).toEqual([]);
    expect(result.current.terminalFinished).toBe(false);
    expect(result.current.terminalExitCode).toBeNull();
    expect(result.current.terminalStoppedByUser).toBe(false);
    expect(result.current.terminalStartedAt).toBeNull();
  });

  it("works without options", () => {
    const { result } = renderHook(() => useAgentTerminal());
    expect(result.current.activeTerminal).toBeNull();
  });

  describe("openTerminal", () => {
    it("sets activeTerminal and startedAt", async () => {
      mockFetchAgentLogs.mockResolvedValue({
        data: { logs: [], offset: 0, finished: false, exitCode: null, stoppedByUser: false },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      expect(result.current.activeTerminal).toBe("coverage_agent_enabled");
      expect(result.current.terminalStartedAt).toBe("2026-02-16T12:00:00Z");
    });

    it("resets state when opening a new terminal", async () => {
      mockFetchAgentLogs.mockResolvedValue({
        data: { logs: [], offset: 0, finished: false, exitCode: null, stoppedByUser: false },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("agent_a", "2026-02-16T12:00:00Z");
      });

      expect(result.current.terminalLogs).toEqual([]);
      expect(result.current.terminalFinished).toBe(false);
      expect(result.current.terminalExitCode).toBeNull();
      expect(result.current.terminalStoppedByUser).toBe(false);
    });

    it("triggers immediate log fetch on open", async () => {
      mockFetchAgentLogs.mockResolvedValue({
        data: {
          logs: [{ timestamp: "2026-02-16T12:00:01Z", text: "Starting..." }],
          offset: 1,
          finished: false,
          exitCode: null,
          stoppedByUser: false,
        },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      expect(mockFetchAgentLogs).toHaveBeenCalledWith("coverage_agent_enabled", 0);
      expect(result.current.terminalLogs).toEqual([
        { timestamp: "2026-02-16T12:00:01Z", text: "Starting..." },
      ]);
    });
  });

  describe("closeTerminal", () => {
    it("resets all terminal state", async () => {
      mockFetchAgentLogs.mockResolvedValue({
        data: {
          logs: [{ timestamp: "2026-02-16T12:00:01Z", text: "Starting..." }],
          offset: 1,
          finished: false,
          exitCode: null,
          stoppedByUser: false,
        },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      // Open terminal
      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      // Close terminal
      act(() => {
        result.current.closeTerminal();
      });

      expect(result.current.activeTerminal).toBeNull();
      expect(result.current.terminalLogs).toEqual([]);
      expect(result.current.terminalFinished).toBe(false);
      expect(result.current.terminalExitCode).toBeNull();
      expect(result.current.terminalStoppedByUser).toBe(false);
      expect(result.current.terminalStartedAt).toBeNull();
    });
  });

  describe("log polling", () => {
    it("accumulates logs from multiple polls", async () => {
      mockFetchAgentLogs
        .mockResolvedValueOnce({
          data: {
            logs: [{ timestamp: "T1", text: "Line 1" }],
            offset: 1,
            finished: false,
            exitCode: null,
            stoppedByUser: false,
          },
        })
        .mockResolvedValueOnce({
          data: {
            logs: [{ timestamp: "T2", text: "Line 2" }],
            offset: 2,
            finished: false,
            exitCode: null,
            stoppedByUser: false,
          },
        });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      // Open triggers first fetch
      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      expect(result.current.terminalLogs).toHaveLength(1);

      // Advance to next poll
      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });

      expect(result.current.terminalLogs).toHaveLength(2);
      expect(result.current.terminalLogs[1].text).toBe("Line 2");
    });

    it("skips appending when no new logs", async () => {
      mockFetchAgentLogs
        .mockResolvedValueOnce({
          data: {
            logs: [{ timestamp: "T1", text: "Line 1" }],
            offset: 1,
            finished: false,
            exitCode: null,
            stoppedByUser: false,
          },
        })
        .mockResolvedValueOnce({
          data: {
            logs: [],
            offset: 1,
            finished: false,
            exitCode: null,
            stoppedByUser: false,
          },
        });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });

      // Should still only have 1 log line
      expect(result.current.terminalLogs).toHaveLength(1);
    });

    it("handles finished with exit code", async () => {
      mockFetchAgentLogs.mockResolvedValueOnce({
        data: {
          logs: [{ timestamp: "T1", text: "Done!" }],
          offset: 1,
          finished: true,
          exitCode: 0,
          stoppedByUser: false,
        },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      expect(result.current.terminalFinished).toBe(true);
      expect(result.current.terminalExitCode).toBe(0);
      expect(result.current.terminalStoppedByUser).toBe(false);
      expect(onFinished).toHaveBeenCalledWith("coverage_agent_enabled", 0, false);
    });

    it("handles finished with stoppedByUser", async () => {
      mockFetchAgentLogs.mockResolvedValueOnce({
        data: {
          logs: [],
          offset: 0,
          finished: true,
          exitCode: 137,
          stoppedByUser: true,
        },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      expect(result.current.terminalFinished).toBe(true);
      expect(result.current.terminalExitCode).toBe(137);
      expect(result.current.terminalStoppedByUser).toBe(true);
      expect(onFinished).toHaveBeenCalledWith("coverage_agent_enabled", 137, true);
    });

    it("stops polling after stream finishes", async () => {
      mockFetchAgentLogs.mockResolvedValueOnce({
        data: {
          logs: [{ timestamp: "T1", text: "Done!" }],
          offset: 1,
          finished: true,
          exitCode: 0,
          stoppedByUser: false,
        },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      mockFetchAgentLogs.mockClear();

      // Advance several poll intervals
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      // Should not have polled again after finishing
      expect(mockFetchAgentLogs).not.toHaveBeenCalled();
    });

    it("handles fetchAgentLogs returning no data", async () => {
      mockFetchAgentLogs.mockResolvedValue({ error: "Network error" });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      // Should not crash, logs should remain empty
      expect(result.current.terminalLogs).toEqual([]);
      expect(result.current.terminalFinished).toBe(false);
    });

    it("clears polling interval when terminal is closed", async () => {
      mockFetchAgentLogs.mockResolvedValue({
        data: {
          logs: [],
          offset: 0,
          finished: false,
          exitCode: null,
          stoppedByUser: false,
        },
      });

      const { result } = renderHook(() => useAgentTerminal({ onFinished }));

      await act(async () => {
        result.current.openTerminal("coverage_agent_enabled", "2026-02-16T12:00:00Z");
      });

      // Close terminal to trigger cleanup
      act(() => {
        result.current.closeTerminal();
      });

      mockFetchAgentLogs.mockClear();

      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      // Should not poll after close
      expect(mockFetchAgentLogs).not.toHaveBeenCalled();
    });
  });
});
