# Database Backup and Restore

Procedures for verifying backup coverage, locating recovery points, and executing a restore on the Supabase Pro-tier database for paisaxe.

---

## Backup Types

Paisaxe runs on **Supabase Pro**, which provides two backup mechanisms:

| Type | Mechanism | Retention | Granularity |
|------|-----------|-----------|-------------|
| **PITR (Point-in-Time Recovery)** | Continuous WAL archiving | 7 days | Any second within the window |
| **Daily snapshots** | Full logical backup at ~00:00 UTC | 7 daily snapshots | Restore to start of any day |

PITR is the primary recovery path for precision restores (e.g., "restore to 2 minutes before the bad migration ran"). Daily snapshots are the fallback for coarse restores or downloading data for analysis.

---

## PITR — Point-in-Time Recovery

### What It Is

Supabase continuously archives PostgreSQL write-ahead log (WAL) segments to object storage. This means any point within the 7-day rolling window can be selected as a recovery target — down to the second.

### Finding the PITR Window

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select the **asturias** project (the Paisaxe production database).
3. Navigate to **Database → Backups** in the left sidebar.
4. The **Point in Time** tab shows:
   - The earliest available recovery point (7 days ago)
   - The latest available recovery point (near real-time, typically a few minutes behind)
   - A calendar and time picker to select the exact target

### PITR Restore Procedure

> **Before you begin**: A PITR restore replaces the entire database. All data written after the selected recovery point will be lost. Coordinate with any active users if possible.

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select the **asturias** project.
2. Navigate to **Database → Backups → Point in Time** tab.
3. Use the calendar to select the **date** of the desired recovery point.
4. Use the time picker to select the **exact time** (UTC). Choose a point just before the incident — for example, if a bad migration ran at 14:35 UTC, select 14:34:00 UTC.
5. Click **Restore**.
6. Review the confirmation dialog carefully — it will show the selected timestamp.
7. Click **Confirm restore**.
8. Supabase will provision a new database cluster from the WAL archive and promote it. This typically takes **10–20 minutes** depending on database size.
9. Monitor the Supabase Dashboard for the restore status. The project will briefly go offline during the switchover.
10. Once the restore is complete, verify the health endpoint:

```bash
curl -s https://paisaxe.es/api/health | jq
# Expected: "status": "healthy", supabase: "connected"
```

11. Run a spot-check query in the Supabase SQL Editor to confirm data integrity:

```sql
-- Verify chunks and stories are present
SELECT COUNT(*) FROM chunks;
SELECT COUNT(*) FROM stories;
SELECT COUNT(*) FROM feature_flags;
```

12. Re-apply any migrations that were run after the recovery point (forward-only principle — see [migration-policy.md](./migration-policy.md)).

---

## Daily Snapshots

### What They Are

Supabase takes a full logical backup of the database once per day, retained for 7 days. Snapshots are taken around 00:00 UTC. These are the starting point for downloading data or for coarser restores when PITR precision is not needed.

### Downloading a Snapshot

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select the **asturias** project.
2. Navigate to **Database → Backups → Scheduled backups** tab.
3. You will see up to 7 daily snapshots listed with their timestamps.
4. Click **Restore** next to the desired snapshot to initiate a full restore, OR
5. Click **Download** (if available for your plan tier) to get a `.sql` dump for local analysis.

> Downloading snapshots is useful when you need to inspect data from a specific day without performing a live restore.

---

## Post-Restore Verification Checklist

After any restore (PITR or daily snapshot), complete this checklist before considering the database operational:

- [ ] **Health endpoint returns 200 and `status: healthy`**

  ```bash
  curl -s https://paisaxe.es/api/health | jq
  ```

- [ ] **Core tables have expected row counts**

  ```sql
  SELECT 'chunks' AS tbl, COUNT(*) FROM chunks
  UNION ALL SELECT 'images', COUNT(*) FROM images
  UNION ALL SELECT 'stories', COUNT(*) FROM stories
  UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
  UNION ALL SELECT 'feature_flags', COUNT(*) FROM feature_flags;
  ```

- [ ] **Feature flags are present and sensible** — confirm `maintenance_mode` is set to the correct value for the current operational state.

- [ ] **pg_cron jobs are running** — verify cron jobs were not lost:

  ```sql
  SELECT jobname, schedule FROM cron.job ORDER BY jobname;
  ```

  If jobs are missing, re-apply migration `011_pg_cron_jobs.sql` via `supabase db push`.

- [ ] **Database webhooks are configured** — verify `webhook_config` contains the correct `base_url`:

  ```sql
  SELECT * FROM webhook_config;
  ```

  If `base_url` is wrong or missing, update it:

  ```sql
  UPDATE webhook_config SET value = 'https://paisaxe.es' WHERE key = 'base_url';
  ```

- [ ] **Pending migrations re-applied** — if the restore point predates any migrations that were previously applied, re-run them via `supabase db push`. Review `supabase/migrations/` to identify what needs to be re-applied relative to the restore timestamp.

  > **HNSW index note (migration 086):** Migration `086_switch_to_hnsw_index.sql` drops the IVFFlat index and creates an HNSW index on `chunks.embedding`. If restoring to a point before this migration, vector search will use the older IVFFlat index (still functional but slower). Re-run migration 086 after the restore to restore HNSW performance.

- [ ] **Chat functionality verified** — send a test message to confirm vector search and Claude API are working end-to-end.

- [ ] **Admin panel accessible** — log in to https://paisaxe.es/admin and confirm feature flag management works.

---

## Escalation

This is a solo-dev project. In a database emergency:

1. **Roll back the application first** if a deployment caused the issue — see [rollback.md](./rollback.md). A Vercel rollback (2–3 minutes) is faster than a database restore.
2. **Enable maintenance mode** via the admin panel (https://paisaxe.es/admin → Feature Flags → enable `maintenance_mode`) to prevent user-facing errors while the restore is in progress.
3. **Check Supabase status** at https://status.supabase.com to rule out a platform-wide incident before initiating a restore.
4. **Contact Supabase support** at https://supabase.com/support if the PITR restore fails or the Dashboard is unavailable. Pro plan includes email support.
5. **Post an incident update** to the Upptime status page repo (https://github.com/juan294/paisaxe-upptime) if downtime is expected to exceed 15 minutes.

---

## Related Runbooks

- [Migration Policy](./migration-policy.md) — forward-only migrations, destructive migration checklist, backup requirements before drops
- [Rollback Procedures](./rollback.md) — Vercel rollback, code revert, compensation migrations
- [Operations Guide](./operations.md) — health endpoint, pg_cron jobs, database webhooks
