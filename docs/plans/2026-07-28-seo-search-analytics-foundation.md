# Paisaxe SEO, Search Operations, and Analytics Implementation Plan

**Date:** 2026-07-28
**Status:** Planned
**Research:** [2026-07-28-seo-analytics-search-foundation.md](../research/2026-07-28-seo-analytics-search-foundation.md)
**Reference blueprint:** `/Users/juan/code/spoken-letter/docs/plans/2026-07-27-seo-starter-guide-action-plan.md`

## Objective

Build a durable organic-search and measurement system for Paisaxe that:

1. gives each public story and guide a stable, indexable canonical URL;
2. aligns sitemap, robots, metadata, structured data, and public content;
3. adds keyword-intent discovery and an initial Spanish guide cluster;
4. creates and verifies Paisaxe-only GA4, Search Console, Bing Webmaster,
   and Microsoft Clarity properties;
5. adds privacy-gated GA4 and Clarity while preserving the existing cookieless
   PostHog implementation;
6. submits production changes through IndexNow and search-engine consoles; and
7. records cross-service SEO outcomes in a durable aggregate ledger.

## Scope Boundaries

- Keep `paisaxe.es` as the canonical production domain.
- Keep `/immersive` as the core interactive product experience.
- Keep PostHog and Vercel Analytics in place. GA4 and Clarity are additive.
- Do not create, edit, or delete any Spoken Letter or other-project property,
  credential, DNS record, environment variable, workflow, or report.
- Do not create locale-prefixed SEO routes in this plan. Current translated UI
  continues to share URLs; only Spanish canonical content is indexed initially.
- Do not add FAQ structured data unless the same question and answer are visibly
  rendered on the page.
- Do not put `noindex` pages, redirects, or duplicate query URLs in the sitemap.
- No production deployment, `main` PR, DNS change, Vercel environment change, or
  external-service mutation occurs without the explicit authorization required
  by `CLAUDE.md`.

## Selected Design

### Public URL architecture

- `/immersive` remains the interactive discovery application.
- `/story/[slug]` becomes a server-rendered, indexable story landing page instead
  of a proxy redirect.
- Story landing pages contain visible story information, attribution, image,
  related links, and a primary CTA to `/immersive?story=[slug]`.
- `/immersive?story=[slug]` remains an interaction state and canonicalizes to
  `/immersive`; it is not listed in the sitemap.
- `/guides` becomes the content hub.
- The first guide cluster is:
  - `/guides/asturias-sin-coche`
  - `/guides/asturias-con-ninos`
  - `/guides/asturias-en-invierno`

This preserves the product's visual/conversational identity while giving crawlers
stable HTML documents with distinct intent, headings, descriptions, links, and
structured data.

### Analytics architecture

- PostHog remains memory-only and cookieless.
- GA4 and Clarity load only after explicit analytics consent.
- Clarity uses Strict masking, a public-route allowlist, and markup-level masking.
- No email, phone number, booking detail, chat text, voice transcript, or other
  user-authored content is sent as an analytics parameter.
- GA4 and Clarity use pseudonymous/session-level context only. No Clarity friendly
  name is set.

### External property isolation

Create Paisaxe-only assets:

- GA account: `Paisaxe`
- GA4 property: `Paisaxe - Production`
- GA4 web stream: `paisaxe.es` / `https://paisaxe.es`
- Search Console Domain property: `paisaxe.es`
- Bing Webmaster site: `https://paisaxe.es`
- Clarity project: `Paisaxe` / `https://paisaxe.es`

Every CLI/browser action must resolve the selected account, property, domain, and
project immediately before mutation and verify the resulting Paisaxe identifier
afterward.

## Phase Map

| Phase | Description | Depends on | Batch |
|---|---|---|---|
| [Phase 1](./2026-07-28-seo-search-analytics-foundation-phases/phase-1.md) | Create isolated external properties and record IDs | None | |
| [Phase 2](./2026-07-28-seo-search-analytics-foundation-phases/phase-2.md) | Consent, GA4, Clarity, events, and legal disclosure | Phase 1 | |
| [Phase 3](./2026-07-28-seo-search-analytics-foundation-phases/phase-3.md) | Canonical story pages, sitemap, metadata, and JSON-LD | Phase 2 | |
| [Phase 4](./2026-07-28-seo-search-analytics-foundation-phases/phase-4.md) | Keyword discovery, guide hub, and first topic cluster | Phase 3 | |
| [Phase 5](./2026-07-28-seo-search-analytics-foundation-phases/phase-5.md) | Public-surface truthfulness gate and continuous SEO checks | Phase 4 | |
| [Phase 6](./2026-07-28-seo-search-analytics-foundation-phases/phase-6.md) | IndexNow and search-console operational activation | Phase 5 + production release | |
| [Phase 7](./2026-07-28-seo-search-analytics-foundation-phases/phase-7.md) | Analytics configuration, search links, and SEO ledger | Phase 6 | |

The phases intentionally remain sequential. Root layout, legal copy, sitemap,
package scripts, CI, and external-service identifiers overlap across phases, so no
phase qualifies as `[batch-eligible]`.

## Target Measurement Contract

### GA4 events

| Event | Trigger | Key event |
|---|---|---|
| `story_view` | Stable story becomes visible | No |
| `story_share` | Share action completes | Yes |
| `story_save` | Favorite is saved | Yes |
| `chat_started` | First text-chat interaction | Yes |
| `chat_message_sent` | Visitor sends a chat message | No |
| `voice_started` | Voice guide session starts | Yes |
| `language_changed` | Visitor changes UI language | No |
| `guide_view` | Guide page view | No |
| `guide_cta_click` | Guide-to-immersive CTA | Yes |

### GA4 dimensions

- `content_locale`
- `story_slug`
- `story_category`
- `guide_slug`
- `interaction_mode`
- `visitor_auth_state`

All parameter names are centralized in one typed analytics module and covered by a
guard test binding registered dimensions to emitted names.

### Audiences and reports

- Engaged explorers: story view plus chat, save, share, or voice interaction.
- Guide readers without interaction: guide view with no `guide_cta_click` or
  `chat_started`.
- Returning story explorers: at least two sessions with `story_view`.
- Funnel: guide view -> guide CTA -> story view -> chat/voice/save/share.
- Path exploration from `/guides/**`.
- Search Console organic landing-page report after product linking.

## Implementation Method

Each phase follows:

1. create an isolated worktree from current `develop`;
2. write failing tests first for repository changes;
3. implement the minimum change;
4. run focused tests;
5. run sequential project verification;
6. perform a reuse/quality/efficiency review;
7. fix findings and rerun verification;
8. stop for phase review;
9. merge to local `develop` only after approval;
10. push only when authorized and then monitor exact-SHA CI.

External-service and DNS operations use CLI first, then logged-in Chrome only when
the service has no sufficient CLI/API path. Each mutation phase records before/after
property identifiers and verifies that other projects are unchanged.

## Repository Verification

Run sequentially after each code phase:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Run when public URLs, metadata, or rendered content changes:

```bash
npm run test:e2e
npm run prelaunch
npm run check-public-surface
```

## Production Success Criteria

- Every sitemap URL returns 200, is indexable, declares itself canonical, and has
  a unique title and description.
- No sitemap URL redirects or points to `/favorites`, `/admin`, `/auth`, `/api`,
  checkout/success state, or `/immersive?story=...`.
- Each active story has one `/story/[slug]` canonical page with visible content,
  Story JSON-LD, breadcrumbs, and an immersive CTA.
- GA4 DebugView/Realtime shows consented events with the exact registered parameter
  names and shows no events before consent.
- Clarity records only allowlisted public pages after consent, with Strict masking
  and no sensitive text visible.
- PostHog pageviews and the existing admin analytics remain operational.
- Search Console and Bing both verify only the Paisaxe property/site and accept
  `https://paisaxe.es/sitemap.xml`.
- IndexNow accepts the production sitemap-derived payload with 200 or 202.
- The scheduled aggregate ledger completes with independent source status for GA4,
  Search Console, Bing, and Clarity.
- Production release evidence distinguishes automated-suite, direct HTTP, and
  manual browser checks.

## Deferred Follow-up

- Locale-prefixed, independently indexable translations and reciprocal hreflang.
- Additional guide clusters selected from collected query and engagement data.
- Image SEO work that depends on future visual redesign or new licensed assets.
- Any decision to consolidate or remove PostHog, GA4, Clarity, or Vercel Analytics.
