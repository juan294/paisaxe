-- ============================================================================
-- Migration: 066_restrict_webhook_config_rls.sql
-- Purpose: Restrict webhook_config read access to admins only
--
-- The previous policy "Authenticated can read webhook config" allowed ANY
-- authenticated user to read the webhook_config table, which contains the
-- webhook secret. This migration restricts read access to admin users only.
--
-- The notify_webhook() function uses SECURITY DEFINER, so it can still read
-- the webhook secret regardless of RLS policies.
--
-- Fixes: https://github.com/soyelJuan/paisaxe/issues/78
-- ============================================================================

-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Authenticated can read webhook config" ON public.webhook_config;

-- Create a new policy that only allows admins to read webhook_config
CREATE POLICY "Only admins can read webhook config" ON public.webhook_config
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin')
  );
