-- Migration: Fix platform_costs RLS policies
-- The original migration (056) used user_profiles.id instead of user_profiles.user_id
-- user_profiles.id is an auto-generated UUID, not the auth user ID

-- Drop existing (buggy) policies
DROP POLICY IF EXISTS "Admins can read platform_costs" ON public.platform_costs;
DROP POLICY IF EXISTS "Admins can insert platform_costs" ON public.platform_costs;
DROP POLICY IF EXISTS "Admins can update platform_costs" ON public.platform_costs;
DROP POLICY IF EXISTS "Admins can delete platform_costs" ON public.platform_costs;

-- Recreate with correct column reference (user_profiles.user_id)
-- Using (select auth.uid()) subselect optimization to prevent per-row re-evaluation

CREATE POLICY "Admins can read platform_costs"
  ON public.platform_costs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert platform_costs"
  ON public.platform_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update platform_costs"
  ON public.platform_costs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete platform_costs"
  ON public.platform_costs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );
