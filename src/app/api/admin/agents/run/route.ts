import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import type { AgentLogLine } from "@/types/agents-dashboard";

const AGENT_SCRIPTS: Record<string, string> = {
  coverage_agent_enabled: "scripts/coverage-agent.sh",
  security_agent_enabled: "scripts/security-agent.sh",
  documentation_agent_enabled: "scripts/documentation-agent.sh",
  performance_agent_enabled: "scripts/performance-agent.sh",
  qa_agent_enabled: "scripts/qa-agent.sh",
  localization_agent_enabled: "scripts/localization-agent.sh",
  cost_analyst_agent_enabled: "scripts/cost-analyst-agent.sh",
};

const MAX_LOG_LINES = 500;

interface RunningAgent {
  pid: number;
  startedAt: string;
  logs: AgentLogLine[];
  process: ChildProcess;
  finished: boolean;
}

/** In-memory tracking of running agent processes. */
const runningAgents = new Map<string, RunningAgent>();

/** Strip ANSI escape codes from a string. */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Append a line to an agent's log buffer, enforcing the ring buffer limit. */
function appendLog(agent: RunningAgent, text: string) {
  agent.logs.push({ timestamp: new Date().toISOString(), text: stripAnsi(text) });
  if (agent.logs.length > MAX_LOG_LINES) {
    agent.logs.splice(0, agent.logs.length - MAX_LOG_LINES);
  }
}

/**
 * POST: Start an agent run.
 * Body: { agentKey: string }
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;

  if (process.env.NODE_ENV !== "development" && !process.env.ALLOW_AGENT_RUN) {
    return NextResponse.json(
      { error: "Agent runs are only allowed in development" },
      { status: 403 },
    );
  }

  let body: { agentKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentKey } = body;
  if (!agentKey || !AGENT_SCRIPTS[agentKey]) {
    return NextResponse.json(
      { error: `Unknown agent key: ${agentKey}` },
      { status: 400 },
    );
  }

  // Check if already running
  const existing = runningAgents.get(agentKey);
  if (existing && !existing.finished) {
    // Verify the process is still alive
    try {
      process.kill(existing.pid, 0);
      return NextResponse.json(
        { error: "Agent is already running", startedAt: existing.startedAt },
        { status: 409 },
      );
    } catch {
      // Process died without us noticing — mark as finished
      existing.finished = true;
    }
  }

  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, AGENT_SCRIPTS[agentKey]);
  const startedAt = new Date().toISOString();

  const child = spawn("bash", [scriptPath], {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.unref();

  if (!child.pid) {
    return NextResponse.json(
      { error: "Failed to start agent process" },
      { status: 500 },
    );
  }

  const agent: RunningAgent = {
    pid: child.pid,
    startedAt,
    logs: [],
    process: child,
    finished: false,
  };

  // Listen to stdout/stderr and push to ring buffer
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) appendLog(agent, line);
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) appendLog(agent, `[stderr] ${line}`);
    }
  });

  // Clean up when process exits
  child.on("exit", (code) => {
    // Flush remaining buffers
    if (stdoutBuffer.trim()) appendLog(agent, stdoutBuffer);
    if (stderrBuffer.trim()) appendLog(agent, `[stderr] ${stderrBuffer}`);
    appendLog(agent, `Process exited with code ${code ?? "unknown"}`);
    agent.finished = true;
  });

  runningAgents.set(agentKey, agent);

  return NextResponse.json({ started: true, agentKey, startedAt });
}

/**
 * GET: Check which agents are currently running, and optionally fetch logs.
 * Query params:
 *   - agentKey: string — fetch logs for this specific agent
 *   - since: number — return logs starting from this offset (0-based)
 */
export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;

  const { searchParams } = request.nextUrl;
  const agentKey = searchParams.get("agentKey");
  const sinceParam = searchParams.get("since");

  // If requesting logs for a specific agent
  if (agentKey) {
    const agent = runningAgents.get(agentKey);
    if (!agent) {
      return NextResponse.json({ logs: [], offset: 0, finished: true });
    }

    const since = sinceParam ? parseInt(sinceParam, 10) : 0;
    const logs = agent.logs.slice(since);

    return NextResponse.json({
      logs,
      offset: agent.logs.length,
      finished: agent.finished,
    });
  }

  // Default: return running status (backwards compatible)
  const running: Record<string, { startedAt: string }> = {};

  for (const [key, agent] of runningAgents) {
    if (agent.finished) continue;
    try {
      process.kill(agent.pid, 0);
      running[key] = { startedAt: agent.startedAt };
    } catch {
      // Process no longer alive — mark finished
      agent.finished = true;
    }
  }

  return NextResponse.json({ running });
}

/**
 * DELETE: Stop a running agent.
 * Body: { agentKey: string }
 */
export async function DELETE(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;

  let body: { agentKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentKey } = body;
  if (!agentKey) {
    return NextResponse.json({ error: "agentKey is required" }, { status: 400 });
  }

  const agent = runningAgents.get(agentKey);
  if (!agent || agent.finished) {
    return NextResponse.json({ error: "Agent is not running" }, { status: 404 });
  }

  try {
    // Kill the process group (negative PID kills the group since we used detached: true)
    process.kill(-agent.pid, "SIGTERM");
  } catch {
    // Process may have already exited
    try {
      process.kill(agent.pid, "SIGTERM");
    } catch {
      // Already dead
    }
  }

  appendLog(agent, "Process stopped by user");
  agent.finished = true;

  return NextResponse.json({ stopped: true, agentKey });
}
