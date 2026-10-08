import { rejectUnsafeMutation } from "./request";
import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { spawn } from "child_process";
import path from "path";
import { logger } from "@/lib/logger";
import { sanitizeLogMessage } from "@/lib/logger-sanitize";
import { runningAgents, type RunningAgent } from "@/app/api/admin/agents/run/state";

/**
 * SE-L1 (#542): Explicit env allowlist for spawned agent scripts.
 *
 * Passing the whole `process.env` to a child process leaks every secret the
 * Next.js server holds (API keys, DB credentials, tokens) into the agent
 * subprocess and any process it spawns. The agent scripts only need a small,
 * well-known set of variables: PATH/HOME for the shell + Claude CLI, the
 * Anthropic key the headless CLI uses, and a couple of locale/runtime hints.
 */
const CHILD_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "SHELL",
  "USER",
  "LOGNAME",
  "TERM",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "NODE_ENV",
  "ANTHROPIC_API_KEY",
  "CLAUDE_CONFIG_DIR",
] as const;

/** Build the explicit, allowlisted environment for a spawned agent process. */
function buildChildEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {};
  // Iterate as plain strings so NODE_ENV (a read-only key on ProcessEnv) can be
  // assigned via a string index without a type error.
  for (const key of CHILD_ENV_ALLOWLIST as readonly string[]) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env as NodeJS.ProcessEnv;
}

/** Map agent flag keys to their script filenames (all live in scripts/). */
const AGENT_SCRIPTS: Record<string, string> = {
  coverage_agent_enabled: "coverage-agent.sh",
  security_agent_enabled: "security-agent.sh",
  documentation_agent_enabled: "documentation-agent.sh",
  performance_agent_enabled: "performance-agent.sh",
  qa_agent_enabled: "qa-agent.sh",
  localization_agent_enabled: "localization-agent.sh",
  cost_analyst_agent_enabled: "cost-analyst-agent.sh",
};

const MAX_LOG_LINES = 500;
const FINISHED_AGENT_TTL_MS = 60 * 60 * 1000;

/** Strip ANSI escape codes from a string. */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Append a line to an agent's log buffer, enforcing the ring buffer limit. */
function appendLog(agent: RunningAgent, text: string) {
  // SE-L1 (#542): scrub secrets (API keys, tokens, emails, …) from captured
  // subprocess output before it lands in the log buffer / admin UI.
  const safe = sanitizeLogMessage(stripAnsi(text));
  agent.logs.push({ timestamp: new Date().toISOString(), text: safe });
  if (agent.logs.length > MAX_LOG_LINES) {
    agent.logs.splice(0, agent.logs.length - MAX_LOG_LINES);
  }
}

function buildLocalOnlyResponse() {
  logger.warn("[AGENT_RUNNER]", {
    reason: "not_local",
    vercelEnv: process.env.VERCEL_ENV,
  });
  return NextResponse.json(
    { error: "Agent runs are only allowed in local development.", localOnly: true },
    { status: 403 }
  );
}

/** Runtime defense for the development implementation, also excluding hosted dev. */
function ensureLocalRuntime() {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL_ENV !== undefined) {
    return buildLocalOnlyResponse();
  }

  return null;
}

function markAgentFinished(agent: RunningAgent, code: number | null) {
  agent.exitCode = code;
  agent.finished = true;
  agent.finishedAt = Date.now();
}

function pruneFinishedAgents(now = Date.now()) {
  const cutoff = now - FINISHED_AGENT_TTL_MS;

  for (const [key, agent] of runningAgents) {
    if (agent.finishedAt !== null && agent.finishedAt < cutoff) {
      runningAgents.delete(key);
    }
  }
}

/**
 * POST: Start an agent run.
 * Body: { agentKey: string }
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth({ skipCache: true });
  if (!auth.valid) return auth.error;

  const localOnlyResponse = ensureLocalRuntime();
  if (localOnlyResponse) {
    return localOnlyResponse;
  }

  const csrfError = rejectUnsafeMutation(request);
  if (csrfError) return csrfError;

  let body: { agentKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentKey } = body;
  if (!agentKey || !Object.prototype.hasOwnProperty.call(AGENT_SCRIPTS, agentKey)) {
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
      markAgentFinished(existing, existing.exitCode);
      pruneFinishedAgents();
    }
  }

  // Use specific subdirectory to avoid Turbopack tracing the entire project root.
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "scripts", AGENT_SCRIPTS[agentKey]);
  const startedAt = new Date().toISOString();

  const child = spawn("bash", [scriptPath], {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    // SE-L1 (#542): pass an explicit allowlist, never the whole process env.
    env: buildChildEnv(),
  });

  // spawn failures emit asynchronously, including after a no-pid response.
  child.on("error", (error) => {
    logger.error("[AGENT_RUNNER] Failed to start agent process", { error: error.message });
    const failed = runningAgents.get(agentKey);
    if (failed?.process === child) {
      appendLog(failed, `Process failed: ${error.message}`);
      markAgentFinished(failed, null);
      pruneFinishedAgents();
    }
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
    exitCode: null,
    stoppedByUser: false,
    finishedAt: null,
  };

  // Listen to stdout/stderr and push to ring buffer
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop()!; // split() always returns >=1 element
    for (const line of lines) {
      if (line.trim()) appendLog(agent, line);
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop()!; // split() always returns >=1 element
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
    markAgentFinished(agent, code ?? null);
    pruneFinishedAgents();
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

  const localOnlyResponse = ensureLocalRuntime();
  if (localOnlyResponse) {
    return localOnlyResponse;
  }

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
      exitCode: agent.exitCode,
      stoppedByUser: agent.stoppedByUser,
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
      markAgentFinished(agent, agent.exitCode);
      pruneFinishedAgents();
    }
  }

  return NextResponse.json({ running });
}

/**
 * DELETE: Stop a running agent.
 * Body: { agentKey: string }
 */
export async function DELETE(request: NextRequest) {
  const auth = await validateAdminAuth({ skipCache: true });
  if (!auth.valid) return auth.error;

  const localOnlyResponse = ensureLocalRuntime();
  if (localOnlyResponse) {
    return localOnlyResponse;
  }

  const csrfError = rejectUnsafeMutation(request);
  if (csrfError) return csrfError;

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
  agent.stoppedByUser = true;
  markAgentFinished(agent, agent.exitCode);
  pruneFinishedAgents();

  return NextResponse.json({ stopped: true, agentKey });
}
