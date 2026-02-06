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
  - [Agents Dashboard](#agents-dashboard)
    - [Agent Toggles](#agent-toggles)
    - [Agent Status Grid](#agent-status-grid)
    - [Cross-Agent Insights](#cross-agent-insights)
    - [Recent Activity Timeline](#recent-activity-timeline)
- [Automated Agents](#automated-agents)
  - [Scheduled Agents](#scheduled-agents)
  - [Shared Context System](#shared-context-system)
  - [Agent Team Skills](#agent-team-skills)
  - [Agent Team Rules](#agent-team-rules)
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

> **⚠️ Known limitation (roadmap):** When a paying customer clicks a question prompt chip, the chat modal opens in voice mode by default (Pelayo). However, the selected question is not currently passed to the ElevenLabs voice agent—so Pelayo doesn't know what the user wanted to ask. Two potential solutions:
> 1. Open text chat mode instead of voice mode when a prompt chip is clicked
> 2. Pass the question text to Pelayo via the ElevenLabs conversation context so he can answer it directly
>
> Until this is resolved, the `contextual_prompts` feature flag should remain disabled for production.

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

The admin panel is accessible at `/admin`. Analytics is the default landing page. It has six main tabs:

| Tab | Shortcut | Purpose |
|-----|----------|---------|
| Analytics | `Cmd+1` | View visitor, revenue, and voice metrics |
| Stories | `Cmd+2` | Manage story content and images |
| Features | `Cmd+3` | Control feature flags by category |
| Marketing | `Cmd+4` | Social media automation |
| Suggestions | `Cmd+5` | Review visitor-submitted place suggestions |
| Agents | `Cmd+6` | Monitor automated agents and toggle agent flags |

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

The Features tab organizes 17 feature flags into five categories, each with a search input and category tab bar.

| Category | Description | Flag count |
|----------|-------------|------------|
| Discovery | Help visitors find and explore stories | 7 |
| Experience | Enhance the viewing experience | 4 |
| Social | Community and sharing features | 2 |
| Voice | Voice assistant features | 3 |
| System | System settings and maintenance | 1 |

Each flag shows its label, description, current on/off status, and a toggle switch. A global search filters flags by label or description across the active category. A header displays the overall enabled/total count (e.g., "12/18 Active" — the tunnel counts as one extra in System).

Some flags have expandable configuration panels (gear icon): `visitor_voice_agent` opens voice agent settings, and `maintenance_mode` opens maintenance message settings.

Agent-related flags (master toggle + 7 individual agents) are managed separately in the [Agents Dashboard](#agents-dashboard).

See [Feature Flags Reference](#feature-flags-reference) below for the full list.

### Analytics Dashboard

The Analytics tab organizes metrics into four sub-tabs, each focused on a specific data source. Switch between sub-tabs using the pill buttons or keyboard shortcuts.

| Sub-tab | Shortcut | Data Source | Default Date Range |
|---------|----------|-------------|-------------------|
| Visitors | `v` | PostHog | Last 7 days |
| Revenue | `r` | Stripe | Last 30 days |
| Voice | `e` | ElevenLabs | Last 30 days |
| Costs | `c` | Anthropic, Twilio, ElevenLabs, manual | Current month |

**Caching architecture** — All four panels are mounted simultaneously (CSS `display:none` for inactive tabs) so they fetch data in parallel on first load. An in-memory stale-while-revalidate cache (`AnalyticsCacheProvider`) ensures tab switches are instant. Data becomes stale after 2 minutes, triggering a background refresh that shows a subtle blue indicator bar. API routes also set `Cache-Control: private, max-age=120, stale-while-revalidate=300` for browser-level caching.

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

Revenue metrics from Stripe, the payment processor for Voice Pass purchases.

**Summary cards:**

| Metric | Description |
|--------|-------------|
| Total Revenue | All-time revenue from successful payments |
| 30-Day Revenue | Revenue in the last 30 days |
| Total Orders | All-time successful order count |
| Avg Order Value | Average revenue per order |

**Revenue chart** — Bar chart showing daily revenue over the selected date range.

**Breakdown sections:**

| Section | Description |
|---------|-------------|
| Revenue by Product | Product breakdown with order count and revenue |
| Recent Orders | Last 20 orders with status badges (Succeeded, Pending, Failed) |

**Configuration** — Requires `STRIPE_SECRET_KEY` environment variable. If not configured, shows a warning with a link to the Stripe Dashboard.

**External link** — A button at the bottom opens the full Stripe Dashboard for detailed reports.

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

### Agents Dashboard

The Agents tab provides a unified view of all 7 automated CI/CD agents. Data is fetched from `GET /api/admin/agents-summary`, which reads agent report files from `docs/agents/` and the shared context file. Uses the same `AnalyticsCacheProvider` caching as the Analytics tabs.

The dashboard has five sections:

#### Overall Health Banner

A color-coded banner showing system-wide health status:

| Color | Meaning |
|-------|---------|
| Green | All agents reporting healthy |
| Yellow | Some agents have warnings or unknown status |
| Red | At least one agent has critical issues |

Displays the count of healthy agents (e.g., "5/7 agents healthy").

#### Agent Toggles

Eight toggle switches for controlling automated agents:

| Flag | Controls |
|------|----------|
| `automated_agents` | Master toggle — disables all agents when off |
| `coverage_agent_enabled` | Coverage agent (daily at 2:00 AM) |
| `security_agent_enabled` | Security agent (weekly Monday 9:00 AM) |
| `documentation_agent_enabled` | Documentation agent (weekly Sunday 6:00 AM) |
| `performance_agent_enabled` | Performance agent (weekly Saturday 10:00 AM) |
| `qa_agent_enabled` | QA agent (weekly Sunday 8:00 AM) |
| `localization_agent_enabled` | Localization agent (weekly Sunday 7:00 AM) |
| `cost_analyst_agent_enabled` | Cost Analyst agent (daily at 3:00 AM) |

Individual agent toggles have an expandable configuration panel (gear icon) for adjusting agent-specific settings like schedule and prompt parameters.

#### Agent Status Grid

A responsive card grid (2-4 columns) showing each agent's current state:

- **Agent name** and schedule description
- **Health indicator** — colored dot (green/yellow/red/gray)
- **Health summary** — one-line description parsed from the agent's last report
- **Last run** — relative time (e.g., "2h ago", "3d ago")

Health status is parsed from each agent's report file using multiple format patterns (e.g., "Health Status: GREEN", "Status: HEALTHY").

#### Cross-Agent Insights

Displays parsed entries from `docs/agents/shared-context.md` — findings that agents have flagged for cross-team awareness. Each entry shows the agent name, timestamp, and the markdown content of their shared insight.

#### Recent Activity Timeline

A chronological timeline of agent runs with health-colored dots, agent names, timestamps, and key findings. Sorted by most recent first.

---

## Automated Agents

Paisaxe runs 7 automated quality agents on launchd schedules. Each agent uses the Claude CLI (`claude -p`) in non-interactive mode to analyze the codebase and produce a markdown report in `docs/agents/`.

### Scheduled Agents

| Agent | Schedule | Report File | Focus |
|-------|----------|-------------|-------|
| Coverage | Daily 2:00 AM | `coverage-report.md` | Test coverage gaps |
| Security | Weekly Mon 9:00 AM | `security-report.md` | Vulnerabilities, secrets, OWASP |
| Documentation | Weekly Sun 6:00 AM | `documentation-report.md` | Doc freshness and accuracy |
| Performance | Weekly Sat 10:00 AM | `performance-report.md` | Bundle size, Lighthouse, bottlenecks |
| QA | Weekly Sun 8:00 AM | `qa-report.md` | LLM response quality, test gaps |
| Localization | Weekly Sun 7:00 AM | `localization-report.md` | Translation coverage |
| Cost Analyst | Daily 3:00 AM | `cost-analyst-report.md` | API spend tracking |

Each agent checks its feature flag before running. If the flag is disabled (or the master `automated_agents` flag is off), the agent exits immediately.

### Shared Context System

Agents share findings with each other through `docs/agents/shared-context.md`. This enables cross-pollination — for example, the Security agent finds a vulnerable dependency, the Cost agent factors in upgrade costs, and the QA agent adds tests for the affected area.

**How it works:**

1. Before running, each agent reads `shared-context.md` and injects other agents' recent findings into its Claude prompt
2. After running, the agent extracts cross-agent recommendations from its report and appends them to `shared-context.md`
3. A pruning function keeps only the last 3 entries per agent to prevent the file from growing unbounded

**Entry format:**
```
<!-- ENTRY:START agent=security_agent_enabled timestamp=2026-02-06T09:00:00Z -->
## Security Agent — 2026-02-06
- Key findings and cross-agent recommendations
<!-- ENTRY:END -->
```

Shell functions in `scripts/lib/agent-utils.sh`: `read_shared_context`, `write_shared_context`, `prune_shared_context`.

### Agent Team Skills

Four slash commands that create multi-agent teams for specific workflows. These use Claude Code's Agent Teams feature (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).

| Skill | Command | Team Size | Purpose |
|-------|---------|-----------|---------|
| Pre-Launch Audit | `/pre-launch` | 6 specialists | Full system review before production deploy |
| PR Review | `/review-pr [number]` | 3-4 reviewers | Multi-perspective code review |
| Dependency Upgrade | `/upgrade-deps [package]` | 3 specialists | Coordinated dependency upgrades |
| Incident Response | `/incident [description]` | 3 specialists | Production incident diagnosis |

**`/pre-launch`** — Creates architect, qa-lead, security-reviewer, performance-eng, ux-reviewer, and devops teammates. Each investigates their area in parallel. Produces `docs/agents/pre-launch-report.md` with a verdict (READY / CONDITIONAL / NOT READY).

**`/review-pr`** — Creates security-reviewer, qa-reviewer, arch-reviewer, and optionally perf-reviewer (for large PRs). Accepts a PR number or auto-detects from the current branch.

**`/upgrade-deps`** — Creates compatibility-analyst, implementer, and test-runner in sequence. Accepts a package name or runs `npm outdated` to propose candidates. Produces `docs/agents/upgrade-report.md`.

**`/incident`** — Creates health-checker, log-analyst, and rollback-assessor. Accepts an optional incident description. Outputs diagnosis, probable cause, and rollback commands.

### Agent Team Rules

Three patterns defined in `CLAUDE.md` that trigger agent teams automatically or on command:

| Rule | Trigger | Team |
|------|---------|------|
| Debug Mode | "enter debug mode" or "debug this" | 3-5 parallel investigators with competing hypotheses |
| Large Refactoring | Auto-detected when refactoring touches 5+ files | architect + dependency-analyst (parallel), then implementer, then test-updater |
| Code Quality Audit | "run a code quality audit" | dead-code-hunter + pattern-enforcer + complexity-analyst (parallel) |

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

All flags are managed from the admin panel and take effect within approximately 1 minute of toggling. Feature flags are split across two tabs: the Features tab (17 flags in 5 categories) and the Agents tab (8 agent flags).

### Discovery Flags (Features tab)

| Flag | Controls |
|------|----------|
| `contextual_prompts` | Suggested question prompts below story description |
| `related_stories` | Related stories carousel |
| `randomized_order` | Session-based story shuffle |
| `surprise_me` | Surprise Me button visibility |
| `seasonal_surfacing` | Boost stories matching the current month |
| `mood_discovery` | Mood overlay on first visit |
| `story_freshness` | "NEW" badge on stories less than 14 days old |

### Experience Flags (Features tab)

| Flag | Controls |
|------|----------|
| `ambient_discovery` | Ambient mode (slow auto-play with cinematic transitions) |
| `autoplay_button` | Play/pause button for auto-play in story viewer |
| `asturianu_touches` | Asturian language labels and titles |
| `fullscreen_button` | Fullscreen button in toolbar (native fullscreen on desktop, Add to Home Screen on iOS/iPad) |

### Social Flags (Features tab)

| Flag | Controls |
|------|----------|
| `story_sharing` | Share button visibility |
| `user_story_suggestions` | "Suggest a Place" button for visitor submissions |

### Voice Flags (Features tab)

| Flag | Controls |
|------|----------|
| `visitor_voice_agent` | Voice agent access (whitelisted emails only) |
| `booking_system` | Master toggle for Pelayo's outbound booking calls to restaurants/hotels |
| `sms_booking_confirmation` | SMS confirmation to customers via Twilio after booking calls complete |

### System Flags (Features tab)

| Flag | Controls |
|------|----------|
| `maintenance_mode` | Shows maintenance page instead of the main app |

### Agent Flags (Agents tab)

| Flag | Controls |
|------|----------|
| `automated_agents` | Master toggle for all automated CI/CD agents |
| `coverage_agent_enabled` | Coverage agent (daily at 2:00 AM) |
| `security_agent_enabled` | Security agent (weekly Monday 9:00 AM) |
| `documentation_agent_enabled` | Documentation agent (weekly Sunday 6:00 AM) |
| `performance_agent_enabled` | Performance agent (weekly Saturday 10:00 AM) |
| `qa_agent_enabled` | QA agent (weekly Sunday 8:00 AM) |
| `localization_agent_enabled` | Localization agent (weekly Sunday 7:00 AM) |
| `cost_analyst_agent_enabled` | Cost Analyst agent (daily at 3:00 AM) |
