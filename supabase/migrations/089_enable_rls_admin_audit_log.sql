-- Enable RLS on admin_audit_log to satisfy Supabase security advisor.
-- Migration 076 disabled RLS and revoked anon/authenticated grants, which is
-- functionally safe but trips the rls_disabled_in_public linter.
--
-- Enabling RLS without policies denies anon and authenticated by default.
-- service_role has BYPASSRLS, so application writes via the service key
-- continue to work. The REVOKE from migration 076 remains as defense in depth.

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
