import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { spawn } from "child_process";
import path from "path";

const AGENT_SCRIPTS: Record<string, string> = {
  coverage_agent_enabled: "scripts/coverage-agent.sh",
  security_agent_enabled: "scripts/security-agent.sh",
  documentation_agent_enabled: "scripts/documentation-agent.sh",
  performance_agent_enabled: "scripts/performance-agent.sh",
  qa_agent_enabled: "scripts/qa-agent.sh",
  localization_agent_enabled: "scripts/localization-agent.sh",
  cost_analyst_agent_enabled: "scripts/cost-analyst-agent.sh",
};

interface RunningAgent {
  pid: number;
  startedAt: string;
}

/** In-memory tracking of running agent processes. */
const runningAgents = new Map<string, RunningAgent>();

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
  if (existing) {
    // Verify the process is still alive
    try {
      process.kill(existing.pid, 0);
      return NextResponse.json(
        { error: "Agent is already running", startedAt: existing.startedAt },
        { status: 409 },
      );
    } catch {
      // Process died without us noticing — clean up
      runningAgents.delete(agentKey);
    }
  }

  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, AGENT_SCRIPTS[agentKey]);
  const startedAt = new Date().toISOString();

  const child = spawn("bash", [scriptPath], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });

  child.unref();

  if (!child.pid) {
    return NextResponse.json(
      { error: "Failed to start agent process" },
      { status: 500 },
    );
  }

  runningAgents.set(agentKey, { pid: child.pid, startedAt });

  // Auto-cleanup when process exits
  child.on("exit", () => {
    runningAgents.delete(agentKey);
  });

  return NextResponse.json({ started: true, agentKey, startedAt });
}

/**
 * GET: Check which agents are currently running.
 */
export async function GET() {
  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;

  const running: Record<string, { startedAt: string }> = {};

  for (const [key, agent] of runningAgents) {
    try {
      process.kill(agent.pid, 0);
      running[key] = { startedAt: agent.startedAt };
    } catch {
      // Process no longer alive — clean up
      runningAgents.delete(key);
    }
  }

  return NextResponse.json({ running });
}
