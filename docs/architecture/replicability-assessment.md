# Paisaxe Replicability Assessment

**Goal**: Assess what changes are needed to replicate Paisaxe for other locations (e.g., New York).

**Date**: January 2026

---

## Executive Summary

Paisaxe was built with good separation of concerns, but most location-specific content is hardcoded rather than configurable. To make replication easier, you have two paths:

1. **Fork & Replace** (current state) — Clone the repo, find-and-replace location-specific content
2. **Multi-tenant Architecture** (requires refactoring) — Extract location data into configuration, deploy multiple instances from one codebase

This document catalogs everything that would need to change and recommends architectural improvements to reduce future replication effort.

---

## Current State: What's Hardcoded

### 1. Location References in Code

| File | What's Hardcoded |
|------|------------------|
| `src/lib/stories-data.ts` | 8 fallback stories (Lagos de Covadonga, Catedral de Oviedo, Fabada, etc.) |
| `src/types/immersive.ts` | Location enum: `eastern`, `central`, `western` with Asturias-specific meanings |
| `src/components/seo/json-ld.tsx` | Geo-coordinates for 3 regions (Cangas de Onís, Oviedo, Cudillero) |
| `src/lib/chat-config.ts` | Entire system prompt is Asturias-specific |
| `src/config/elevenlabs-agents.ts` | Agent IDs for Pelayo (named after Asturian historical figure) |

### 2. Metadata & SEO

| File | Content |
|------|---------|
| `src/app/layout.tsx` | Title: "Paisaxe \| Descubre Asturias", keywords, OG description |
| `src/app/immersive/layout.tsx` | Title: "Explora Asturias \| Paisaxe" |
| `src/app/opengraph-image.tsx` | Spanish tagline: "Mira. Pregunta. Descubre." |
| `public/manifest.json` | App name: "Paisaxe - Descubre Asturias" |

### 3. Internationalization (i18n)

All 5 language files (`es.ts`, `en.ts`, `pt.ts`, `de.ts`, `fr.ts`) contain:
- Location labels: "Asturias Oriental", "Asturias Central", "Asturias Occidental"
- Alt text: "Imagen relacionada de Asturias"
- Empty state copy: "Explora las historias de Asturias..."

### 4. Chat System Prompts

`src/lib/chat-config.ts` contains `PELAYO_SYSTEM_PROMPT` (Lines 18-95):
- Persona: "I am Pelayo, a passionate Asturian who works as a local tourism guide"
- Scope: Places, gastronomy, Camino de Santiago, Picos de Europa
- Forbidden topics: "Other regions of Spain or other countries"
- Redirect templates with Asturias-specific examples

### 5. Database Schema

`supabase/migrations/028_story_suggestions.sql`:
```sql
location text check (location in ('eastern', 'central', 'western'))
```

The location values are hardcoded in the constraint.

### 6. Brand Voice & Marketing Agents

| File | Content |
|------|---------|
| `src/agents/shared/brand-voice.md` | "Immersive tourism experience for Asturias, Spain" |
| `src/agents/personas/*.md` | All agent personas reference Asturias-specific content |

### 7. Visual Assets

| Location | Assets |
|----------|--------|
| `public/images/stories/` | 20+ images (lagos-covadonga.png, playa-silencio.png, etc.) |
| `src/components/ui/logo.tsx` | Mountain peaks logo (Picos de Europa metaphor) |

### 8. Domain Configuration

| File | Hardcoded Domains |
|------|-------------------|
| `vercel.json` | Redirects to `paisaxe.es` |
| `src/app/layout.tsx` | Default: `https://paisaxe.es` |
| `.github/upptime/.upptimerc.yml` | Monitoring for `paisaxe.es` |

### 9. Content Dependencies

- `content/pdfs/` — 37 PDFs with Asturian tourism content
- All vector embeddings in database are from these PDFs
- Story records reference these specific PDFs

---

## Replication Effort (Fork & Replace)

If you fork and manually replace content:

| Category | Effort | Files to Change |
|----------|--------|-----------------|
| **Content Creation** | 3-4 weeks | New PDFs, images, story data |
| **System Prompts** | 1-2 weeks | `chat-config.ts`, agent personas |
| **i18n Updates** | 1 week | 5 language files |
| **SEO & Metadata** | 2-3 days | Layout files, JSON-LD, manifest |
| **Visual Assets** | 1-2 weeks | Logo, hero images |
| **Configuration** | 1-2 days | Env vars, domain redirects |
| **Database** | 1 day | Re-run migrations with new constraints |
| **Testing** | 1 week | Validate all location-specific features |

**Total: 7-10 weeks** (with content ready: 3-4 weeks)

---

## Recommended Architecture Changes

To reduce replication effort for future locations, consider these refactoring priorities:

### Priority 1: Extract Location Config (High Impact, Medium Effort)

Create a single source of truth for location data:

```typescript
// src/config/location.ts
export const LOCATION_CONFIG = {
  name: "Asturias",
  country: "Spain",
  domains: ["paisaxe.es", "paisaxe.com"],
  tagline: "Mira. Pregunta. Descubre.",

  regions: [
    { id: "eastern", name: { es: "Asturias Oriental", en: "Eastern Asturias" }, geo: { lat: 43.35, lng: -4.85 } },
    { id: "central", name: { es: "Asturias Central", en: "Central Asturias" }, geo: { lat: 43.36, lng: -5.85 } },
    { id: "western", name: { es: "Asturias Occidental", en: "Western Asturias" }, geo: { lat: 43.54, lng: -6.55 } },
  ],

  persona: {
    name: "Pelayo",
    backstory: "A passionate Asturian who works as a local tourism guide",
    voiceAgentId: "yPxfhFkNjugcLBg76NE1",
  },

  topics: {
    allowed: ["Places to visit", "Gastronomy", "Camino de Santiago", "Nature and parks"],
    forbidden: ["Other regions of Spain or other countries"],
  },

  seo: {
    title: { es: "Paisaxe | Descubre Asturias", en: "Paisaxe | Discover Asturias" },
    description: { es: "Tu guía personal para explorar Asturias...", en: "Your personal guide to explore Asturias..." },
    keywords: ["Asturias", "turismo", "Spain", "sidra", "Picos de Europa"],
  },
}
```

Then update all files to import from this config instead of hardcoding values.

**Files to update:**
- `src/lib/chat-config.ts` — Generate system prompt from config
- `src/types/immersive.ts` — Derive location enum from config
- `src/lib/i18n/*.ts` — Import location labels from config
- `src/app/layout.tsx` — Read SEO from config
- `src/components/seo/json-ld.tsx` — Read geo-coordinates from config

### Priority 2: Template System Prompts (High Impact, Low Effort)

Convert `PELAYO_SYSTEM_PROMPT` to a template function:

```typescript
// src/lib/chat-config.ts
import { LOCATION_CONFIG } from '@/config/location'

export function buildSystemPrompt(config = LOCATION_CONFIG) {
  return `
You are ${config.persona.name}, ${config.persona.backstory}.

## SCOPE (What you CAN help with)
${config.topics.allowed.map(t => `- ${t}`).join('\n')}

## FORBIDDEN (You must redirect these)
${config.topics.forbidden.map(t => `- ${t}`).join('\n')}
...
  `.trim()
}
```

### Priority 3: Dynamic Region Constraints (Medium Impact, Low Effort)

Instead of hardcoding region values in SQL constraints, use a more flexible approach:

```sql
-- Current (hardcoded)
location text check (location in ('eastern', 'central', 'western'))

-- Better (reference a regions table)
location text references regions(id)
```

Or remove the constraint entirely and validate at the application layer.

### Priority 4: Environment-Based Branding (Medium Impact, Medium Effort)

Add environment variables for key brand elements:

```env
# .env.local
NEXT_PUBLIC_SITE_NAME=Paisaxe
NEXT_PUBLIC_SITE_TAGLINE="Mira. Pregunta. Descubre."
NEXT_PUBLIC_LOCATION_NAME=Asturias
NEXT_PUBLIC_LOCATION_COUNTRY=Spain
```

### Priority 5: Fallback Stories from Database (Low Impact, Low Effort)

Move `FALLBACK_STORIES` from code to a seeded database table that's included in migrations. This way, changing fallback content is a database operation, not a code change.

---

## Infrastructure Per Location

Each new location requires its own:

| Service | Why Separate | Setup Time |
|---------|--------------|------------|
| **Vercel Project** | Different domain, env vars | 30 min |
| **Supabase Project** | Isolated database, storage | 1 hour |
| **ElevenLabs Account** | Different voice agents | 2-3 hours |
| **Voyage AI** | Can share if same API key | 0 |
| **Anthropic (Claude)** | Can share if same API key | 0 |
| **Domain(s)** | Location-specific branding | 30 min |
| **GitHub Repo** | Separate codebase (fork) | 30 min |
| **Upptime Monitoring** | Separate status page | 1 hour |

**Total infrastructure setup: ~6 hours**

---

## Multi-Tenant Alternative

Instead of forking, you could build a multi-tenant architecture:

### Pros
- Single codebase to maintain
- Shared bug fixes and improvements
- Easier to add new locations

### Cons
- Significant refactoring effort (2-4 weeks)
- More complex deployment
- Database isolation challenges
- Different voice agents per tenant complicates config

### When Multi-Tenant Makes Sense
- If you plan to launch 5+ locations
- If locations share most content structure
- If you want centralized administration

### Recommendation
For 2-3 locations, **fork & replace** is faster. For 5+ locations, invest in multi-tenant architecture.

---

## Quick Wins to Implement Now

These changes take minimal effort but significantly ease future replication:

### 1. Create `src/config/location.ts`
Extract all location-specific values into one file. Even if other files still import directly, having a single reference makes find-and-replace much easier.

### 2. Add Comments Marking Location-Specific Code
```typescript
// LOCATION-SPECIFIC: Update for new regions
export type StoryLocation = "eastern" | "central" | "western"
```

### 3. Document the Replication Checklist
Create a `REPLICATION.md` with step-by-step instructions for forking.

### 4. Separate Content from Code
- Move fallback stories to `content/fallback-stories.json`
- Move system prompt templates to `content/prompts/`
- Reference these files from code

---

## Files to Change for New Location

Complete checklist:

### Code Changes (~15 files)
- [ ] `src/config/location.ts` (create or update)
- [ ] `src/lib/chat-config.ts` — System prompt
- [ ] `src/lib/stories-data.ts` — Fallback stories
- [ ] `src/types/immersive.ts` — Location enum
- [ ] `src/lib/i18n/es.ts` — Spanish translations
- [ ] `src/lib/i18n/en.ts` — English translations
- [ ] `src/lib/i18n/pt.ts` — Portuguese translations
- [ ] `src/lib/i18n/de.ts` — German translations
- [ ] `src/lib/i18n/fr.ts` — French translations
- [ ] `src/app/layout.tsx` — Metadata, SEO
- [ ] `src/app/immersive/layout.tsx` — Page metadata
- [ ] `src/app/opengraph-image.tsx` — OG image text
- [ ] `src/components/seo/json-ld.tsx` — Structured data
- [ ] `src/config/elevenlabs-agents.ts` — Voice agent IDs
- [ ] `public/manifest.json` — PWA manifest

### Content Changes
- [ ] `content/pdfs/` — Replace all PDFs
- [ ] `public/images/stories/` — Replace all images
- [ ] `public/favicon.ico` — Update if branding changes
- [ ] `public/images/og/` — Open Graph images

### Database
- [ ] Run `npm run seed-db:clear` to clear and re-seed with new content
- [ ] Update `supabase/migrations/028_story_suggestions.sql` location constraint

### Infrastructure
- [ ] Create new Vercel project
- [ ] Create new Supabase project
- [ ] Create new ElevenLabs agents
- [ ] Configure domain DNS
- [ ] Set up Upptime monitoring
- [ ] Update `vercel.json` redirects

### Agent Personas (if using marketing agents)
- [ ] `src/agents/shared/brand-voice.md`
- [ ] `src/agents/personas/xander-x-agent.md`
- [ ] `src/agents/personas/iris-instagram-agent.md`
- [ ] `src/agents/personas/penny-pinterest-agent.md`

---

## Conclusion

The Paisaxe codebase is well-structured but not optimized for replication. The main effort is **content creation** (PDFs, images, stories), not code changes.

**Recommended next steps:**

1. **Now**: Create `src/config/location.ts` as a central config file (1-2 hours)
2. **Now**: Add `// LOCATION-SPECIFIC` comments to aid find-and-replace (30 min)
3. **Before next location**: Implement Priority 1-2 refactoring (1-2 days)
4. **If 5+ locations planned**: Consider multi-tenant architecture

With the quick wins implemented, replicating for a new location would take:
- **With content ready**: 2-3 weeks
- **Without content**: 6-8 weeks (content creation is the bottleneck)
