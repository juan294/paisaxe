import { useState, useEffect, useRef } from "react";
import { triggerAgentRun, fetchRunningAgents, stopAgent } from "@/lib/admin-api";

interface UseAgentRunnerOptions {
  onAgentsFinished: () => void;
}

export function useAgentRunner({ onAgentsFinished }: UseAgentRunnerOptions) {
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track last run results per agent for card display
  const [lastRunResults, setLastRunResults] = useState<Record<string, {
    status: "success" | "error" | "stopped";
    time: string;
  }>>({});

  // Poll running agents when any are active
  useEffect(() => {
    if (runningAgents.size === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const result = await fetchRunningAgents();
      if (!result.data) return;

      const stillRunning = new Set(Object.keys(result.data.running));
      const justFinished = [...runningAgents].filter((k) => !stillRunning.has(k));

      if (justFinished.length > 0) {
        onAgentsFinished();
      }

      setRunningAgents(stillRunning);
    };

    pollingRef.current = setInterval(poll, 10_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningAgents.size]);

  const handleRunAgent = async (agentKey: string) => {
    const result = await triggerAgentRun(agentKey);
    if (result.data?.started) {
      setRunningAgents((prev) => new Set([...prev, agentKey]));
      return { started: true, startedAt: result.data.startedAt };
    }
    return { started: false, startedAt: null };
  };

  const handleStopAgent = async (agentKey: string) => {
    await stopAgent(agentKey);
    setRunningAgents((prev) => {
      const next = new Set(prev);
      next.delete(agentKey);
      return next;
    });
  };

  const recordRunResult = (agentKey: string, status: "success" | "error" | "stopped") => {
    setLastRunResults((prev) => ({
      ...prev,
      [agentKey]: { status, time: new Date().toISOString() },
    }));
  };

  return {
    runningAgents,
    lastRunResults,
    handleRunAgent,
    handleStopAgent,
    recordRunResult,
  };
}
