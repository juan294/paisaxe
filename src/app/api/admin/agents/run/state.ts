import type { ChildProcess } from "child_process";
import type { AgentLogLine } from "@/types/agents-dashboard";

export interface RunningAgent {
  pid: number;
  startedAt: string;
  logs: AgentLogLine[];
  process: ChildProcess;
  finished: boolean;
  exitCode: number | null;
  stoppedByUser: boolean;
  finishedAt: number | null;
}

/** In-memory tracking of running agent processes. */
export const runningAgents = new Map<string, RunningAgent>();

/** Test-only: clear all agent state between test cases. */
export function resetRunningAgentsForTests() {
  runningAgents.clear();
}
