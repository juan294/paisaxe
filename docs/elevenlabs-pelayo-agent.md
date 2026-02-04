# Pelayo Voice Agent - ElevenLabs Configuration

> **Last Updated:** 2026-02-04
> **Status:** Tools configured, pending local tunnel setup for testing
> **Agent ID:** `agent_3101kg5bvnf4f1r94f0cav0v9y61`

---

## Overview

Pelayo is the primary voice agent for Paisaxe immersive stories. This document captures the complete configuration for the ElevenLabs Conversational AI agent, including system prompt, webhook tools, and dynamic variables.

---

## What's Been Implemented

### 1. Code Changes (Completed)

#### New Hook: `src/hooks/use-voice-session.ts`
Tracks conversation session state for personalization:
- `conversationCount` - Number of conversations in this session
- `isReturning` - Boolean if user has talked before
- `userLocale` - Browser language from `navigator.language`
- `preferredLanguage` - "Spanish" or "English" based on locale
- `timeOfDay` - "morning" | "afternoon" | "evening"

#### Updated: `src/components/immersive/voice-chat-elevenlabs.tsx`
Now passes expanded dynamic variables to ElevenLabs:
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
},
overrides: {
  agent: {
    language: languageOverride, // "es" or "en" based on locale
  },
},
```

#### New Webhook Endpoints

**Weather Tool:** `src/app/api/mcp/weather/route.ts`
- GET: `/api/mcp/weather?city=Oviedo`
- POST: `/api/mcp/weather` with body `{ "city": "Oviedo" }`
- Returns: temperature, humidity, wind_speed, description
- Uses OpenWeatherMap API
- Pre-configured coordinates for 16 Asturias cities

**Places Tool:** `src/app/api/mcp/places/route.ts`
- GET: `/api/mcp/places?query=fabada&type=restaurant&city=Gijón`
- POST: `/api/mcp/places` with body `{ "query": "...", "type": "...", "city": "..." }`
- Returns: up to 5 places with name, address, rating, reviews_count, price_level
- Uses Google Places API
- Location-biased searches centered on Asturias

#### Environment Variables Required
```
OPENWEATHERMAP_API_KEY=  # Already in .env.local
GOOGLE_PLACES_API_KEY=   # Already in .env.local
```

---

## ElevenLabs Dashboard Configuration

### System Prompt (Updated via API)

The system prompt was updated via `scripts/update-pelayo-prompt.ts`. Current version:

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

### Webhook Tools Configuration (Completed in Dashboard)

Both tools have been added to the agent in ElevenLabs Dashboard → Tools tab.

#### Tool 1: get_weather

| Field | Value |
|-------|-------|
| Name | `get_weather` |
| Description | `Get current weather for cities in Asturias. Returns temperature, humidity, wind speed, and conditions.` |
| Method | POST |
| URL | `https://paisaxe.es/api/mcp/weather` |
| Response timeout | 20 seconds |
| Pre-tool speech | Auto |
| Execution mode | Immediate |

**Headers:**
- `Content-Type`: `application/json`

**Body Parameters:**
| Identifier | Type | Required | Value Type | Description |
|------------|------|----------|------------|-------------|
| `city` | String | ✅ | LLM Prompt | City name in Asturias such as Oviedo, Gijon, Aviles, Llanes, Cudillero, or Luarca |

#### Tool 2: search_places

| Field | Value |
|-------|-------|
| Name | `search_places` |
| Description | `Search for restaurants, bars, cafes, museums, and attractions in Asturias` |
| Method | POST |
| URL | `https://paisaxe.es/api/mcp/places` |
| Response timeout | 20 seconds |
| Pre-tool speech | Auto |
| Execution mode | Immediate |

**Headers:**
- `Content-Type`: `application/json`

**Body Parameters:**
| Identifier | Type | Required | Value Type | Description |
|------------|------|----------|------------|-------------|
| `query` | String | ✅ | LLM Prompt | What to search for such as fabada, sidreria, restaurante, museo, or playa |
| `type` | String | ❌ | LLM Prompt | Optional filter: restaurant, bar, cafe, museum, tourist_attraction, park |
| `city` | String | ❌ | LLM Prompt | Optional city to search near such as Oviedo, Gijon, or Aviles |

### System Tools Enabled
- ✅ End conversation
- ✅ Detect language

---

## Development & Production Workflow

### Two-Agent Strategy

To safely develop and test webhook tools without affecting production:

| Agent | Purpose | Webhook URLs |
|-------|---------|--------------|
| **Pelayo** | Production | `https://paisaxe.es/api/mcp/*` |
| **Pelayo-Dev** | Local testing | `https://paisaxe.tunnelfor.me/api/mcp/*` |

### Local Development Setup

1. **Start the dev server**
   ```bash
   npm run dev
   ```

2. **Start the Cloudflare tunnel** (in another terminal)
   ```bash
   ./scripts/tunnel.sh
   ```
   This exposes `localhost:3000` at `https://paisaxe.tunnelfor.me`

3. **Test with Pelayo-Dev agent**
   - The dev agent's tools point to `paisaxe.tunnelfor.me`
   - Production agent remains untouched

### Cloudflare Tunnel Details

- **Tunnel name:** `paisaxe`
- **Tunnel ID:** `9be5c7a4-6de2-4cc1-8e4f-714cec7e449e`
- **Config file:** `~/.cloudflared/config-paisaxe.yml`
- **Public URL:** `https://paisaxe.tunnelfor.me`

### Test Scenarios

| Prompt | Expected Tool |
|--------|---------------|
| "¿Qué tiempo hace en Oviedo?" | `get_weather` |
| "¿Dónde puedo comer fabada?" | `search_places` |
| "Recomiéndame una sidrería en Gijón" | `search_places` |

### Deployment Flow

1. Develop and test locally with Pelayo-Dev agent
2. When ready, deploy code to production:
   ```bash
   git push origin develop
   # Merge develop → main for production release
   ```
3. Production agent automatically uses the updated code at `paisaxe.es`

---

## Implementation Status

### Completed ✅
1. Created `use-voice-session` hook for session tracking
2. Updated `voice-chat-elevenlabs.tsx` with new dynamic variables
3. Created weather webhook endpoint (`/api/mcp/weather`)
4. Created places webhook endpoint (`/api/mcp/places`) - using Places API (New)
5. Updated system prompt via ElevenLabs API
6. Configured both webhook tools in ElevenLabs Dashboard
7. Set up Cloudflare tunnel at `paisaxe.tunnelfor.me`
8. Created `scripts/tunnel.sh` convenience script

### Pending
- [ ] Create Pelayo-Dev agent in ElevenLabs (clone of Pelayo with dev URLs)
- [ ] Voice testing with both agents

---

## Files Modified/Created

| File | Status | Description |
|------|--------|-------------|
| `src/hooks/use-voice-session.ts` | ✅ Created | Session tracking hook |
| `src/hooks/use-voice-session.test.ts` | ✅ Created | 15 tests, all passing |
| `src/components/immersive/voice-chat-elevenlabs.tsx` | ✅ Modified | Added dynamic variables |
| `src/app/api/mcp/weather/route.ts` | ✅ Created | Weather webhook endpoint |
| `src/app/api/mcp/weather/route.test.ts` | ✅ Created | 7 tests, all passing |
| `src/app/api/mcp/places/route.ts` | ✅ Created | Places webhook endpoint |
| `src/app/api/mcp/places/route.test.ts` | ✅ Created | 8 tests, all passing |
| `.env.example` | ✅ Modified | Added new API keys |
| `scripts/update-pelayo-prompt.ts` | ✅ Created | Script to update agent prompt |
| `scripts/elevenlabs-weather-tool.json` | ✅ Created | Tool JSON (for reference) |
| `scripts/elevenlabs-places-tool.json` | ✅ Created | Tool JSON (for reference) |

---

## Test Results

All tests passing:
```
npm run test        # 2355 passed
npm run typecheck   # No errors
npm run lint        # No errors
```

---

## Related Documentation

- [ElevenLabs Enhancement Plan](/Users/juan/.claude/projects/-Users-juan-Documents-GenAI-Projects-paisaxe/plan.md) - Original implementation plan
- [Operations Guide](/docs/operations/operations.md) - General operations documentation
