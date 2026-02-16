import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentRunner } from "./use-agent-runner";

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  triggerAgentRun: vi.fn(),
  fetchRunningAgents: vi.fn(),
  stopAgent: vi.fn(),
}));

import { triggerAgentRun, fetchRunningAgents, stopAgent } from "@/lib/admin-api";

const mockTriggerAgentRun = vi.mocked(triggerAgentRun);
const mockFetchRunningAgents = vi.mocked(fetchRunningAgents);
const mockStopAgent = vi.mocked(stopAgent);

describe("useAgentRunner", () => {
  const onAgentsFinished = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with empty running agents", () => {
    const { result } = renderHook(() =>
      useAgentRunner({ onAgentsFinished })
    );

    expect(result.current.runningAgents.size).toBe(0);
    expect(result.current.lastRunResults).toEqual({});
  });

  describe("handleRunAgent", () => {
    it("adds agent to running set on successful start", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: true, agentKey: "coverage_agent_enabled", startedAt: "2026-02-16T12:00:00Z" },
      });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      let runResult: { started: boolean; startedAt: string | null };
      await act(async () => {
        runResult = await result.current.handleRunAgent("coverage_agent_enabled");
      });

      expect(runResult!.started).toBe(true);
      expect(runResult!.startedAt).toBe("2026-02-16T12:00:00Z");
      expect(result.current.runningAgents.has("coverage_agent_enabled")).toBe(true);
    });

    it("returns started false when agent fails to start", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: false, agentKey: "coverage_agent_enabled", startedAt: "" },
      });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      let runResult: { started: boolean; startedAt: string | null };
      await act(async () => {
        runResult = await result.current.handleRunAgent("coverage_agent_enabled");
      });

      expect(runResult!.started).toBe(false);
      expect(runResult!.startedAt).toBeNull();
      expect(result.current.runningAgents.has("coverage_agent_enabled")).toBe(false);
    });

    it("returns started false when no data returned", async () => {
      mockTriggerAgentRun.mockResolvedValue({ error: "Network error" });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      let runResult: { started: boolean; startedAt: string | null };
      await act(async () => {
        runResult = await result.current.handleRunAgent("coverage_agent_enabled");
      });

      expect(runResult!.started).toBe(false);
      expect(runResult!.startedAt).toBeNull();
    });
  });

  describe("handleStopAgent", () => {
    it("removes agent from running set", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: true, agentKey: "coverage_agent_enabled", startedAt: "2026-02-16T12:00:00Z" },
      });
      mockStopAgent.mockResolvedValue({
        data: { stopped: true, agentKey: "coverage_agent_enabled" },
      });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      // First start the agent
      await act(async () => {
        await result.current.handleRunAgent("coverage_agent_enabled");
      });
      expect(result.current.runningAgents.has("coverage_agent_enabled")).toBe(true);

      // Then stop it
      await act(async () => {
        await result.current.handleStopAgent("coverage_agent_enabled");
      });
      expect(result.current.runningAgents.has("coverage_agent_enabled")).toBe(false);
    });
  });

  describe("recordRunResult", () => {
    it("records success result with timestamp", () => {
      vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      act(() => {
        result.current.recordRunResult("coverage_agent_enabled", "success");
      });

      expect(result.current.lastRunResults["coverage_agent_enabled"]).toEqual({
        status: "success",
        time: "2026-02-16T12:00:00.000Z",
      });
    });

    it("records error result", () => {
      vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      act(() => {
        result.current.recordRunResult("security_agent_enabled", "error");
      });

      expect(result.current.lastRunResults["security_agent_enabled"]?.status).toBe("error");
    });

    it("records stopped result", () => {
      vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      act(() => {
        result.current.recordRunResult("qa_agent_enabled", "stopped");
      });

      expect(result.current.lastRunResults["qa_agent_enabled"]?.status).toBe("stopped");
    });

    it("overwrites previous result for same agent", () => {
      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      act(() => {
        result.current.recordRunResult("coverage_agent_enabled", "error");
      });
      act(() => {
        result.current.recordRunResult("coverage_agent_enabled", "success");
      });

      expect(result.current.lastRunResults["coverage_agent_enabled"]?.status).toBe("success");
    });
  });

  describe("polling", () => {
    it("starts polling when agents are running", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: true, agentKey: "coverage_agent_enabled", startedAt: "2026-02-16T12:00:00Z" },
      });
      mockFetchRunningAgents.mockResolvedValue({
        data: { running: { coverage_agent_enabled: { startedAt: "2026-02-16T12:00:00Z" } } },
      });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      await act(async () => {
        await result.current.handleRunAgent("coverage_agent_enabled");
      });

      // Advance timer past the 10s poll interval
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      expect(mockFetchRunningAgents).toHaveBeenCalled();
    });

    it("calls onAgentsFinished when agents complete", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: true, agentKey: "coverage_agent_enabled", startedAt: "2026-02-16T12:00:00Z" },
      });
      // First poll: agent still running
      mockFetchRunningAgents
        .mockResolvedValueOnce({
          data: { running: { coverage_agent_enabled: { startedAt: "2026-02-16T12:00:00Z" } } },
        })
        // Second poll: agent finished
        .mockResolvedValueOnce({
          data: { running: {} },
        });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      await act(async () => {
        await result.current.handleRunAgent("coverage_agent_enabled");
      });

      // First poll - agent still running
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(onAgentsFinished).not.toHaveBeenCalled();

      // Second poll - agent finished
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      expect(onAgentsFinished).toHaveBeenCalledTimes(1);
    });

    it("handles fetchRunningAgents returning no data", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: true, agentKey: "coverage_agent_enabled", startedAt: "2026-02-16T12:00:00Z" },
      });
      mockFetchRunningAgents.mockResolvedValue({ error: "Network error" });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      await act(async () => {
        await result.current.handleRunAgent("coverage_agent_enabled");
      });

      // Should not throw when poll returns no data
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      // Agent should still be in running set since we couldn't confirm completion
      expect(result.current.runningAgents.has("coverage_agent_enabled")).toBe(true);
    });

    it("clears polling when no agents are running", async () => {
      mockTriggerAgentRun.mockResolvedValue({
        data: { started: true, agentKey: "coverage_agent_enabled", startedAt: "2026-02-16T12:00:00Z" },
      });
      mockStopAgent.mockResolvedValue({
        data: { stopped: true, agentKey: "coverage_agent_enabled" },
      });

      const { result } = renderHook(() =>
        useAgentRunner({ onAgentsFinished })
      );

      // Start agent
      await act(async () => {
        await result.current.handleRunAgent("coverage_agent_enabled");
      });

      // Stop agent
      await act(async () => {
        await result.current.handleStopAgent("coverage_agent_enabled");
      });

      // Clear mock call count
      mockFetchRunningAgents.mockClear();

      // Advance time - should NOT poll since no agents running
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });

      expect(mockFetchRunningAgents).not.toHaveBeenCalled();
    });
  });
});
