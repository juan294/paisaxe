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
| 6 | Update NEXT_PUBLIC_SITE_URL on Vercel | COMPLETED (24h ago) |
| 7 | Add ELEVENLABS_API_KEY to Vercel | COMPLETED (2026-01-31) |
| 8 | Trigger redeployment | PENDING |
| 9 | Verify Everything Works | PENDING |

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
2. Upptime pings `/api/health` every 5 minutes, which queries the database
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

**PENDING** - After adding new environment variables, trigger a redeployment:

```bash
vercel --prod
```

Or push any commit to `main` to trigger automatic deployment.

---

## 9. Verify Everything Works

After completing all steps above:

1. **Health check**: Visit `https://paisaxe.es/api/health` - should show `"healthy"` with database size info
2. **Webhooks**: Toggle a feature flag in the admin panel, then check if the cache is invalidated (the flag change should reflect immediately)
3. **Realtime**: Open two browser tabs on the immersive page. Toggle a feature flag in the admin panel. Both tabs should reflect the change without refreshing
4. **Voice agents**: Test the voice chat feature (requires `visitor_voice_agent` feature flag enabled)
5. **Edge Functions**: Check the Supabase Dashboard > Edge Functions to see invocation logs
6. **Cron jobs**: Wait 3 days and verify the keep-alive job ran: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

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

*This file can be archived once all tasks are verified as working.*
