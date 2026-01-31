# Paisaxe Visitor Experience Improvement Ideas

## Charter Alignment Criteria

Every idea was evaluated against the 4 core values:
- **Discovery** over Commerce
- **Simplicity** over Features
- **Respect** over Extraction
- **Personal** over Corporate

---

## Final Top 10 (Ranked by Value to Visitor)

### Priority Score = Value / Complexity (higher = do first)

| Rank | Idea | Complexity | Value | Priority |
|------|------|:----------:|:-----:|:--------:|
| 1 | Contextual Question Prompts | 2 | 5 | **2.50** |
| 2 | Unhide Related Stories | 1 | 4 | **4.00** |
| 3 | Randomized Story Order | 1 | 4 | **4.00** |
| 4 | "Surprise Me" Button | 1 | 4 | **4.00** |
| 5 | Story Sharing | 2 | 4 | **2.00** |
| 6 | Seasonal Story Surfacing | 2 | 4 | **2.00** |
| 7 | Mood-Based Discovery | 2 | 4 | **2.00** |
| 8 | Asturianu Language Touches | 2 | 3 | **1.50** |
| 9 | Ambient Discovery Mode | 3 | 4 | **1.33** |
| 10 | Story Freshness Badges | 1 | 2 | **2.00** |

---

## Detailed Descriptions

### 1. Contextual Question Prompts
Show 2-3 story-specific suggested questions near the chat button ("What's the best time to visit?", "What should I eat nearby?", "Tell me a local legend about this place"). Dramatically lowers the barrier to using the AI chat -- the "Ask" in "Look. Ask. Discover."

- **Values**: Discovery (pulls users deeper), Simplicity (no new feature, better activation of existing one), Respect (suggestions not demands), Personal (guide offering to tell you more)
- **Complexity**: 2/5 -- Add prompt arrays per story (in `metadata` JSON), render chip buttons in story viewer, wire to open chat with pre-filled text
- **Caveat**: Prompts must be story-specific, not generic. "What's the best time to visit Lagos de Covadonga?" not "Learn more"

### 2. Unhide Related Stories
Surface the already-built but hidden related stories feature. When viewing a story, show 2-3 related story thumbnails. The component, scoring logic, and data all exist in `related-stories.ts`.

- **Values**: Discovery (chains exploration), Simplicity (already built -- anti-bloat), Respect (no data needed), Personal ("since you liked this...")
- **Complexity**: 1/5 -- Wire existing `getRelatedStories()` into `StoryViewer`. Layout adjustment only.
- **Caveat**: Show only when info panel is visible. Must not clutter the immersive view.

### 3. Randomized Story Order
Shuffle story order on each site load so returning visitors encounter a different sequence. Every session feels fresh.

- **Values**: Discovery (every visit is unique), Simplicity (no UI change), Respect (no data needed), Personal (your session, your order)
- **Complexity**: 1/5 -- Fisher-Yates shuffle in `useStories` after fetch. Optionally seeded per session.
- **Caveat**: Preserve filter behavior. Consider keeping first story partially curated for strong first impression.

### 4. "Surprise Me" Button
A single button that jumps to a random story not yet viewed in the session. Pure serendipity.

- **Values**: Discovery (purest form), Simplicity (one button), Respect (no tracking), Personal (playful, inviting)
- **Complexity**: 1/5 -- Track viewed indices in session state, pick random unviewed index.
- **Caveat**: Place subtly. When all stories viewed, graceful message.

### 5. Story Sharing
One-tap share via Web Share API with a beautiful preview card showing the story's image, title, and description.

- **Values**: Discovery (spreads to others), Simplicity (native OS share sheet), Respect (user-initiated), Personal (sharing is deeply personal)
- **Complexity**: 2/5 -- Share button + Web Share API + proper OG meta tags. Requires `/story/[slug]` routes for shareable URLs.
- **Caveat**: Share card represents the story, not the platform. No marketing CTAs.

### 6. Seasonal Story Surfacing
Detect current month/season and weight story order toward seasonally relevant content. Beach stories in summer, food/indoor in winter, festivals during festival dates.

- **Values**: Discovery (timely), Simplicity (invisible to user), Respect (only uses system clock), Personal (like a local saying "right now, see this")
- **Complexity**: 2/5 -- Add `best_months` field to story metadata, seasonal weighting function. Combines with randomization.
- **Caveat**: Requires editorial tagging. With 20 stories, some seasons may be thin -- use soft weighting, not hard filters.

### 7. Mood-Based Discovery
Optional entry: "What kind of day are you dreaming of?" with 4 options (Relaxing / Adventurous / Cultural / Delicious). Reorders stories by emotional preference.

- **Values**: Discovery (feeling-first), Simplicity (4 buttons, optional), Respect (no data stored), Personal (starts from YOUR mood)
- **Complexity**: 2/5 -- Map moods to category combos, dismissible overlay, reorder stories.
- **Caveat**: Must be optional, not a gate. Gentle floating element, not a modal.

### 8. Asturianu Language Touches
Sprinkle authentic Asturian words with warm explanations. In subtitles, chat responses, UI labels. "In Asturias, we say 'prestoso' for something beautiful."

- **Values**: Discovery (cultural depth), Simplicity (text changes only), Respect (sharing culture), Personal (deeply local, intimate)
- **Complexity**: 2/5 -- Update story metadata, Claude system prompt, select UI labels.
- **Caveat**: Requires genuine linguistic accuracy. Start small -- chat system prompt first.

### 9. Ambient Discovery Mode
Enhanced auto-play with slower transitions and optional subtle ambient audio (waves, birdsong, rain). Meditative, screen-saver-like exploration.

- **Values**: Discovery (passive immersion), Simplicity (builds on existing auto-play), Respect (opt-in), Personal (atmospheric, emotional)
- **Complexity**: 3/5 -- Audio sourcing/licensing, playback with crossfades, extended auto-play timing.
- **Caveat**: Audio must be opt-in. Start with slower transitions only -- audio can come later.

### 10. Story Freshness Badges
Subtle "Nuevo" badge on stories added in the last 14 days. Returning visitors spot fresh content at a glance.

- **Values**: Discovery (highlights new), Simplicity (tiny badge), Respect (timestamp only), Personal (rewards returning visitors)
- **Complexity**: 1/5 -- Compare `created_at` against current date, render small badge.
- **Caveat**: Must be very subtle. Auto-expires. Must not make older stories feel stale.

---

## Recommended Implementation Waves

### Wave 1 -- Quick Wins (priority score >= 4.0)
- Randomized story order
- Unhide related stories
- "Surprise me" button
- Story freshness badges

### Wave 2 -- High-Impact Features (priority score >= 2.0)
- Contextual question prompts
- Story sharing
- Seasonal story surfacing
- Mood-based discovery

### Wave 3 -- Experience Elevation
- Asturianu language touches
- Ambient discovery mode

---

## Bookmark-Based Popularity Signal (Founder's Idea #2)

This idea is **endorsed as an internal backend system only**. Track save counts per story (already exists in `user_favorites` table). Use it to subtly influence random ordering weight. **Never expose counts or rankings to visitors** -- the moment you show popularity metrics, the platform feels corporate and commercial, violating the charter.

---

## 20 Rejected Ideas (with reasons)

| Idea | Rejection Reason |
|------|-----------------|
| Time-of-day greeting | Low impact, gimmick risk; mood discovery serves this better |
| Story of the day | Catalog too small (20 stories); rotation exhausts in 3 weeks |
| Local weather context | Over-engineered, adds API dependency, fails Simplicity test |
| "Near this" mini-map | Maps break the immersive spell; shifts toward travel tool |
| Personal discovery notes | Scope creep toward trip planning, away from inspiration |
| Curated story trails | Premature -- need 50+ stories for meaningful trails |
| First-time welcome sequence | Current immersive opening IS the welcome; extra layer dilutes it |
| Return visitor recognition | Low impact until catalog grows faster |
| Exploration breadcrumbs | High gamification risk with 20 stories |
| Voice narration | High production effort; visual-first by design |
| Offline favorites | Technically complex; better as v2 |
| "I'm here now" location | Narrow audience; location permission conflicts with Respect |
| Progressive story depth | Already partially implemented; contextual prompts solve the gap |
| Visitor tips / community wisdom | Contradicts curated editorial voice; moderation burden |
| Weekend planner | Off-charter -- makes Paisaxe a planning tool |
| Visitor photo gallery | UGC undermines curated visual quality |
| Gentle notifications | Notifications are extractive by nature |
| Golden hour indicators | Utility feature, not inspiration feature |
| Story freshness (duplicate) | Kept in top 10 |
| Emotional reactions | Adds cognitive friction where bookmark simplicity exists |

---

## Key Files for Implementation

- `src/components/immersive/story-viewer.tsx` -- Core viewer (prompts, surprise button, share, badges, ambient)
- `src/hooks/use-stories.ts` -- Story fetching (randomization, seasonal weighting)
- `src/lib/related-stories.ts` -- Already-built related stories to unhide
- `src/types/immersive.ts` -- Story types (metadata extensions for prompts, seasons, moods)
- `src/lib/claude.ts` -- System prompt (Asturianu touches, contextual awareness)
- `src/hooks/use-favorites.ts` -- Favorites data (popularity signal source)
