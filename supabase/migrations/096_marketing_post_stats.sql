-- Migration: PE-M4 — move marketing dashboard stats aggregation into SQL
--
-- Bug (PE-M4):
--   /api/admin/marketing/dashboard fetched 100 recent posts and ran the entire
--   stats aggregation (totals, per-platform counts, engagement sums, last
--   posted) in JavaScript. As the table grows this is wasteful: the row payload
--   is shipped to the app server only to be folded into a handful of numbers.
--
-- Fix:
--   get_marketing_post_stats() computes the dashboard stats directly in
--   Postgres over the whole marketing_posts table and returns a single jsonb
--   object shaped exactly like the app's MarketingStats type:
--     {
--       totalPosts, postsThisWeek, postsThisMonth, failedPosts,
--       totalEngagement: { <numeric engagement keys summed> },
--       byPlatform: {
--         x|instagram|pinterest: {
--           posts, scheduled, engagement: {...}, lastPostedAt
--         }
--       }
--     }
--   The route then calls this RPC instead of aggregating in JS.
--
-- Security:
--   SECURITY DEFINER + SET search_path = '' with fully-qualified references.
--   EXECUTE granted only to service_role (the admin route uses that client).

CREATE OR REPLACE FUNCTION public.get_marketing_post_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH platforms AS (
    SELECT unnest(ARRAY['x', 'instagram', 'pinterest']) AS platform
  ),
  -- Sum every numeric key found in the engagement jsonb across posted rows.
  engagement_pairs AS (
    SELECT
      p.platform,
      e.key,
      sum((e.value)::numeric) AS total
    FROM public.marketing_posts p
    CROSS JOIN LATERAL jsonb_each(coalesce(p.engagement, '{}'::jsonb)) AS e(key, value)
    WHERE p.status = 'posted'
      AND jsonb_typeof(e.value) = 'number'
    GROUP BY p.platform, e.key
  ),
  -- Per-platform engagement object: { key: total, ... }
  platform_engagement AS (
    SELECT platform, jsonb_object_agg(key, total) AS engagement
    FROM engagement_pairs
    GROUP BY platform
  ),
  -- Total engagement object across all platforms.
  total_engagement AS (
    SELECT jsonb_object_agg(key, total) AS engagement
    FROM (
      SELECT key, sum(total) AS total
      FROM engagement_pairs
      GROUP BY key
    ) s
  ),
  -- Per-platform counts and last-posted timestamp.
  platform_counts AS (
    SELECT
      pl.platform,
      count(*) FILTER (WHERE p.status = 'posted') AS posts,
      count(*) FILTER (WHERE p.status = 'scheduled') AS scheduled,
      max(p.posted_at) FILTER (WHERE p.status = 'posted') AS last_posted_at
    FROM platforms pl
    LEFT JOIN public.marketing_posts p ON p.platform = pl.platform
    GROUP BY pl.platform
  ),
  by_platform AS (
    SELECT jsonb_object_agg(
      pc.platform,
      jsonb_build_object(
        'posts', pc.posts,
        'scheduled', pc.scheduled,
        'engagement', coalesce(pe.engagement, '{}'::jsonb),
        'lastPostedAt', to_jsonb(pc.last_posted_at)
      )
    ) AS obj
    FROM platform_counts pc
    LEFT JOIN platform_engagement pe ON pe.platform = pc.platform
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE status = 'posted') AS total_posts,
      count(*) FILTER (
        WHERE status = 'posted'
          AND posted_at IS NOT NULL
          AND posted_at >= now() - interval '7 days'
      ) AS posts_this_week,
      count(*) FILTER (
        WHERE status = 'posted'
          AND posted_at IS NOT NULL
          AND posted_at >= now() - interval '30 days'
      ) AS posts_this_month,
      count(*) FILTER (WHERE status = 'failed') AS failed_posts
    FROM public.marketing_posts
  )
  SELECT jsonb_build_object(
    'totalPosts', t.total_posts,
    'postsThisWeek', t.posts_this_week,
    'postsThisMonth', t.posts_this_month,
    'failedPosts', t.failed_posts,
    'totalEngagement', coalesce((SELECT engagement FROM total_engagement), '{}'::jsonb),
    'byPlatform', coalesce((SELECT obj FROM by_platform), '{}'::jsonb)
  )
  FROM totals t;
$$;

COMMENT ON FUNCTION public.get_marketing_post_stats() IS
  'Aggregates marketing_posts into the dashboard MarketingStats shape (totals, per-platform counts, engagement sums, last posted) entirely in SQL.';

REVOKE ALL ON FUNCTION public.get_marketing_post_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketing_post_stats() TO service_role;
