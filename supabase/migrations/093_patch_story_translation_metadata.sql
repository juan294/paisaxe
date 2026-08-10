-- BE-M3: patch story translation metadata without replacing the full JSONB blob.
--
-- Translation generation and manual admin edits previously wrote the entire
-- stories.metadata object after reading it. A concurrent writer could add or
-- change unrelated metadata keys between that read and write, and the stale
-- full-object update would lose those changes. This RPC applies only the
-- translation-related JSONB paths against the current row value.

CREATE OR REPLACE FUNCTION public.patch_story_translation_metadata(
  p_story_id uuid,
  p_translations jsonb DEFAULT '{}'::jsonb,
  p_translation_status jsonb DEFAULT '{}'::jsonb,
  p_last_translated_at timestamptz DEFAULT NULL,
  p_set_last_translated_at boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata jsonb;
BEGIN
  SELECT COALESCE(s.metadata, '{}'::jsonb)
  INTO v_metadata
  FROM public.stories s
  WHERE s.id = p_story_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_metadata := jsonb_set(
    v_metadata,
    '{translations}',
    COALESCE(v_metadata->'translations', '{}'::jsonb) || COALESCE(p_translations, '{}'::jsonb),
    true
  );

  v_metadata := jsonb_set(
    v_metadata,
    '{translation_status}',
    COALESCE(v_metadata->'translation_status', '{}'::jsonb) || COALESCE(p_translation_status, '{}'::jsonb),
    true
  );

  IF p_set_last_translated_at THEN
    v_metadata := jsonb_set(
      v_metadata,
      '{last_translated_at}',
      COALESCE(to_jsonb(p_last_translated_at), 'null'::jsonb),
      true
    );
  END IF;

  UPDATE public.stories
  SET metadata = v_metadata
  WHERE id = p_story_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.patch_story_translation_metadata(uuid, jsonb, jsonb, timestamptz, boolean) IS
  'Atomically patches stories.metadata translations, translation_status, and optionally last_translated_at without replacing unrelated metadata keys.';

REVOKE ALL ON FUNCTION public.patch_story_translation_metadata(uuid, jsonb, jsonb, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_story_translation_metadata(uuid, jsonb, jsonb, timestamptz, boolean) TO service_role;
