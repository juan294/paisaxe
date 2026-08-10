# Paisaxe SEO, Search Operations, and Analytics Research

**Date:** 2026-07-28
**Repository baseline:** `origin/develop` at `858b9d4aa9a132a97a03ebae17879c5c5f282b4c`
**Reference blueprint:** `/Users/juan/code/spoken-letter/docs/plans/2026-07-27-seo-starter-guide-action-plan.md`

## Scope

This document records the current Paisaxe implementation relevant to applying the
Spoken Letter SEO blueprint. It covers public URL behavior, metadata, structured
data, content delivery, analytics, privacy, external search services, deployment,
and existing verification. It describes the repository and observed service state
as they exist on 2026-07-28.

## Product and Audience Context

Paisaxe is an image-first, conversational tourism experience for Asturias. Its
documented visitor journey starts with visual discovery, continues through questions
about a place, and ends with saving or sharing the discovery
(`docs/project/project-charter.md:15-37`). The intended audience includes tourists
researching Spain, travelers already interested in Asturias, families, solo
travelers, couples, and visitors across age groups
(`docs/project/project-charter.md:29-37`).

The documented voice is knowledgeable, warm, human, inclusive, non-corporate, and
non-salesy (`docs/project/project-charter.md:50-63`). The design principles are
image-first, conversational, simple, and source-respecting
(`docs/project/project-charter.md:73-81`).

The central location configuration establishes Asturias as the subject, Spanish as
the primary language, `paisaxe.es` as the primary domain, and `paisaxe.com` as the
alternate domain (`src/config/location.ts:14-33`). The same configuration contains
the current SEO description, keywords, locale, cuisine, natural features, and
cultural highlights (`src/config/location.ts:74-113`).

## Public URL and Canonical Model

The application has two independent layers of canonical-host handling:

- Vercel permanently redirects `paisaxe.com`, `www.paisaxe.com`, and
  `www.paisaxe.es` to the matching path on `paisaxe.es`
  (`vercel.json:31-65`).
- The request proxy recognizes the same alternate hosts, preserves path and query
  parameters, switches to HTTPS, and returns 308
  (`src/lib/proxy/canonical-domain.ts:14-34`).

The root URL returns a 308 to `/immersive`
(`src/lib/proxy/root-redirect.ts:10-15`). `/immersive` is the primary full-screen
story experience (`docs/project/features.md:34-49`).

Share links use `/story/{slug-or-id}`
(`src/components/immersive/share-button.tsx:25-33`). The request proxy converts
those paths to 308 redirects targeting `/immersive?story={slug}`
(`src/lib/proxy/story-rewrite.ts:13-24`). The immersive client then reads the
`story` query parameter and selects the matching story after hydration
(`src/app/immersive/immersive-page-content.tsx:149-170`).

The App Router also contains a `/story/[slug]` route that generates static
parameters and per-story metadata, but its page body redirects to the same immersive
query URL (`src/app/story/[slug]/page.tsx:10-19`,
`src/app/story/[slug]/page.tsx:21-53`). Proxy processing handles `/story/:slug`
before that route body (`src/proxy.ts:13-31`).

On the production site observed on 2026-07-28, `/` returns 308 to `/immersive`;
`paisaxe.com` and `www.paisaxe.es` return 308 to `paisaxe.es`; and `/immersive`
returns 200.

## Metadata and Language Delivery

Root metadata uses a trimmed `NEXT_PUBLIC_SITE_URL` with
`https://paisaxe.es` as fallback (`src/app/layout.tsx:24-30`,
`src/lib/env.ts:99-101`). It declares title, Spanish description, keywords,
authorship, icons, manifest, Open Graph, Twitter, canonical, language alternates,
and crawler preview directives (`src/app/layout.tsx:39-115`).

The root language alternates contain `es-ES` and `x-default`, both pointing to the
root URL (`src/app/layout.tsx:97-103`). `/immersive` has its own title,
description, Open Graph, Twitter, and `/immersive` canonical
(`src/app/immersive/layout.tsx:13-49`). `/favorites` has a canonical but declares
`noindex,nofollow` (`src/app/favorites/layout.tsx:5-20`).

Story metadata uses each story's title and description and sets Open Graph type to
`article` (`src/app/story/[slug]/page.tsx:21-47`). The underlying metadata query
selects `slug`, `title`, and `description` for active, approved stories and falls
back to bundled story data (`src/lib/stories-data.ts:217-276`).

The server-rendered root HTML starts with `lang="es"`
(`src/app/layout.tsx:117-127`). Locale selection then happens client-side, using a
stored or browser locale after hydration (`src/lib/i18n/provider.tsx:55-68`,
`src/lib/i18n/detect-language.ts:80-90`). The document language is updated on
client locale changes (`src/components/a11y/lang-sync.tsx:6-13`).

The supported UI locales are Spanish, English, French, German, Portuguese, and
Asturian (`src/lib/i18n/types.ts:1-4`). They share the same URLs and use
`paisaxe-locale` in local storage (`src/lib/i18n/detect-language.ts:3-5`,
`src/lib/i18n/detect-language.ts:49-77`). A retained localization report records
411 UI leaf keys in all six locales and 565 completed story translation records
across five target translations (`docs/agents/localization-report.md:1-46`).

## Sitemap and Robots

`robots.ts` allows the public surface and blocks `/api/`, `/admin/`, and `/auth/`
for the default crawler and seven named AI/search crawlers. It publishes the
sitemap URL (`src/app/robots.ts:9-57`).

`sitemap.ts` uses a trimmed site URL and loads the current active stories
(`src/app/sitemap.ts:5-12`). It emits:

- the root URL;
- `/immersive`;
- `/favorites`;
- one `/immersive?story={slug-or-id}` entry per story
  (`src/app/sitemap.ts:14-41`).

Every generated entry receives the current time as `lastModified`. Root and
immersive are marked daily; favorites and story entries are marked weekly
(`src/app/sitemap.ts:14-40`). Story-table webhook events revalidate both
`/immersive` and `/sitemap.xml`
(`src/app/api/webhooks/supabase/route.ts:29-38`,
`src/app/api/webhooks/supabase/route.ts:87-96`).

The production sitemap observed on 2026-07-28 contained the root, `/immersive`,
`/favorites`, and the immersive query URLs. The production robots response allowed
the public surface, blocked the three private path families, and advertised the
sitemap.

## Structured Data

The JSON-LD component uses a serializer that escapes HTML-significant characters
and JavaScript line separators (`src/components/seo/json-ld.tsx:12-20`). The
repository defines:

- `WebSite` with a `SearchAction`
  (`src/components/seo/json-ld.tsx:22-58`);
- `TouristDestination` (`src/components/seo/json-ld.tsx:60-85`);
- story-level `Restaurant` and `TouristAttraction`
  (`src/components/seo/json-ld.tsx:90-162`);
- `BreadcrumbList` (`src/components/seo/json-ld.tsx:179-212`);
- `FAQPage` (`src/components/seo/json-ld.tsx:214-248`).

The currently mounted schemas are `WebSite` in the root layout and
`TouristDestination` in `/immersive`
(`src/app/layout.tsx:144-152`, `src/app/immersive/layout.tsx:51-60`).
Story, breadcrumb, and FAQ schema exports have tests but are not mounted by a
current application route.

The retained SEO record describes the crawler rules, `llms.txt`, schema exports,
manifest, and metadata changes as completed
(`docs/marketing/seo-implementation.md:5-68`). It records Rich Results, robots,
`llms.txt`, PWA, Open Graph, and Twitter verification steps
(`docs/marketing/seo-implementation.md:91-113`).

## Public Content Delivery

`/immersive` provides a partially prerendered shell with a Suspense fallback
(`src/app/immersive/page.tsx:1-16`). The data loader fetches feature flags and
stories concurrently and passes them to the client experience
(`src/app/immersive/immersive-data-loader.tsx:9-28`).

Production story loading requests active, approved stories from Supabase with a
60-second Next data-cache revalidation period and uses bundled fallback data for
missing credentials, non-production credentials, empty responses, HTTP errors,
and fetch errors (`src/lib/stories-server.ts:36-92`).

The selected story renders in a `<main>` with localized image alt text and a
localized information panel (`src/components/immersive/story-viewer.tsx:228-255`,
`src/components/immersive/story-viewer.tsx:282-299`,
`src/components/immersive/story-viewer.tsx:339-355`). The story title is rendered
as an `<h1>` (`src/components/immersive/story-info-panel.tsx:105`).

The prior marketing strategy names destination, seasonal, and transport-oriented
guides as the long-form content concepts retained for later use
(`docs/marketing/seo-implementation.md:263-275`).

## Analytics and Consent State

The root layout mounts Vercel Analytics, Speed Insights, and PostHog on the global
application surface (`src/app/layout.tsx:11-16`,
`src/app/layout.tsx:144-153`). Vercel's two clients are dynamically loaded
(`src/components/analytics.tsx:1-23`).

PostHog wraps the provider hierarchy (`src/app/providers.tsx:27-53`). It:

- initializes only when a public key is present and the host is not localhost
  (`src/components/posthog-provider.tsx:15-22`);
- defers initialization until the browser is idle
  (`src/components/posthog-provider.tsx:70-115`);
- uses `person_profiles: "never"` and memory persistence;
- disables built-in pageview, page-leave, and autocapture;
- emits pageviews manually on route changes
  (`src/components/posthog-provider.tsx:24-40`,
  `src/components/posthog-provider.tsx:92-101`).

The `/a` rewrite sends PostHog assets and ingestion to EU endpoints
(`next.config.ts:47-57`). The environment inventory contains PostHog public and
server-side query configuration (`.env.example:104-108`). The migration record
describes the move from a Supabase analytics table to PostHog EU Cloud and the
removal of the former ingestion path, cleanup function, cron jobs, and database
table (`docs/engineering/posthog-migration.md:1-14`,
`docs/engineering/posthog-migration.md:27-60`).

The current PostHog initializer does not read a consent state
(`src/components/posthog-provider.tsx:15-22`,
`src/components/posthog-provider.tsx:70-115`). The Spanish privacy text describes
usage-data collection, lists the current service providers, and states that
essential login cookies are used without advertising-tracking cookies
(`src/lib/i18n/es.ts:353-386`). The rendered provider list includes Supabase,
Google OAuth, Stripe, Anthropic, ElevenLabs, and Twilio
(`src/app/privacy/page.tsx:88-115`).

Repository-wide searches found no GA4 loader or measurement ID, Microsoft Clarity
loader or project ID, Google Search Console verification marker, Bing verification
marker, IndexNow key or submission workflow, Google Autocomplete extraction script,
or combined SEO analytics collector in the Paisaxe baseline.

## Performance and Verification

The March TTFB plan records that `/immersive`, `/about`, `/privacy`, and `/terms`
were moved to ISR/PPR-compatible delivery
(`docs/plans/2026-03-07-perf-ttfb-optimization.md:46-79`). Its verification
contract covers route classification, tests, typechecking, lint, E2E, live TTFB,
JSON-LD, CSP, cache headers, and Speed Insights
(`docs/plans/2026-03-07-perf-ttfb-optimization.md:105-135`).

Lighthouse runs against `/immersive` and collects performance, accessibility,
best-practices, and SEO results, with an SEO warning threshold of 0.8
(`lighthouserc.json:2-35`). The workflow runs for the long-lived branches
(`.github/workflows/lighthouse.yml:1-15`,
`.github/workflows/lighthouse.yml:34-61`).

Existing focused tests cover root metadata, robots, sitemap, canonical redirects,
story redirects and metadata, JSON-LD variants, and PostHog initialization
(`src/app/layout.test.tsx:33-131`,
`src/app/robots.test.ts:4-83`,
`src/app/sitemap.test.ts:14-149`,
`src/lib/proxy/canonical-domain.test.ts:12-74`,
`src/lib/proxy/story-rewrite.test.ts:9-73`,
`src/components/seo/json-ld.test.tsx:6-129`,
`src/components/posthog-provider.test.tsx:297-472`).

CI runs lint, typechecking, documented-environment checks, tests/coverage, and
builds on `develop` and `main` activity
(`.github/workflows/ci.yml:22-30`,
`.github/workflows/ci.yml:86-212`). Main-targeting pull requests also receive a
Vercel preview smoke check (`.github/workflows/preview-smoke.yml:24-42`,
`.github/workflows/preview-smoke.yml:93-132`).

## External Service Inventory

The user supplied the following setup state for Paisaxe:

- no Google Analytics account/property or web stream;
- no Google Search Console property;
- no Bing Webmaster Tools site;
- no Microsoft Clarity project.

A read-only Chrome review on 2026-07-28 confirmed that the currently logged-in
Google Analytics selector contains BecomingApps and Spoken Letter accounts but no
Paisaxe account or property; Google Search Console lists only the
`spokenletter.com` domain property; and Bing Webmaster Tools lists only
`spokenletter.com`. No external property, project, DNS record, environment
variable, or site configuration was created or changed during research.

## Spoken Letter Pattern Inventory

The reference implementation contains concrete examples for the missing layers:

- localized sitemap and canonical/hreflang generation
  (`/Users/juan/code/spoken-letter/src/app/sitemap.ts:8-37`,
  `/Users/juan/code/spoken-letter/src/app/[locale]/layout.tsx:45-125`);
- a falsifiable public-surface checker wired into CI
  (`/Users/juan/code/spoken-letter/scripts/check-public-surface.ts:1-53`,
  `/Users/juan/code/spoken-letter/.github/workflows/ci.yml:108-126`);
- a Google Autocomplete intent extractor
  (`/Users/juan/code/spoken-letter/scripts/seo/fetch-autocomplete-insights.mjs:1-120`);
- sitemap-derived IndexNow submission and a production-branch workflow
  (`/Users/juan/code/spoken-letter/scripts/submit-indexnow.ts:12-100`,
  `/Users/juan/code/spoken-letter/.github/workflows/indexnow.yml:1-56`);
- shared consent, GA4 bootstrap, consent- and route-gated Clarity, and Clarity
  identification
  (`/Users/juan/code/spoken-letter/src/components/analytics/cookie-banner.tsx:7-72`,
  `/Users/juan/code/spoken-letter/src/components/analytics/google-analytics-bootstrap.tsx:14-50`,
  `/Users/juan/code/spoken-letter/src/components/analytics/microsoft-clarity.tsx:9-94`);
- a daily collector that combines GA4, Search Console, Clarity, and Bing data
  (`/Users/juan/code/spoken-letter/scripts/seo/collect-analytics.ts:6-29`,
  `/Users/juan/code/spoken-letter/scripts/seo/collect-analytics.ts:313-380`).

## Research Summary

Paisaxe currently has canonical-host redirects, route metadata, robots, a dynamic
sitemap, two mounted global JSON-LD schemas, six-locale client content, dynamic
story data, Lighthouse SEO collection, and cookieless PostHog/Vercel analytics.
Its story share URLs resolve into one immersive query-driven experience, while the
sitemap lists those query URLs. Google Analytics, Search Console, Bing Webmaster
Tools, Microsoft Clarity, IndexNow automation, keyword-intent automation, and a
cross-service SEO ledger are not present in the repository or the Paisaxe service
inventory observed for this research.
