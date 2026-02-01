# ElevenLabs Pelayo Agent Configuration

Optimal configuration for **Pelayo** (`agent_3101kg5bvnf4f1r94f0cav0v9y61`), the premium voice tourism guide for Paisaxe stories.

## Overview

| Aspect | Value |
|--------|-------|
| **Role** | Tourism storytelling guide for Asturias |
| **Interaction Style** | Conversational, warm, informative |
| **Languages** | Spanish (primary), English (secondary) |
| **Budget Tier** | ElevenLabs Starter ($5/month) |
| **Cost Target** | ~$0.10/minute |

## Recommended LLM Configuration

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
| **Temperature** | 0.65 | Warmth with accuracy (higher than transactional agents) |
| **Max Tokens** | 250 | ~90 seconds spoken max, keeps responses conversational |

**Backup Strategy:** Enable "Default" backup with Gemini 2.0 Flash and GPT-4o Mini for resilience.

## System Prompt

```
# IDENTITY
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

Instead, be specific and sensory.
```

## First Message (Greeting)

**Spanish (Primary):**
```
¡Hola! Soy Pelayo, tu guía de Asturias. Estoy aquí para contarte historias de esta tierra verde y ayudarte a descubrir sus rincones especiales. ¿Qué te gustaría saber sobre este lugar?
```

**English Alternative:**
```
Hello! I'm Pelayo, your guide to Asturias. I'm here to share stories of this green land and help you discover its special corners. What would you like to know about this place?
```

## Voice Settings

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Voice** | Ignacio - Neutral and Authentic | Spanish male voice |
| **TTS Model** | Turbo (eleven_turbo_v2_5) | Fastest, best multilingual Spanish support |
| **Stability** | 0.50 | Lower for Spanish expressiveness and warmth |
| **Similarity Boost** | 0.75 | Higher for Spanish phonetic clarity |
| **Speed** | 0.95x | Slightly slower for storytelling rhythm |

**Tip:** Spanish voices benefit from lower stability (0.45-0.55) to capture natural melodic quality.

## Conversation Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Max Duration** | 600s (10 min) | Allow longer exploration sessions |
| **Turn Timeout** | 12s | Time for thoughtful questions |
| **Silence End Call** | 45s | Don't rush users away |
| **Interruptible** | Yes | Natural conversation flow |

## Language Configuration

| Setting | Value |
|---------|-------|
| **Primary Language** | Spanish (es) |
| **Additional Languages** | English, German, French, Portuguese |
| **Language Detection** | Auto-detect from user input |

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

## Tools Enabled

| Tool | Purpose |
|------|---------|
| **Detect language** | Auto-detect visitor's language for multilingual support |
| **End conversation** | Allows graceful goodbyes |

## Console Configuration Steps

1. **Open Pelayo agent** in ElevenLabs Console

2. **Agent Tab:**
   - Paste the system prompt above
   - Set first message (Spanish version)
   - Languages: Add Spanish (primary), English, German, French, Portuguese

3. **LLM Tab:**
   - Select "Custom" backup configuration
   - Primary LLM: **Gemini 2.5 Flash**
   - Backup LLM: **GPT-4o Mini**
   - Temperature: **65%** (slider slightly right of center)
   - Limit token usage: **250**

4. **Voice Tab:**
   - Voice: Ignacio - Neutral and Authentic
   - TTS Model: Turbo
   - Stability: 0.50
   - Speed: 0.95
   - Similarity: 0.75

5. **Knowledge Base Tab:**
   - Enable versioning (for rollback capability)
   - Upload curated PDFs (city guides, Camino, culture, family)
   - Click "Configure RAG" and set:
     - Embedding model: Multilingual optimized
     - Character limit: 15000
     - Chunk limit: 5
     - Vector distance limit: 0.40

6. **Tools Tab:**
   - Enable "Detect language"
   - Enable "End conversation"

7. **Advanced Tab:**
   - Max conversation duration: 600 seconds

8. **Save and Test with Preview**

## Cost Estimate

| Scenario | Est. Cost |
|----------|-----------|
| Per minute | ~$0.10 |
| 5-minute conversation | ~$0.50 |
| 100 conversations/month (avg 3 min) | ~$30 |

## Testing Checklist

- [ ] Spanish greeting test: Start conversation, verify Spanish first message
- [ ] Language switching: Ask question in English, verify English response
- [ ] Factual accuracy: Ask about Lagos de Covadonga, verify accurate info
- [ ] Personality check: Responses should feel warm, not robotic
- [ ] Brevity test: Responses should be < 30 seconds spoken
- [ ] Off-topic handling: Ask about Madrid, verify gentle redirect to Asturias

## Future Enhancements

1. **RAG Integration**: Upload story content for context-aware responses
2. **Custom Voice Clone**: Create a unique "Pelayo" voice
3. **Workflow Integration**: Connect to Paisaxe story database for live context
4. **Multi-agent Handoff**: Transfer to specialized agents for booking/logistics

## References

- [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)
- [ElevenLabs Voice Design Guide](https://elevenlabs.io/docs/agents-platform/customization/voice/best-practices/conversational-voice-design)
- [ElevenLabs Models Documentation](https://elevenlabs.io/docs/agents-platform/customization/llm)
