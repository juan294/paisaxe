# Database Migration Policy

Policy and patterns for safe, forward-only database migrations on Supabase.

---

## Forward-Only Principle

**All migrations are forward-only. There are no `down.sql` rollback files.**

This is a deliberate constraint, not an oversight:

- Applied migrations may have already modified live data. A rollback script that drops a column cannot restore data that was written to that column after the migration ran.
- The Supabase migration runner does not support transactional rollback across DDL statements.
- Forward-only migrations are simpler to audit and reason about in production.

**When you need to undo a migration, write a compensation migration** — a new forward-applied migration that reverses the effect. See the [Rollback Runbook](./rollback.md) for compensation examples.

---

## Expand/Contract Pattern

For any destructive change (dropping a column, renaming a column, changing a column type), use the **expand/contract** pattern across at least two separate deploys.

This ensures that code and schema are never out of sync during a deployment window.

### Phase 1: Expand (additive — safe to deploy anytime)

Add the new column or table without removing anything. The existing code continues to work unchanged.

```sql
-- Example: rename chunks.source_pdf → chunks.source_document
-- Phase 1: add the new column
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS source_document text;
```

Deploy this migration with the updated application code that writes to *both* columns during the transition period.

### Phase 2: Migrate Data

Backfill the new column with data from the old one. This can be done in a migration or via a one-time script.

```sql
-- Phase 2: backfill the new column from the old one
UPDATE chunks SET source_document = source_pdf WHERE source_document IS NULL;
```

Deploy and verify that all rows have the new value populated. At this point, application code should read from the new column.

### Phase 3: Contract (drop the old — only after Phase 1+2 are fully deployed)

Once the code no longer reads or writes the old column, remove it in a separate deploy.

```sql
-- Phase 3: drop the old column (separate migration, separate deploy)
ALTER TABLE chunks DROP COLUMN IF EXISTS source_pdf;
```

**Never combine Phase 1 and Phase 3 in the same migration.** If the deploy fails mid-way, you end up with neither the old nor the new column.

---

## Checklist for Destructive Migrations

Before any migration that contains a `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or equivalent:

- [ ] **Code already deployed that doesn't read the dropped column/table?**
  Verify by searching the codebase for all references to the column or table name. The application must be fully deployed without touching the old structure before the drop migration runs.

  ```bash
  grep -r "source_pdf" src/ --include="*.ts" --include="*.tsx"
  ```

- [ ] **Backup of affected data taken?**
  For tables with user data or content, export the data before dropping:

  ```sql
  -- Export via Supabase SQL Editor before dropping
  COPY (SELECT * FROM table_name) TO STDOUT WITH CSV HEADER;
  ```

  Or use the Supabase Dashboard → Database → Backups to trigger a manual backup.

- [ ] **Compensation migration written?**
  Write the compensation migration *before* applying the destructive one. Store it in a separate file (e.g., `NNN_revert_<description>.sql`) but do not apply it unless needed. This ensures you can recover quickly without writing SQL under pressure.

- [ ] **Migration tested locally?**

  ```bash
  supabase start          # Start local Supabase (requires Docker Desktop)
  supabase db reset       # Apply all migrations from scratch
  # Run your verification queries
  supabase stop
  ```

- [ ] **Health endpoint verified after migration?**

  ```bash
  curl -s https://paisaxe.es/api/health | jq
  # Expected: "status": "healthy", supabase: "connected"
  ```

---

## Identifying Risky Migrations

The following existing migrations in `supabase/migrations/` contain `DROP` statements. They have already been applied to production but are documented here as a reference for understanding what data is no longer recoverable.

| Migration | Risk | Notes |
|-----------|------|-------|
| `017_reduce_embedding_dimensions.sql` | **Data loss — re-seed required** | Drops `chunks_embedding_idx`, then alters `embedding` column from `vector(1024)` to `vector(512)`. All existing embeddings were invalidated. Recovery: re-run `npm run seed-db`. |
| `019_drop_analytics_events.sql` | **Table dropped — data unrecoverable** | Drops `analytics_events` table and its pg_cron jobs. Analytics moved to PostHog EU Cloud. Historical event data from before this migration is gone. |
| `073_cleanup_unused_indexes.sql` | **Low risk — indexes only** | Drops 12 unused indexes on inactive marketing tables and low-traffic columns. Indexes can be recreated at any time with no data loss. The compensation would simply be `CREATE INDEX IF NOT EXISTS`. |

### How to Find Risky Migrations in Future

```bash
# Find all migrations with DROP statements
grep -l "DROP TABLE\|DROP COLUMN\|TRUNCATE" supabase/migrations/

# Review a specific migration
cat supabase/migrations/<migration-file>.sql
```

---

## Migration Naming Convention

Migration files follow a sequential numeric prefix:

```
NNN_description.sql
```

Where `NNN` is a zero-padded integer incremented from the last migration. The description should be lowercase with underscores.

Examples:
```
074_add_user_preferences.sql
075_drop_legacy_sessions.sql
076_revert_drop_legacy_sessions.sql   # compensation migration
```

---

## Migration Authoring Guidelines

1. **Include a header comment** explaining the purpose, any required manual steps, and data impacts.

2. **Use `IF EXISTS` / `IF NOT EXISTS`** on all DDL to make migrations idempotent where possible.

3. **Explicit `search_path`** — set `search_path = public, extensions` at the top of every migration that references pgvector or extension-provided types.

4. **Functions must set `search_path`** — all `CREATE FUNCTION` statements that are `SECURITY DEFINER` must include `SET search_path = ''` and use fully qualified references (e.g., `public.chunks`, not `chunks`).

5. **Grants on new tables** — every migration that creates a public-facing table must include:

   ```sql
   GRANT SELECT ON table_name TO anon, authenticated;
   ```

---

## Related Runbooks

- [Rollback Procedures](./rollback.md) — Vercel rollback, code revert, compensation migrations
- [Operations Guide](./operations.md) — pg_cron, health endpoint, CI/CD
- [Supabase skill](./../../../.claude/skills/) — local migration testing workflow
