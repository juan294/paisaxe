# PostHog Analytics Migration

This document describes the migration from custom Supabase-based analytics to PostHog EU Cloud.

---

## Why PostHog?

The previous custom analytics system stored events in a `analytics_events` PostgreSQL table. While functional, it had limitations:

- **Storage pressure** — Events consumed database storage on the Supabase free tier (500 MB limit)
- **Limited insights** — Only tracked custom events, no automatic pageviews, referrers, or geo data
- **Maintenance overhead** — Required custom cleanup Edge Functions and cron jobs
- **No visualization** — Raw data required manual SQL queries for analysis

PostHog provides:

- **Zero storage impact** — All data stored in PostHog's infrastructure
- **Rich automatic data** — Pageviews, referrers, countries, devices, and more out of the box
- **EU data residency** — PostHog EU Cloud (Frankfurt) for GDPR compliance
- **Cookieless mode** — No cookies, no consent banners required
- **HogQL queries** — Powerful SQL-like queries for custom analytics
- **Free tier** — 1M events/month on the free plan

---

## What Was Removed

### Files Deleted

| File/Directory | Purpose |
|----------------|---------|
| `src/hooks/use-analytics.ts` | Client-side analytics hook |
| `src/hooks/use-analytics.test.ts` | Tests for analytics hook |
| `src/app/api/analytics/route.ts` | Analytics event ingestion API |
| `src/app/api/analytics/route.test.ts` | Tests for analytics API |
| `supabase/functions/cleanup-analytics/` | Edge Function for event cleanup |

### Database Objects Dropped (Migration 019)

```sql
-- Unscheduled cron jobs
cron.unschedule('vacuum-analyze-analytics');
cron.unschedule('edge-cleanup-analytics');

-- Dropped table (with all indexes and RLS policies)
DROP TABLE IF EXISTS public.analytics_events CASCADE;
```

### Code References Removed

The following components had `useAnalytics` imports and `trackEvent` calls removed:

- `src/components/immersive/share-button.tsx`
- `src/components/immersive/surprise-me-button.tsx`
- `src/components/immersive/mood-overlay.tsx`
- `src/components/immersive/freshness-badge.tsx`
- `src/components/immersive/question-prompts.tsx`
- `src/components/immersive/story-viewer.tsx`
- `src/app/immersive/page.tsx`

---

## What Was Added

### PostHog Client Setup

| File | Purpose |
|------|---------|
| `src/components/posthog-provider.tsx` | PostHog React provider with cookieless config |
| `src/lib/posthog-server.ts` | Server-side PostHog client singleton |

### Configuration

PostHog is initialized with:

```typescript
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/a",
  person_profiles: "never",      // No user identification
  persistence: "memory",         // No cookies or localStorage
  capture_pageview: false,       // Manual pageview tracking
  capture_pageleave: true,       // Track when users leave
  autocapture: true,             // Automatic click/form tracking
});
```

### Reverse Proxy

To avoid ad blockers, PostHog requests route through a Next.js rewrite:

```typescript
// next.config.ts
rewrites: async () => [
  { source: "/a/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
  { source: "/a/:path*", destination: "https://eu.i.posthog.com/:path*" },
],
```

### Admin Dashboard

The admin analytics dashboard (`src/components/admin/analytics-dashboard.tsx`) queries PostHog via HogQL:

| Metric | HogQL Query |
|--------|-------------|
| Total Pageviews | `SELECT count() FROM events WHERE event = '$pageview' AND timestamp BETWEEN ...` |
| Unique Visitors | `SELECT count(DISTINCT distinct_id) FROM events WHERE ...` |
| Top Pages | `SELECT properties.$current_url, count() ... GROUP BY ... LIMIT 10` |
| Top Referrers | `SELECT properties.$referrer, count() ... GROUP BY ... LIMIT 10` |
| Countries | `SELECT properties.$geoip_country_name, count() ... GROUP BY ... LIMIT 10` |
| Devices | `SELECT properties.$device_type, count() ... GROUP BY ... LIMIT 10` |

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | `phc_abc123...` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Reverse proxy path | `/a` |
| `POSTHOG_PROJECT_ID` | PostHog project ID (for API queries) | `12345` |
| `POSTHOG_PERSONAL_API_KEY` | Personal API key for HogQL queries | `phx_xyz789...` |

### Where to Configure

1. **Local development**: Add to `.env.local`
2. **Vercel**: Add to Environment Variables (production + preview)
3. **PostHog**: Create keys at https://eu.posthog.com > Project Settings

---

## PostHog Setup Checklist

1. Create account at https://eu.posthog.com (EU Cloud / Frankfurt)
2. Create a project and note the Project API Key (`phc_...`)
3. Find the Project ID in project settings
4. Create a Personal API Key with query read access (`phx_...`)
5. Enable cookieless mode: Project Settings > Web Analytics > "Cookieless server hash mode"
6. Add environment variables to `.env.local` and Vercel

---

## Verification

After deployment, verify the migration:

1. **Pageviews tracking**: Visit the site, check PostHog Live Events
2. **Reverse proxy**: Network tab should show requests to `/a/e/`, not `eu.i.posthog.com`
3. **Cookieless mode**: Application > Cookies should have no PostHog cookies
4. **Admin dashboard**: Visit `/admin` > Analytics tab, confirm data renders
5. **Database cleanup**: Run `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events');` — should return `false`

---

## Rollback (if needed)

If issues arise with PostHog:

1. Restore the deleted files from git history
2. Re-apply migration 009 to recreate `analytics_events` table
3. Re-schedule the cron jobs from migration 011 and 014
4. Restore the `cleanup-analytics` Edge Function
5. Remove PostHog provider from `providers.tsx` and `layout.tsx`
6. Remove PostHog rewrites from `next.config.ts`
