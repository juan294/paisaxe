import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  getAgentById,
  getAllAgents,
  BRAND_VOICE_FILE,
  type AgentConfig,
} from "@/agents";
import { supabase } from "@/lib/supabase";
import { agentChatRequestSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { CHAT_MODEL } from "@/lib/models";
import { recordAnthropicUsageInBackground } from "@/lib/costs/anthropic-usage";

// Agent chat response
interface AgentChatResponse {
  response: string;
  agentId: string;
  agentName: string;
  usage?: {
    /** Uncached input only; the full input adds the two cache fields. */
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
}

// Agent list response
interface AgentListResponse {
  agents: Array<{
    id: string;
    name: string;
    platform: string;
    description: string;
    capabilities: string[];
    voice?: {
      style: string;
      tone: string;
    };
  }>;
}

/**
 * Load and combine persona with brand voice.
 */
async function loadAgentPrompt(agent: AgentConfig): Promise<string> {
  const [personaContent, brandVoiceContent] = await Promise.all([
    fs.readFile(agent.personaFile, "utf-8"),
    fs.readFile(BRAND_VOICE_FILE, "utf-8"),
  ]);

  return `${brandVoiceContent}\n\n---\n\n${personaContent}`;
}

/**
 * Gather context from the database for richer agent responses.
 */
async function gatherContext(): Promise<string> {

  // Get recent scheduled content
  const { data: scheduledContent } = await supabase
    .from("marketing_content")
    .select("platform, content_type, caption, status, scheduled_for")
    .order("scheduled_for", { ascending: false })
    .limit(10);

  // Get active stories count
  const { count: storyCount } = await supabase
    .from("stories")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  let context = "## Current Context\n\n";

  if (storyCount) {
    context += `- There are ${storyCount} active stories in the Paisaxe database.\n`;
  }

  if (scheduledContent && scheduledContent.length > 0) {
    context += `- Recent marketing content:\n`;
    for (const item of scheduledContent.slice(0, 5)) {
      context += `  - ${item.platform}: ${item.content_type} (${item.status})\n`;
    }
  }

  return context;
}

/**
 * Build the system blocks for the agent.
 *
 * Block 1 (brand voice + persona + static instructions) is identical for every
 * request to the same agent and carries the cache marker. Block 2 is the live
 * DB context, which changes between requests, so it follows unmarked.
 * See .claude/rules/prompt-caching.md.
 */
async function buildAgentSystem(agent: AgentConfig): Promise<Anthropic.TextBlockParam[]> {
  const [agentPrompt, context] = await Promise.all([
    loadAgentPrompt(agent),
    gatherContext(),
  ]);

  const stable = `${agentPrompt}

## Important Instructions

You are ${agent.name}, the ${agent.platform.toUpperCase()} marketing specialist for Paisaxe.

When helping the user:
1. Stay in character as ${agent.name}
2. Apply the brand voice guidelines consistently
3. Focus on your platform expertise (${agent.platform})
4. Be practical and actionable
5. Reference your capabilities when relevant

Your capabilities: ${agent.capabilities.join(", ")}
Your limitations: ${agent.limitations.join(", ")}

Respond helpfully while staying true to the Paisaxe brand voice.`;

  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    // Blocks are concatenated as-is: start the context heading on its own line.
    { type: "text", text: `\n\n${context}` },
  ];
}

/**
 * POST /api/admin/marketing/agent
 * Chat with a marketing agent.
 */
export async function POST(
  request: Request
): Promise<NextResponse<AgentChatResponse | { error: string }>> {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error as NextResponse<{ error: string }>;
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = agentChatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const { agentId, message, conversationHistory = [] } = parsed.data;

    // Validate agent ID
    const agent = getAgentById(agentId);
    if (!agent) {
      return NextResponse.json(
        { error: `Invalid agent ID: ${agentId}` },
        { status: 400 }
      );
    }

    const system = await buildAgentSystem(agent);

    // Build messages array
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...conversationHistory,
      { role: "user", content: message.trim() },
    ];

    // Call Claude API
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 2048,
      system,
      messages,
      // The full conversationHistory is re-sent every turn: automatic caching
      // moves one breakpoint to the end of it (2 of 4 breakpoints in use).
      cache_control: { type: "ephemeral" },
    });

    recordAnthropicUsageInBackground({
      model: CHAT_MODEL,
      usage: response.usage,
      source: `marketing_${agent.id}`,
    });

    // Extract response text
    const responseText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({
      response: responseText,
      agentId: agent.id,
      agentName: agent.name,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    logger.error("Agent chat error:", { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof Error && error.message.includes("Could not read")) {
      return NextResponse.json(
        { error: "Agent persona files not found" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process agent request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/marketing/agent
 * List available agents.
 */
export async function GET(): Promise<NextResponse<AgentListResponse | { error: string }>> {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error as NextResponse<{ error: string }>;
  }

  const agents = getAllAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    platform: agent.platform,
    description: agent.description,
    capabilities: agent.capabilities,
    voice: agent.voice
      ? { style: agent.voice.style, tone: agent.voice.tone }
      : undefined,
  }));

  return NextResponse.json({ agents });
}
