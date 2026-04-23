CREATE OR REPLACE FUNCTION public.fail_stale_story_translations(
  p_cutoff timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated_count integer := 0;
BEGIN
  WITH computed AS (
    SELECT
      s.id,
      jsonb_object_agg(
        status_entry.locale,
        CASE
          WHEN status_entry.value->>'status' = 'translating'
            AND COALESCE(NULLIF(status_entry.value->>'updatedAt', '')::timestamptz, to_timestamp(0)) < p_cutoff
          THEN (
            jsonb_set(
              jsonb_set(status_entry.value, '{status}', '"failed"', true),
              '{updatedAt}',
              to_jsonb(v_now),
              true
            ) || jsonb_build_object('error', 'timeout')
          )
          ELSE status_entry.value
        END
      ) AS next_translation_status,
      bool_or(
        status_entry.value->>'status' = 'translating'
        AND COALESCE(NULLIF(status_entry.value->>'updatedAt', '')::timestamptz, to_timestamp(0)) < p_cutoff
      ) AS has_stale
    FROM public.stories s
    CROSS JOIN LATERAL jsonb_each(
      COALESCE(s.metadata->'translation_status', '{}'::jsonb)
    ) AS status_entry(locale, value)
    GROUP BY s.id
  ),
  updated AS (
    UPDATE public.stories s
    SET metadata = jsonb_set(
      COALESCE(s.metadata, '{}'::jsonb),
      '{translation_status}',
      computed.next_translation_status,
      true
    )
    FROM computed
    WHERE s.id = computed.id
      AND computed.has_stale
    RETURNING s.id
  )
  SELECT count(*) INTO v_updated_count FROM updated;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_story_translations(timestamptz) IS
  'Marks stale metadata.translation_status entries as failed when they remain translating past the cutoff.';

REVOKE ALL ON FUNCTION public.fail_stale_story_translations(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_story_translations(timestamptz) TO service_role;
