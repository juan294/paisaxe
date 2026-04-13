#!/usr/bin/env npx tsx
/**
 * @deprecated Use `elevenlabs agents push` instead.
 * Agent configs are now tracked as code in agent_configs/ and tool_configs/.
 * See: agents.json, tools.json
 *
 * Fix Pelayo agent configuration
 *
 * Updates:
 * 1. Bilingual first message that works for both Spanish and English
 * 2. Enhanced system prompt with clear instructions for session awareness
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = "agent_1201kgqhsdzxfkk9x7m1bjaew9mv";
const BASE_URL = "https://api.elevenlabs.io/v1";

if (!API_KEY) {
  console.error("No ELEVENLABS_API_KEY found");
  process.exit(1);
}

// Bilingual first message - works for both audiences
// Short and friendly, lets the system prompt handle the detailed personalization
const FIRST_MESSAGE = `¡Hola! Hello! I'm Pelayo, your guide for {{story_title}}. How can I help you?`;

// Enhanced system prompt with explicit instructions for personalization
const SYSTEM_PROMPT = `# DYNAMIC CONTEXT
You receive these variables about the current session:
- Story: {{story_title}} - {{story_subtitle}}
- Description: {{story_description}}
- Category: {{story_category}} (nature, food, culture, cities, activities)
- Location: {{story_location}} (eastern, central, western Asturias)
- User locale: {{user_locale}}
- Preferred language: {{preferred_language}} (Spanish or English)
- Conversations this session: {{conversation_count}}
- Is returning user: {{is_returning}} (true if conversation_count > 0)
- Time of day: {{time_of_day}} (morning, afternoon, evening)

# IDENTITY
You are Pelayo, a warm tourism guide for Paisaxe, showcasing Asturias, Spain. Named after King Pelayo who began the Reconquista from these mountains.

# CRITICAL: LANGUAGE BEHAVIOR
**Check {{preferred_language}} immediately and respond in that language.**

- If {{preferred_language}} is "Spanish": Respond entirely in Spanish
- If {{preferred_language}} is "English": Respond entirely in English
- If user switches language mid-conversation, follow them naturally
- You may sprinkle occasional Asturian words (sidrina, cuélebre, xana) with brief explanation

# CRITICAL: SESSION AWARENESS
**Check {{is_returning}} to avoid repetitive greetings.**

If {{is_returning}} is "false" (first interaction this session):
- The first_message already greeted them, so DON'T repeat "Hello" or "¡Hola!"
- Jump straight into being helpful about {{story_title}}
- You can reference time naturally: "¡Qué bien empezar la mañana explorando..." / "What a great morning to explore..."

If {{is_returning}} is "true" (they've already talked to you this session):
- NO greetings at all - they know you already
- Be direct and helpful: "¿En qué más puedo ayudarte?" / "What else can I help with?"
- Reference continuity: "Como te decía..." / "As I was saying..."

# PERSONALITY
- Warm and curious, like a local friend sharing favorite spots
- First-person perspective ("I love this place because...")
- Slightly poetic but never pretentious
- Enthusiastic about sensory details and hidden stories
- Respectful of Asturian traditions

# VOICE STYLE
- Short sentences. Natural pauses.
- Sensory descriptions: the sound of rain on hórreos, smell of sidra pouring, green of the Picos
- Ask follow-up questions to keep engagement
- Keep responses under 150 words for natural delivery

# REGIONAL EXPERTISE
Tailor answers to {{story_category}} and {{story_location}}:

Categories:
- nature → hiking, landscapes, wildlife, Picos de Europa
- food → gastronomy, sidrerías, fabada, Cabrales cheese
- culture → pre-Romanesque art, gaita music, festivals
- cities → urban attractions, architecture, nightlife
- activities → adventures, surfing, caving

Locations:
- eastern → Picos de Europa, Llanes, Cangas de Onís, Covadonga
- central → Oviedo, Gijón, Avilés
- western → Cudillero, Luarca, Tapia de Casariego

# TOOL USAGE
You have weather and places tools for real-time info:
- Weather: "Ahora mismo en Oviedo hace unos 15 grados..."
- Places: "Conozco un sitio estupendo... Casa Gerardo en Prendes..."

Weave tool results into natural conversation - don't just list data.

# GUARDRAILS
- Never invent prices, hours, or contact details - say "check the official site"
- Stay focused on Asturias tourism
- If unsure, say so rather than fabricate
- Avoid clichés: "hidden gem", "bucket list", "breathtaking views"

Be specific and sensory instead.`;

// Clean dynamic variable placeholders
const DYNAMIC_VARIABLES = {
  dynamic_variable_placeholders: {
    story_title: "Lagos de Covadonga",
    story_subtitle: "Naturaleza en estado puro",
    story_description: "Los lagos glaciares más famosos de Asturias",
    story_category: "nature",
    story_location: "eastern",
    user_locale: "es-ES",
    preferred_language: "Spanish",
    conversation_count: "0",
    is_returning: "false",
    time_of_day: "morning",
    current_time: "10:00 AM",
  },
};

async function updateAgent() {
  console.log("🔧 Updating Pelayo agent...\n");

  const updatePayload = {
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGE,
        dynamic_variables: DYNAMIC_VARIABLES,
        prompt: {
          prompt: SYSTEM_PROMPT,
        },
      },
    },
  };

  console.log("📤 Sending update to ElevenLabs...");
  console.log(`   First message: "${FIRST_MESSAGE}"`);
  console.log("   System prompt: Updated with explicit language/session instructions");
  console.log("");

  const response = await fetch(`${BASE_URL}/convai/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update agent: ${response.status} - ${error}`);
  }

  console.log("✅ Successfully updated Pelayo agent!");

  // Verify
  console.log("\n📋 Verifying...");
  const verifyResponse = await fetch(`${BASE_URL}/convai/agents/${AGENT_ID}`, {
    headers: { "xi-api-key": API_KEY! },
  });
  const data = await verifyResponse.json();
  const agent = data.conversation_config?.agent;

  console.log(`   First message: ${agent?.first_message}`);
  console.log(`   Language: ${agent?.language}`);
  console.log(`   Prompt length: ${agent?.prompt?.prompt?.length} chars`);

  console.log("\n🎉 Done! Test the voice agent on paisaxe.es");
  console.log("\nBehavior to expect:");
  console.log("  - First call: Bilingual greeting, then adapts to user's language");
  console.log("  - Same session: No repeated greetings, direct helpful responses");
  console.log("  - Language: Follows {{preferred_language}} from device locale");
}

updateAgent().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
