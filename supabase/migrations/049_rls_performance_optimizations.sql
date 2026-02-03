-- ============================================================================
-- Migration: 049_rls_performance_optimizations.sql
-- Purpose: Fix Supabase Security Advisor warnings for RLS performance
--
-- Issues addressed:
-- 1. auth_rls_initplan: Wrap auth.uid()/auth.role() in (select ...) to prevent
--    per-row re-evaluation
-- 2. multiple_permissive_policies: Use TO service_role instead of checking
--    auth.role() in USING clause to avoid overlapping policies
-- ============================================================================

-- ============================================================================
-- USER_FAVORITES TABLE
-- Fix: Wrap auth.uid() in (select auth.uid())
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own favorites" ON public.user_favorites;
CREATE POLICY "Users can view own favorites"
  ON public.user_favorites FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.user_favorites;
CREATE POLICY "Users can insert own favorites"
  ON public.user_favorites FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.user_favorites;
CREATE POLICY "Users can delete own favorites"
  ON public.user_favorites FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- USER_PROFILES TABLE
-- Fix: Wrap auth.uid() and use TO service_role
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Change from auth.role() check to TO service_role (more efficient, no overlap)
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;
CREATE POLICY "Service role can manage all profiles"
  ON public.user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STORY_SUGGESTIONS TABLE
-- Fix: Wrap auth.uid() in (select auth.uid())
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own suggestions" ON public.story_suggestions;
CREATE POLICY "Users can view own suggestions"
  ON public.story_suggestions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own suggestions" ON public.story_suggestions;
CREATE POLICY "Users can insert own suggestions"
  ON public.story_suggestions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Service role policy already uses TO service_role (no change needed)

-- ============================================================================
-- VOICE_PURCHASES TABLE
-- Fix: Wrap auth.uid() and use TO service_role
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own purchases" ON public.voice_purchases;
CREATE POLICY "Users can view own purchases"
  ON public.voice_purchases FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage all purchases" ON public.voice_purchases;
CREATE POLICY "Service role can manage all purchases"
  ON public.voice_purchases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MARKETING_ACCOUNTS TABLE
-- Fix: Use TO service_role and wrap auth.uid() in admin check
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage marketing_accounts" ON public.marketing_accounts;
CREATE POLICY "Service role can manage marketing_accounts"
  ON public.marketing_accounts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read marketing_accounts" ON public.marketing_accounts;
CREATE POLICY "Admins can read marketing_accounts"
  ON public.marketing_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- MARKETING_POSTS TABLE
-- Fix: Use TO service_role and wrap auth.uid() in admin check
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage marketing_posts" ON public.marketing_posts;
CREATE POLICY "Service role can manage marketing_posts"
  ON public.marketing_posts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read marketing_posts" ON public.marketing_posts;
CREATE POLICY "Admins can read marketing_posts"
  ON public.marketing_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- MARKETING_SCHEDULE TABLE
-- Fix: Use TO service_role and wrap auth.uid() in admin check
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage marketing_schedule" ON public.marketing_schedule;
CREATE POLICY "Service role can manage marketing_schedule"
  ON public.marketing_schedule FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read marketing_schedule" ON public.marketing_schedule;
CREATE POLICY "Admins can read marketing_schedule"
  ON public.marketing_schedule FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- MARKETING_CONTENT_BANK TABLE
-- Fix: Use TO service_role and wrap auth.uid() in admin check
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage marketing_content_bank" ON public.marketing_content_bank;
CREATE POLICY "Service role can manage marketing_content_bank"
  ON public.marketing_content_bank FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read marketing_content_bank" ON public.marketing_content_bank;
CREATE POLICY "Admins can read marketing_content_bank"
  ON public.marketing_content_bank FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- MARKETING_AGENT_LOGS TABLE
-- Fix: Use TO service_role and wrap auth.uid() in admin check
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage marketing_agent_logs" ON public.marketing_agent_logs;
CREATE POLICY "Service role can manage marketing_agent_logs"
  ON public.marketing_agent_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read marketing_agent_logs" ON public.marketing_agent_logs;
CREATE POLICY "Admins can read marketing_agent_logs"
  ON public.marketing_agent_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- WEBHOOK_CONFIG TABLE
-- Fix: Use TO service_role
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage webhook config" ON public.webhook_config;
CREATE POLICY "Service role can manage webhook config"
  ON public.webhook_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Keep the "Authenticated can read" policy as-is (it uses USING(true), no auth function)

-- ============================================================================
-- VERIFICATION QUERY
-- Run this after migration to confirm no warnings remain:
--
-- SELECT * FROM extensions.supabase_db_lint()
-- WHERE level = 'WARN';
-- ============================================================================
