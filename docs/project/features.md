# Paisaxe Feature Reference

A complete catalog of everything Paisaxe can do, organized by audience.

---

## Table of Contents

- [Visitor Experience](#visitor-experience)
  - [Immersive Story Explorer](#immersive-story-explorer)
  - [Navigation](#navigation)
  - [Voice & Text Chat](#voice--text-chat)
  - [Filtering & Discovery](#filtering--discovery)
  - [Favorites](#favorites)
  - [Sharing](#sharing)
  - [Authentication](#authentication)
  - [Language Support](#language-support)
- [Admin Panel](#admin-panel)
  - [Access & Authentication](#access--authentication)
  - [Story Management](#story-management)
  - [Image Management](#image-management)
  - [Feature Flags](#feature-flags)
  - [Analytics Dashboard](#analytics-dashboard)
    - [Visitors Analytics](#visitors-analytics)
    - [Revenue Analytics](#revenue-analytics)
    - [Voice Analytics](#voice-analytics)
- [SEO & Social](#seo--social)
- [Infrastructure](#infrastructure)
- [Feature Flags Reference](#feature-flags-reference)

---

## Visitor Experience

### Immersive Story Explorer

The main experience lives at `/immersive`. Visitors see a full-screen carousel of curated tourism stories about Asturias, each with a high-resolution photograph, title, subtitle, and short description. Image attribution is displayed when available.

**Auto-play and ambient mode** — A play/pause toggle in the top-right controls automatic story progression. Two speeds exist:

| Mode | Transition interval | Ken Burns zoom |
|------|---------------------|----------------|
| Standard auto-play | 6 seconds | Normal |
| Ambient mode | 12 seconds | Slow, cinematic |

Ambient mode is indicated by a pulsing dot with an "AMBIENT" label. Both modes pause automatically when the chat panel is open.

**Ken Burns effect** — Every story image has a subtle continuous zoom animation that creates a sense of movement. The speed adapts to the current playback mode.

**Fullscreen immersion** — Clicking the main area or pressing `i` hides all UI overlays (buttons, text, progress bar) for a distraction-free view. Press `i` or click again to restore.

**Freshness badge** — Stories added within the last 14 days show a green "NEW" badge above the subtitle (controlled by the `story_freshness` feature flag).

**Image prefetching** — The previous, next, and two-ahead images are preloaded in the background for smooth transitions.

### Navigation

**Progress bar** — A row of dots at the top of the screen shows position within the current story set (capped at 20 visible indicators with a sliding window). Dots are clickable to jump directly to any story.

**Arrow buttons** — Left and right arrows on screen edges navigate between stories. These are disabled while the chat panel is open.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `Left arrow` | Previous story |
| `Right arrow` | Next story |
| `Space` | Next story |
| `i` | Toggle UI visibility |

A keyboard hint strip is displayed in the bottom-right corner.

**Surprise Me** — A button that jumps to a random unviewed story. Prefers stories the visitor hasn't seen yet in the current session; falls back to any story if all have been viewed. Controlled by the `surprise_me` feature flag.

### Voice & Text Chat

Visitors can ask questions about the current story by tapping "Ask about this" or the contextual question prompts below the description.

**Text input** — A text field with a send button at the bottom of the chat panel. Messages are limited to 1000 characters.

**Voice input (Web Speech API)** — A microphone button activates the Web Speech API (when the browser supports it). Speech is transcribed to text and sent automatically. The interface shows a "Listening..." state while recording. Language defaults to Spanish (es-ES).

**How text chat works under the hood:**

1. The user's question is sent to `POST /api/chat` along with the current story context.
2. The server generates an embedding of the question via Voyage AI.
3. A vector similarity search finds the most relevant content chunks from the PDF database.
4. The matched chunks are passed as context to the Claude API.
5. Claude generates a response, which may include references to source PDFs.
6. Related images from the database are returned alongside the response, displayed inline with captions and source attribution.

### Premium Voice Agent (Pelayo)

A premium, paid voice conversation feature using ElevenLabs Conversational AI. Gated by the `visitor_voice_agent` feature flag with email whitelist.

**Voice persona** — Pelayo, a warm and knowledgeable tourism guide named after King Pelayo. Speaks Spanish by default with auto-detection for English, German, French, and Portuguese.

**Configuration:**
- LLM: Gemini 2.5 Flash (low latency, strong multilingual)
- TTS: eleven_turbo_v2_5 with Ignacio voice
- Temperature: 0.65 (warmth with accuracy)
- Max tokens: 250 (conversational brevity)
- Max duration: 10 minutes per conversation

**RAG Knowledge Base** — Pelayo has access to curated Asturias tourism content via ElevenLabs RAG:
- City guides (Oviedo, Gijón, Avilés)
- Camino de Santiago planner
- Culture guide
- Family activities guide
- Asturias story guide

RAG settings: Multilingual embeddings, 5 chunks max, 15K character limit, 0.40 distance threshold.

**System tools enabled:**
- Language detection (auto-detect visitor's language)
- End conversation (graceful goodbyes)

See `docs/operations/elevenlabs-pelayo-config.md` for full configuration details.

**Suggested questions** — Up to three contextual question prompts appear below the story description (e.g., "Can I visit in winter?", "Best time to hike here?"). These are populated from each story's `question_prompts` metadata. Controlled by the `contextual_prompts` feature flag.

**Privacy notice** — The first time a visitor opens the chat, a dismissible notice explains that questions are processed with AI and conversations are not stored. The dismissal is persisted in localStorage.

**Rate limiting** — The chat API enforces per-IP rate limits to prevent abuse.

### Filtering & Discovery

**Category filter badge** — A pill button in the top-left opens a filter panel with three dimensions:

| Dimension | Options |
|-----------|---------|
| Category | Naturaleza, Ciudades, Gastronomia, Cultura, Actividades |
| Location | Asturias Oriental, Asturias Central, Asturias Occidental |
| Duration | Excursion de un dia, Fin de semana, Una semana |

Filters are multi-select within each dimension. A badge shows the count of active filters. The panel closes on outside click or Escape. A "Clear filters" button resets all selections.

**Mood overlay** — On the first visit (per session), a 2x2 grid overlay asks visitors how they feel:

| Mood | Maps to |
|------|---------|
| Relajante (Relaxing) | Nature stories |
| Aventurero (Adventurous) | Activities & Nature stories |
| Cultural (Cultural) | Culture & Cities stories |
| Delicioso (Delicious) | Food stories |

Selecting a mood filters the story set. The visitor can dismiss it with "Show all" to see everything. The choice is stored in sessionStorage so it doesn't re-appear in the same session. Controlled by the `mood_discovery` feature flag.

**Seasonal weighting** — Stories tagged with `bestMonths` that match the current month are promoted to the top of the story set. The relative order within boosted and non-boosted groups is preserved. Controlled by the `seasonal_surfacing` feature flag.

**Randomized order** — When enabled, stories are shuffled using a session-stable seed (Fisher-Yates algorithm). The same session always sees the same order; different sessions see different orders. Controlled by the `randomized_order` feature flag.

**Related stories** — A collapsible carousel at the bottom-left recommends up to 3 related stories. Relevance is scored by: same category (+3), same location (+2), same duration (+1). Clicking a card jumps to that story. Controlled by the `related_stories` feature flag.

**Story ordering pipeline** — Stories go through these stages in order:

1. Load from database
2. Apply mood filter (if selected)
3. Apply seasonal weighting (if enabled)
4. Shuffle (if enabled, using session seed)
5. Apply category/location/duration filters
6. Display

### Favorites

**Bookmark button** — A button in the top-right toggles a story as saved or unsaved. A toast notification confirms the action ("Saved to favorites" / "Removed from favorites"). The icon fills when saved.

**Favorites page** (`/favorites`) — A responsive grid gallery of all bookmarked stories. Features include:

- Large featured card for the first story (on desktop)
- Quick-remove buttons on each card
- Saved story count
- Empty state with a call-to-action to explore
- Lazy-loaded images via Intersection Observer
- Infinite scroll (loads 20 stories at a time)
- Responsive layout: 1 column on mobile, 2 on tablet, 3 on desktop

**Storage strategy:**

| Layer | Storage | Scope |
|-------|---------|-------|
| Local | localStorage | Per-browser, persists across sessions |
| Cloud | Supabase `user_favorites` table | Per-user, requires Google login |

When a user logs in, local and cloud favorites are merged (union). New local favorites are uploaded to the cloud. This means favorites are never lost.

**Sync banner** — Unauthenticated visitors with local favorites see a banner encouraging them to sign in with Google to sync across devices.

### Sharing

**Share button** — Shares the current story via a link in the format `/story/{slug}`.

| Device type | Behavior |
|-------------|----------|
| Touch devices | Native Web Share API (if available) |
| Non-touch devices | Copies URL to clipboard |

A toast notification confirms "Link copied" when using clipboard. The share includes the story title and subtitle. Controlled by the `story_sharing` feature flag.

**Story detail page** (`/story/[slug]`) — When someone follows a shared link, the page generates rich OpenGraph metadata for social previews and then redirects to `/immersive?story={slug}` so the visitor lands directly on that story.

### Authentication

**Google OAuth** — Visitors can sign in with Google to sync favorites across devices. The auth flow uses Supabase Auth with Google as the provider.

| State | UI |
|-------|-----|
| Not signed in | "Log In" icon button |
| Loading | Pulsing placeholder |
| Signed in | Google profile avatar or initials |

Clicking the avatar opens a dropdown showing the user's name and email with a "Sign out" option.

**Sign-in prompt** — A modal that can appear contextually when a visitor has local favorites, explaining the benefits of syncing with Google.

### Language Support

**UI language** — A two-button toggle in the top-right switches between Spanish (ES) and English (EN). The choice is persisted in localStorage. On first visit, the browser's language preference is auto-detected.

All UI labels, buttons, hints, error messages, empty states, and filter names are translated in both languages.

**Chat language** — The AI chat responds in the visitor's detected or selected language.

**Asturian language touches** — When the `asturianu_touches` feature flag is enabled, some UI labels and story titles/subtitles are displayed in Asturianu (the local language of Asturias). Examples: "Preguntar sobre esto" becomes "Entrugame sobre esto".

---

## Admin Panel

The admin panel is accessible at `/admin`. It has five main tabs:

| Tab | Shortcut | Purpose |
|-----|----------|---------|
| Stories | `Cmd+1` | Manage story content and images |
| Toggles | `Cmd+2` | Control feature flags |
| Analytics | `Cmd+3` | View visitor, revenue, and voice metrics |
| Marketing | `Cmd+4` | Social media automation |
| Suggestions | `Cmd+5` | Review visitor-submitted place suggestions |

### Access & Authentication

The admin panel uses Supabase Auth (Google OAuth) with role-based access control (RBAC) via the `user_profiles` table.

1. Navigate to `/admin`.
2. Sign in with Google (the same OAuth flow used by regular visitors).
3. The server reads the session cookie and checks `user_profiles.role = 'admin'` via `validateAdminAuth()`.
4. If the user has the `admin` role, the admin session begins. There is no secret key or bearer token.
5. The session lasts until the admin clicks "Logout" or the session cookie expires.

All admin API routes (`/api/admin/*`) validate the session cookie and confirm the user holds the `admin` role. Cookies are sent automatically by the browser on every fetch request. Requests from unauthenticated users or users without the `admin` role return 401/403 errors. On the client side, the `useAdminRole()` hook queries the user's role via Row Level Security to control UI access.

### Story Management

**Story grid** — The Stories tab shows all stories in a responsive grid (1-4 columns depending on screen width). Every 5th card spans 2 columns for visual rhythm.

**Story cards** display:

- Story image (with zoom effect on hover)
- Title, subtitle, and category label (visible on hover)
- Curation status badge (top-left): amber "Pending" or hidden when approved
- Placeholder badge (bottom-left, blue): shown for stories using temporary Unsplash images
- Edit button (top-right, on hover): opens the image editor

**Curation status filtering** — A filter bar above the grid offers three views:

| Filter | Shows |
|--------|-------|
| All | Every story with count |
| Pending | Only `needs_curation` stories |
| Approved | Only `approved` stories |

**Header metrics** (desktop only) — Total count, pending count, approved count, and stories-with-images count.

**Curation workflow:**

1. New stories default to `needs_curation` status.
2. Admin reviews the story image and content.
3. Admin marks as `approved` via the image editor dialog.
4. Approved stories lose the amber badge.

### Image Management

Clicking a story card opens the **Image Editor Dialog**, which provides:

**Two input methods:**

| Tab | How it works |
|-----|-------------|
| URL | Paste an image URL directly. Preview updates as you type. |
| Upload | Click or drag-and-drop a file. Accepts JPEG, PNG, WebP, GIF up to 5 MB. |

Uploaded files are stored in the `story-images` Supabase Storage bucket with a unique filename (`{storyId}-{timestamp}.{ext}`). URL-based images reference the external URL directly.

**Image attribution** — An optional "Image Source" text field. This attribution appears below the image on the public site.

**Fullscreen preview** — A button opens the image in a fullscreen overlay with the story title at the bottom.

**Curation status toggle** — The dialog shows the current status badge and a button to switch between "Mark as approved" and "Mark as pending".

**Placeholder image system** — Stories without real images are assigned consistent placeholder images from a curated pool of Unsplash photos (8 per category). The assignment is deterministic based on the story slug, so the same story always gets the same placeholder. A blue "Placeholder" badge in the admin grid flags these stories as needing real images.

### Feature Flags

The Feature Toggles tab shows all 10 feature flags with toggle switches.

Each flag shows its label, optional description, and current enabled/disabled state. Clicking a toggle sends an API request to update the flag in the database. A note reminds admins that "Changes take effect within 1 minute" (due to client-side caching).

See [Feature Flags Reference](#feature-flags-reference) below for the full list.

### Analytics Dashboard

The Analytics tab organizes metrics into three sub-tabs, each focused on a specific data source. Switch between sub-tabs using the pill buttons or keyboard shortcuts (`v`, `r`, `e`).

| Sub-tab | Shortcut | Data Source | Default Date Range |
|---------|----------|-------------|-------------------|
| Visitors | `v` | PostHog | Last 7 days |
| Revenue | `r` | Lemon Squeezy | Last 30 days |
| Voice | `e` | ElevenLabs | Last 30 days |

Each sub-tab loads data lazily—API calls are only made when a tab becomes active.

#### Visitors Analytics

Visitor metrics powered by PostHog (EU Cloud).

**Summary cards:**

| Metric | Description |
|--------|-------------|
| Pageviews | All pageview events in the date range |
| Visitors | Count of distinct visitor identifiers |
| Sessions | Number of browsing sessions |
| Bounce Rate | Percentage of single-page visits |

**Breakdown sections:**

| Section | Description |
|---------|-------------|
| Traffic Over Time | Line chart showing pageviews and visitors by day |
| Top Pages | Most visited URLs with pageview counts |
| Top Referrers | Traffic sources showing where visitors come from |
| UTM Campaigns | Campaign tracking breakdown (source, medium, campaign) |
| Countries & Cities | Geographic distribution of visitors |
| Devices & Browsers | Device type and browser breakdown |
| Operating Systems | OS distribution |
| Screen Sizes | Viewport dimensions |
| Entry & Exit Pages | Where visitors start and end sessions |
| New vs Returning | Ratio of new to returning visitors |

**PostHog integration** — Analytics are collected via PostHog in cookieless mode (no cookies, memory-only persistence) with a reverse proxy through `/a/` to avoid ad blockers. The admin dashboard queries PostHog's HogQL API to fetch aggregated metrics.

#### Revenue Analytics

Revenue metrics from Lemon Squeezy, the payment processor for pay-per-use voice chat credits.

**Summary cards:**

| Metric | Description |
|--------|-------------|
| Total Revenue | All-time revenue from the store |
| 30-Day Revenue | Revenue in the last 30 days |
| Total Orders | All-time order count |
| Avg Order Value | Average revenue per order |

**Revenue chart** — Bar chart showing daily revenue over the selected date range.

**Breakdown sections:**

| Section | Description |
|---------|-------------|
| Revenue by Product | Product breakdown with order count and revenue |
| Recent Orders | Last 20 orders with status badges (Paid, Pending, Refunded) |

**Configuration** — Requires `LEMONSQUEEZY_API_KEY` and optionally `LEMONSQUEEZY_STORE_ID` environment variables. If not configured, shows a warning with a link to the Lemon Squeezy API settings.

**External link** — A button at the bottom opens the full Lemon Squeezy dashboard for detailed reports.

#### Voice Analytics

Voice agent metrics from ElevenLabs Conversational AI.

**Active calls indicator** — Shows real-time count of ongoing voice conversations (green pulse when calls are active).

**Summary cards:**

| Metric | Description |
|--------|-------------|
| Total Conversations | All voice conversations in the date range |
| Completed | Successfully finished conversations |
| Failed | Conversations that ended in error |
| Minutes Used | Total voice minutes consumed |
| Avg Duration | Average conversation length in seconds |
| Avg Rating | Average user rating (if collected) |

**Breakdown sections:**

| Section | Description |
|---------|-------------|
| By Agent | Conversation count and minutes by voice agent (Pelayo, etc.) |
| By Language | Detected language distribution |
| By Status | Conversation outcome breakdown |
| Recent Conversations | Last 10 conversations with timestamp, status, and duration |

**Configuration** — Requires `ELEVENLABS_API_KEY` environment variable. Only shows data for agents with names starting with "Paisaxe".

---

## SEO & Social

**Dynamic sitemap** (`/sitemap.xml`) — Automatically generated with all static pages and dynamic story URLs. Priorities: homepage (1.0), immersive (0.9), stories (0.8), favorites (0.5).

**Robots.txt** — Allows crawling of all public pages. Blocks `/api/`, `/admin/`, and `/auth/`.

**JSON-LD structured data** — Implements `WebSite` and `TouristDestination` schema.org types for rich search results. Includes geo-coordinates for Asturias and a search action targeting the immersive page.

**Open Graph images** — Dynamically generated on the edge (no external image fetches):

| Route | Content |
|-------|---------|
| `/opengraph-image` (root) | Dark gradient with "Paisaxe" title and "Mira. Pregunta. Descubre." tagline |
| `/story/[slug]/opengraph-image` | Dark gradient with category badge, story title, subtitle, and Paisaxe branding |

Both produce 1200x630 PNG images. The root image cascades to child routes that don't define their own. Story pages use their own dynamic image.

**OpenGraph metadata** — Story pages (`/story/[slug]`) generate `og:title`, `og:description`, `og:type` (article), and `og:site_name` metadata. Twitter cards use `summary_large_image`.

---

## Infrastructure

**Health check** (`GET /api/health`) — Returns service status (healthy/degraded), uptime, app version, Supabase connectivity with latency, and database storage usage. Reports "degraded" if Supabase connection fails or database usage exceeds 80% of the 8 GB Pro tier limit. Always returns HTTP 200 to work with uptime monitors. Monitored every 5 minutes by [Upptime](https://juan294.github.io/paisaxe-upptime/).

**Database size monitoring** — The health endpoint reports `database.size_mb`, `database.limit_mb` (8192), and `database.usage_percent`. Useful for tracking storage growth as content expands.

**Rate limiting** — In-memory rate limiting protects the analytics API (60 requests per 60 seconds per IP) and the chat API. Returns 429 with a `Retry-After` header when exceeded.

**Speed Insights** — Vercel Speed Insights (RUM) tracks Core Web Vitals in production.

**Accessibility** — Skip link for keyboard navigation, `lang` attribute synced with the selected language for screen readers, ARIA labels on all interactive elements, Escape key closes modals and dropdowns.

**Error boundaries** — Dedicated error pages for the admin panel and main app with retry buttons. Loading skeletons for all pages.

**Code splitting** — The voice chat component is dynamically imported, reducing the initial bundle by ~15 KB.

### Supabase Pro Tier

Paisaxe runs on Supabase Pro ($25/month) with generous resource limits:

**Included resources**:
- 8 GB database storage
- 100K monthly active users (MAUs)
- 100 GB file storage
- 200 concurrent Realtime connections
- 2M Realtime messages/month
- 500K Edge Function invocations/month

**Keep-alive system** — Although the Pro tier doesn't auto-pause, redundant keep-alive mechanisms are retained as a safeguard:
1. A pg_cron job runs `SELECT 1` every 3 days (migration 012)
2. A Supabase Edge Function is called every 3 days via pg_cron + pg_net (migration 014)

Additionally, Upptime pings the health endpoint every 5 minutes, which queries the database.

**Database webhooks** — Using the `pg_net` extension, database triggers automatically call the Next.js API (`POST /api/webhooks/supabase`) when data changes. This enables:
- Cache invalidation when stories are updated (revalidates `/immersive` and `/sitemap.xml`)
- Cache invalidation when feature flags are toggled (revalidates `/api/feature-flags`)

Webhook payloads include the table name, operation type, and changed record. Authentication uses a shared secret in the `x-webhook-secret` header.

**Realtime subscriptions** — Supabase Realtime (free: 200 concurrent connections, 2M messages/month) provides live updates:
- Feature flags: When an admin toggles a flag, all active browser sessions pick up the change instantly via `useRealtimeFeatureFlags` hook
- Story updates: When an admin changes a story's curation status or image, `useRealtimeStories` hook notifies the UI

**Edge Functions** — Deno-based Edge Functions (500K invocations/month included):
- `keep-alive`: Queries active stories to generate database activity

Scheduled via pg_cron + pg_net and deployed with `supabase functions deploy keep-alive`.

**Automated database maintenance** — pg_cron runs weekly VACUUM ANALYZE on high-churn tables (chunks), daily ANALYZE on all main tables, and monthly cron history cleanup.

**Security hardening** (migration 015) — All database functions have explicit `SET search_path` to prevent search path injection attacks. Security-critical functions (`is_story_favorited`, `get_database_size`, `notify_webhook`) use `search_path = ''` with fully qualified table references. The pgvector extension has been moved from the `public` schema to the `extensions` schema per Supabase best practices.

| Supabase Feature | Status | Usage |
|-----------------|--------|-------|
| PostgreSQL + pgvector | Active | Vector search, 5 tables |
| Row Level Security | Active | All tables, user-scoped favorites |
| Auth (Google OAuth) | Active | Visitor accounts, favorites sync |
| Storage | Active | Admin story images |
| pg_cron | Active | 5 scheduled jobs (maintenance + keep-alive) |
| pg_net + Webhooks | Active | Cache invalidation triggers |
| Realtime | Active | Feature flag sync |
| Edge Functions | Active | Keep-alive |
| Full-text search (GIN) | Active | Spanish keyword search fallback |

---

## Feature Flags Reference

All flags are managed from the admin panel and take effect within approximately 1 minute of toggling.

### Experience Flags

| Flag | Controls |
|------|----------|
| `ambient_discovery` | Ambient mode (slow auto-play with cinematic transitions) |
| `autoplay_button` | Play/pause button for auto-play in story viewer |
| `mood_discovery` | Mood overlay on first visit |
| `randomized_order` | Session-based story shuffle |
| `seasonal_surfacing` | Boost stories matching the current month |
| `surprise_me` | Surprise Me button visibility |
| `story_sharing` | Share button visibility |
| `story_freshness` | "NEW" badge on stories less than 14 days old |
| `related_stories` | Related stories carousel |
| `contextual_prompts` | Suggested question prompts below story description |
| `asturianu_touches` | Asturian language labels and titles |

### Social Flags

| Flag | Controls |
|------|----------|
| `user_story_suggestions` | "Suggest a Place" button for visitor submissions |

### Voice Flags

| Flag | Controls |
|------|----------|
| `visitor_voice_agent` | Voice agent access (whitelisted emails only) |

### System Flags

| Flag | Controls |
|------|----------|
| `maintenance_mode` | Shows maintenance page instead of the main app |
| `automated_agents` | Master toggle for all automated CI/CD agents |
| `coverage_agent_enabled` | Coverage agent (runs daily at 2:00 AM) |
| `security_agent_enabled` | Security agent (runs weekly on Monday) |
| `docs_freshness_agent_enabled` | Docs freshness agent (runs weekly on Sunday) |
| `performance_agent_enabled` | Performance agent (runs weekly on Saturday) |
| `qa_agent_enabled` | QA agent for LLM response quality testing |
