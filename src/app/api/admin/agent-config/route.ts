import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { promises as fs } from "fs";
import path from "path";
import type { AgentConfigFile } from "@/types/agent-config";
import { agentConfigMasterSchema, agentConfigEnableSchema } from "@/lib/schemas";

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

  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;

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

  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;

  try {
    const rawBody = await request.json().catch(() => null);

    // Validate body shape before reading/writing config to avoid unnecessary I/O
    const masterParsed = agentConfigMasterSchema.safeParse(rawBody);
    const hasKey = rawBody !== null && typeof rawBody === "object" && "key" in (rawBody as object);
    const agentParsed = hasKey ? agentConfigEnableSchema.safeParse(rawBody) : null;

    if (!masterParsed.success && (!agentParsed || !agentParsed.success || !hasKey)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const config = await readConfig();

    if (masterParsed.success) {
      config.master_enabled = masterParsed.data.master_enabled;
    } else {
      // Per-agent update — agentParsed is guaranteed non-null and successful here
      if (!agentParsed || !agentParsed.success) {
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 },
        );
      }

      const body = agentParsed.data;
      const agent = config.agents[body.key];
      if (!agent) {
        return NextResponse.json(
          { error: `Unknown agent key: ${body.key}` },
          { status: 400 },
        );
      }

      if (body.enabled !== undefined) {
        agent.enabled = body.enabled;
      }

      if (body.config_key !== undefined && "value" in body) {
        agent.config[body.config_key] = body.value;
      }
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
