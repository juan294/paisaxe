// ElevenLabs Voice Agent Analytics Types

export interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  status: "initiated" | "in-progress" | "processing" | "done" | "failed";
  start_time_unix?: number;
  end_time_unix?: number;
  call_duration_secs?: number;
  message_count?: number;
  detected_language?: string;
  rating?: number;
}

export interface ElevenLabsAgent {
  agent_id: string;
  name: string;
}

export interface ElevenLabsAnalyticsSummary {
  totalConversations: number;
  completedConversations: number;
  failedConversations: number;
  totalMinutesUsed: number;
  averageCallDuration: number;
  averageRating: number | null;
}

export interface ElevenLabsAgentBreakdown {
  agentId: string;
  agentName: string;
  conversationCount: number;
  totalMinutes: number;
}

export interface ElevenLabsLanguageBreakdown {
  language: string;
  count: number;
}

export interface ElevenLabsStatusBreakdown {
  status: string;
  count: number;
}

export interface ElevenLabsAnalyticsDashboardData {
  summary: ElevenLabsAnalyticsSummary;
  activeCalls: number;
  conversationsByAgent: ElevenLabsAgentBreakdown[];
  conversationsByLanguage: ElevenLabsLanguageBreakdown[];
  conversationsByStatus: ElevenLabsStatusBreakdown[];
  recentConversations: ElevenLabsConversation[];
  dateRange: {
    from: string;
    to: string;
  };
}
