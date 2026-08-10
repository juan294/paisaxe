-- Migration: BE-M4 — atomic story creation from a user suggestion
--
-- Bug (BE-M4):
--   The admin "create story" route inserted the story row, then SEPARATELY
--   updated story_suggestions.status = 'converted' in a second DB call. If the
--   suggestion update failed, the route logged the error but still returned
--   201 — leaving a story created while the originating suggestion was never
--   marked converted. Curation metrics (and the suggestion queue) then drifted
--   out of sync, and the same suggestion could be converted again.
--
-- Fix:
--   create_story_from_suggestion() performs BOTH writes in a single function
--   body (one transaction): it inserts the story and updates the suggestion.
--   Any error in either statement rolls back the whole RPC, so the system is
--   never left half-converted. The function returns the new story row (as a
--   jsonb object) so the route can respond with the created story's identity.
--
-- Security:
--   SECURITY DEFINER + SET search_path = '' with fully-qualified references,
--   per the project's database function security rule. EXECUTE is granted only
--   to service_role (the admin route uses the service-role client).

CREATE OR REPLACE FUNCTION public.create_story_from_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_slug text,
  p_subtitle text,
  p_description text,
  p_category text,
  p_location text,
  p_duration text,
  p_source_pdf text,
  p_best_months integer[],
  p_metadata jsonb,
  p_display_order integer,
  p_source_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_story public.stories%ROWTYPE;
BEGIN
  -- 1. Insert the new story.
  INSERT INTO public.stories (
    title,
    slug,
    subtitle,
    description,
    category,
    location,
    duration,
    source_pdf,
    best_months,
    metadata,
    display_order,
    curation_status,
    is_active,
    source_type,
    suggestion_id
  ) VALUES (
    p_title,
    p_slug,
    p_subtitle,
    p_description,
    p_category,
    p_location,
    p_duration,
    p_source_pdf,
    p_best_months,
    COALESCE(p_metadata, '{}'::jsonb),
    p_display_order,
    'needs_curation',
    true,
    COALESCE(p_source_type, 'curated'),
    p_suggestion_id
  )
  RETURNING * INTO v_story;

  -- 2. Mark the originating suggestion as converted. This runs in the same
  --    transaction as the insert above; any failure here rolls back the story
  --    insert too, so the two never diverge (BE-M4 invariant).
  UPDATE public.story_suggestions
  SET
    status = 'converted',
    converted_story_id = v_story.id,
    updated_at = now()
  WHERE id = p_suggestion_id;

  IF NOT FOUND THEN
    -- The suggestion does not exist — abort the whole operation so we don't
    -- create an orphaned "converted" story with no matching suggestion.
    RAISE EXCEPTION 'story_suggestion % not found', p_suggestion_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_story.id,
    'slug', v_story.slug,
    'title', v_story.title,
    'category', v_story.category,
    'display_order', v_story.display_order,
    'curation_status', v_story.curation_status,
    'created_at', v_story.created_at
  );
END;
$$;

COMMENT ON FUNCTION public.create_story_from_suggestion(uuid, text, text, text, text, text, text, text, text, integer[], jsonb, integer, text) IS
  'Atomically creates a story from a user suggestion and marks the suggestion converted in one transaction. Returns the new story row as jsonb. Raises (rolling back the insert) if the suggestion does not exist.';

REVOKE ALL ON FUNCTION public.create_story_from_suggestion(uuid, text, text, text, text, text, text, text, text, integer[], jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_story_from_suggestion(uuid, text, text, text, text, text, text, text, text, integer[], jsonb, integer, text) TO service_role;
