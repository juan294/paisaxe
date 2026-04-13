-- ============================================================================
-- Migration: 074_grant_user_profiles_authenticated.sql
-- Purpose: Grant SELECT on user_profiles to authenticated role
--
-- Background: Migration 069 granted SELECT on stories, chunks, images,
-- and feature_flags but missed user_profiles. Without table-level SELECT,
-- the RLS policy "Users can read own profile" can never be evaluated —
-- the authenticated role gets "permission denied" at the table level.
-- This causes the admin panel to always show "Access Denied" even for
-- users with role = 'admin' in user_profiles.
-- ============================================================================

GRANT SELECT ON public.user_profiles TO authenticated;
