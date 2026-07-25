#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";

const AGENTS = [
  "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
  "agent_5201kgm2956ge8ct95yxjas867z5",
  "agent_1601kg4wghnzewc9aqpkf4r2fkfw",
  "agent_1301kg4wggmvfwgbx91h7sn2xsbh",
  "agent_5901kg4wgebce0abca4ssyav3684",
];

const TOOLS = [
  "tool_2101kgqhsetcf7f8ew71176van7m",
  "tool_4801kgqhsetdf3vr045n8r1h55js",
  "tool_7901kgqhsetben3bbbg4p360d987",
];

const outputDir =
  "docs/operations/evidence/elevenlabs/2026-07-25-pre-modernization";
const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("ELEVENLABS_API_KEY is required.");
}

function redact(value, key = "") {
  if (
    typeof value === "string" &&
    /(authorization|api[_-]?key|password|secret|token)/i.test(key)
  ) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey),
      ])
    );
  }
  return value;
}

async function get(path) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs read failed for ${path} (${response.status}).`);
  }
  return response.json();
}

await mkdir(outputDir, { recursive: true });

for (const agentId of AGENTS) {
  const [agent, branches] = await Promise.all([
    get(`/v1/convai/agents/${agentId}`),
    get(`/v1/convai/agents/${agentId}/branches?include_archived=true&limit=100`),
  ]);
  await writeFile(
    `${outputDir}/${agentId}.json`,
    `${JSON.stringify(redact({ agent, branches }), null, 2)}\n`
  );
}

for (const toolId of TOOLS) {
  const tool = await get(`/v1/convai/tools/${toolId}`);
  await writeFile(
    `${outputDir}/${toolId}.json`,
    `${JSON.stringify(redact(tool), null, 2)}\n`
  );
}

console.log(`Captured ${AGENTS.length} agents and ${TOOLS.length} tools.`);
