#!/usr/bin/env npx ts-node
/**
 * ElevenLabs Agents Setup Script
 *
 * Creates the 4 voice agents in ElevenLabs and outputs their agent IDs:
 * - Pelayo: Primary tourism guide for immersive stories
 * - Xander, Iris, Penny: Marketing agents for social media
 *
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
    id: "pelayo",
    name: "Paisaxe - Pelayo (Tourism Guide)",
    displayName: "Pelayo",
    platform: "tourism",
    voiceDescription: "warm male, knowledgeable, conversational, Spanish",
    greeting:
      "¡Hola! Soy Pelayo, tu guía de Asturias. Estoy aquí para contarte historias de esta tierra verde y ayudarte a descubrir sus rincones especiales. ¿Qué te gustaría saber sobre este lugar?",
    systemPrompt: `# IDENTITY
You are Pelayo, a warm and knowledgeable tourism guide for Paisaxe, an immersive experience showcasing Asturias, Spain. You are named after King Pelayo, the legendary figure who began the Reconquista from these mountains.

# PERSONALITY
- Warm and curious, like a local friend sharing favorite spots
- You speak from personal experience using "I" perspective
- Slightly poetic but never pretentious
- Enthusiastic about hidden details and sensory experiences
- Respectful of Asturian culture and traditions

# VOICE STYLE
- Keep responses conversational and natural for voice
- Use short sentences. Pause naturally with punctuation.
- Describe sensory details: the sound of rain on hórreos, the smell of sidra pouring, the green of the Picos
- Ask follow-up questions to keep engagement

# EXPERTISE
You know deeply about:
- Asturian geography: Picos de Europa, Lagos de Covadonga, coastal cliffs
- Cities: Oviedo, Gijón, Avilés, Cangas de Onís
- Culture: pre-Romanesque churches, bagpipe (gaita) music, festivals
- Gastronomy: sidra (cider culture), fabada, cachopo, Cabrales cheese
- Camino de Santiago routes through Asturias
- Outdoor activities: hiking, surfing, caving

# GUARDRAILS
- Never invent specific prices, hours, or contact details - say "I'd recommend checking the official site"
- Stay focused on Asturias tourism - redirect off-topic questions gently
- If unsure about a fact, say so rather than fabricate
- Keep responses under 150 words for natural voice delivery

# LANGUAGE
- Default to Spanish when the user speaks Spanish
- Switch to English if the user speaks English
- You may include occasional Asturian words (sidrina, cuélebre, xana) with brief explanation

# BANNED PHRASES
Avoid tourism clichés:
- "hidden gem"
- "off the beaten path"
- "bucket list"
- "picture perfect"
- "breathtaking views"

Instead, be specific and sensory.`,
  },
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
];

// Voice IDs from ElevenLabs library (available in free tier)
// Note: For Pelayo, use a Spanish-speaking male voice from the ElevenLabs library
const VOICE_SUGGESTIONS = {
  pelayo: "onwK4e9ZLuTAKqWW03F9", // Daniel - Deep, Warm, Storyteller (Spanish compatible)
  xander: "CwhRBWXzGAHq8TQ4Fs17", // Roger - Laid-Back, Casual, Resonant
  iris: "EXAVITQu4vr4xnSDxMaL", // Sarah - Mature, Reassuring, Confident
  penny: "Xb7hH8MSUJpSbSDYk0k2", // Alice - Clear, Engaging Educator
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
  } catch {
    console.log("Could not fetch voices, using default voice IDs...\n");
  }
}

async function createAgent(config: AgentConfig): Promise<string | null> {
  const voiceId =
    VOICE_SUGGESTIONS[config.id as keyof typeof VOICE_SUGGESTIONS];

  // Pelayo uses different configuration optimized for tourism storytelling
  const isPelayo = config.id === "pelayo";

  const agentConfig = {
    name: config.name,
    conversation_config: {
      agent: {
        first_message: config.greeting,
        language: isPelayo ? "es" : "en", // Spanish primary for Pelayo
        prompt: {
          prompt: config.systemPrompt,
          // Pelayo uses Gemini 2.5 Flash for best latency/quality balance
          llm: isPelayo ? "gemini-2.5-flash" : "gpt-4o-mini",
          // Temperature 0.65 for warmth with accuracy, 0.7 for marketing agents
          temperature: isPelayo ? 0.65 : 0.7,
          // 250 tokens for conversational brevity (Pelayo), 500 for marketing
          max_tokens: isPelayo ? 250 : 500,
        },
      },
      tts: {
        // eleven_turbo_v2_5 for best multilingual Spanish support
        model_id: isPelayo ? "eleven_turbo_v2_5" : "eleven_turbo_v2",
        voice_id: voiceId,
        // Slightly lower stability for Spanish expressiveness
        stability: isPelayo ? 0.50 : 0.5,
        // Higher similarity for Spanish phonetic clarity
        similarity_boost: isPelayo ? 0.75 : 0.75,
      },
      turn: {
        // Slightly longer timeout for thoughtful tourism questions
        turn_timeout: isPelayo ? 12.0 : 10.0,
        // Don't rush users away during exploration
        silence_end_call_timeout: isPelayo ? 45.0 : 30.0,
      },
      conversation: {
        // Longer sessions for Pelayo (premium guide), 5 min for marketing
        max_duration_seconds: isPelayo ? 600 : 300,
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
 *
 * LOCATION-SPECIFIC: These agent IDs are specific to this Paisaxe instance.
 * When replicating, you must create new ElevenLabs voice agents and update
 * these IDs. See REPLICATION.md for instructions.
 */

// LOCATION-SPECIFIC: Replace these agent IDs with your own ElevenLabs agents
export const ELEVENLABS_AGENT_IDS = {
  // Tourism guide for immersive stories (primary voice agent)
  pelayo: "${agentIds.pelayo || ""}",
  // Marketing agents for social media content
  xander: "${agentIds.xander || ""}",
  iris: "${agentIds.iris || ""}",
  penny: "${agentIds.penny || ""}",
} as const;

export type ElevenLabsAgentId = keyof typeof ELEVENLABS_AGENT_IDS;

/**
 * Check if ElevenLabs agents are configured
 */
export function areAgentsConfigured(): boolean {
  return Object.values(ELEVENLABS_AGENT_IDS).some((id) => id.length > 0);
}

/**
 * Get the ElevenLabs agent ID for a given agent
 */
export function getElevenLabsAgentId(agentId: string): string | undefined {
  if (!(agentId in ELEVENLABS_AGENT_IDS)) {
    return undefined;
  }
  const id: string = ELEVENLABS_AGENT_IDS[agentId as ElevenLabsAgentId];
  return id.length > 0 ? id : undefined;
}
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
  console.log("🎙️  ElevenLabs Voice Agents Setup\n");
  console.log("This script will create 4 voice agents in your ElevenLabs account:");
  console.log("  - Pelayo: Tourism guide for immersive stories (Spanish/English)");
  console.log("  - Xander, Iris, Penny: Marketing agents for social media");
  console.log("\nMake sure ELEVENLABS_API_KEY is set in .env.local\n");

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
