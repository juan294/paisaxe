import { useState, useEffect, useRef } from "react";
import { fetchAgentLogs } from "@/lib/admin-api";
import type { AgentLogLine } from "@/types/agents-dashboard";

interface UseAgentTerminalOptions {
  onFinished?: (agentKey: string, exitCode: number | null, stoppedByUser: boolean) => void;
}

export function useAgentTerminal({ onFinished }: UseAgentTerminalOptions = {}) {
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<AgentLogLine[]>([]);
  const [terminalOffset, setTerminalOffset] = useState(0);
  const [terminalFinished, setTerminalFinished] = useState(false);
  const [terminalExitCode, setTerminalExitCode] = useState<number | null>(null);
  const [terminalStoppedByUser, setTerminalStoppedByUser] = useState(false);
  const [terminalStartedAt, setTerminalStartedAt] = useState<string | null>(null);
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll logs for the active terminal
  useEffect(() => {
    if (!activeTerminal) {
      if (logPollRef.current) {
        clearInterval(logPollRef.current);
        logPollRef.current = null;
      }
      return;
    }

    // Use a ref-stable offset for incremental fetching
    let currentOffset = terminalOffset;

    const pollLogs = async () => {
      const result = await fetchAgentLogs(activeTerminal, currentOffset);
      if (!result.data) return;

      if (result.data.logs.length > 0) {
        setTerminalLogs((prev) => [...prev, ...result.data!.logs]);
        currentOffset = result.data.offset;
        setTerminalOffset(result.data.offset);
      }

      if (result.data.finished) {
        setTerminalFinished(true);
        setTerminalExitCode(result.data.exitCode);
        setTerminalStoppedByUser(result.data.stoppedByUser);

        onFinished?.(activeTerminal, result.data.exitCode, result.data.stoppedByUser);

        if (logPollRef.current) {
          clearInterval(logPollRef.current);
          logPollRef.current = null;
        }
      }
    };

    // Immediate first fetch
    pollLogs();
    logPollRef.current = setInterval(pollLogs, 2_000);

    return () => {
      if (logPollRef.current) clearInterval(logPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTerminal]);

  const openTerminal = (agentKey: string, startedAt: string) => {
    setTerminalLogs([]);
    setTerminalOffset(0);
    setTerminalFinished(false);
    setTerminalExitCode(null);
    setTerminalStoppedByUser(false);
    setTerminalStartedAt(startedAt);
    setActiveTerminal(agentKey);
  };

  const closeTerminal = () => {
    setActiveTerminal(null);
    setTerminalLogs([]);
    setTerminalOffset(0);
    setTerminalFinished(false);
    setTerminalExitCode(null);
    setTerminalStoppedByUser(false);
    setTerminalStartedAt(null);
  };

  return {
    activeTerminal,
    terminalLogs,
    terminalFinished,
    terminalExitCode,
    terminalStoppedByUser,
    terminalStartedAt,
    openTerminal,
    closeTerminal,
  };
}
