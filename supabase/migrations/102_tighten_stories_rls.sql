-- Migration: Tighten stories RLS policy to match app-layer moderation gate (SE-H2, #842)
--
-- Bug: every application read path filters stories on
-- is_active = true AND curation_status = 'approved' (see
-- src/lib/stories-server.ts:63, which queries
-- `stories?is_active=eq.true&curation_status=eq.approved`), but the RLS
-- policy from migration 003 only checked `is_active = true`. Because
-- migration 069 grants anon/authenticated table-level SELECT on stories,
-- a client using the public anon key could query PostgREST directly
-- (e.g. `stories?select=*&is_active=eq.true`) and read unapproved,
-- AI-generated, human-unreviewed story content — bypassing the moderation
-- gate entirely, since that gate exists only in TypeScript.
--
-- Fix: replace the public SELECT policy with one that matches the app
-- predicate exactly, and add a companion policy so authenticated admins
-- keep full visibility for the curation queue.
--
-- Regression check (admin reads): GET /api/admin/stories
-- (src/app/api/admin/stories/route.ts:35-36) uses `withAdminRead`
-- (src/lib/admin-auth.ts:182-216), which passes a COOKIE-SCOPED client
-- subject to RLS — NOT the service-role client used by POST's `withAdmin`.
-- Tightening the public policy alone would make the curation queue (which
-- must list needs_curation/rejected/inactive rows) render empty for admins.
-- The "Admins can read all stories" policy below closes that gap by
-- granting authenticated users with user_profiles.role = 'admin' an
-- unconditional SELECT, following the same pattern already used for
-- marketing_* tables in migration 049 and platform_costs in migration 057.
--
-- Scope: chunks and images intentionally NOT touched here. Both have a
-- broad `USING (true)` SELECT policy (migration 001) with no
-- curation_status/is_active columns at all — they back the RAG chat
-- pipeline, which is expected to read the full corpus via the anon key from
-- a client context. Applying the "same predicate" doesn't translate to
-- those tables without further design work, and the issue's primary,
-- concretely-evidenced finding is stories. Deferring chunks/images is an
-- explicit Wave 1 scope decision, not an oversight.
--
-- Index note: the existing partial index `stories_active_idx` (is_active)
-- and `stories_curation_status_idx` (curation_status, migration 004) let
-- Postgres satisfy the new two-column predicate via a bitmap AND of both
-- indexes. A single composite (is_active, curation_status) partial index
-- would be more selective but isn't urgent at current table size; tracked
-- as a low-priority follow-up (#919) rather than done here.

drop policy if exists "Public read access for active stories" on stories;

create policy "Public read access for approved active stories"
  on stories for select
  to anon, authenticated
  using (is_active = true and curation_status = 'approved');

create policy "Admins can read all stories"
  on stories for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );
