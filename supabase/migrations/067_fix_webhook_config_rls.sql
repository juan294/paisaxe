-- ============================================================================
-- Migration: 067_fix_webhook_config_rls.sql
-- Purpose: Fix webhook_config RLS policy using wrong column
--
-- Migration 066 used `id` (auto-generated PK) instead of `user_id` (auth UID)
-- in the admin check. This is the same bug pattern fixed for platform_costs
-- in migration 057.
--
-- Also adds the (select auth.uid()) optimization established in migration 049
-- to prevent per-row re-evaluation.
-- ============================================================================

-- Drop the buggy policy from migration 066
DROP POLICY IF EXISTS "Only admins can read webhook config" ON public.webhook_config;

-- Recreate with correct column (user_id) and subselect optimization
CREATE POLICY "Only admins can read webhook config" ON public.webhook_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );
