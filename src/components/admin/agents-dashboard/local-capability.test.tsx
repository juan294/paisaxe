import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAgentRunner } from "./use-agent-runner";
import { useAgentTerminal } from "./use-agent-terminal";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("local capability with real API consumers", () => {
  it.each([403, 404])("stops status polling and further starts on %s", async (status) => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ started: true, agentKey: "qa_agent_enabled", startedAt: "now" }))
      .mockResolvedValue(Response.json({ error: "Unavailable" }, { status }));
    const onAgentsFinished = vi.fn();
    const { result } = renderHook(() => useAgentRunner({ onAgentsFinished }));
    await act(async () => { await result.current.handleRunAgent("qa_agent_enabled"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(result.current.unavailable).toBe(true);
    expect(result.current.runningAgents.size).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await result.current.handleRunAgent("qa_agent_enabled"); });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onAgentsFinished).not.toHaveBeenCalled();
  });

  it("stops log polling on an explicit local-only response and discloses recovery", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ localOnly: true, error: "Unavailable" }, { status: 403 }));
    const onFinished = vi.fn();
    const { result } = renderHook(() => useAgentTerminal({ onFinished }));
    await act(async () => { result.current.openTerminal("qa_agent_enabled", "now"); });
    expect(result.current.unavailable).toBe(true);
    expect(result.current.terminalLogs[0].text).toMatch(/desarrollo local/);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();
  });
});
