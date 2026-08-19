# Pending Setup Tasks

Tasks to complete once the domain (paisaxe.com / paisaxe.es) is fully configured and DNS has propagated.

**Status**: Domain is live. Most items completed. See checklist below.

---

## Checklist

| # | Task | Status |
|---|------|--------|
| 1 | Add WEBHOOK_SECRET to Vercel | COMPLETED (2026-01-31) |
| 2 | Configure Supabase Database Webhook Settings | COMPLETED |
| 3 | Configure Supabase Edge Function Settings | REMOVED (not needed on Pro tier) |
| 4 | Deploy Edge Functions | COMPLETED (2026-01-31) |
| 5 | Verify Database Migrations | COMPLETED |
| 6 | Update NEXT_PUBLIC_SITE_URL on Vercel | COMPLETED (2026-01-31) |
| 7 | Add ELEVENLABS_API_KEY to Vercel | COMPLETED (2026-01-31) |
| 8 | Trigger redeployment | COMPLETED (site live since 2026-01-31) |
| 9 | Verify Everything Works | COMPLETED (site live and monitored by Upptime) |

---

## 1. Add WEBHOOK_SECRET to Vercel

**COMPLETED** - Added to both Production and Preview environments on 2026-01-31.

---

## 2. Configure Supabase Database Webhook Settings

**COMPLETED** - Webhook config is set to `https://paisaxe.es` with the correct secret.

---

## 3. Configure Supabase Edge Function Settings

**REMOVED** (2026-02-03) - This configuration is not needed on the Pro tier:

1. Pro tier databases don't auto-pause (that's only a free tier limitation)
2. Upptime already pings `/api/health/live` every 5 minutes (see `.github/upptime/.upptimerc.yml`)
   for uptime purposes, and the app itself queries the database on every real request to
   `/immersive` and other story pages — regular traffic already generates activity without
   needing a dedicated keep-alive ping. (`/api/health/live` itself is liveness-only and
   intentionally runs no database check — see the Health Check Endpoints section above — so it
   was never the source of the activity this decision relied on.)
3. The `ALTER DATABASE ... SET` command requires superuser privileges not available in Supabase's SQL Editor

The `edge-keep-alive` cron job was unscheduled:
```sql
SELECT cron.unschedule('edge-keep-alive');
```

The Edge Function `keep-alive` remains deployed and can be called manually if needed.

---

## 4. Deploy Edge Functions

**COMPLETED** - Deployed on 2026-01-31.

Only `keep-alive` is deployed. The `cleanup-analytics` Edge Function was removed as part of the PostHog migration (analytics are now handled by PostHog).

Verify deployment:
```bash
supabase functions list
```

---

## 5. Verify Database Migrations

**COMPLETED** - All migrations applied. The following cron jobs should be active:

| Job | Status |
|-----|--------|
| `analyze-main-tables` | Active |
| `cleanup-cron-history` | Active |
| `keep-alive` | Active |
| `vacuum-analyze-chunks` | Active |

**Note**: `edge-keep-alive` was removed on 2026-02-03 (not needed on Pro tier).

**Note**: The `vacuum-analyze-analytics` and `edge-cleanup-analytics` jobs were removed as part of the PostHog migration.

---

## 6. Update NEXT_PUBLIC_SITE_URL on Vercel

**COMPLETED** - Set 24 hours ago to production URL.

---

## 7. Add ELEVENLABS_API_KEY to Vercel

**COMPLETED** - Added to both Production and Preview environments on 2026-01-31.

---

## 8. Trigger Redeployment

**COMPLETED** — Site has been live since 2026-01-31. All environment variables were in place at initial deployment. Redeployments happen automatically on every push to `main` via Vercel's GitHub integration.

---

## 9. Verify Everything Works

**COMPLETED** — Site has been live and verified since 2026-01-31. Ongoing health monitoring is handled by Upptime (pings `paisaxe.es` and `/api/health/live` every 5 minutes — see the Upptime Status Page section in [operations.md](./operations.md)). For a re-verification checklist, see the Pre-Launch Checklist in [operations.md](./operations.md).

---

## Quick Reference

| Item | Value |
|------|-------|
| Supabase project ref | `axoishtlumlswzhegseq` |
| Supabase dashboard | https://supabase.com/dashboard/project/axoishtlumlswzhegseq |
| Supabase SQL Editor | https://supabase.com/dashboard/project/axoishtlumlswzhegseq/sql |
| Vercel project | `thecreativetoken/paisaxe` |
| Production URL | https://paisaxe.es |
| Edge Functions | https://supabase.com/dashboard/project/axoishtlumlswzhegseq/functions |

---

*All tasks completed. This file is retained as a historical record of the initial launch setup.*
