# Supabase Edge Functions

Deno-based serverless functions deployed to Supabase. These run on Deno Deploy and are invoked via HTTP or scheduled through pg_cron.

## Functions

### keep-alive

Prevents the free-tier Supabase database from auto-pausing due to inactivity (7-day timeout). Queries the `stories` table and returns the count of active stories.

- **Schedule**: Every 3 days at noon UTC (`0 12 */3 * *`)
- **Endpoint**: `POST /functions/v1/keep-alive`
- **Response**: `{ ok: true, active_stories: number, timestamp: string }`

### cleanup-analytics

Deletes old analytics events to keep the database under the 500 MB free-tier storage limit. Retention period is configurable via query parameter.

- **Schedule**: First of each month at 2:00 AM UTC (`0 2 1 * *`)
- **Endpoint**: `POST /functions/v1/cleanup-analytics?days=90`
- **Response**: `{ ok: true, deleted_count: number, retention_days: number, cutoff_date: string, timestamp: string }`

## Local Development

```bash
# Serve all functions locally
supabase functions serve

# Serve a specific function
supabase functions serve keep-alive

# Test with curl
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/keep-alive' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

## Deployment

```bash
# Deploy a single function
supabase functions deploy keep-alive
supabase functions deploy cleanup-analytics

# Deploy all functions
supabase functions deploy
```

## Scheduling Setup (pg_cron + pg_net)

Edge Functions are scheduled via pg_cron, which uses pg_net to make HTTP calls. After deploying the functions, configure the database settings:

```sql
-- Set the project URL and service role key (run in Supabase SQL Editor)
ALTER DATABASE postgres SET app.supabase_functions_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

Then apply migration `014_edge_function_schedules.sql` to register the cron jobs.

Verify the schedules are active:

```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```

## Environment Variables

Edge Functions automatically have access to these Supabase-provided variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full access) |
| `SUPABASE_ANON_KEY` | Anonymous key (RLS-restricted) |
| `SUPABASE_DB_URL` | Direct database connection string |

No additional environment variables need to be set for these functions.

## Notes

- Edge Functions use Deno, not Node.js. Imports use URL-based module specifiers (`https://esm.sh/...`).
- TypeScript checking and linting use Deno's toolchain, not the project's `tsc` or `eslint`.
- The `.vscode/` directory in this folder configures the Deno extension for proper IDE support.
- Free tier allows 500K Edge Function invocations per month. The current schedules use fewer than 25 invocations/month combined.
