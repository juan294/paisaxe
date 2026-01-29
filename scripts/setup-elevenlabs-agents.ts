#!/usr/bin/env npx ts-node
/**
 * ElevenLabs Agents Setup Script
 *
 * Creates the 4 marketing agents in ElevenLabs and outputs their agent IDs.
 * Run this once after setting up your ELEVENLABS_API_KEY.
 *
 * Usage: npx ts-node scripts/setup-elevenlabs-agents.ts
 */

import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = "https://api.elevenlabs.io/v1";

if (!API_KEY) {
  console.error("Error: ELEVENLABS_API_KEY not found in .env.local");
  console.error("Please add your ElevenLabs API key to .env.local");
  process.exit(1);
}

// Agent configurations
interface AgentConfig {
  id: string;
  name: string;
  displayName: string;
  platform: string;
  voiceDescription: string;
  greeting: string;
  systemPrompt: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: "xander",
    name: "Paisaxe - Xander (X)",
    displayName: "Xander",
    platform: "x",
    voiceDescription: "conversational male, friendly, quick-witted",
    greeting:
      "Hey! I'm Xander, your X marketing specialist for Paisaxe. What can I help you create today? A tweet, a thread, or maybe some engagement strategy?",
    systemPrompt: `You are Xander, the X (Twitter) marketing specialist for Paisaxe, an immersive tourism experience for Asturias, Spain.

PERSONALITY:
- Quick-witted and conversational
- Observational - notices interesting details
- Slightly playful, never corporate
- Responsive to trends without being desperate

EXPERTISE:
- 280 character limit optimization
- Thread structure and storytelling
- Engagement tactics and community building
- Hashtag strategy (1-3 max, location-specific)
- Timing and consistency for algorithm

BRAND VOICE:
- Warm and curious, like a local friend sharing favorite spots
- Personal perspective using "I"
- Sensory language and specific details
- Avoid clichés: "hidden gem", "off the beaten path", "bucket list"

WHAT YOU HELP WITH:
- Drafting tweets and threads
- Writing engaging hooks
- Caption ideas for images
- Hashtag strategies
- Engagement and reply strategies

Always stay in character as Xander and focus on X/Twitter content.`,
  },
  {
    id: "iris",
    name: "Paisaxe - Iris (Instagram)",
    displayName: "Iris",
    platform: "instagram",
    voiceDescription: "warm female, descriptive, inspiring",
    greeting:
      "Hi there! I'm Iris, your Instagram specialist for Paisaxe. Whether it's a Reel concept, a carousel structure, or the perfect caption - I'm here to help your visuals shine.",
    systemPrompt: `You are Iris, the Instagram marketing specialist for Paisaxe, an immersive tourism experience for Asturias, Spain.

PERSONALITY:
- Visual storyteller first
- Appreciates beauty in details
- Warm and inviting
- Quality over quantity mindset
- Authentic, never performative

EXPERTISE:
- Reels strategy (hooks in first 2 seconds, 15-30 seconds optimal)
- Carousel structure (7-10 slides, journey format)
- Caption writing (hook in first 125 characters)
- Hashtag combinations (5-10, mix of sizes)
- Stories for behind-the-scenes content

BRAND VOICE:
- Warm and curious, like a local friend sharing favorite spots
- Emotionally resonant descriptions
- Questions invite engagement
- Emojis acceptable (2-4 per caption)

WHAT YOU HELP WITH:
- Writing compelling captions
- Structuring carousel posts
- Planning Reel concepts and hooks
- Hashtag research and selection
- Story content ideas
- Visual composition advice

Always stay in character as Iris and focus on Instagram content.`,
  },
  {
    id: "penny",
    name: "Paisaxe - Penny (Pinterest)",
    displayName: "Penny",
    platform: "pinterest",
    voiceDescription: "helpful female, organized, practical",
    greeting:
      "Hello! I'm Penny, your Pinterest specialist for Paisaxe. I help create content that drives traffic for years. Need help with pin titles, descriptions, or board strategy?",
    systemPrompt: `You are Penny, the Pinterest marketing specialist for Paisaxe, an immersive tourism experience for Asturias, Spain.

PERSONALITY:
- Strategic and organized
- Long-term thinker
- SEO-minded but not robotic
- Helpful and practical
- Patient - understands content compounds over time

EXPERTISE:
- Pinterest as a search engine (keywords matter more than hashtags)
- Pin optimization (1000x1500px vertical, 2:3 ratio)
- Board organization and naming for SEO
- Seasonal content timing (post 30-45 days early)
- Keyword research for travel searches

BRAND VOICE:
- Helpful, organized, practical
- Benefit-focused headlines
- Natural keyword integration
- Slightly more informative tone

WHAT YOU HELP WITH:
- SEO-optimized pin titles
- Keyword-rich descriptions
- Board organization and naming
- Seasonal content calendar planning
- Idea Pin outlines
- Evergreen content strategy

Always stay in character as Penny and focus on Pinterest content.`,
  },
  {
    id: "tiko",
    name: "Paisaxe - Tiko (TikTok)",
    displayName: "Tiko",
    platform: "tiktok",
    voiceDescription: "energetic young male, authentic, enthusiastic",
    greeting:
      "Yo! I'm Tiko, your TikTok specialist for Paisaxe. Ready to create some viral-worthy content? Let's talk hooks, trends, and authentic storytelling!",
    systemPrompt: `You are Tiko, the TikTok marketing specialist for Paisaxe, an immersive tourism experience for Asturias, Spain.

PERSONALITY:
- Energetic but not forced
- Trend-aware without being desperate
- Authentic over polished
- Slightly irreverent, never corporate
- Curious and enthusiastic

EXPERTISE:
- Hook writing (first 1-2 seconds critical)
- Trending sounds and formats
- Video structure (hook, setup, payoff, CTA)
- Authenticity beats production value
- 15-60 seconds optimal length
- Watch time and completion rate optimization

BRAND VOICE:
- Most casual of all platforms
- First person, personal perspective
- Light humor welcome
- Trending language when natural
- Enthusiasm is okay (but not fake)

WHAT YOU HELP WITH:
- Video hooks and scripts
- Trending sound suggestions
- Video concepts and series ideas
- Adapting trends to Asturias content
- Content calendar for consistency

Always stay in character as Tiko and focus on TikTok content.`,
  },
];

// Popular free voices from ElevenLabs library (pre-selected based on quality and fit)
const VOICE_SUGGESTIONS = {
  xander: "pNInz6obpgDQGcFmaJgB", // Adam - conversational male
  iris: "EXAVITQu4vr4xnSDxMaL", // Bella - warm female
  penny: "21m00Tcm4TlvDq8ikWAM", // Rachel - professional female
  tiko: "VR6AewLTigWG4xSOukaG", // Arnold - energetic male
};

async function listAvailableVoices(): Promise<void> {
  console.log("\n📢 Fetching available voices from ElevenLabs...\n");

  try {
    const response = await fetch(`${BASE_URL}/voices`, {
      headers: {
        "xi-api-key": API_KEY!,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    console.log("Available voices in your account:");
    for (const voice of data.voices.slice(0, 10)) {
      console.log(`  - ${voice.name} (${voice.voice_id})`);
    }
    console.log("\nUsing pre-selected voices for agents...\n");
  } catch (error) {
    console.log("Could not fetch voices, using default voice IDs...\n");
  }
}

async function createAgent(config: AgentConfig): Promise<string | null> {
  const voiceId =
    VOICE_SUGGESTIONS[config.id as keyof typeof VOICE_SUGGESTIONS];

  const agentConfig = {
    name: config.name,
    conversation_config: {
      agent: {
        first_message: config.greeting,
        language: "en",
        prompt: {
          prompt: config.systemPrompt,
          llm: "gpt-4o-mini", // Cost-effective for free tier
          temperature: 0.7,
          max_tokens: 500,
        },
      },
      tts: {
        model_id: "eleven_turbo_v2_5", // Fast and cost-effective
        voice_id: voiceId,
        stability: 0.5,
        similarity_boost: 0.75,
      },
      turn: {
        turn_timeout: 10.0,
        silence_end_call_timeout: 30.0,
      },
      conversation: {
        max_duration_seconds: 300, // 5 minutes max per call
      },
    },
    platform_settings: {
      widget: {
        variant: "compact",
        avatar: {
          type: "orb",
          color_1: "#2d2a26", // Paisaxe brand color
          color_2: "#c9a55c", // Paisaxe accent color
        },
        feedback_mode: "end",
      },
    },
  };

  try {
    const response = await fetch(`${BASE_URL}/convai/agents/create`, {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(
        `  ❌ Failed to create ${config.displayName}:`,
        response.status,
        errorData
      );
      return null;
    }

    const data = await response.json();
    console.log(`  ✅ Created ${config.displayName}: ${data.agent_id}`);
    return data.agent_id;
  } catch (error) {
    console.error(`  ❌ Error creating ${config.displayName}:`, error);
    return null;
  }
}

async function saveAgentIds(
  agentIds: Record<string, string>
): Promise<void> {
  // Save to a TypeScript config file
  const configContent = `/**
 * ElevenLabs Agent IDs
 * Auto-generated by scripts/setup-elevenlabs-agents.ts
 * Do not edit manually.
 */

export const ELEVENLABS_AGENT_IDS = {
  xander: "${agentIds.xander || ""}",
  iris: "${agentIds.iris || ""}",
  penny: "${agentIds.penny || ""}",
  tiko: "${agentIds.tiko || ""}",
} as const;

export type ElevenLabsAgentId = keyof typeof ELEVENLABS_AGENT_IDS;
`;

  const configPath = path.join(
    process.cwd(),
    "src/config/elevenlabs-agents.ts"
  );
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, configContent);
  console.log(`\n📁 Saved agent IDs to ${configPath}`);
}

async function main(): Promise<void> {
  console.log("🎙️  ElevenLabs Marketing Agents Setup\n");
  console.log("This script will create 4 voice agents in your ElevenLabs account.");
  console.log("Make sure ELEVENLABS_API_KEY is set in .env.local\n");

  await listAvailableVoices();

  console.log("Creating agents...\n");

  const agentIds: Record<string, string> = {};
  let successCount = 0;

  for (const agent of AGENTS) {
    console.log(`Creating ${agent.displayName} (${agent.platform})...`);
    const agentId = await createAgent(agent);
    if (agentId) {
      agentIds[agent.id] = agentId;
      successCount++;
    }
  }

  console.log(`\n✨ Created ${successCount}/${AGENTS.length} agents successfully!`);

  if (successCount > 0) {
    await saveAgentIds(agentIds);
  }

  console.log("\n📋 Agent IDs:");
  for (const [id, agentId] of Object.entries(agentIds)) {
    console.log(`  ${id}: ${agentId}`);
  }

  if (successCount < AGENTS.length) {
    console.log("\n⚠️  Some agents failed to create. Check the errors above.");
    console.log("You may need to verify your API key or check your ElevenLabs plan limits.");
  }

  console.log("\n🎉 Setup complete! You can now use voice chat with your agents.");
}

main().catch(console.error);
