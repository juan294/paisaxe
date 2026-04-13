-- ============================================================================
-- Migration: 070_default_anon_privileges.sql
-- Purpose: Set default privileges so future tables automatically get
--          anon/authenticated SELECT grants
--
-- Background: Tables created via migrations don't inherit Supabase's
-- dashboard-granted privileges. Without explicit GRANT statements,
-- RLS policies exist but can't be evaluated — the anon role gets
-- "permission denied" at the table level before RLS is even checked.
-- This caused the immersive page to silently serve fallback placeholder
-- images instead of real stories (incident 2026-03-25).
--
-- This migration ensures ALL future tables in the public schema
-- automatically get SELECT grants for anon and authenticated roles.
-- Individual tables can still restrict access via RLS policies.
-- ============================================================================

-- Set default privileges for future tables created by the postgres role
-- (which runs migrations on Supabase)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated;
