# Pending Setup Tasks

Tasks to complete once the domain (paisaxe.com / paisaxe.es) is fully configured and DNS has propagated.

**Status**: Waiting on domain finalization.

---

## 1. Add WEBHOOK_SECRET to Vercel

The webhook receiver API needs this secret to validate incoming requests from Supabase.

```bash
# Add to both Production and Preview
vercel env add WEBHOOK_SECRET production
vercel env add WEBHOOK_SECRET preview
```

Use the same value as in `.env.local`: `(see .env.local WEBHOOK_SECRET)`

After adding, trigger a redeployment so the new env var takes effect.

---

## 2. Configure Supabase Database Webhook Settings

Run these SQL commands in the [Supabase SQL Editor](https://supabase.com/dashboard/project/axoishtlumlswzhegseq/sql) to tell the database where to send webhook HTTP calls:

```sql
-- Set the webhook target URL (your production domain)
ALTER DATABASE postgres SET app.webhook_base_url = 'https://paisaxe.com';

-- Set the webhook secret (must match WEBHOOK_SECRET env var above)
ALTER DATABASE postgres SET app.webhook_secret = '(see .env.local WEBHOOK_SECRET)';
```

**Note**: If using `paisaxe.es` as the primary domain instead, update the URL accordingly.

---

## 3. Configure Supabase Edge Function Settings

Run these SQL commands to enable pg_cron to call the Edge Functions:

```sql
-- Set the Edge Functions base URL
ALTER DATABASE postgres SET app.supabase_functions_url = 'https://axoishtlumlswzhegseq.supabase.co/functions/v1';

-- Set the service role key for authentication
-- Get this from: Supabase Dashboard > Settings > API > service_role key
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

To get the service role key:
1. Go to https://supabase.com/dashboard/project/axoishtlumlswzhegseq/settings/api
2. Copy the `service_role` key (the secret one, not the anon key)
3. Paste it in the SQL command above

---

## 4. Deploy Edge Functions

Deploy the two Supabase Edge Functions:

```bash
supabase functions deploy keep-alive
supabase functions deploy cleanup-analytics
```

Verify they're deployed:
```bash
supabase functions list
```

---

## 5. Verify Database Migrations

Migrations 012–015 have already been applied via `supabase db push`. Verify they are in place:

```sql
-- Check all migrations are applied
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;

-- Verify cron jobs are registered (expect 7)
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```

Expected cron jobs (7 total):
- `analyze-main-tables`
- `cleanup-cron-history`
- `edge-cleanup-analytics`
- `edge-keep-alive`
- `keep-alive`
- `vacuum-analyze-analytics`
- `vacuum-analyze-chunks`

Migrations applied:
- `012_keep_alive_cron.sql` — Keep-alive cron job + get_database_size() function
- `013_database_webhooks.sql` — pg_net extension + webhook triggers on stories and feature_flags
- `014_edge_function_schedules.sql` — pg_cron schedules for Edge Functions
- `015_security_advisor_fixes.sql` — Function search_path hardening, move vector to extensions schema, tighten analytics RLS

---

## 6. Update NEXT_PUBLIC_SITE_URL on Vercel

Once the domain is finalized, update the production site URL:

```bash
vercel env rm NEXT_PUBLIC_SITE_URL production
vercel env add NEXT_PUBLIC_SITE_URL production
# Enter: https://paisaxe.com (or https://paisaxe.es)
```

---

## 7. Verify Everything Works

After completing all steps above:

1. **Health check**: Visit `https://paisaxe.com/api/health` - should show `"healthy"` with database size info
2. **Webhooks**: Toggle a feature flag in the admin panel, then check if the cache is invalidated (the flag change should reflect immediately)
3. **Realtime**: Open two browser tabs on the immersive page. Toggle a feature flag in the admin panel. Both tabs should reflect the change without refreshing
4. **Edge Functions**: Check the Supabase Dashboard > Edge Functions to see invocation logs
5. **Cron jobs**: Wait 3 days and verify the keep-alive job ran: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
6. **Security Advisor**: Check [Security Advisor](https://supabase.com/dashboard/project/axoishtlumlswzhegseq/advisors/security) — should show only 1 warning ("Leaked Password Protection Disabled", which requires a paid Pro plan and can be ignored)

---

## Quick Reference

| Item | Value |
|------|-------|
| Supabase project ref | `axoishtlumlswzhegseq` |
| Supabase dashboard | https://supabase.com/dashboard/project/axoishtlumlswzhegseq |
| Supabase SQL Editor | https://supabase.com/dashboard/project/axoishtlumlswzhegseq/sql |
| Vercel project | `thecreativetoken/paisaxe` |
| Vercel preview URL | https://paisaxe-oe4tox6sq-thecreativetoken.vercel.app |
| WEBHOOK_SECRET | `(see .env.local WEBHOOK_SECRET)` |

---

*Delete this file once all tasks are completed.*
