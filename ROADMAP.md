# Paisaxe - Development Roadmap

A living document tracking implemented features and future development plans.

**Domain**: paisaxe.es
**Last Updated**: May 1, 2026

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
| Voice Output (TTS) | :white_check_mark: ElevenLabs Pelayo agent (paid feature) |
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
| Vector Search | :white_check_mark: | Supabase pgvector (512 dims, Matryoshka) |
| Voyage AI Embeddings | :white_check_mark: | voyage-3.5 model |
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
| Vitest Testing | :white_check_mark: | 6,347 tests passing (341 files) |
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

## Phase 3: AI Improvements :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Improve Context Retrieval | :white_check_mark: | Hybrid vector + keyword search working |
| Define AI Persona "Pelayo" | :white_check_mark: | First-person persona based on Asturian cultural identity; warm, personal, knowledgeable local |
| Add Personality to Responses | :white_check_mark: | Pelayo persona in system prompt — speaks as a passionate local friend, not a generic bot |
| Display Related Images in Chat | :white_check_mark: | Images rendered inline with `<figure>`/`<figcaption>`, captions, source attribution |

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

Database-backed feature flags (migration `008_feature_flags.sql`) with admin panel toggles and analytics tracking. All 10 visitor experience features implemented and individually toggleable. All default to disabled for controlled rollout.

| Flag | Status | Notes |
|------|--------|-------|
| `related_stories` | :white_check_mark: | Active and visible in UI |
| `contextual_prompts` | :white_check_mark: | Story-specific suggested questions near chat button |
| `randomized_order` | :white_check_mark: | Fisher-Yates shuffle in story ordering |
| `surprise_me` | :white_check_mark: | Random unviewed story jump button |
| `story_sharing` | :white_check_mark: | Web Share API + OG meta tags |
| `seasonal_surfacing` | :white_check_mark: | Weight order by current month/season |
| `mood_discovery` | :white_check_mark: | Optional mood selector overlay |
| `asturianu_touches` | :white_check_mark: | Authentic Asturian words in UI and chat |
| `ambient_discovery` | :white_check_mark: | Slower transitions with ambient indicator |
| `story_freshness` | :white_check_mark: | "Nuevo" badge on recent stories |

See `docs/visitor-experience-improvements.md` for full feature descriptions and implementation waves.

---

## Phase 5: Visitor Experience Enhancements :white_check_mark:

All 10 features implemented behind feature flags (disabled by default, toggleable via admin panel). See feature flags above for individual status.

### Wave 1 -- Quick Wins (priority >= 4.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Randomized Story Order | :white_check_mark: | Fisher-Yates shuffle in `shuffle.ts` |
| "Surprise Me" Button | :white_check_mark: | `surprise-me-button.tsx` - random unviewed story jump |
| Story Freshness Badges | :white_check_mark: | `freshness-badge.tsx` - "Nuevo" badge on recent stories |

### Wave 2 -- High-Impact Features (priority >= 2.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Contextual Question Prompts | :white_check_mark: | `question-prompts.tsx` - story-specific suggested questions |
| Story Sharing | :white_check_mark: | `share-button.tsx` - Web Share API + OG meta tags |
| Seasonal Story Surfacing | :white_check_mark: | `seasonal-weighting.ts` - weight order by current month |
| Mood-Based Discovery | :white_check_mark: | `mood-overlay.tsx` + `mood-mapping.ts` - optional mood selector |

### Wave 3 -- Experience Elevation

| Feature | Status | Notes |
|---------|--------|-------|
| Asturianu Language Touches | :white_check_mark: | `asturianu.ts` - authentic Asturian words in UI and chat |
| Ambient Discovery Mode | :white_check_mark: | `ambient-indicator.tsx` - slower transitions with indicator |

---

## Phase 6: Internationalization :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| i18n Infrastructure | :white_check_mark: | LanguageProvider context, useTranslation hook, dot-notation key resolver |
| Browser Language Detection | :white_check_mark: | Auto-detect from `navigator.languages`, persisted to localStorage |
| Spanish Locale (es) | :white_check_mark: | ~85 translation keys covering all UI chrome |
| English Locale (en) | :white_check_mark: | Full English translation of all UI strings |
| Language Switcher | :white_check_mark: | ES/EN pill toggle in story viewer header |
| Filter Labels i18n | :white_check_mark: | Categories, locations, durations all translated via `t()` |
| Action Buttons i18n | :white_check_mark: | "Ask about this", "Saved", chat UI, favorites page |
| Other Languages | :white_check_mark: | French, German, Portuguese added (5 locales total) |

Note: Story content (titles, descriptions) remains in Spanish — sourced from Supabase DB. Chat responds in the visitor's detected language via Claude.

---

## Phase 7: Polish :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Skeleton UI Loading States | :white_check_mark: | Shimmer skeletons for story cards, chat messages, story details; replaces all spinners |
| Accessibility Audit | :white_check_mark: | `prefers-reduced-motion` via `useReducedMotion` hook, `aria-live` regions, `focus-visible` rings, semantic HTML (`<main>`, `<article>`), 11 new i18n a11y keys |
| SEO Optimization | :white_check_mark: | Open Graph + Twitter cards, JSON-LD (WebSite + TouristDestination), `robots.ts`, enhanced `sitemap.ts`, all using `NEXT_PUBLIC_SITE_URL` |
| Error Boundaries | :white_check_mark: | `error.tsx` (root + immersive), `not-found.tsx` (404), `global-error.tsx` — Spanish UI, dark theme, retry buttons |

---

## Phase 8: Automation & Quality Agents :white_check_mark:

Automated agents and scheduled workflows to guarantee code quality, security, and availability at the highest levels. All tools are free or use existing paid services (Anthropic API).

### Security & Dependency Management

| Feature | Status | Notes |
|---------|--------|-------|
| Gitleaks Secret Scanning | :white_check_mark: | `gitleaks.yml` — push/PR + daily 4AM UTC cron |
| Dependabot | :white_check_mark: | `dependabot.yml` — npm + GitHub Actions, weekly Monday, grouped PRs |
| License Compliance | :white_check_mark: | `license-check.yml` — fails on GPL/AGPL/EUPL/SSPL/BSL/CPAL/OSL |

### Performance CI

| Feature | Status | Notes |
|---------|--------|-------|
| Lighthouse CI | :white_check_mark: | `lighthouse.yml` + `lighthouserc.json` — 3 runs, perf/a11y/SEO budgets |
| Bundle Size Tracking | :white_check_mark: | `bundle-size.yml` — PR comments with .next size breakdown + top 20 bundles |

### App Integration

| Feature | Status | Notes |
|---------|--------|-------|
| Vercel Speed Insights | :white_check_mark: | `<SpeedInsights />` in layout.tsx — RUM for Core Web Vitals |
| Health Check Endpoint | :white_check_mark: | `GET /api/health` — Supabase connectivity, latency, version, uptime (9 tests) |

### Code Quality & AI Review

| Feature | Status | Notes |
|---------|--------|-------|
| Knip Dead Code Detection | :white_check_mark: | `knip.yml` + `knip.json` — report mode (initial rollout), Next.js + Vitest aware |
| Claude Code Action | :white_check_mark: | `claude-review.yml` — AI review on PRs using claude-sonnet-4, @claude trigger |

### Database Maintenance

| Feature | Status | Notes |
|---------|--------|-------|
| Supabase pg_cron | :white_check_mark: | `011_pg_cron_maintenance.sql` — VACUUM chunks/analytics weekly, ANALYZE daily |

### Availability Monitoring

| Feature | Status | Notes |
|---------|--------|-------|
| Upptime | :white_check_mark: | `.github/upptime/.upptimerc.yml` config ready; requires separate repo setup (see file comments) |

---

## Verification Checklist

- [x] Image extraction: 1,773 images extracted to `content/images/`
- [x] Manifest generated: `content/images/manifest.json` with metadata
- [x] 20 stories defined: In `scripts/seed-database.ts`
- [x] Database migration: Stories table exists in Supabase
- [x] Story seeding: 20 stories seeded via `npm run seed-db:stories`
- [x] Image replacement: 7 stories use PDF images, 13 use Unsplash fallback
- [x] Tests: `npm run test` - 6,347 tests pass (341 files)
- [x] Build: `npm run build` - no errors
- [x] Auth: Google SSO working with Supabase SSR
- [x] Favorites: Cloud sync + local storage fallback
- [x] Admin: Story management panel at `/admin`
- [x] Feature flags: 10 flags in database, all features implemented
- [x] Analytics: Vercel Analytics active, custom events table + admin dashboard
- [x] i18n: ES/EN language switcher, browser detection, all UI chrome translated
- [x] Security: Gitleaks, Dependabot, license compliance workflows active
- [x] Performance CI: Lighthouse CI + bundle size analysis on PRs
- [x] Monitoring: Speed Insights RUM + `/api/health` endpoint
- [x] Code quality: Knip dead code detection + Claude AI PR reviews
- [x] Database: pg_cron maintenance jobs scheduled (VACUUM, ANALYZE)
- [x] Availability: Upptime config prepared (separate repo setup required)
- [x] Voice agent: ElevenLabs Pelayo configured with RAG knowledge base

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
| `011_pg_cron_maintenance.sql` | Scheduled VACUUM/ANALYZE via pg_cron | :white_check_mark: |

---

## Phase 9: Voice Agent Enhancements :calendar:

Premium voice conversations with Pelayo (ElevenLabs). Currently configured with RAG knowledge base from curated Asturias PDFs.

### Current Implementation :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Pelayo Voice Agent | :white_check_mark: | ElevenLabs agent with Gemini 2.5 Flash |
| Multilingual Support | :white_check_mark: | Spanish primary + English, German, French, Portuguese |
| RAG Knowledge Base | :white_check_mark: | Curated PDFs: city guides, Camino, culture, family activities |
| Language Detection | :white_check_mark: | Auto-detect visitor language |
| Visitor Access Control | :white_check_mark: | Feature flag + email whitelist gating |

### MCP Tool Integrations :white_check_mark:

Pelayo's real-time capabilities via custom webhook tools (at `/api/mcp/*`):

| Tool | Status | Notes |
|------|--------|-------|
| Weather API | :white_check_mark: | `get_weather` — current weather for Asturian cities |
| Places Search | :white_check_mark: | `search_places` — restaurants, attractions, hotels via Google Places API |
| Booking Integration | :white_check_mark: | `make_booking` — outbound calls via ElevenLabs + Twilio (gated by `booking_system` flag) |
| SMS Confirmation | :white_check_mark: | `sms_booking_confirmation` — post-call SMS via Twilio webhook |
| Events/Calendar | :calendar: | Not yet implemented |
| Maps/Directions | :calendar: | Not yet implemented |

Agents are tracked in git via ElevenLabs CLI (`agents.json`, `agent_configs/*.json`).

---

---

## Phase 10: Payments & Monetization :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Stripe Embedded Checkout | :white_check_mark: | Day Pass (€1.99/24h) via embedded checkout, not hosted |
| Stripe Webhook Handler | :white_check_mark: | `grant_day_pass_idempotent` RPC for atomic idempotent grants |
| Revenue Analytics | :white_check_mark: | Admin → Analytics → Revenue tab with Stripe data |
| Return to Story After Payment | :white_check_mark: | User lands back on original story after checkout |
| Checkout Health Endpoint | :white_check_mark: | `/api/checkout/health` (admin-auth required) |

Lemon Squeezy fully removed. All payment processing via Stripe only.

---

## Phase 11: Security Hardening (Audit Remediation) :white_check_mark:

Engineering audit (Phases 1–10, April 2026). Key remediations:

| Area | Change |
|------|--------|
| Stripe webhook | Atomic `grant_day_pass_idempotent` Supabase RPC |
| CSRF protection | Double-submit cookie (`src/lib/csrf.ts`, `src/lib/csrf-client.ts`) |
| Request correlation | Propagated correlation IDs (`src/lib/proxy/request-id.ts`) |
| Distributed rate limiting | Upstash Redis with in-memory fallback (`src/lib/rate-limit.ts`) |
| Env validation | Centralized `src/lib/env.ts` with `.trim()` enforcement |
| Admin auth | `withAdmin` HOF replacing per-route checks (`src/lib/admin-auth.ts`) |
| XSS | `dangerouslySetInnerHTML` replaced with `SafeMarkdown` everywhere |
| Proxy decomposition | `proxy.ts` split into `src/lib/proxy/` modules |
| Sentry | Error tracking across client, server, and edge runtimes |
| Structured logging | Pino with PII sanitization (`src/lib/logger.ts`, `src/lib/logger-sanitize.ts`) |
| SSE abort | Chat stream cancellation propagated to Claude API |
| Zod validation | Runtime validation across full API surface |

---

## Phase 12: Content & Story Pipeline :white_check_mark:

| Feature | Status | Notes |
|---------|--------|-------|
| Automatic Story Translations | :white_check_mark: | `/api/webhooks/translate` + `cron/fail-stale-translations` |
| Content Discovery Agent | :white_check_mark: | Weekly cron discovers new Asturias places via Google Places API |
| WebP Image Migration | :white_check_mark: | All story images converted from PNG (~14 MB → ~6 MB) |
| Author Attribution Pill | :white_check_mark: | Typewriter animation with story author credit |
| About / Privacy / Terms Pages | :white_check_mark: | Localized to all 6 languages |
| Site Footer | :white_check_mark: | Legal links and content attribution |
| Mobile Tap Zones | :white_check_mark: | Instagram-style 30/70 left/right split |

---

## Technical Notes

- Keep mobile-first approach in all UI changes
- Maintain current visual aesthetic (elegant, natural, warm)
- Voice input already works - preserve this functionality
- Tests before implementation (TDD workflow)
- All work on `develop` branch
- Feature flags control visitor experience features - enable via admin panel when ready to roll out

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0 | Jan 2026 | MVP - Immersive stories + voice chat |
| v0.2.0 | Jan 2026 | Content expansion + dynamic loading |
| v0.3.0 | Jan 2026 | Story organization UI + related stories |
| v0.4.0 | Jan 2026 | User features (auth, favorites, admin panel) |
| v0.5.0 | Jan 2026 | Visitor experience enhancements (Waves 1-3) + feature flags |
| v0.6.0 | Jan 2026 | AI improvements (Pelayo persona, chat images) |
| v0.7.0 | Jan 2026 | Internationalization (ES/EN language switcher, browser detection, full UI translation) |
| v0.8.0 | Jan 2026 | Automation & quality agents (security, performance, availability, AI review) |
| v0.9.0 | Jan 2026 | Polish (skeleton UI, a11y, SEO, error boundaries) |
| v0.10.0 | Feb 2026 | Voice agent (ElevenLabs Pelayo with RAG knowledge base) |
| v1.0.0 | Feb 2026 | Production release |
| v1.1.0 | Feb 2026 | Stripe payments + voice booking + admin dashboard expansion |
| v1.2.0 | Feb 2026 | Asturian language support + UI improvements |
| v1.3.0 | Apr 2026 | Security hardening (audit remediation phases 1-10) + content pipeline |
| v1.4.0 | Apr 2026 | Pre-launch remediation: booking persistence, E2E reliability, admin hardening, DevOps automation |
| v1.5.0 | May 2026 | Wave 1+2 audit remediation: health split, Redis cache, HNSW index, RLS-aware admin auth, Pino logger, CRON telemetry, develop-smoke CI |
| v1.5.1 | May 2026 | Patch: restore author-pill typewriter animation (effect-deps regression) |
