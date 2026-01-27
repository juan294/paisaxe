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

**Voice input** — A microphone button activates the Web Speech API (when the browser supports it). Speech is transcribed to text and sent automatically. The interface shows a "Listening..." state while recording. Language defaults to Spanish (es-ES).

**How it works under the hood:**

1. The user's question is sent to `POST /api/chat` along with the current story context.
2. The server generates an embedding of the question via Voyage AI.
3. A vector similarity search finds the most relevant content chunks from the PDF database.
4. The matched chunks are passed as context to the Claude API.
5. Claude generates a response, which may include references to source PDFs.
6. Related images from the database are returned alongside the response, displayed inline with captions and source attribution.

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

The admin panel is accessible at `/admin`. It has three tabs: Stories, Feature Toggles, and Analytics.

### Access & Authentication

The admin panel uses a secret key (the `ADMIN_SECRET_KEY` environment variable). There is no user account system for admins.

1. Navigate to `/admin`.
2. Enter the admin key in the login form.
3. The key is validated against the server via a test API call.
4. If valid, the admin session begins. The key is passed as a Bearer token in all subsequent API requests.
5. The session lasts until the admin clicks "Logout" or closes the browser.

All admin API routes (`/api/admin/*`) require the `Authorization: Bearer {key}` header. Invalid or missing tokens return 401/403 errors.

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

The Analytics tab provides usage metrics for a configurable date range (default: last 7 days).

**Summary cards:**

| Metric | Description |
|--------|-------------|
| Total Events | All analytics events in the date range |
| Unique Sessions | Count of distinct session IDs |

**Per-feature breakdown** — A table sorted by event count (descending) showing for each feature flag: event count, unique sessions, and a visual bar chart. This helps identify which features are being used and by how many visitors.

**Date range picker** — Two date inputs (from/to) to narrow the analytics window.

**Analytics events tracked** include: story views, filter usage, shares, chat interactions, button clicks (Surprise Me, Share, etc.), mood selections, and feature flag exposure. Events are anonymous (IP is hashed, no personal data stored without auth).

---

## SEO & Social

**Dynamic sitemap** (`/sitemap.xml`) — Automatically generated with all static pages and dynamic story URLs. Priorities: homepage (1.0), immersive (0.9), stories (0.8), favorites (0.5).

**Robots.txt** — Allows crawling of all public pages. Blocks `/api/`, `/admin/`, and `/auth/`.

**JSON-LD structured data** — Implements `WebSite` and `TouristDestination` schema.org types for rich search results. Includes geo-coordinates for Asturias and a search action targeting the immersive page.

**Open Graph images** — Dynamically generated on the edge (no external image fetches):

| Route | Content |
|-------|---------|
| `/opengraph-image` (root) | Dark gradient with "Paisaxe" title and "Mira. Pregunta. Explora." tagline |
| `/story/[slug]/opengraph-image` | Dark gradient with category badge, story title, subtitle, and Paisaxe branding |

Both produce 1200x630 PNG images. The root image cascades to child routes that don't define their own. Story pages use their own dynamic image.

**OpenGraph metadata** — Story pages (`/story/[slug]`) generate `og:title`, `og:description`, `og:type` (article), and `og:site_name` metadata. Twitter cards use `summary_large_image`.

---

## Infrastructure

**Health check** (`GET /api/health`) — Returns service status (healthy/degraded), uptime, app version, Supabase connectivity with latency, and database storage usage. Reports "degraded" if Supabase connection fails or database usage exceeds 80% of the 500 MB free-tier limit. Always returns HTTP 200 to work with uptime monitors. Monitored every 5 minutes by [Upptime](https://juan294.github.io/paisaxe-upptime/).

**Database size monitoring** — The health endpoint reports `database.size_mb`, `database.limit_mb` (500), and `database.usage_percent`. This is critical for the Supabase free tier where pgvector embeddings can grow storage quickly.

**Rate limiting** — In-memory rate limiting protects the analytics API (60 requests per 60 seconds per IP) and the chat API. Returns 429 with a `Retry-After` header when exceeded.

**Speed Insights** — Vercel Speed Insights (RUM) tracks Core Web Vitals in production.

**Accessibility** — Skip link for keyboard navigation, `lang` attribute synced with the selected language for screen readers, ARIA labels on all interactive elements, Escape key closes modals and dropdowns.

**Error boundaries** — Dedicated error pages for the admin panel and main app with retry buttons. Loading skeletons for all pages.

**Code splitting** — The voice chat component is dynamically imported, reducing the initial bundle by ~15 KB.

### Supabase Free Tier Optimization

Paisaxe runs on the Supabase free tier ($0/month) and takes advantage of every available feature:

**Keep-alive system** — The free tier auto-pauses projects after 7 days of inactivity. Two redundant keep-alive mechanisms prevent this:
1. A pg_cron job runs `SELECT 1` every 3 days (migration 012)
2. A Supabase Edge Function is called every 3 days via pg_cron + pg_net, querying active stories count (migration 014)

Additionally, Upptime pings the health endpoint every 5 minutes, which queries the database.

**Database webhooks** — Using the `pg_net` extension, database triggers automatically call the Next.js API (`POST /api/webhooks/supabase`) when data changes. This enables:
- Cache invalidation when stories are updated (revalidates `/immersive` and `/sitemap.xml`)
- Cache invalidation when feature flags are toggled (revalidates `/api/feature-flags`)

Webhook payloads include the table name, operation type, and changed record. Authentication uses a shared secret in the `x-webhook-secret` header.

**Realtime subscriptions** — Supabase Realtime (free: 200 concurrent connections, 2M messages/month) provides live updates:
- Feature flags: When an admin toggles a flag, all active browser sessions pick up the change instantly via `useRealtimeFeatureFlags` hook
- Story updates: When an admin changes a story's curation status or image, `useRealtimeStories` hook notifies the UI

**Edge Functions** — Two Deno-based Edge Functions (free: 500K invocations/month, ~25 used):
- `keep-alive`: Queries active stories to generate database activity
- `cleanup-analytics`: Deletes analytics events older than 90 days to manage storage

Both are scheduled via pg_cron + pg_net and deployed with `supabase functions deploy`.

**Automated database maintenance** — pg_cron runs weekly VACUUM ANALYZE on high-churn tables (chunks, analytics_events), daily ANALYZE on all main tables, and monthly cron history cleanup.

**Security hardening** (migration 015) — All database functions have explicit `SET search_path` to prevent search path injection attacks. Security-critical functions (`is_story_favorited`, `get_database_size`, `notify_webhook`) use `search_path = ''` with fully qualified table references. The pgvector extension has been moved from the `public` schema to the `extensions` schema per Supabase best practices. The `analytics_events` INSERT RLS policy validates that `event_name` is non-empty and under 200 characters (replacing the previous overly permissive `WITH CHECK (true)`).

| Supabase Feature | Status | Usage |
|-----------------|--------|-------|
| PostgreSQL + pgvector | Active | Vector search, 6 tables |
| Row Level Security | Active | All tables, user-scoped favorites |
| Auth (Google OAuth) | Active | Visitor accounts, favorites sync |
| Storage | Active | Admin story images |
| pg_cron | Active | 7 scheduled jobs |
| pg_net + Webhooks | Active | Cache invalidation triggers |
| Realtime | Active | Feature flags + story update sync |
| Edge Functions | Active | Keep-alive + analytics cleanup |
| Full-text search (GIN) | Active | Spanish keyword search fallback |

---

## Feature Flags Reference

All flags are managed from the admin panel and take effect within approximately 1 minute of toggling.

| Flag | Controls |
|------|----------|
| `ambient_discovery` | Ambient mode (slow auto-play with cinematic transitions) |
| `mood_discovery` | Mood overlay on first visit |
| `randomized_order` | Session-based story shuffle |
| `seasonal_surfacing` | Boost stories matching the current month |
| `surprise_me` | Surprise Me button visibility |
| `story_sharing` | Share button visibility |
| `story_freshness` | "NEW" badge on stories less than 14 days old |
| `related_stories` | Related stories carousel |
| `contextual_prompts` | Suggested question prompts below story description |
| `asturianu_touches` | Asturian language labels and titles |
