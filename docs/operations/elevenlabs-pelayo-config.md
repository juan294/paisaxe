# ElevenLabs Pelayo Agent Configuration

> **Last Updated:** 2026-02-04
> **Agent ID:** `agent_3101kg5bvnf4f1r94f0cav0v9y61`

Pelayo is the primary voice agent for Paisaxe immersive stories - a warm and knowledgeable tourism guide for Asturias, Spain.

---

## Overview

| Aspect | Value |
|--------|-------|
| **Role** | Tourism storytelling guide for Asturias |
| **Interaction Style** | Conversational, warm, informative |
| **Languages** | Spanish (primary), English (secondary) |
| **Budget Tier** | ElevenLabs Starter ($5/month) |
| **Cost Target** | ~$0.10/minute |

---

## LLM Configuration

### Primary LLM: Gemini 2.5 Flash

| Model | Latency | Cost/min | Use Case |
|-------|---------|----------|----------|
| **Gemini 2.5 Flash** | ~1.1s | ~$0.0015 | Default - best balance |
| Gemini 2.0 Flash Lite | ~568ms | ~$0.0007 | Ultra-fast, simpler responses |
| GPT-4o Mini | ~932ms | ~$0.0015 | Backup option |

**Why Gemini 2.5 Flash:**
- Recommended default by ElevenLabs for enterprise agents
- Strong multilingual support (Spanish + English)
- Enhanced reasoning for contextual tourism knowledge
- Low latency essential for natural conversation

### LLM Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Temperature** | 0.65 | Warmth with accuracy |
| **Max Tokens** | 250 | ~90 seconds spoken max |

**Backup Strategy:** Enable "Default" backup with Gemini 2.0 Flash and GPT-4o Mini for resilience.

---

## System Prompt

The current system prompt includes dynamic variables passed from the frontend and tool usage instructions:

```
# CONTEXT VARIABLES
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

# GREETING BEHAVIOR
Adapt your greeting based on session context:

If {{is_returning}} is "false" (first conversation):
- Give a warm, full introduction
- Introduce yourself as their guide for this story
- Reference the time of day naturally: "¡Buenos días!" / "¡Buenas tardes!" / "¡Buenas noches!"

If {{is_returning}} is "true" (returning user):
- Skip the full introduction - they already know you
- Be brief and welcoming: "¿En qué más puedo ayudarte?" or "¿Qué más quieres descubrir?"
- You can reference that you've been chatting: "Me alegra que sigas explorando..."

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
- Weather tool: Use when asked about current weather in Asturias cities
- Places tool: Use when asked for restaurant recommendations, attractions, or points of interest

When using tools:
- Summarize the results naturally in conversation
- Don't just list data - weave it into your response
- For weather: "Ahora mismo en Oviedo hace unos 15 grados con algo de nubosidad..."
- For restaurants: "Conozco un sitio estupendo... Casa Gerardo en Prendes tiene..."

# GUARDRAILS
- Never invent specific prices, hours, or contact details - say "I'd recommend checking the official site"
- Stay focused on Asturias tourism - redirect off-topic questions gently
- If unsure about a fact, say so rather than fabricate
- Keep responses under 150 words for natural voice delivery

# BANNED PHRASES
Avoid tourism clichés:
- "hidden gem"
- "off the beaten path"
- "bucket list"
- "picture perfect"
- "breathtaking views"

Instead, be specific and sensory.
```

---

## First Message (Greeting)

**Spanish (Primary):**
```
¡Hola! Soy Pelayo, tu guía de Asturias. Estoy aquí para contarte historias de esta tierra verde y ayudarte a descubrir sus rincones especiales. ¿Qué te gustaría saber sobre este lugar?
```

**English Alternative:**
```
Hello! I'm Pelayo, your guide to Asturias. I'm here to share stories of this green land and help you discover its special corners. What would you like to know about this place?
```

---

## Voice Settings

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Voice** | Ignacio - Neutral and Authentic | Spanish male voice |
| **TTS Model** | Turbo (eleven_turbo_v2_5) | Fastest, best multilingual Spanish support |
| **Stability** | 0.50 | Lower for Spanish expressiveness and warmth |
| **Similarity Boost** | 0.75 | Higher for Spanish phonetic clarity |
| **Speed** | 0.95x | Slightly slower for storytelling rhythm |

**Tip:** Spanish voices benefit from lower stability (0.45-0.55) to capture natural melodic quality.

---

## Conversation Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Max Duration** | 600s (10 min) | Allow longer exploration sessions |
| **Turn Timeout** | 12s | Time for thoughtful questions |
| **Silence End Call** | 45s | Don't rush users away |
| **Interruptible** | Yes | Natural conversation flow |

---

## Language Configuration

| Setting | Value |
|---------|-------|
| **Primary Language** | Spanish (es) |
| **Additional Languages** | English, German, French, Portuguese |
| **Language Detection** | Auto-detect from user input |

---

## RAG Knowledge Base

Curated PDFs uploaded to ElevenLabs for specialized Asturias knowledge.

### Documents Included

| Document | Content |
|----------|---------|
| Guía para visitar Oviedo | City guide |
| Guía para visitar Gijón | City guide |
| Guía para visitar Avilés | City guide |
| Planificador del Camino de Santiago | Pilgrimage route planning |
| Guía cultura | Pre-Romanesque, museums, festivals |
| Asturias en familia | Family activities |
| El Cuento de Asturias | Regional story/overview |

### RAG Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Embedding model** | Multilingual optimized | Spanish content |
| **Character limit** | 15000 | Voice responses are short; less context = faster |
| **Chunk limit** | 5 | Fewer high-quality chunks; reduces latency |
| **Vector distance limit** | 0.40 | Stricter matching = higher quality results |
| **Query rewrite** | Off (default) | Default works well |

---

## Webhook Tools

### Production Tools (paisaxe.es)

#### get_weather

```json
{
  "type": "webhook",
  "name": "get_weather",
  "description": "Get current weather for cities in Asturias. Returns temperature, humidity, wind speed, and conditions.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://paisaxe.es/api/mcp/weather",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for weather lookup",
      "properties": [
        {
          "id": "city",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "City name in Asturias such as Oviedo, Gijon, Aviles, Llanes, Cudillero, or Luarca",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [
      {
        "type": "value",
        "name": "Content-Type",
        "value": "application/json"
      }
    ],
    "auth_connection": null
  },
  "response_timeout_secs": 20,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  }
}
```

#### search_places

```json
{
  "type": "webhook",
  "name": "search_places",
  "description": "Search for restaurants, bars, cafes, museums, and attractions in Asturias",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://paisaxe.es/api/mcp/places",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for places search",
      "properties": [
        {
          "id": "query",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "What to search for such as fabada, sidreria, restaurante, museo, or playa",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        },
        {
          "id": "type",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Optional filter: restaurant, bar, cafe, museum, tourist_attraction, park",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "city",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Optional city to search near such as Oviedo, Gijon, or Aviles",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [
      {
        "type": "value",
        "name": "Content-Type",
        "value": "application/json"
      }
    ],
    "auth_connection": null
  },
  "response_timeout_secs": 20,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  }
}
```

### Development Tools (paisaxe.tunnelfor.me)

For local development testing with Pelayo-Dev agent.

#### get_weather_dev

```json
{
  "type": "webhook",
  "name": "get_weather_dev",
  "description": "DEV: Get current weather for cities in Asturias. Returns temperature, humidity, wind speed, and conditions.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://paisaxe.tunnelfor.me/api/mcp/weather",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for weather lookup",
      "properties": [
        {
          "id": "city",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "City name in Asturias such as Oviedo, Gijon, Aviles, Llanes, Cudillero, or Luarca",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [
      {
        "type": "value",
        "name": "Content-Type",
        "value": "application/json"
      }
    ],
    "auth_connection": null
  },
  "response_timeout_secs": 20,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  }
}
```

#### search_places_dev

```json
{
  "type": "webhook",
  "name": "search_places_dev",
  "description": "DEV: Search for restaurants, bars, cafes, museums, and attractions in Asturias",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://paisaxe.tunnelfor.me/api/mcp/places",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for places search",
      "properties": [
        {
          "id": "query",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "What to search for such as fabada, sidreria, restaurante, museo, or playa",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        },
        {
          "id": "type",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Optional filter: restaurant, bar, cafe, museum, tourist_attraction, park",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "city",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Optional city to search near such as Oviedo, Gijon, or Aviles",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [
      {
        "type": "value",
        "name": "Content-Type",
        "value": "application/json"
      }
    ],
    "auth_connection": null
  },
  "response_timeout_secs": 20,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  }
}
```

### System Tools Enabled

- **Detect language** - Auto-detect visitor's language for multilingual support
- **End conversation** - Allows graceful goodbyes

---

## Dynamic Variables (Frontend)

The frontend passes these variables via `voice-chat-elevenlabs.tsx`:

```typescript
dynamicVariables: {
  // Story context
  story_title: localizedStory.title,
  story_subtitle: localizedStory.subtitle,
  story_description: localizedStory.description,
  story_category: story.category || "general",
  story_location: story.location || "Asturias",

  // Session awareness
  conversation_count: String(voiceSession.conversationCount),
  is_returning: voiceSession.isReturning ? "true" : "false",

  // Language/locale
  user_locale: voiceSession.userLocale,
  preferred_language: voiceSession.preferredLanguage,

  // Time context
  time_of_day: voiceSession.timeOfDay,
  current_time: new Date().toLocaleTimeString(...),
}
```

Session state tracked by `src/hooks/use-voice-session.ts`:
- `conversationCount` - Number of conversations in this session
- `isReturning` - Boolean if user has talked before
- `userLocale` - Browser language from `navigator.language`
- `preferredLanguage` - "Spanish" or "English" based on locale
- `timeOfDay` - "morning" | "afternoon" | "evening"

---

## Local Development Setup

### Cloudflare Tunnel

For testing webhooks locally:

| Setting | Value |
|---------|-------|
| **Tunnel name** | `paisaxe` |
| **Tunnel ID** | `9be5c7a4-6de2-4cc1-8e4f-714cec7e449e` |
| **Config file** | `~/.cloudflared/config-paisaxe.yml` |
| **Public URL** | `https://paisaxe.tunnelfor.me` |

### Running Locally

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start tunnel
./scripts/tunnel.sh
```

### Two-Agent Strategy (Recommended)

| Agent | Purpose | Webhook URLs |
|-------|---------|--------------|
| **Pelayo** | Production | `https://paisaxe.es/api/mcp/*` |
| **Pelayo-Dev** | Local testing | `https://paisaxe.tunnelfor.me/api/mcp/*` |

---

## Webhook Endpoints

### Weather API

**Endpoint:** `/api/mcp/weather`
**Source:** `src/app/api/mcp/weather/route.ts`

| Method | Example |
|--------|---------|
| GET | `/api/mcp/weather?city=Oviedo` |
| POST | `{ "city": "Oviedo" }` |

**Response:**
```json
{
  "city": "Oviedo",
  "temperature": 15,
  "feels_like": 14,
  "humidity": 68,
  "description": "nubes",
  "wind_speed": 2.7,
  "icon": "04d",
  "units": "metric"
}
```

**Supported cities:** Oviedo, Gijón, Avilés, Llanes, Cangas de Onís, Cudillero, Luarca, Ribadesella, Villaviciosa, Mieres, Langreo, Covadonga, and more.

### Places API

**Endpoint:** `/api/mcp/places`
**Source:** `src/app/api/mcp/places/route.ts`
**API:** Google Places API (New)

| Method | Example |
|--------|---------|
| GET | `/api/mcp/places?query=fabada&type=restaurant&city=Oviedo` |
| POST | `{ "query": "fabada", "type": "restaurant", "city": "Oviedo" }` |

**Response:**
```json
{
  "places": [
    {
      "name": "Casa Gerardo",
      "address": "Carretera AS-19, Prendes, Asturias",
      "rating": 4.7,
      "reviews_count": 1642,
      "price_level": 2,
      "types": ["restaurant", "food", "establishment"],
      "location": { "lat": 43.449, "lng": -6.076 },
      "is_open": true,
      "place_id": "ChIJ..."
    }
  ],
  "query": "fabada",
  "city": "Oviedo",
  "type": "restaurant"
}
```

### Environment Variables Required

```
OPENWEATHERMAP_API_KEY=  # Weather API
GOOGLE_PLACES_API_KEY=   # Places API (New)
```

---

## Cost Estimate

| Scenario | Est. Cost |
|----------|-----------|
| Per minute | ~$0.10 |
| 5-minute conversation | ~$0.50 |
| 100 conversations/month (avg 3 min) | ~$30 |

---

## Testing Checklist

- [ ] Spanish greeting test: Start conversation, verify Spanish first message
- [ ] Language switching: Ask question in English, verify English response
- [ ] Factual accuracy: Ask about Lagos de Covadonga, verify accurate info
- [ ] Personality check: Responses should feel warm, not robotic
- [ ] Brevity test: Responses should be < 30 seconds spoken
- [ ] Off-topic handling: Ask about Madrid, verify gentle redirect to Asturias
- [ ] Weather tool: "¿Qué tiempo hace en Oviedo?" → triggers get_weather
- [ ] Places tool: "¿Dónde puedo comer fabada?" → triggers search_places
- [ ] Returning user: Second conversation gets brief greeting

---

## Files Reference

| File | Description |
|------|-------------|
| `src/hooks/use-voice-session.ts` | Session tracking hook |
| `src/components/immersive/voice-chat-elevenlabs.tsx` | Voice chat component with dynamic variables |
| `src/app/api/mcp/weather/route.ts` | Weather webhook endpoint |
| `src/app/api/mcp/places/route.ts` | Places webhook endpoint (Places API New) |
| `scripts/tunnel.sh` | Cloudflare tunnel startup script |
| `scripts/update-pelayo-prompt.ts` | Script to update agent prompt via API |

---

## References

- [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)
- [ElevenLabs Voice Design Guide](https://elevenlabs.io/docs/agents-platform/customization/voice/best-practices/conversational-voice-design)
- [ElevenLabs Models Documentation](https://elevenlabs.io/docs/agents-platform/customization/llm)
- [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service/text-search)
