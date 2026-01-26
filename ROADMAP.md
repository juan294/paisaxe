# Paisaxe - Development Roadmap

A living document tracking implemented features and future development plans.

**Domain**: paisaxe.es
**Last Updated**: January 26, 2026

---

## Legend

| Status | Meaning |
|--------|---------|
| :white_check_mark: | Complete |
| :construction: | In Progress |
| :calendar: | Planned |

---

## Project Vision

A personal passion project showcasing Asturias, Spain through immersive visual storytelling and an intelligent AI assistant. The site helps visitors discover and plan trips to the region.

**Hero Features**: Stunning visual stories + Smart AI assistant

---

## Requirements Summary

| Aspect | Decision |
|--------|----------|
| Audience | Mixed - anyone interested in Asturias |
| Primary Goals | Inspiration & discovery + Trip planning |
| Platform Priority | Mobile-first |
| Content Source | 37 official tourism PDFs |
| Target Stories | 50+ (currently 20) |
| Languages | Auto-detect UI language |
| AI Role | Information assistant + local expert (accurate with personality) |
| Voice Input | Essential |
| Voice Output (TTS) | Future feature |
| User Accounts | Optional SSO for favorites only |
| Map View | Not needed |
| Trip Planner | Not needed |
| Analytics | Basic (page views, popular stories) |

---

## Phase 1: MVP :white_check_mark:

### Core Experience

| Feature | Status | Notes |
|---------|--------|-------|
| Immersive Story Viewer | :white_check_mark: | Full-screen visual stories with Ken Burns effect |
| Swipe/Arrow Navigation | :white_check_mark: | Touch and keyboard support |
| Auto-play Mode | :white_check_mark: | 6-second intervals |
| Progress Indicator | :white_check_mark: | Shows position in story sequence |
| Story Categories | :white_check_mark: | 5 categories: Nature, Cities, Food, Culture, Activities |
| 8 Curated Stories | :white_check_mark: | Initial hardcoded content |

### Voice & Text Chat

| Feature | Status | Notes |
|---------|--------|-------|
| Text Chat Interface | :white_check_mark: | Modal dialog with message history |
| Voice Input | :white_check_mark: | Web Speech API (Spanish) |
| Context-Aware Responses | :white_check_mark: | Answers based on current story |
| Multilingual Responses | :white_check_mark: | Responds in user's language |
| Source Attribution | :white_check_mark: | References PDF sources |

### AI & Search Backend

| Feature | Status | Notes |
|---------|--------|-------|
| Vector Search | :white_check_mark: | Supabase pgvector (1024 dims) |
| Voyage AI Embeddings | :white_check_mark: | voyage-3 model |
| Claude Integration | :white_check_mark: | Claude Sonnet for responses |
| Hybrid Search | :white_check_mark: | Vector similarity + keyword matching for place names |

### Data Pipeline

| Feature | Status | Notes |
|---------|--------|-------|
| PDF Text Extraction | :white_check_mark: | 37 PDFs processed |
| Content Chunking | :white_check_mark: | Smart paragraph splitting |
| Batch Embedding Generation | :white_check_mark: | Rate-limited processing |
| Database Seeding | :white_check_mark: | With clear/reseed option |

### Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Next.js 16 App Router | :white_check_mark: | TypeScript strict mode |
| Supabase PostgreSQL | :white_check_mark: | With pgvector extension |
| shadcn/ui Components | :white_check_mark: | Button, Card, Dialog, Input |
| Tailwind CSS Styling | :white_check_mark: | Custom Paisaxe theme |
| Vitest Testing | :white_check_mark: | 705 tests passing (48 files, 97.31% coverage) |
| GitHub Actions CI | :white_check_mark: | Lint, typecheck, test, build |
| Git Hooks (Husky) | :white_check_mark: | Pre-commit quality checks |
| Coverage Automation | :white_check_mark: | Nightly scheduled updates via `scripts/coverage-agent.sh` |

---

## Content Expansion Sprint :white_check_mark:

### Task 1: PDF Image Extraction Pipeline :white_check_mark:

| Item | Status | Notes |
|------|--------|-------|
| Create extraction script | :white_check_mark: | `scripts/extract-images.ts` |
| Extract images from PDFs | :white_check_mark: | 1,773 images from 37 PDFs |
| Generate manifest file | :white_check_mark: | `content/images/manifest.json` (14K lines) |
| Seed images table | :white_check_mark: | Images table populated in database |

### Task 2: Dynamic Stories from Database :white_check_mark:

| Item | Status | Notes |
|------|--------|-------|
| Create stories table migration | :white_check_mark: | `003_stories_table.sql` |
| Apply migration to Supabase | :white_check_mark: | Stories table exists in Supabase |
| Add database loading functions | :white_check_mark: | `getStoriesFromDB()`, etc. |
| Seed stories table | :white_check_mark: | 20 stories seeded via `npm run seed-db:stories` |

### Task 3: Expand Story Content :white_check_mark:

| Item | Status | Notes |
|------|--------|-------|
| Create 12+ additional stories | :white_check_mark: | 20 total stories in seed script |
| Add location metadata | :white_check_mark: | Eastern, Central, Western |
| Add duration metadata | :white_check_mark: | Day-trip, Weekend, Week |
| Match with extracted images | :white_check_mark: | 7 stories use PDF images, 13 use Unsplash fallback |

### Task 4: Database Deployment :white_check_mark:

| Item | Status | Notes |
|------|--------|-------|
| Apply stories migration | :white_check_mark: | Stories table exists in Supabase |
| Seed stories to database | :white_check_mark: | 20 stories seeded via `npm run seed-db:stories` |
| Copy PDF images to public/ | :white_check_mark: | 7 images in `public/images/stories/` |
| Update story image paths | :white_check_mark: | 7 stories use PDF images, 13 use Unsplash fallback |

---

## Phase 2: Story Organization :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Category Filtering UI | :white_check_mark: | Filter by Nature, Cities, Food, Culture, Activities |
| Geographic Filtering | :white_check_mark: | Eastern, Central, Western Asturias |
| Trip-type Filtering | :white_check_mark: | Day trip, Weekend, Week |
| Related Stories | :white_check_mark: | Visible in UI with category/location/duration scoring |

---

## Phase 3: AI Improvements :construction:

| Feature | Status | Notes |
|---------|--------|-------|
| Improve Context Retrieval | :white_check_mark: | Hybrid vector + keyword search working |
| Add Personality to Responses | :construction: | Generic warmth in system prompt; distinct persona pending |
| Define AI Persona | :calendar: | "Pelayo" - historic Asturian name |
| Display Related Images in Chat | :calendar: | Show images inline with responses |

---

## Phase 4: User Features :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| SSO Authentication | :white_check_mark: | Google OAuth via Supabase SSR |
| Favorites List | :white_check_mark: | Local storage + cloud sync when logged in |
| Sign-in Prompts | :white_check_mark: | Prompted after first bookmark if not logged in |
| Favorites Page | :white_check_mark: | Full UI at `/favorites` with grid view |
| Basic Analytics | :white_check_mark: | Vercel Analytics integrated; custom events DB table ready |

---

## Admin Panel :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Admin Authentication | :white_check_mark: | Bearer token with timing-safe comparison |
| Story Management UI | :white_check_mark: | Full CRUD at `/admin` |
| Image Editor | :white_check_mark: | Upload and manage story images |
| Curation Workflow | :white_check_mark: | Status tracking: needs_curation, approved |
| Admin API Routes | :white_check_mark: | Stories list, image upload, status update |

---

## Feature Flag Infrastructure :white_check_mark:

Database-backed feature flags (migration `008_feature_flags.sql`) ready for visitor experience features. All default to disabled.

| Flag | Status | Notes |
|------|--------|-------|
| `related_stories` | :white_check_mark: | Active and visible in UI |
| `contextual_prompts` | :calendar: | DB schema ready (`metadata.question_prompts`), UI pending |
| `randomized_order` | :calendar: | Flag ready, shuffle logic pending |
| `surprise_me` | :calendar: | Flag ready, button UI pending |
| `story_sharing` | :calendar: | Flag ready, Web Share API pending |
| `seasonal_surfacing` | :calendar: | DB field `best_months` ready, weighting logic pending |
| `mood_discovery` | :calendar: | DB field `metadata.mood_tags` ready, UI pending |
| `asturianu_touches` | :calendar: | DB fields ready, system prompt updates pending |
| `ambient_discovery` | :calendar: | Extended auto-play pending |
| `story_freshness` | :calendar: | Badge UI pending |

See `doc/visitor-experience-improvements.md` for full feature descriptions and implementation waves.

---

## Phase 5: Visitor Experience Enhancements :calendar:

Prioritized features from the visitor experience evaluation. See feature flags above for infrastructure status.

### Wave 1 -- Quick Wins (priority >= 4.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Randomized Story Order | :calendar: | Fisher-Yates shuffle in `useStories` hook |
| "Surprise Me" Button | :calendar: | Random unviewed story jump |
| Story Freshness Badges | :calendar: | Subtle "Nuevo" badge on recent stories |

### Wave 2 -- High-Impact Features (priority >= 2.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Contextual Question Prompts | :calendar: | Story-specific suggested questions near chat button |
| Story Sharing | :calendar: | Web Share API + OG meta tags |
| Seasonal Story Surfacing | :calendar: | Weight order by current month |
| Mood-Based Discovery | :calendar: | Optional mood selector: Relaxing / Adventurous / Cultural / Delicious |

### Wave 3 -- Experience Elevation

| Feature | Status | Notes |
|---------|--------|-------|
| Asturianu Language Touches | :calendar: | Authentic Asturian words in UI and chat |
| Ambient Discovery Mode | :calendar: | Slower transitions, optional ambient audio |

---

## Phase 6: Internationalization :calendar:

| Feature | Status | Notes |
|---------|--------|-------|
| Browser Language Detection | :calendar: | Auto-detect UI language |
| English UI Translation | :calendar: | Full interface translation |
| Other Languages | :calendar: | As needed |

---

## Phase 7: Polish :construction:

| Feature | Status | Notes |
|---------|--------|-------|
| Loading States | :construction: | Basic spinners + Suspense boundaries; skeleton UI pending |
| Accessibility | :construction: | ARIA labels + keyboard nav present; reduced motion + screen reader audit pending |
| SEO Optimization | :calendar: | Basic title/description; OG tags + structured data pending |
| Error Boundaries | :calendar: | No error boundary components yet |

---

## Verification Checklist

- [x] Image extraction: 1,773 images extracted to `content/images/`
- [x] Manifest generated: `content/images/manifest.json` with metadata
- [x] 20 stories defined: In `scripts/seed-database.ts`
- [x] Database migration: Stories table exists in Supabase
- [x] Story seeding: 20 stories seeded via `npm run seed-db:stories`
- [x] Image replacement: 7 stories use PDF images, 13 use Unsplash fallback
- [x] Tests: `npm run test` - 705 tests pass (97.31% statement coverage)
- [x] Build: `npm run build` - no errors
- [x] Auth: Google SSO working with Supabase SSR
- [x] Favorites: Cloud sync + local storage fallback
- [x] Admin: Story management panel at `/admin`
- [x] Feature flags: 10 flags in database, infrastructure ready
- [x] Analytics: Vercel Analytics active, custom events table ready

---

## Database Migrations

| Migration | Description | Status |
|-----------|-------------|--------|
| `001_chunks_table.sql` | PDF content chunks with embeddings | :white_check_mark: |
| `003_stories_table.sql` | Stories table | :white_check_mark: |
| `006_user_favorites.sql` | User favorites with cloud sync | :white_check_mark: |
| `008_feature_flags.sql` | Feature flag system | :white_check_mark: |
| `009_analytics_events.sql` | Custom analytics events | :white_check_mark: |
| `010_story_metadata_extensions.sql` | Extended metadata for visitor features | :white_check_mark: |

---

## Technical Notes

- Keep mobile-first approach in all UI changes
- Maintain current visual aesthetic (elegant, natural, warm)
- Voice input already works - preserve this functionality
- Tests before implementation (TDD workflow)
- All work on `develop` branch
- Feature flags control visitor experience features - enable in DB when UI is ready

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0 | Jan 2026 | MVP - Immersive stories + voice chat |
| v0.2.0 | Jan 2026 | Content expansion + dynamic loading |
| v0.3.0 | Jan 2026 | Story organization UI + related stories |
| v0.4.0 | Jan 2026 | User features (auth, favorites, admin panel) |
| v0.5.0 | - | AI improvements (Pelayo persona, chat images) |
| v0.6.0 | - | Visitor experience enhancements (Waves 1-3) |
| v0.7.0 | - | Internationalization |
| v1.0.0 | - | Production release |
