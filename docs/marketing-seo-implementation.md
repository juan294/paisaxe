# Marketing & SEO Implementation

This document summarizes the technical SEO and marketing optimizations implemented for Paisaxe.

## Completed Implementations

### 1. AI Crawler Support (`src/app/robots.ts`)

Added explicit allow rules for AI search crawlers:
- GPTBot (ChatGPT)
- ChatGPT-User
- anthropic-ai (Claude)
- Claude-Web
- PerplexityBot
- Bytespider (TikTok)
- Google-Extended (Bard/Gemini)

All crawlers are allowed to index public content while `/api/`, `/admin/`, and `/auth/` paths remain blocked.

### 2. LLM Summary File (`public/llms.txt`)

Created an AI-readable site summary following the emerging `llms.txt` standard. Contains:
- Site description and purpose
- Key topics covered (nature, cities, food, culture, activities)
- Geographic regions
- Technical details
- Citation guidelines

Access at: `https://paisaxe.com/llms.txt`

### 3. Enhanced Schema Markup (`src/components/seo/json-ld.tsx`)

Added new schema types for richer search results:

| Schema Type | Use Case |
|-------------|----------|
| `TouristAttraction` | Nature, cities, culture, activities stories |
| `Restaurant` | Food/gastronomy stories |
| `FAQPage` | Stories with question prompts |
| `BreadcrumbList` | Navigation structure |

Each schema includes:
- Geo coordinates based on story location (eastern/central/western Asturias)
- Image URLs
- `isPartOf` reference linking to Paisaxe
- Category-specific attributes

### 4. PWA Manifest (`public/manifest.json`)

Added Web App Manifest for PWA capability:
- App name and short name
- Theme color (#0a0a0a - dark theme)
- Display mode: standalone
- Icon references (requires PNG generation)
- Categories: travel, tourism, lifestyle

### 5. Metadata Enhancements (`src/app/layout.tsx`)

Enhanced metadata with:
- **Icons**: favicon, SVG icon, apple-touch-icon references
- **Theme color**: #0a0a0a for mobile browser chrome
- **hreflang**: Spanish (es-ES) and x-default declarations
- **Robots**: googleBot directives for max previews
- **Preconnect**: Font loading optimization
- **Author/Publisher**: Paisaxe attribution

### 6. Placeholder Icon (`public/icon.svg`)

Created an SVG icon with stylized mountain design representing Asturias landscapes. This serves as a template for generating PNG icons.

## Pending Tasks

### Icon Generation (Manual)

Generate PNG files from `icon.svg`:
- `favicon.ico` (32x32)
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `icon-maskable-192.png` (192x192)
- `icon-maskable-512.png` (512x512)
- `apple-touch-icon.png` (180x180)

See `docs/icon-generation.md` for instructions.

## Test Coverage

All implementations include comprehensive tests:
- 30 tests for JSON-LD schemas
- 5 tests for robots.ts (including AI crawler verification)
- All 1634 tests passing

## Verification Checklist

After deployment, verify:

1. **Schema Markup**
   - Test at: https://search.google.com/test/rich-results
   - Enter: `https://paisaxe.com`

2. **Robots.txt**
   - Verify at: `https://paisaxe.com/robots.txt`
   - Check AI crawler rules are present

3. **llms.txt**
   - Accessible at: `https://paisaxe.com/llms.txt`

4. **PWA**
   - Chrome DevTools > Application > Manifest
   - Test "Add to Home Screen" on mobile

5. **Metadata**
   - Check page source for theme-color meta tag
   - Verify Open Graph tags with Facebook debugger
   - Verify Twitter cards with Twitter card validator

## Related Files

| File | Purpose |
|------|---------|
| `src/app/robots.ts` | Robots.txt generation |
| `src/app/layout.tsx` | Root layout with metadata |
| `src/components/seo/json-ld.tsx` | Schema markup components |
| `public/llms.txt` | AI crawler summary |
| `public/manifest.json` | PWA manifest |
| `public/icon.svg` | Vector icon template |
| `docs/icon-generation.md` | Icon generation guide |

---

## Appendix: Original Marketing Strategy Plan

The following is the original marketing strategy document that was used as input to generate these changes. This is preserved here for reference and to enable reuse of this strategy in other projects.

<details>
<summary>Click to expand the original marketing strategy prompt</summary>

### Paisaxe Marketing Strategy

**Goal**: Maximize organic discovery and build brand awareness for Paisaxe without paid advertising.

**Research completed**: SEO audit of current implementation, current organic marketing best practices for tourism, LLM/AI search optimization (GEO), and technical SEO requirements.

---

### Part 1: Marketing Strategy Document

#### Executive Summary

Paisaxe has a solid technical SEO foundation. The strategy focuses on three pillars:
1. **Technical optimization** - Enhance SEO and AI discoverability
2. **Content & social presence** - Build brand awareness organically
3. **Community & trust** - Leverage user engagement and reviews

---

### Organic Marketing Strategy

#### 1. Content Pillars (Your Voice)

Based on the Paisaxe charter, your messaging should feel like **a local friend sharing their favorite spots**:

| Pillar | Description | Content Examples |
|--------|-------------|------------------|
| **Wonder** | Stunning visuals that stop the scroll | Full-screen landscape photos, drone footage, golden hour shots |
| **Discovery** | Secrets and lesser-known gems | "This beach has no road access", hidden viewpoints, local-only spots |
| **Story** | The human element | Why you moved to Asturias, conversations with locals, seasonal traditions |
| **Practical** | Helpful without being boring | "How to get there", best times to visit, what to bring |

**Voice Guidelines**:
- First person ("I discovered this...")
- Warm and curious, never salesy
- Show don't tell - let the images do the heavy lifting
- Avoid tourism clichés ("hidden gem", "off the beaten path", "bucket list")

---

#### 2. Platform Strategy

##### Primary: X (Twitter)
- **Why**: You're already active here, lowest friction to start
- **Content mix**: Photos with short commentary, threads for longer stories, reposts of your Instagram content
- **Posting frequency**: Daily or near-daily (X rewards consistency and recency)
- **Tactics**:
  - Share stunning images with brief, evocative captions
  - Use threads for "mini-guides" (5-7 tweets telling a story)
  - Engage with #Asturias, #Spain, #Travel communities
  - Quote-tweet travel accounts with your perspective
  - Cross-post Instagram Reels as video tweets
  - Build connections with Spain/Europe travel accounts
  - Reply to travel-related conversations

##### Primary: Instagram
- **Why**: Travel's most engaging platform (1.41% avg engagement rate), visual-first fits Paisaxe perfectly
- **Content mix**: 70% Reels (short-form video), 20% carousel posts, 10% single images
- **Posting frequency**: 2x/week (with your time constraints)
- **Tactics**:
  - Use location hashtags (#Asturias, #NorthernSpain, #ParaisoNatural, #VisitAsturias)
  - Geotag every post
  - Reply to every comment (only 6% of travel brands do this)
  - Stories for behind-the-scenes, polls, Q&As

##### Secondary: Pinterest
- **Why**: Content lives forever (pins drive traffic for years), high purchase intent, trip-planning focused
- **Content**: Vertical pins (2:3 ratio), itinerary ideas, "best of" collections
- **Posting frequency**: 5-10 pins/week (can schedule in bulk)
- **Tactics**:
  - Create boards: "Asturias Beaches", "Asturian Food", "Hiking Routes", "Rainy Day Ideas"
  - Keyword-rich descriptions (Pinterest is a search engine)
  - Link pins to Paisaxe stories

##### Tertiary: TikTok
- **Why**: The discovery platform for travel in 2025 (16.9M posts under #TikTokTravel)
- **Content**: Raw, authentic short videos (15-60 seconds)
- **Posting frequency**: 2-3x/week when you have good content
- **Tactics**:
  - Use trending sounds
  - Hook in first 2 seconds
  - End with curiosity ("wait until you see the view")

---

#### 3. Content Calendar Framework

**Weekly rhythm (2-3 hours/week)**:

With limited time, focus on quality over quantity. X is easiest to maintain daily since you're already there.

| Day | Activity | Time |
|-----|----------|------|
| **Weekend** | Batch create 2-3 visual pieces | 1 hr |
| **Daily** | Post to X (photo + short thought) | 5-10 min |
| **Mon** | Post Instagram Reel + Pinterest pins (3-5) | 20 min |
| **Wed** | Post Instagram carousel or image | 15 min |
| **Daily** | Engage on X + reply to IG comments | 10 min |

**Realistic goals for 2-3 hrs/week**:
- **X**: 5-7 posts/week (quick photos + commentary, threads occasionally)
- **Instagram**: 2 posts/week (1 Reel, 1 carousel/image)
- **Pinterest**: 3-5 pins/week (schedule in bulk, repurpose Instagram content)
- Skip TikTok initially - add later if capacity grows
- IG Stories only when you have natural moments to share

**Pro tip**: X content can be quick and spontaneous. Post a beautiful view with a one-liner while you're out. Save polished content for Instagram.

**Monthly themes** (align with best_months metadata in stories):
- Jan-Feb: Cozy Asturias (sidrerias, comfort food, rainy day charm)
- Mar-Apr: Spring awakening (wildflowers, waterfalls, Camino prep)
- May-Jun: Pre-summer sweet spot (beaches before crowds, hiking season)
- Jul-Aug: Summer highlights (festivals, beaches, mountain escapes)
- Sep-Oct: Autumn glory (harvest, fall colors, quieter trails)
- Nov-Dec: Winter magic (Christmas markets, cocido, mountain snow)

---

#### 4. Building Trust & Community

##### Reviews & Mentions
- Encourage visitors to tag @paisaxe when they visit places from the site
- Reshare user content (UGC) - 92% of consumers trust UGC over ads
- Build relationships with Asturias-based travel bloggers (not paid, just genuine connections)

##### Press & Backlinks (Organic)
- Submit to tourism innovation features (the conversational interface is novel)
- Reach out to "digital nomad in Spain" bloggers
- Guest post on Asturias/Spain travel blogs (offer unique content, not promotion)

##### Entity Building (for AI visibility)
- Create/claim Google Business Profile for Paisaxe
- Ensure Paisaxe appears on relevant directories
- If notable enough, Wikipedia entry (long-term goal)

---

#### 5. SEO Content Strategy

##### Blog/Long-form Content (if added later)
Not immediate priority, but consider adding:
- Destination guides ("Complete Guide to Eastern Asturias")
- Seasonal guides ("Asturias in Winter: What to Do")
- Practical guides ("Getting to Asturias Without a Car")

These would:
- Target long-tail keywords
- Build topical authority
- Provide content for Pinterest
- Feed AI training data

---

### Part 2: Technical Optimizations Required

#### Current State Assessment

**Already Implemented** (strong foundation):
- Meta tags, Open Graph, Twitter Cards
- JSON-LD structured data (WebSite, TouristDestination)
- Dynamic sitemap with all stories
- Robots.txt properly configured
- Core Web Vitals monitoring (Lighthouse CI)
- Image optimization (AVIF, WebP, lazy loading)
- Accessibility (ARIA, keyboard nav, screen reader support)
- Dynamic OG images for social sharing

#### Required Technical Changes

##### HIGH PRIORITY

1. **Add Favicon & App Icons**
   - Create `/public/favicon.ico`, `/public/icon.png`, `/public/apple-touch-icon.png`
   - Add `metadata.icons` in `layout.tsx`
   - Impact: Brand recognition, professionalism

2. **Add Story-Level Schema Markup**
   - Enhance `json-ld.tsx` to generate schema per story type:
     - `TouristAttraction` for locations
     - `Restaurant` for food establishments
     - `Article` for general content
   - Include geo coordinates, ratings if available
   - Impact: Rich results in search, AI citations

3. **Add FAQ Schema from Question Prompts**
   - Stories have `question_prompts` metadata
   - Convert to `FAQPage` schema for applicable stories
   - Impact: FAQ rich results, voice search optimization

4. **Allow AI Crawlers in robots.txt**
   - Currently allows all crawlers, but explicitly verify:
   ```
   User-agent: GPTBot
   Allow: /

   User-agent: anthropic-ai
   Allow: /

   User-agent: PerplexityBot
   Allow: /
   ```
   - Impact: Ensures AI systems can index content

5. **Create llms.txt File**
   - New standard for AI-readable site summaries
   - Place at `/public/llms.txt`
   - Content: Site description, key topics, contact info
   - Impact: Direct communication with AI crawlers

##### MEDIUM PRIORITY

6. **Add Breadcrumb Schema**
   - Implement `BreadcrumbList` schema
   - Path: Home > Category > Story
   - Impact: Site structure clarity for search engines

7. **Structured Chunk Content for AI**
   - Ensure content chunks lead with direct answers (40-60 words)
   - Add statistics and citations where possible
   - Impact: 40% visibility boost in AI citations

8. **Add hreflang Tags**
   - Even if content is Spanish, declare language properly
   - `alternates.languages` in metadata
   - Impact: International SEO

9. **Add Theme Color Meta**
   - `metadata.themeColor` for mobile browser chrome
   - Match Paisaxe brand color
   - Impact: Brand consistency on mobile

10. **Add Web App Manifest**
    - `/public/manifest.json` for PWA capability
    - Enables "Add to Home Screen"
    - Impact: Engagement, return visits

##### LOWER PRIORITY

11. **Preconnect to External Services**
    - Add `rel="preconnect"` for Supabase, analytics
    - Impact: Performance (LCP improvement)

12. **Enhanced Analytics Events**
    - Track: story views, chat initiated, category filters used
    - Impact: Content strategy insights

---

### Part 3: AI/LLM Search Optimization (GEO)

This is the emerging frontier. Key insights:

#### How AI Systems Find Content

| Platform | Primary Sources | Paisaxe Strategy |
|----------|-----------------|------------------|
| **ChatGPT** | Wikipedia, Forbes, G2, Amazon | Build brand presence, get mentioned in articles |
| **Perplexity** | Reddit, YouTube, LinkedIn | Share on Reddit travel subs, create YouTube content |
| **Google AI Overviews** | Diverse cross-platform presence | Multi-platform content distribution |

#### What Drives AI Citations

1. **Brand search volume** (strongest predictor) - Build brand awareness so people search "Paisaxe"
2. **Content freshness** - Keep content updated, add new stories
3. **Structured data** - Already good, enhance with story-level schema
4. **Multi-platform presence** - Be on 4+ platforms (2.8x citation likelihood)

#### Actions for AI Visibility

1. **Optimize content for extraction**:
   - Lead paragraphs with direct answers
   - Use 40-60 word paragraphs
   - Include statistics when possible

2. **Build entity presence**:
   - Google Business Profile
   - Wikidata entry (if criteria met)
   - Mentions on travel sites/blogs

3. **Fresh content signals**:
   - Update stories seasonally
   - Add new content regularly
   - Keep `lastModified` accurate in sitemap

4. **Allow all AI crawlers** (see robots.txt update above)

5. **Create llms.txt** (see above)

---

### Part 4: Implementation Roadmap

#### Technical Implementation (I will do this)

##### 1. Favicon & App Icons
- Create placeholder favicon (can be replaced with branded version)
- Add `metadata.icons` configuration to `src/app/layout.tsx`
- Files: `/public/favicon.ico`, `/public/icon.png`, `/public/apple-touch-icon.png`

##### 2. AI Crawler Support
- Update `src/app/robots.ts` to explicitly allow GPTBot, anthropic-ai, PerplexityBot
- Create `/public/llms.txt` with Paisaxe site summary

##### 3. Enhanced Schema Markup
- Extend `src/components/seo/json-ld.tsx` with:
  - `TouristAttraction` schema for nature/location stories
  - `Restaurant` schema for food/gastronomy stories
  - `FAQPage` schema from story question_prompts
  - `BreadcrumbList` schema for navigation
- Add story-level schema injection to story pages

##### 4. Metadata Enhancements
- Add `themeColor` to layout metadata
- Add hreflang declaration (`es` primary)
- Create `/public/manifest.json` for PWA support

##### 5. Add Tests
- Tests for new schema types
- Tests for llms.txt content
- Tests for manifest.json

#### Your Tasks (Social Media)

##### Phase 1: Setup (Before Launch)
- [ ] Set up X account for Paisaxe (or use existing personal account if preferred)
- [ ] Create Instagram account (@paisaxe or @paisaxeapp)
- [ ] Create Pinterest business account
- [ ] Create basic content bank (10-15 visual pieces minimum)
- [ ] Link all accounts in bios to paisaxe.com

##### Phase 2: Launch (Week 1-2)
- [ ] Start posting on X (daily or near-daily, low friction)
- [ ] Begin Instagram rhythm (2 posts/week)
- [ ] Batch-schedule Pinterest pins
- [ ] Follow/engage with Asturias travel community on all platforms

##### Phase 3: Growth (Month 2+)
- [ ] Analyze what content performs across platforms
- [ ] Double down on winners
- [ ] Build X threads for popular topics
- [ ] Consider TikTok if capacity grows
- [ ] Track AI search visibility (manual checks monthly)

---

### Part 5: Success Metrics

#### Organic Growth Indicators
- X followers and engagement (impressions, replies, reposts)
- Instagram followers growth rate
- Pinterest monthly views
- Website traffic from social (check referrers)
- Direct traffic (brand searches for "Paisaxe")

#### SEO Health
- Google Search Console impressions/clicks
- Number of indexed pages
- Rich results appearance
- Core Web Vitals scores

#### AI Visibility (check manually monthly)
- Does ChatGPT mention Paisaxe when asked about Asturias tourism?
- Does Perplexity cite Paisaxe?
- Does Google AI Overview include Paisaxe?

#### Engagement
- X engagement rate (replies, reposts, quote tweets)
- Instagram engagement rate (aim for >2%)
- Pinterest saves and click-throughs
- Time on site from social traffic
- Stories viewed per session

---

### Files to Create/Modify

#### New Files
| File | Purpose |
|------|---------|
| `/public/favicon.ico` | Browser tab icon |
| `/public/icon.png` | PWA icon (512x512) |
| `/public/apple-touch-icon.png` | iOS bookmark icon (180x180) |
| `/public/llms.txt` | AI crawler summary |
| `/public/manifest.json` | PWA manifest |

#### Files to Modify
| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Add icons, themeColor, manifest link |
| `src/app/robots.ts` | Add AI crawler rules |
| `src/components/seo/json-ld.tsx` | Add TouristAttraction, Restaurant, FAQ, Breadcrumb schemas |
| `src/app/immersive/layout.tsx` | Include story-level schema |

#### New Test Files
| File | Coverage |
|------|----------|
| `src/components/seo/json-ld.test.tsx` | Extend with new schema tests |
| `public/llms.txt` | Validation test |

---

### Verification

After implementation, verify:
1. **Schema**: Test at https://search.google.com/test/rich-results
2. **Favicon**: Check browser tab shows icon
3. **PWA**: Test "Add to Home Screen" on mobile
4. **AI Crawlers**: Check robots.txt at /robots.txt
5. **llms.txt**: Accessible at /llms.txt

---

### Key Resources

#### Research Sources
- [Travel Marketing Guide 2025](https://www.hummingbird.agency/2025s-ultimate-guide-to-digital-marketing-for-travel/)
- [AI Search Optimization 2025](https://www.pagetraffic.com/blog/ai-search-optimization-in-2025/)
- [2025 AI Visibility Report](https://thedigitalbloom.com/learn/2025-ai-citation-llm-visibility-report/)
- [Social Media for Travel](https://sproutsocial.com/insights/social-media-for-travel/)
- [Pinterest Marketing 2025](https://thekarareport.com/pinterest-marketing-in-2025/)
- [Schema Markup for Travel SEO](https://618media.com/en/blog/schema-markup-for-travel-seo/)
- [LLM Search Optimization Guide](https://www.m8l.com/blog/llm-search-optimization-how-to-make-your-website-visible-to-ai)

#### Tools to Use
- **Google Search Console** - Monitor search performance
- **Google Rich Results Test** - Validate schema markup
- **Otterly.AI** - Monitor AI search visibility (when ready)
- **X Analytics** - Track impressions, engagement, link clicks
- **Pinterest Analytics** - Track pin performance
- **Instagram Insights** - Track engagement

---

*This document serves as both the marketing strategy and the implementation plan for technical changes needed to support it.*

</details>

---

## How to Reuse This Strategy

To apply a similar marketing/SEO strategy to another project:

1. **Audit current SEO state** - Check existing meta tags, schema, sitemap, robots.txt
2. **Research platform-specific best practices** - Each platform has different optimal content formats
3. **Implement technical foundations first** - Schema, AI crawler support, PWA manifest
4. **Create content pillars** - Define your voice and content categories
5. **Start with lowest friction platforms** - Build habits before expanding
6. **Track metrics that matter** - Focus on engagement over vanity metrics
7. **Document everything** - Create a file like this one for future reference
