-- QA Test User Cleanup Function
-- Provides surgical cleanup for the dedicated QA test user (never touches real users)

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.cleanup_qa_test_user(text);

-- Cleanup function: ONLY deletes data for the exact test email pattern
-- This function validates the email pattern to ensure we never accidentally
-- clean up a real user's data.
CREATE OR REPLACE FUNCTION public.cleanup_qa_test_user(test_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id uuid;
  favorites_deleted integer;
BEGIN
  -- Validate email matches pattern qa-test-*@paisaxe.dev
  -- This is a CRITICAL safety check - we only allow cleanup for test users
  IF test_email IS NULL OR test_email NOT LIKE 'qa-test-%@paisaxe.dev' THEN
    RAISE EXCEPTION 'Invalid test email pattern. Must match qa-test-*@paisaxe.dev';
  END IF;

  -- Find the user ID for this test email
  SELECT user_id INTO target_user_id
  FROM public.user_profiles
  WHERE email = test_email;

  -- If user doesn't exist, return early (not an error - user may not have been created yet)
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'status', 'no_user',
      'message', 'No user found with email: ' || test_email,
      'favorites_deleted', 0
    );
  END IF;

  -- Delete ONLY this user's favorites (user account persists for re-use)
  DELETE FROM public.user_favorites
  WHERE user_id = target_user_id;

  GET DIAGNOSTICS favorites_deleted = ROW_COUNT;

  RETURN json_build_object(
    'status', 'cleaned',
    'user_id', target_user_id,
    'email', test_email,
    'favorites_deleted', favorites_deleted
  );
END;
$$;

-- Grant execute permission to service role (for authenticated API calls)
GRANT EXECUTE ON FUNCTION public.cleanup_qa_test_user(text) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.cleanup_qa_test_user(text) IS
  'Cleans up test data for QA test users. ONLY accepts emails matching qa-test-*@paisaxe.dev pattern.
   Used by the QA Agent to reset test user state between runs.';
