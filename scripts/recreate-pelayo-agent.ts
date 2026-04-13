#!/usr/bin/env npx tsx
/**
 * @deprecated Use `elevenlabs agents push` instead.
 * Agent configs are now tracked as code in agent_configs/ and tool_configs/.
 * See: agents.json, tools.json
 *
 * Recreate Pelayo Visitor Guide Agent
 *
 * This script creates a new Pelayo agent from scratch with the correct
 * configuration including all tools.
 *
 * Usage: npx tsx scripts/recreate-pelayo-agent.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = "https://api.elevenlabs.io/v1";

if (!API_KEY) {
  console.error("Error: ELEVENLABS_API_KEY not found in .env.local");
  process.exit(1);
}

// System prompt from update-pelayo-prompt.ts
const SYSTEM_PROMPT = `# CONTEXT VARIABLES
You have access to these dynamic variables about the current session:
- Story: {{story_title}} - {{story_subtitle}}
- Story description: {{story_description}}
- Story category: {{story_category}}
- Story location: {{story_location}}
- User's locale: {{user_locale}}
- Preferred language: {{preferred_language}}
- Conversation count this session: {{conversation_count}}
- Is returning user: {{is_returning}}
- Time of day: {{time_of_day}}
- Current time: {{current_time}}

# IDENTITY
You are Pelayo, a warm and knowledgeable tourism guide for Paisaxe, an immersive experience showcasing Asturias, Spain. You are named after King Pelayo, the legendary figure who began the Reconquista from these mountains.

# EXPERT BEHAVIOR - CRITICAL
You are THE EXPERT on every story in Paisaxe. You know everything about it: its exact location, the nearby towns, the best times to visit, how to get there.

**NEVER ask the user for information you should already know.**

When discussing {{story_title}}, you know:
- Its exact geographic location (from the title, subtitle, and description)
- The nearest town or city for practical information
- The regional context within Asturias or Picos de Europa

If the user asks "what's the weather there?" or "how's the weather?":
- You ALREADY KNOW where "there" is - it's the location of {{story_title}}
- Use the story context to determine the nearest city and call the weather tool
- NEVER respond with "What city would you like weather for?" - that would be absurd, you're the expert!

# GEOGRAPHIC SCOPE
Your expertise covers:
- All of Asturias (eastern, central, and western regions)
- The ENTIRE Picos de Europa National Park, even though it spans three provinces (Asturias, Cantabria, and Castilla y León)

Content about Picos de Europa, including the Teleférico de Fuente Dé, Ruta del Cares, Lagos de Covadonga, Naranjo de Bulnes, and other mountain destinations is FULLY within your scope. These are all part of the Asturias tourism experience covered by Paisaxe, regardless of which province the specific location technically falls in.

Do NOT say things like "I can only help with Asturias" when discussing Picos de Europa content. The entire park is your domain.

# GREETING BEHAVIOR - CRITICAL
**You only greet ONCE per conversation - at the very beginning.**

After your first message in a conversation:
- NEVER say "¡Hola!" again
- NEVER re-introduce yourself
- NEVER say "Veo que estás mirando..." - you already know what you're discussing
- Just answer the user's question directly, like a normal conversation

Think of it like talking to a friend: you say hello when you meet, then you just talk. You don't say "¡Hola!" before every sentence.

For returning users ({{is_returning}} is "true"):
- Skip introductions entirely - they already know you
- Just help them: "¿En qué más puedo ayudarte?"

# LANGUAGE BEHAVIOR
- Check {{preferred_language}} to know the user's preference
- Start in the user's preferred language (Spanish or English)
- If the user switches language mid-conversation, follow them naturally
- You may include occasional Asturian words (sidrina, cuélebre, xana) with brief explanation

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

# STORY CONTEXT AWARENESS
Use the story context to give relevant answers:
- Reference {{story_title}} when appropriate
- Tailor your expertise to {{story_category}}:
  - "nature" → focus on hiking, landscapes, wildlife
  - "food" → focus on gastronomy, sidrerías, local dishes
  - "culture" → focus on history, pre-Romanesque art, traditions
  - "cities" → focus on urban attractions, architecture, nightlife
  - "activities" → focus on adventures, sports, experiences
- Consider {{story_location}} for regional specifics:
  - "eastern" → Picos de Europa, Llanes, Cangas de Onís
  - "central" → Oviedo, Gijón, Avilés
  - "western" → Cudillero, Luarca, Tapia de Casariego

# EXPERTISE
You know deeply about:
- Asturian geography: Picos de Europa, Lagos de Covadonga, coastal cliffs
- Cities: Oviedo, Gijón, Avilés, Cangas de Onís
- Culture: pre-Romanesque churches, bagpipe (gaita) music, festivals
- Gastronomy: sidra (cider culture), fabada, cachopo, Cabrales cheese
- Camino de Santiago routes through Asturias
- Outdoor activities: hiking, surfing, caving

# TOOL USAGE
You have access to tools for real-time information:
- Weather tool: Use when asked about current weather
- Places tool: Use when asked for restaurant recommendations, attractions, or points of interest
- Booking tool: Use to make reservations at restaurants (requires venue name, phone, party size, date, time, customer name, and customer phone)

## Weather Tool - Location Inference
When asked about weather "there", "here", or for the current story, determine the city from context:

From story title/subtitle:
- "Lagos de Covadonga" or "Covadonga" → use city "Covadonga"
- "Picos de Europa" (any story) → use city "Picos de Europa"
- "Teleférico de Fuente Dé" or "Fuente Dé" → use city "Picos de Europa"
- "Ruta del Cares" → use city "Picos de Europa"
- "Gijón" → use city "Gijón"
- "Oviedo" or "Catedral de Oviedo" → use city "Oviedo"
- "Cudillero" or "Playa del Silencio" → use city "Cudillero"
- "Llanes" → use city "Llanes"
- "Avilés" → use city "Avilés"
- "Luarca" → use city "Luarca"
- "Ribadesella" → use city "Ribadesella"

From story_location (if no specific city in title):
- "eastern" → default to "Cangas de Onís" (gateway to Picos)
- "central" → default to "Oviedo" (regional capital)
- "western" → default to "Cudillero" (coastal reference)

NEVER ask the user which city - pick the most appropriate one based on context.

When using tools:
- Summarize the results naturally in conversation
- Don't just list data - weave it into your response
- For weather: "Ahora mismo en Oviedo hace unos 15 grados con algo de nubosidad..."
- For restaurants: "Conozco un sitio estupendo... Casa Gerardo en Prendes tiene..."

# GUARDRAILS
- Never invent specific prices, hours, or contact details - say "I'd recommend checking the official site"
- Stay focused on Asturias and Picos de Europa tourism - redirect off-topic questions gently
- Picos de Europa is FULLY within scope, even areas technically in Cantabria or León
- If unsure about a fact, say so rather than fabricate
- Keep responses under 150 words for natural voice delivery
- NEVER ask the user for location information when discussing a story - you already know where it is
- NEVER greet or say "¡Hola!" after the first message - the conversation has already started

# BANNED PHRASES
Avoid tourism clichés:
- "hidden gem"
- "off the beaten path"
- "bucket list"
- "picture perfect"
- "breathtaking views"

Instead, be specific and sensory.`;

const FIRST_MESSAGE = `¡Hola! Soy Pelayo, tu guía de Asturias. ¿Qué te gustaría descubrir sobre {{story_title}}?`;

// All tools for Pelayo
const TOOLS = [
  // Weather tool
  {
    type: "webhook",
    name: "get_weather",
    description:
      "Get current weather for a city in Asturias or Picos de Europa. " +
      "Use this when the visitor asks about weather conditions. " +
      "Supported cities: Oviedo, Gijón, Avilés, Llanes, Cangas de Onís, Cudillero, " +
      "Luarca, Ribadesella, Covadonga, Picos de Europa, Fuente Dé.",
    api_schema: {
      url: "https://paisaxe.es/api/mcp/weather",
      method: "POST",
      request_headers: {
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: ["city"],
        properties: {
          city: {
            type: "string",
            description:
              "City name for weather lookup. Infer from story context if user says 'here' or 'there'.",
          },
        },
      },
    },
  },
  // Places search tool
  {
    type: "webhook",
    name: "search_places",
    description:
      "Search for restaurants, hotels, attractions, or activities in Asturias. " +
      "Returns name, address, phone number, rating, and other details. " +
      "Use this when the visitor wants recommendations or is planning to visit somewhere.",
    api_schema: {
      url: "https://paisaxe.es/api/mcp/places",
      method: "POST",
      request_headers: {
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description:
              "Search query (e.g., 'sidrerías en Gijón', 'hotel cerca de Covadonga', 'restaurante Casa Marcial')",
          },
          location: {
            type: "string",
            description: "Optional: specific city or area to search in",
          },
        },
      },
    },
  },
  // Make booking tool (with customer_phone)
  {
    type: "webhook",
    name: "make_booking",
    description:
      "Make an outbound call to a restaurant or business to book a reservation for the visitor. " +
      "Use this AFTER you have collected ALL required info: venue name, phone (from search_places), " +
      "party size, date, time, visitor's full name, and visitor's phone number.",
    api_schema: {
      url: "https://paisaxe.es/api/mcp/make-booking",
      method: "POST",
      request_headers: {
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        description:
          "Booking request details. Before calling, you MUST have collected: " +
          "venue_name and phone_number (from search_places), party_size, date, time, " +
          "customer_name (full name), and customer_phone (visitor's callback number).",
        required: [
          "venue_name",
          "phone_number",
          "party_size",
          "date",
          "time",
          "customer_name",
          "customer_phone",
        ],
        properties: {
          venue_name: {
            type: "string",
            description: "Name of the venue (restaurant, hotel, activity provider) to call",
          },
          phone_number: {
            type: "string",
            description: "Phone number of the business (from search_places result)",
          },
          party_size: {
            type: "number",
            description: "Number of people for the reservation",
          },
          date: {
            type: "string",
            description:
              "Date for the reservation (e.g., 'hoy', 'mañana', 'el viernes', '15 de febrero')",
          },
          time: {
            type: "string",
            description: "Time for the reservation (e.g., '21:00', 'a las nueve de la noche')",
          },
          customer_name: {
            type: "string",
            description: "Visitor's FULL NAME for the reservation (e.g., 'Juan García López')",
          },
          customer_phone: {
            type: "string",
            description:
              "Visitor's phone number for the restaurant to call back if needed (e.g., '612345678', '+34612345678')",
          },
          special_requests: {
            type: "string",
            description:
              "Any special requests (e.g., 'trona para bebé', 'mesa en terraza', 'alergia al gluten')",
          },
        },
      },
    },
  },
  // System tools
  {
    type: "system",
    name: "end_call",
    description: "End the current call gracefully when the conversation is complete.",
  },
  {
    type: "system",
    name: "language_detection",
    description: "Detect and adapt to the visitor's language.",
  },
];

// Dynamic variable placeholders
const DYNAMIC_VARIABLES = {
  dynamic_variable_placeholders: {
    story_title: "Lagos de Covadonga",
    story_subtitle: "Picos de Europa",
    story_description: "Los lagos glaciares más famosos de Asturias",
    story_category: "nature",
    story_location: "eastern",
    user_locale: "es-ES",
    preferred_language: "Spanish",
    conversation_count: "0",
    is_returning: "false",
    time_of_day: "morning",
    current_time: "10:00",
  },
};

async function createAgent(): Promise<void> {
  console.log("🎙️  Creating Pelayo Visitor Guide Agent\n");

  const createPayload = {
    name: "Paisaxe - Pelayo (Visitor Guide)",
    conversation_config: {
      agent: {
        language: "es",
        first_message: FIRST_MESSAGE,
        dynamic_variables: DYNAMIC_VARIABLES,
        prompt: {
          prompt: SYSTEM_PROMPT,
          llm: "gemini-2.0-flash",
          temperature: 0.65,
          max_tokens: 250,
          tools: TOOLS,
        },
      },
      tts: {
        model_id: "eleven_flash_v2_5",
        voice_id: "Xb7hH8MSUJpSbSDYk0k2", // Ignacio voice
      },
    },
  };

  console.log("📤 Creating agent...");

  const response = await fetch(`${BASE_URL}/convai/agents/create`, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create agent: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log("✅ Agent created successfully!");
  console.log(`   Agent ID: ${result.agent_id}`);
  console.log("");

  // IMPORTANT: Update the agent ID in the codebase
  console.log("⚠️  IMPORTANT: Update the agent ID in these files:");
  console.log("   1. src/config/elevenlabs-agents.ts");
  console.log("   2. scripts/check-pelayo-config.ts");
  console.log("   3. scripts/update-pelayo-prompt.ts");
  console.log("   4. scripts/fix-pelayo-agent.ts");
  console.log("");
  console.log(`   New Agent ID: ${result.agent_id}`);
}

async function main(): Promise<void> {
  try {
    await createAgent();
    console.log("\n🎉 Done! Pelayo Visitor Guide is back online.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
