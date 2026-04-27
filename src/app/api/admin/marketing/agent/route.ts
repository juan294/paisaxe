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
import { logger } from "@/lib/logger";

// Agent chat request body
interface AgentChatRequest {
  agentId: string;
  message: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// Agent chat response
interface AgentChatResponse {
  response: string;
  agentId: string;
  agentName: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
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

  let context = "\n\n## Current Context\n\n";

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
 * Build the complete system prompt for the agent.
 */
async function buildSystemPrompt(agent: AgentConfig): Promise<string> {
  const [agentPrompt, context] = await Promise.all([
    loadAgentPrompt(agent),
    gatherContext(),
  ]);

  return `${agentPrompt}${context}

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
    const body = (await request.json()) as AgentChatRequest;
    const { agentId, message, conversationHistory = [] } = body;

    // Validate agent ID
    const agent = getAgentById(agentId);
    if (!agent) {
      return NextResponse.json(
        { error: `Invalid agent ID: ${agentId}` },
        { status: 400 }
      );
    }

    // Validate message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build system prompt
    const systemPrompt = await buildSystemPrompt(agent);

    // Build messages array
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...conversationHistory,
      { role: "user", content: message.trim() },
    ];

    // Call Claude API
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
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
