import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { promises as fs } from "fs";
import path from "path";
import type { AgentConfigFile } from "@/types/agent-config";

const CONFIG_FILE = path.join(process.cwd(), "scripts", "agent-config.json");
const DEFAULTS_FILE = path.join(
  process.cwd(),
  "scripts",
  "agent-config.defaults.json",
);

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

async function readConfig(): Promise<AgentConfigFile> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as AgentConfigFile;
  } catch {
    // Auto-create from defaults
    const defaults = await fs.readFile(DEFAULTS_FILE, "utf-8");
    await fs.writeFile(CONFIG_FILE, defaults, "utf-8");
    return JSON.parse(defaults) as AgentConfigFile;
  }
}

async function writeConfig(config: AgentConfigFile): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * GET /api/admin/agent-config
 * Returns the local agent configuration. Dev-only.
 */
export async function GET() {
  if (!isDev()) {
    return NextResponse.json(
      { error: "Agent config is only available in development" },
      { status: 403 },
    );
  }

  const authError = await validateAdminAuth();
  if (authError) return authError;

  try {
    const config = await readConfig();
    return NextResponse.json({ data: config });
  } catch (error) {
    console.error("Failed to read agent config:", error);
    return NextResponse.json(
      { error: "Failed to read agent config" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/agent-config
 * Update agent config. Supports:
 *   { master_enabled: boolean }
 *   { key: string, enabled: boolean }
 *   { key: string, config_key: string, value: unknown }
 */
export async function PUT(request: NextRequest) {
  if (!isDev()) {
    return NextResponse.json(
      { error: "Agent config is only available in development" },
      { status: 403 },
    );
  }

  const authError = await validateAdminAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const config = await readConfig();

    if ("master_enabled" in body && typeof body.master_enabled === "boolean") {
      config.master_enabled = body.master_enabled;
    } else if ("key" in body && typeof body.key === "string") {
      const agent = config.agents[body.key];
      if (!agent) {
        return NextResponse.json(
          { error: `Unknown agent key: ${body.key}` },
          { status: 400 },
        );
      }

      if ("enabled" in body && typeof body.enabled === "boolean") {
        agent.enabled = body.enabled;
      }

      if (
        "config_key" in body &&
        typeof body.config_key === "string" &&
        "value" in body
      ) {
        agent.config[body.config_key] = body.value;
      }
    } else {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    await writeConfig(config);
    return NextResponse.json({ data: config });
  } catch (error) {
    console.error("Failed to update agent config:", error);
    return NextResponse.json(
      { error: "Failed to update agent config" },
      { status: 500 },
    );
  }
}
