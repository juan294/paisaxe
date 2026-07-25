import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

type AgentOperation = "status" | "pull" | "push:dry" | "push";
type ToolOperation = "status" | "pull" | "push:dry" | "push";

interface AgentOptions {
  agent: string;
  branch: string;
  apply: boolean;
}

interface AgentManifestEntry {
  id: string;
  config: string;
  branch_id: string;
  version_id: string;
  branches?: Record<
    string,
    { config: string; branch_id: string; version_id: string }
  >;
}

interface ToolOptions {
  tool: string;
  apply: boolean;
}

const AGENTS = {
  pelayo: {
    id: "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
    branch: "agtbrch_2801kgqjhbhaf9097aka9qeek8qj",
  },
  booking: {
    id: "agent_5201kgm2956ge8ct95yxjas867z5",
    branch: "agtbrch_2301kgm295x1e0m87n5ayxgb6tnh",
  },
  penny: {
    id: "agent_1601kg4wghnzewc9aqpkf4r2fkfw",
    branch: "agtbrch_2601ks19j2y9fs081b84m85m0gcs",
  },
  iris: {
    id: "agent_1301kg4wggmvfwgbx91h7sn2xsbh",
    branch: "agtbrch_3601ks19j2y7e4y97f28gg0se5pr",
  },
  xander: {
    id: "agent_5901kg4wgebce0abca4ssyav3684",
    branch: "agtbrch_3701ks19j2yme6m9qedhx8bz808s",
  },
} as const;

const TOOLS = {
  search_places: {
    id: "tool_2101kgqhsetcf7f8ew71176van7m",
    config: "tool_configs/search_places.json",
  },
  make_booking: {
    id: "tool_4801kgqhsetdf3vr045n8r1h55js",
    config: "tool_configs/make_booking.json",
  },
  get_weather: {
    id: "tool_7901kgqhsetben3bbbg4p360d987",
    config: "tool_configs/get_weather.json",
  },
} as const;

function ownedAgent(value: string) {
  const entry = Object.entries(AGENTS).find(
    ([alias, agent]) => alias === value || agent.id === value
  );
  if (!entry) {
    throw new Error("The selected agent is not owned by Paisaxe.");
  }
  return entry[1];
}

function ownedTool(value: string) {
  const entry = Object.entries(TOOLS).find(
    ([alias, tool]) => alias === value || tool.id === value
  );
  if (!entry) {
    throw new Error("The selected tool is not in the Paisaxe writable registry.");
  }
  return entry[1];
}

export function buildAgentCliArgs(
  operation: AgentOperation,
  options: AgentOptions
): string[] {
  const agent = ownedAgent(options.agent);
  if (options.branch !== agent.branch) {
    throw new Error("The branch does not match the Paisaxe agent manifest.");
  }

  if (operation === "pull") {
    return [
      "agents",
      "pull",
      "--agent",
      agent.id,
      "--branch",
      agent.branch,
      "--update",
      ...(options.apply ? [] : ["--dry-run"]),
      "--no-ui",
    ];
  }

  if (operation === "push" && !options.apply) {
    throw new Error("Agent writes require the explicit --apply flag.");
  }

  return [
    "agents",
    "push",
    "--agent",
    agent.id,
    "--branch",
    agent.branch,
    ...(operation === "push"
      ? ["--version-description", "Paisaxe scoped configuration update"]
      : ["--dry-run"]),
    "--no-ui",
  ];
}

export function buildAgentUpdateBody(
  config: Record<string, unknown>,
  _branchId: string
): Record<string, unknown> {
  const conversationConfig = structuredClone(
    (config.conversation_config ?? {}) as Record<string, unknown>
  );
  const agent = conversationConfig.agent as
    | Record<string, unknown>
    | undefined;
  const prompt = agent?.prompt as Record<string, unknown> | undefined;
  if (
    prompt &&
    (prompt.tool_ids !== undefined || prompt.toolIds !== undefined)
  ) {
    delete prompt.tools;
  }
  return {
    name: config.name,
    conversation_config: conversationConfig,
    platform_settings: config.platform_settings,
    workflow: config.workflow,
    tags: config.tags ?? [],
    version_description: "Paisaxe scoped configuration update",
  };
}

export function buildToolCliArgs(
  operation: ToolOperation,
  options: ToolOptions
): string[] {
  const tool = ownedTool(options.tool);
  if (operation === "pull") {
    return [
      "tools",
      "pull",
      "--tool",
      tool.id,
      "--update",
      ...(options.apply ? [] : ["--dry-run"]),
      "--no-ui",
    ];
  }

  if (operation === "push" && !options.apply) {
    throw new Error("Tool writes require the explicit --apply flag.");
  }

  return [
    "tools",
    "push",
    "--tool",
    tool.id,
    ...(operation === "push" ? [] : ["--dry-run"]),
    "--no-ui",
  ];
}

function valueAfter(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} is required.`);
  }
  return value;
}

async function runDirectToolOperation(
  operation: Exclude<ToolOperation, "pull">,
  options: ToolOptions
): Promise<void> {
  const tool = ownedTool(options.tool);
  if (operation === "push" && !options.apply) {
    throw new Error("Tool writes require the explicit --apply flag.");
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is required for scoped tool status.");
  }

  const local = JSON.parse(await readFile(tool.config, "utf8")) as object;
  const url = `https://api.elevenlabs.io/v1/convai/tools/${tool.id}`;
  const remoteResponse = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });
  if (!remoteResponse.ok) {
    throw new Error(`ElevenLabs tool read failed (${remoteResponse.status}).`);
  }
  const remote = (await remoteResponse.json()) as { tool_config?: object };
  const drift = JSON.stringify(remote.tool_config) !== JSON.stringify(local);

  if (operation !== "push") {
    console.log(
      drift
        ? `${tool.id}: local configuration differs from live readback`
        : `${tool.id}: local configuration matches live readback`
    );
    return;
  }

  const update = await fetch(url, {
    method: "PATCH",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool_config: local }),
  });
  if (!update.ok) {
    throw new Error(`ElevenLabs tool update failed (${update.status}).`);
  }
  const readback = (await update.json()) as { tool_config?: object };
  if (JSON.stringify(readback.tool_config) !== JSON.stringify(local)) {
    throw new Error("ElevenLabs tool readback did not match the requested config.");
  }
  console.log(`${tool.id}: scoped update verified`);
}

async function runDirectAgentOperation(
  operation: Exclude<AgentOperation, "pull">,
  options: AgentOptions
): Promise<void> {
  const owned = ownedAgent(options.agent);
  if (operation === "push" && !options.apply) {
    throw new Error("Agent writes require the explicit --apply flag.");
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is required for scoped agent operations.");
  }

  const manifest = JSON.parse(await readFile("agents.json", "utf8")) as {
    agents: AgentManifestEntry[];
  };
  const entry = manifest.agents.find((candidate) => candidate.id === owned.id);
  if (!entry) {
    throw new Error("The selected agent is missing from agents.json.");
  }
  const branch =
    options.branch === entry.branch_id
      ? {
          config: entry.config,
          branch_id: entry.branch_id,
          version_id: entry.version_id,
        }
      : entry.branches?.[options.branch];
  if (!branch || branch.branch_id !== options.branch) {
    throw new Error("The branch does not match the Paisaxe agent manifest.");
  }

  const local = JSON.parse(await readFile(branch.config, "utf8")) as Record<
    string,
    unknown
  >;
  const url = new URL(
    `https://api.elevenlabs.io/v1/convai/agents/${owned.id}`
  );
  url.searchParams.set("branch_id", branch.branch_id);
  const remoteResponse = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });
  if (!remoteResponse.ok) {
    throw new Error(`ElevenLabs agent read failed (${remoteResponse.status}).`);
  }
  const remote = (await remoteResponse.json()) as Record<string, unknown>;
  const body = buildAgentUpdateBody(local, branch.branch_id);
  const comparableLocal = {
    conversation_config: body.conversation_config,
    platform_settings: body.platform_settings,
    workflow: body.workflow,
  };
  const comparableRemote = {
    conversation_config: remote.conversation_config,
    platform_settings: remote.platform_settings,
    workflow: remote.workflow,
  };
  const drift =
    JSON.stringify(comparableRemote) !== JSON.stringify(comparableLocal);

  if (operation !== "push") {
    console.log(
      drift
        ? `${owned.id}/${branch.branch_id}: local configuration differs from live readback`
        : `${owned.id}/${branch.branch_id}: local configuration matches live readback`
    );
    return;
  }

  const update = await fetch(url, {
      method: "PATCH",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  if (!update.ok) {
    throw new Error(
      `ElevenLabs agent update failed (${update.status}): ${await update.text()}`
    );
  }
  const updated = (await update.json()) as {
    branch_id?: string;
    version_id?: string;
  };
  if (updated.branch_id !== branch.branch_id || !updated.version_id) {
    throw new Error("ElevenLabs agent update returned the wrong branch.");
  }
  branch.version_id = updated.version_id;
  if (entry.branches?.[branch.branch_id]) {
    entry.branches[branch.branch_id].version_id = updated.version_id;
  } else {
    entry.version_id = updated.version_id;
  }
  await writeFile("agents.json", `${JSON.stringify(manifest, null, 4)}\n`);

  const readbackResponse = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });
  const readback = (await readbackResponse.json()) as Record<string, unknown>;
  if (
    !readbackResponse.ok ||
    readback.branch_id !== branch.branch_id ||
    readback.version_id !== updated.version_id
  ) {
    throw new Error("ElevenLabs branch readback did not match the new version.");
  }
  console.log(
    `${owned.id}/${branch.branch_id}: scoped update verified at ${updated.version_id}`
  );
}

async function main(args: string[]): Promise<void> {
  const [scope, operation] = args;
  const apply = args.includes("--apply");
  let cliArgs: string[];

  if (scope === "agent") {
    const agentOptions = {
      agent: valueAfter(args, "--agent"),
      branch: valueAfter(args, "--branch"),
      apply,
    };
    if (operation !== "pull") {
      await runDirectAgentOperation(
        operation as Exclude<AgentOperation, "pull">,
        agentOptions
      );
      return;
    }
    cliArgs = buildAgentCliArgs(operation as AgentOperation, agentOptions);
  } else if (scope === "tool") {
    if (operation !== "pull") {
      await runDirectToolOperation(operation as Exclude<ToolOperation, "pull">, {
        tool: valueAfter(args, "--tool"),
        apply,
      });
      return;
    }
    cliArgs = buildToolCliArgs(operation as ToolOperation, {
      tool: valueAfter(args, "--tool"),
      apply,
    });
  } else {
    throw new Error("Usage: agent|tool <operation> with an explicit target.");
  }

  const result = spawnSync("elevenlabs", cliArgs, { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
