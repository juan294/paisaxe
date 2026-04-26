import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import type {
  ElevenLabsAnalyticsSummary,
  ElevenLabsAgentBreakdown,
  ElevenLabsLanguageBreakdown,
  ElevenLabsStatusBreakdown,
  ElevenLabsConversation,
} from "@/types/elevenlabs-analytics";
import { ELEVENLABS_AGENT_IDS, ELEVENLABS_API_BASE } from "@/config/elevenlabs-agents";

interface ElevenLabsConversationResponse {
  conversations: Array<{
    conversation_id: string;
    agent_id: string;
    status: string;
    start_time_unix_secs?: number;
    end_time_unix_secs?: number;
    call_duration_secs?: number;
    message_count?: number;
    metadata?: {
      detected_language?: string;
    };
    analysis?: {
      rating?: number;
    };
  }>;
  has_more?: boolean;
  next_cursor?: string;
}

interface ElevenLabsAgentsResponse {
  agents: Array<{
    agent_id: string;
    name: string;
  }>;
}

interface ElevenLabsLiveCountResponse {
  count: number;
}

async function fetchElevenLabs<T>(
  endpoint: string,
  apiKey: string
): Promise<T> {
  const response = await fetch(`${ELEVENLABS_API_BASE}${endpoint}`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function getAgentNameFromId(
  agentId: string,
  agentNameMap: Map<string, string>
): string {
  // First check the dynamic map from ElevenLabs API
  const apiName = agentNameMap.get(agentId);
  if (apiName) return apiName;

  // Fallback to local config
  for (const [name, id] of Object.entries(ELEVENLABS_AGENT_IDS)) {
    if (id === agentId) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  // Last resort: truncated ID
  return agentId.slice(0, 8);
}

export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

  if (!apiKey) {
    console.error("Missing ELEVENLABS_API_KEY");
    return NextResponse.json(
      { error: "ElevenLabs configuration missing" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toParam = url.searchParams.get("to") || new Date().toISOString();

    const fromUnix = Math.floor(new Date(fromParam).getTime() / 1000);
    const toUnix = Math.floor(new Date(toParam).getTime() / 1000);

    // Fetch agents list first to get Paisaxe agent IDs
    const agentsResponse = await fetchElevenLabs<ElevenLabsAgentsResponse>(
      `/convai/agents`,
      apiKey
    ).catch(() => ({ agents: [] }));

    // Filter to only Paisaxe agents (names starting with "Paisaxe")
    const paisaxeAgents = (agentsResponse.agents || []).filter(
      (agent) => agent.name?.startsWith("Paisaxe")
    );
    const paisaxeAgentIds = new Set(paisaxeAgents.map((a) => a.agent_id));

    // Build agent name map (only Paisaxe agents)
    const agentNameMap = new Map<string, string>();
    for (const agent of paisaxeAgents) {
      if (agent.name) {
        // Simplify name: "Paisaxe - Pelayo (Visitor Guide)" -> "Pelayo"
        const match = agent.name.match(/Paisaxe\s*-\s*([^(]+)/);
        const displayName = match ? match[1].trim() : agent.name;
        agentNameMap.set(agent.agent_id, displayName);
      }
    }

    // Fetch conversations and calculate active calls for Paisaxe agents
    const conversationsResponse = await fetchElevenLabs<ElevenLabsConversationResponse>(
      `/convai/conversations?start_time_unix_gte=${fromUnix}&start_time_unix_lte=${toUnix}`,
      apiKey
    );

    // Filter conversations to only Paisaxe agents
    const allConversations = (conversationsResponse.conversations || []).filter(
      (conv) => paisaxeAgentIds.has(conv.agent_id)
    );

    // PE-L1: Get active calls count for all Paisaxe agents concurrently (#307).
    // Previously a sequential for...of loop — now a single Promise.all fan-out.
    const liveCountResults = await Promise.all(
      Array.from(paisaxeAgentIds).map((agentId) =>
        fetchElevenLabs<ElevenLabsLiveCountResponse>(
          `/convai/analytics/live-count?agent_id=${agentId}`,
          apiKey
        ).catch(() => ({ count: 0 as number }))
      )
    );
    const activeCalls = liveCountResults.reduce((sum, r) => sum + r.count, 0);

    // Calculate summary
    const completedConvos = allConversations.filter(c => c.status === "done");
    const failedConvos = allConversations.filter(c => c.status === "failed");
    const totalDurationSecs = allConversations.reduce(
      (sum, c) => sum + (c.call_duration_secs || 0),
      0
    );
    const ratings = allConversations
      .map(c => c.analysis?.rating)
      .filter((r): r is number => r !== undefined && r !== null);

    const summary: ElevenLabsAnalyticsSummary = {
      totalConversations: allConversations.length,
      completedConversations: completedConvos.length,
      failedConversations: failedConvos.length,
      totalMinutesUsed: Math.round(totalDurationSecs / 60 * 10) / 10,
      averageCallDuration: allConversations.length > 0
        ? Math.round(totalDurationSecs / allConversations.length)
        : 0,
      averageRating: ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
    };

    // Group by agent
    const agentCounts = new Map<string, { count: number; minutes: number }>();
    for (const conv of allConversations) {
      const current = agentCounts.get(conv.agent_id) || { count: 0, minutes: 0 };
      agentCounts.set(conv.agent_id, {
        count: current.count + 1,
        minutes: current.minutes + (conv.call_duration_secs || 0) / 60,
      });
    }

    const conversationsByAgent: ElevenLabsAgentBreakdown[] = Array.from(agentCounts.entries())
      .map(([agentId, data]) => ({
        agentId,
        agentName: getAgentNameFromId(agentId, agentNameMap),
        conversationCount: data.count,
        totalMinutes: Math.round(data.minutes * 10) / 10,
      }))
      .sort((a, b) => b.conversationCount - a.conversationCount);

    // Group by language
    const langCounts = new Map<string, number>();
    for (const conv of allConversations) {
      const lang = conv.metadata?.detected_language || "Unknown";
      langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
    }

    const conversationsByLanguage: ElevenLabsLanguageBreakdown[] = Array.from(langCounts.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Group by status
    const statusCounts = new Map<string, number>();
    for (const conv of allConversations) {
      statusCounts.set(conv.status, (statusCounts.get(conv.status) || 0) + 1);
    }

    const conversationsByStatus: ElevenLabsStatusBreakdown[] = Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // Recent conversations (last 10)
    const recentConversations: ElevenLabsConversation[] = allConversations
      .sort((a, b) => (b.start_time_unix_secs || 0) - (a.start_time_unix_secs || 0))
      .slice(0, 10)
      .map(conv => ({
        conversation_id: conv.conversation_id,
        agent_id: conv.agent_id,
        status: conv.status as ElevenLabsConversation["status"],
        start_time_unix: conv.start_time_unix_secs,
        end_time_unix: conv.end_time_unix_secs,
        call_duration_secs: conv.call_duration_secs,
        message_count: conv.message_count,
        detected_language: conv.metadata?.detected_language,
        rating: conv.analysis?.rating,
      }));

    return NextResponse.json({
      data: {
        summary,
        activeCalls,
        conversationsByAgent,
        conversationsByLanguage,
        conversationsByStatus,
        recentConversations,
        dateRange: { from: fromParam, to: toParam },
      },
    }, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("ElevenLabs analytics API error:", error);

    // Return empty data on error
    const url = new URL(request.url);
    const fromFallback = url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toFallback = url.searchParams.get("to") || new Date().toISOString();

    return NextResponse.json({
      data: {
        summary: {
          totalConversations: 0,
          completedConversations: 0,
          failedConversations: 0,
          totalMinutesUsed: 0,
          averageCallDuration: 0,
          averageRating: null,
        },
        activeCalls: 0,
        conversationsByAgent: [],
        conversationsByLanguage: [],
        conversationsByStatus: [],
        recentConversations: [],
        dateRange: { from: fromFallback, to: toFallback },
      },
    });
  }
}
