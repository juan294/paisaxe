import { NextResponse } from "next/server";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { validateAdminAuth } from "@/lib/admin-auth";

const execAsync = promisify(exec);

// Store the tunnel process reference (in-memory, development only)
let tunnelProcess: ChildProcess | null = null;

/**
 * Check if the tunnel is running by checking for cloudflared processes
 */
async function isTunnelRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("pgrep -f 'cloudflared tunnel.*paisaxe' || true");
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/tunnel
 * Returns the current tunnel status
 */
export async function GET(): Promise<NextResponse> {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Tunnel control is only available in development" },
      { status: 403 }
    );
  }

  const authResult = await validateAdminAuth();
  if (!authResult.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const running = await isTunnelRunning();

  return NextResponse.json({
    running,
    url: running ? "https://paisaxe.tunnelfor.me" : null,
  });
}

/**
 * POST /api/admin/tunnel
 * Starts the Cloudflare tunnel
 */
export async function POST(): Promise<NextResponse> {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Tunnel control is only available in development" },
      { status: 403 }
    );
  }

  const authResult = await validateAdminAuth();
  if (!authResult.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already running
  if (await isTunnelRunning()) {
    return NextResponse.json({
      running: true,
      url: "https://paisaxe.tunnelfor.me",
      message: "Tunnel is already running",
    });
  }

  try {
    // Start the tunnel process
    const configPath = `${process.env.HOME}/.cloudflared/config-paisaxe.yml`;

    tunnelProcess = spawn("cloudflared", [
      "tunnel",
      "--config",
      configPath,
      "run",
      "paisaxe",
    ], {
      detached: true,
      stdio: "ignore",
    });

    // Unref so Node.js can exit even if tunnel is running
    tunnelProcess.unref();

    // Wait a moment for the tunnel to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const running = await isTunnelRunning();

    return NextResponse.json({
      running,
      url: running ? "https://paisaxe.tunnelfor.me" : null,
      message: running ? "Tunnel started successfully" : "Failed to start tunnel",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to start tunnel: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tunnel
 * Stops the Cloudflare tunnel
 */
export async function DELETE(): Promise<NextResponse> {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Tunnel control is only available in development" },
      { status: 403 }
    );
  }

  const authResult = await validateAdminAuth();
  if (!authResult.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Kill any cloudflared tunnel processes for paisaxe
    await execAsync("pkill -f 'cloudflared tunnel.*paisaxe' || true");

    tunnelProcess = null;

    // Wait a moment for the process to stop
    await new Promise((resolve) => setTimeout(resolve, 500));

    const running = await isTunnelRunning();

    return NextResponse.json({
      running,
      url: null,
      message: running ? "Failed to stop tunnel" : "Tunnel stopped successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to stop tunnel: ${message}` },
      { status: 500 }
    );
  }
}
