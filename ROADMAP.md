# Paisaxe - Development Roadmap

A living document tracking implemented features and future development plans.

**Domain**: paisaxe.es
**Last Updated**: January 25, 2026

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
| Keyword Fallback Search | :white_check_mark: | Place name matching |

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
| Vitest Testing | :white_check_mark: | 251 tests passing |
| GitHub Actions CI | :white_check_mark: | Lint, typecheck, test, build |
| Git Hooks (Husky) | :white_check_mark: | Pre-commit quality checks |

---

## Current Sprint: Content Expansion :white_check_mark:

### Task 1: PDF Image Extraction Pipeline :white_check_mark:

| Item | Status | Notes |
|------|--------|-------|
| Create extraction script | :white_check_mark: | `scripts/extract-images.ts` |
| Extract images from PDFs | :white_check_mark: | 1,773 images from 37 PDFs |
| Generate manifest file | :white_check_mark: | `content/images/manifest.json` (14K lines) |
| Seed images table | :calendar: | Populate database with extracted images |

### Task 2: Dynamic Stories from Database

| Item | Status | Notes |
|------|--------|-------|
| Create stories table migration | :white_check_mark: | `003_stories_table.sql` |
| Apply migration to Supabase | :calendar: | Run SQL in Supabase dashboard |
| Add database loading functions | :white_check_mark: | `getStoriesFromDB()`, etc. |
| Seed stories table | :calendar: | Run `npm run seed-db:stories` |

### Task 3: Expand Story Content :white_check_mark:

| Item | Status | Notes |
|------|--------|-------|
| Create 12+ additional stories | :white_check_mark: | 20 total stories in seed script |
| Add location metadata | :white_check_mark: | Eastern, Central, Western |
| Add duration metadata | :white_check_mark: | Day-trip, Weekend, Week |
| Match with extracted images | :calendar: | Replace Unsplash URLs with PDF images |

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
| AI-suggested Related Stories | :white_check_mark: | Relevance-based recommendations (category, location, duration) |

---

## Phase 3: AI Improvements :calendar:

| Feature | Status | Notes |
|---------|--------|-------|
| Define AI Persona | :calendar: | "Pelayo" - historic Asturian name |
| Improve Context Retrieval | :calendar: | Better search accuracy |
| Add Personality to Responses | :calendar: | Warm, knowledgeable local expert |
| Display Related Images in Chat | :calendar: | Show images inline with responses |

---

## Phase 4: User Features :calendar:

| Feature | Status | Notes |
|---------|--------|-------|
| SSO Authentication | :calendar: | Google, Apple sign-in |
| Favorites List | :calendar: | Local storage + sync if logged in |
| Basic Analytics | :calendar: | Vercel Analytics or Plausible |

---

## Phase 5: Internationalization :calendar:

| Feature | Status | Notes |
|---------|--------|-------|
| Browser Language Detection | :calendar: | Auto-detect UI language |
| English UI Translation | :calendar: | Full interface translation |
| Other Languages | :calendar: | As needed |

---

## Phase 6: Polish :calendar:

| Feature | Status | Notes |
|---------|--------|-------|
| Loading Skeleton States | :calendar: | For stories and chat |
| Error Boundaries | :calendar: | Graceful error handling |
| Accessibility Audit | :calendar: | Screen readers, reduced motion |
| SEO Optimization | :calendar: | Organic discovery |

---

## Verification Checklist

After completing the current sprint:

- [x] Image extraction: 1,773 images extracted to `content/images/`
- [x] Manifest generated: `content/images/manifest.json` with metadata
- [x] 20 stories defined: In `scripts/seed-database.ts`
- [x] Database migration: Stories table exists in Supabase
- [x] Story seeding: 20 stories seeded via `npm run seed-db:stories`
- [x] Image replacement: 7 stories use PDF images, 13 use Unsplash fallback
- [x] Tests: `npm run test` - 251 tests pass
- [x] Build: `npm run build` - no errors
- [ ] Frontend: Visit `/immersive`, verify new stories load correctly

---

## Technical Notes

- Keep mobile-first approach in all UI changes
- Maintain current visual aesthetic (elegant, natural, warm)
- Voice input already works - preserve this functionality
- Tests before implementation (TDD workflow)
- All work on `develop` branch

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0 | Jan 2026 | MVP - Immersive stories + voice chat |
| v0.2.0 | - | Content expansion + dynamic loading |
| v0.3.0 | - | Story organization UI |
| v0.4.0 | - | AI improvements |
| v0.5.0 | - | User features |
| v1.0.0 | - | Production release |
