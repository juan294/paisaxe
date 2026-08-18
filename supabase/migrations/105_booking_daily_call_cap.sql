-- BE-B2: Bound telephony/SMS spend with a SQL-enforced daily cap on outbound
-- booking calls, independent of and in addition to the Redis-based
-- per-customer rate limit added in the application layer
-- (src/app/api/mcp/make-booking/route.ts). The only prior gate on this route
-- was a static shared secret configured inside a third-party ElevenLabs
-- agent — a leak of that secret (stored outside Vercel env) would otherwise
-- become an unmetered dialer with no ceiling. A Redis-only limit is not
-- durable/auditable enough for a cost ceiling on real-money telephony, so
-- this cap lives in Postgres as the source of truth.

CREATE TABLE IF NOT EXISTS public.booking_daily_call_counters (
  counter_date date PRIMARY KEY,
  call_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.booking_daily_call_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_daily_call_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.booking_daily_call_counters TO service_role;

-- Atomically claims one of today's outbound-call slots. Returns true (and
-- increments the counter) when under the cap, false once the cap is
-- reached. The INSERT ... ON CONFLICT DO UPDATE ... WHERE guard makes the
-- increment and the cap check a single atomic statement, so concurrent
-- callers cannot race past the limit (no read-then-write window).
CREATE OR REPLACE FUNCTION public.claim_daily_booking_call_slot(
  p_max_per_day integer DEFAULT 100
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.booking_daily_call_counters (counter_date, call_count)
  VALUES (current_date, 1)
  ON CONFLICT (counter_date) DO UPDATE
    SET call_count = public.booking_daily_call_counters.call_count + 1
    WHERE public.booking_daily_call_counters.call_count < GREATEST(p_max_per_day, 0)
  RETURNING call_count INTO v_count;

  -- v_count is NULL when the ON CONFLICT DO UPDATE's WHERE clause suppressed
  -- the update (cap already reached) and no INSERT happened either.
  RETURN v_count IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.claim_daily_booking_call_slot(integer) IS
  'Atomically claims one outbound booking call slot for today, enforcing a hard SQL-level daily cap; returns false once the cap is reached.';

REVOKE ALL ON FUNCTION public.claim_daily_booking_call_slot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_booking_call_slot(integer) TO service_role;
