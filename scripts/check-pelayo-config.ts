#!/usr/bin/env npx tsx
/**
 * Check current Pelayo agent configuration from ElevenLabs
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = "agent_3101kg5bvnf4f1r94f0cav0v9y61";

if (!API_KEY) {
  console.error("No ELEVENLABS_API_KEY found");
  process.exit(1);
}

async function main() {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
    { headers: { "xi-api-key": API_KEY } }
  );

  if (!response.ok) {
    console.error(`Failed: ${response.status}`);
    process.exit(1);
  }

  const data = await response.json();
  const agent = data.conversation_config?.agent;

  console.log("=== PELAYO AGENT CONFIG CHECK ===\n");

  console.log("📝 FIRST MESSAGE:");
  console.log(`   ${agent?.first_message}`);
  console.log("");

  console.log("🌐 LANGUAGE:", agent?.language);
  console.log("");

  console.log("📊 DYNAMIC VARIABLES:");
  const vars = agent?.dynamic_variables?.dynamic_variable_placeholders || {};
  const varKeys = Object.keys(vars);
  const garbageKeys = varKeys.filter(
    (k) => k.includes("_if") || k.includes("else") || k.includes("_eq")
  );
  const cleanKeys = varKeys.filter(
    (k) => !k.includes("_if") && !k.includes("else") && !k.includes("_eq")
  );
  console.log(`   Clean placeholders (${cleanKeys.length}): ${cleanKeys.join(", ")}`);
  if (garbageKeys.length > 0) {
    console.log(`   ⚠️  Garbage placeholders: ${garbageKeys.join(", ")}`);
  } else {
    console.log("   ✅ No garbage placeholders");
  }
  console.log("");

  console.log("🔧 TOOLS:");
  const tools = agent?.prompt?.tools || [];
  const webhooks = tools.filter((t: { type: string }) => t.type === "webhook");
  const systemTools = tools.filter((t: { type: string }) => t.type === "system");
  console.log(`   Webhooks (${webhooks.length}):`);
  for (const t of webhooks) {
    console.log(`     - ${t.name}: ${t.api_schema?.url}`);
  }
  console.log(`   System tools: ${systemTools.map((t: { name: string }) => t.name).join(", ")}`);
  console.log("");

  console.log("🤖 LLM:", agent?.prompt?.llm);
  console.log("🌡️  Temperature:", agent?.prompt?.temperature);
  console.log("📏 Max tokens:", agent?.prompt?.max_tokens);
  console.log("");

  console.log("📚 KNOWLEDGE BASE:", (agent?.prompt?.knowledge_base || []).length, "files");
  console.log("");

  console.log("📜 SYSTEM PROMPT (first 600 chars):");
  const prompt = agent?.prompt?.prompt || "";
  console.log("---");
  console.log(prompt.substring(0, 600));
  console.log("---");
  console.log(`   (Total length: ${prompt.length} chars)`);
}

main().catch(console.error);
