/**
 * Marketing Agent Configuration Registry
 *
 * Defines the four specialized marketing agents for Paisaxe,
 * each focused on a specific social media platform.
 */

import type { MarketingPlatform } from "@/types/marketing";

export interface AgentVoiceConfig {
  /** Descriptive style for potential voice synthesis */
  style: string;
  /** Tone characteristics */
  tone: string;
  /** Future: ElevenLabs voice ID for voice synthesis */
  elevenLabsVoiceId?: string;
}

export interface AgentConfig {
  /** Unique identifier for the agent */
  id: string;
  /** Display name */
  name: string;
  /** Platform this agent specializes in */
  platform: MarketingPlatform;
  /** Path to persona markdown file (relative to project root) */
  personaFile: string;
  /** Short description of the agent's role */
  description: string;
  /** List of things this agent can help with */
  capabilities: string[];
  /** List of things this agent cannot or should not do */
  limitations: string[];
  /** Voice configuration for future audio features */
  voice?: AgentVoiceConfig;
}

/**
 * The four marketing agents, one per platform.
 */
export const MARKETING_AGENTS: Record<MarketingPlatform, AgentConfig> = {
  x: {
    id: "xander",
    name: "Xander",
    platform: "x",
    personaFile: "src/agents/personas/xander-x-agent.md",
    description: "X (Twitter) marketing specialist - short-form, conversational content",
    capabilities: [
      "Draft tweets and threads",
      "Write engaging hooks",
      "Suggest hashtag strategies",
      "Plan content calendars",
      "Analyze engagement patterns",
      "Craft responses and quote tweets",
    ],
    limitations: [
      "Cannot post directly to X",
      "Cannot access real-time analytics",
      "Cannot schedule posts",
    ],
    voice: {
      style: "Conversational, quick-witted, observational",
      tone: "Friendly and slightly playful",
    },
  },
  instagram: {
    id: "iris",
    name: "Iris",
    platform: "instagram",
    personaFile: "src/agents/personas/iris-instagram-agent.md",
    description: "Instagram marketing specialist - visual storytelling and engagement",
    capabilities: [
      "Write compelling captions",
      "Structure carousel posts",
      "Plan Reel concepts",
      "Suggest hashtag combinations",
      "Advise on visual composition",
      "Create Story content ideas",
    ],
    limitations: [
      "Cannot post directly to Instagram",
      "Cannot access real-time analytics",
      "Cannot edit images or videos",
    ],
    voice: {
      style: "Warm, descriptive, emotionally resonant",
      tone: "Inviting and inspiring",
    },
  },
  pinterest: {
    id: "penny",
    name: "Penny",
    platform: "pinterest",
    personaFile: "src/agents/personas/penny-pinterest-agent.md",
    description: "Pinterest marketing specialist - SEO-focused, evergreen content",
    capabilities: [
      "Write SEO-optimized pin titles",
      "Craft keyword-rich descriptions",
      "Plan board organization",
      "Suggest seasonal content timing",
      "Create Idea Pin outlines",
      "Research relevant keywords",
    ],
    limitations: [
      "Cannot post directly to Pinterest",
      "Cannot access real-time analytics",
      "Cannot create pin graphics",
    ],
    voice: {
      style: "Helpful, organized, practical",
      tone: "Informative and reliable",
    },
  },
  tiktok: {
    id: "tiko",
    name: "Tiko",
    platform: "tiktok",
    personaFile: "src/agents/personas/tiko-tiktok-agent.md",
    description: "TikTok marketing specialist - trend-aware, authentic short-form video",
    capabilities: [
      "Write video hooks and scripts",
      "Suggest trending sounds",
      "Plan video concepts",
      "Create content series ideas",
      "Advise on video structure",
      "Adapt trends to Asturias content",
    ],
    limitations: [
      "Cannot post directly to TikTok",
      "Cannot access real-time analytics",
      "Cannot edit videos",
    ],
    voice: {
      style: "Energetic, authentic, trend-aware",
      tone: "Enthusiastic but not forced",
    },
  },
};

/**
 * Path to the shared brand voice guidelines.
 */
export const BRAND_VOICE_FILE = "src/agents/shared/brand-voice.md";

/**
 * Get agent configuration by platform.
 */
export function getAgentByPlatform(platform: MarketingPlatform): AgentConfig {
  return MARKETING_AGENTS[platform];
}

/**
 * Get agent configuration by ID.
 */
export function getAgentById(id: string): AgentConfig | undefined {
  return Object.values(MARKETING_AGENTS).find((agent) => agent.id === id);
}

/**
 * Check if a string is a valid agent ID.
 */
export function isValidAgentId(id: string): boolean {
  return Object.values(MARKETING_AGENTS).some((agent) => agent.id === id);
}

/**
 * Get all agent configurations as an array.
 */
export function getAllAgents(): AgentConfig[] {
  return Object.values(MARKETING_AGENTS);
}
