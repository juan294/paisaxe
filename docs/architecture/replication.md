# Replicating Paisaxe for a New Location

This guide walks you through forking and adapting Paisaxe for a different tourism destination.

## Overview

Paisaxe is designed with replicability in mind. Location-specific content is marked with `// LOCATION-SPECIFIC` comments throughout the codebase. The central configuration lives in `src/config/location.ts`.

**Time estimate**: 2-4 hours for basic replication, plus content creation time.

---

## Prerequisites

### Accounts Required

| Service | Purpose | Pricing |
|---------|---------|---------|
| **Supabase** | Database, auth, storage | Free tier available |
| **Vercel** | Hosting & deployment | Free tier available |
| **Anthropic** | Claude API for chat | Pay-as-you-go |
| **Voyage AI** | Embeddings & reranking | 200M free tokens/month |
| **ElevenLabs** | Voice agents (optional) | Starter $5/mo (commercial license required) |
| **PostHog** | Analytics (optional) | Free tier available |
| **Domain** | Your site domain | ~$10-15/year |

### Local Development Setup

1. Node.js 18+ installed
2. Git installed
3. A code editor (VS Code recommended)

---

## Step 1: Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/paisaxe.git my-tourism-site
cd my-tourism-site

# Install dependencies
npm install
```

---

## Step 2: Update Location Configuration

The most important file is `src/config/location.ts`. Update all values:

```typescript
export const LOCATION_CONFIG = {
  // Identity - Change these
  name: "Your Region",           // e.g., "Galicia", "Basque Country"
  country: "Your Country",       // e.g., "Spain", "Portugal"
  countryCode: "XX",             // e.g., "ES", "PT"
  primaryLanguage: "es",         // Primary content language

  // Branding - Change these
  siteName: "YourSiteName",      // Your brand name
  tagline: "Your tagline here",  // Spanish version
  taglineEn: "Your tagline",     // English version
  domain: "yoursite.com",        // Primary domain
  alternateDomain: "yoursite.es", // Secondary domain (optional)

  // Geographic center - Update coordinates
  center: {
    lat: 43.0000,                // Latitude of region center
    lng: -5.0000,                // Longitude of region center
  },

  // Regions - Define your sub-regions
  regions: {
    north: {                     // Use meaningful IDs
      id: "north",
      geo: { lat: 43.1, lng: -5.0 },
      places: ["City1", "City2", "Landmark"],
    },
    south: {
      id: "south",
      geo: { lat: 42.9, lng: -5.0 },
      places: ["City3", "City4"],
    },
    // Add more regions as needed
  },

  // Chat persona - Create your guide character
  persona: {
    name: "YourGuideName",       // e.g., "María", "João"
    role: "local tourism guide",
    expertise: ["places", "gastronomy", "nature", "culture", "activities"],
    localLanguage: "LocalDialect", // e.g., "Gallego", "Euskera"
    localExpressions: [
      { word: "local_word", meaning: "translation" },
    ],
  },

  // SEO - Update for your location
  seo: {
    keywords: ["Region", "tourism", "Country", "local_product", "landmark"],
    locale: "es_ES",             // Or "pt_PT", etc.
    description: "Your meta description in primary language",
    descriptionEn: "Your meta description in English",
  },

  // Content categories
  categories: {
    cuisineStyle: "Regional",    // For restaurant schema
    iconicDishes: ["dish1", "dish2", "dish3"],
    naturalFeatures: ["park1", "mountain1", "coast"],
    culturalHighlights: ["monument1", "tradition1"],
  },

  // Geography
  containedIn: {
    type: "Country",
    name: "País",                // Country name in primary language
    nameEn: "Country",           // Country name in English
  },
};
```

---

## Step 3: Update Types

Edit `src/types/immersive.ts`:

1. Update `StoryLocation` type to match your region IDs:

```typescript
export type StoryLocation =
  | "north"    // Match your LOCATION_CONFIG.regions keys
  | "south"
  | "coast";
```

2. Update `LOCATION_LABELS` for display names:

```typescript
export const LOCATION_LABELS: Record<StoryLocation, string> = {
  north: "Northern Region",
  south: "Southern Region",
  coast: "Coastal Area",
};
```

---

## Step 4: Update Chat Persona

Edit `content/prompts/guide-system-prompt.md`:

Replace all Asturias-specific content with your location's:
- Guide identity and name
- Allowed topics (places, food, activities)
- Forbidden topics
- Redirect responses
- Local expressions and terminology

Then update `src/lib/chat-config.ts` to ensure it references your config.

---

## Step 5: Replace Fallback Stories

Edit `content/fallback-stories.json`:

Replace all stories with your location's content:

```json
{
  "_comment": "LOCATION-SPECIFIC: Fallback stories for your location",
  "stories": [
    {
      "id": "your-landmark",
      "slug": "your-landmark",
      "title": "Your Landmark Name",
      "subtitle": "Region Name",
      "description": "Description in primary language...",
      "image": "/images/stories/your-landmark.png",
      "category": "nature",
      "sourcePdf": "your-content.pdf",
      "location": "north",
      "duration": "day-trip"
    }
  ]
}
```

---

## Step 6: Update Translations

Edit all files in `src/lib/i18n/`:

Look for comments marked `// LOCATION-SPECIFIC` and update:
- Region names in each language
- Location references in privacy notices
- Persona name (Pelayo → your guide name)
- Any location-specific descriptions

---

## Step 7: Update Brand Voice

Edit `src/agents/shared/brand-voice.md`:

Replace all Asturias references with your location's:
- Region name
- Local terminology
- Example transformations
- Topics covered
- Hashtag suggestions

---

## Step 8: Static Assets

Replace these files in `public/`:

| File | Purpose |
|------|---------|
| `favicon-*.png` | Browser favicon |
| `icon-*.png` | App icons |
| `icon.svg` | SVG favicon |
| `apple-touch-icon.png` | iOS icon |
| `images/stories/*.png` | Default story images |

Update `public/manifest.json`:
- `name` → Your site's full name
- `short_name` → Your site's short name
- `description` → Your site's description

---

## Step 9: Set Up Infrastructure

### Supabase

1. Create a new Supabase project
2. Run all migrations from `supabase/migrations/`
3. Configure authentication (Google OAuth)
4. Set up storage buckets for images

### Environment Variables

Create `.env.local` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# AI Services
ANTHROPIC_API_KEY=your_claude_key
VOYAGE_API_KEY=your_voyage_key

# Optional
ELEVENLABS_API_KEY=your_elevenlabs_key
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key

# Site
NEXT_PUBLIC_SITE_URL=https://yoursite.com
WEBHOOK_SECRET=your_webhook_secret
```

### Vercel

1. Import your forked repository
2. Add all environment variables
3. Deploy

---

## Step 10: Voice Agents (Optional)

If using ElevenLabs voice for a premium voice guide feature:

### Prerequisites

1. **Subscribe to at least Starter tier ($5/mo)** - Free tier is non-commercial only
2. Create a new voice agent in ElevenLabs console

### Agent Configuration

Configure your tourism guide agent with these recommended settings:

| Setting | Value | Notes |
|---------|-------|-------|
| **LLM** | Gemini 2.5 Flash | Best latency/quality balance |
| **Temperature** | 0.65 | Warmth with accuracy |
| **Max Tokens** | 250 | Conversational brevity |
| **TTS Model** | eleven_turbo_v2_5 | Best multilingual support |
| **Stability** | 0.50 | Allows expressiveness |
| **Similarity** | 0.75 | Clear phonetics |
| **Max Duration** | 600 seconds | 10 minutes |

### RAG Knowledge Base

For specialized local knowledge, upload your tourism PDFs to ElevenLabs Knowledge Base:

1. Enable versioning (for rollback capability)
2. Upload curated PDFs (city guides, activities, culture)
3. Enable RAG with these settings:
   - Embedding model: **Multilingual optimized**
   - Character limit: **15000**
   - Chunk limit: **5**
   - Vector distance limit: **0.40** (stricter matching)
4. Enable **Language detection** and **End conversation** tools

### Update Code

Update `src/config/elevenlabs-agents.ts` with your new agent ID:

```typescript
export const ELEVENLABS_AGENT_IDS = {
  pelayo: "your_agent_id_here",  // Rename to your guide's name
  // ... other agents
} as const;
```

See `docs/operations/elevenlabs-pelayo-config.md` for the complete Paisaxe configuration reference.

> **Important**: The ElevenLabs free tier cannot be used for commercial/production sites. See `docs/marketing/cost-forecast.md` for pricing details and upgrade triggers.

---

## Step 11: Content Pipeline

### PDF Processing

1. Place your tourism PDFs in `content/pdfs/`
2. Run extraction:

```bash
npm run process-pdfs
```

### Database Seeding

```bash
npm run seed-db
```

---

## Verification Checklist

Before launching, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Site loads with your branding
- [ ] Chat responds with your location's knowledge
- [ ] All regions display correctly
- [ ] SEO metadata is correct
- [ ] OpenGraph images render
- [ ] Mobile experience works

### Manual Testing

- [ ] Browse through stories
- [ ] Ask chat questions about your location
- [ ] Test voice agents (if enabled)
- [ ] Check all translations
- [ ] Test authentication flow
- [ ] Verify analytics tracking

---

## Finding Location-Specific Code

To find all location-specific code:

```bash
grep -r "LOCATION-SPECIFIC" src/
```

Key files to review:
- `src/config/location.ts` - Central configuration
- `src/lib/chat-config.ts` - Chat persona
- `src/types/immersive.ts` - Type definitions
- `src/lib/i18n/*.ts` - Translations
- `src/components/seo/json-ld.tsx` - Structured data
- `src/app/layout.tsx` - Root metadata
- `src/app/immersive/layout.tsx` - Page metadata
- `src/app/opengraph-image.tsx` - OG image
- `content/fallback-stories.json` - Fallback content
- `content/prompts/guide-system-prompt.md` - AI prompt
- `src/agents/shared/brand-voice.md` - Brand guidelines
- `public/manifest.json` - PWA manifest

---

## Need Help?

- Review the [Project Charter](./CLAUDE.md) for design principles
- Check existing implementations for patterns
- Open an issue on GitHub for questions

---

## License

Paisaxe is open source. When replicating, you're free to:
- Modify all location-specific content
- Change branding and design
- Deploy to your own infrastructure

Please retain attribution where appropriate.
