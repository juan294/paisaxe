-- 128: owner-approved 90-day PII redaction, preserving replay and payment links.
-- No cron is activated here. Production first redaction requires reviewed dry-run
-- counts and separate authorization. Existing updated_at is not a terminal clock.
ALTER TABLE public.pending_bookings
  ADD COLUMN terminal_at timestamptz,
  ADD COLUMN terminal_anchor_source text,
  ADD COLUMN terminal_anchor_reference text,
  ADD COLUMN pii_redacted_at timestamptz;
ALTER TABLE public.booking_sms_jobs ADD COLUMN pii_redacted_at timestamptz;
COMMENT ON COLUMN public.pending_bookings.terminal_at IS 'Exact observed terminal transition, or explicitly reviewed supported history; never created_at/updated_at inference.';
COMMENT ON COLUMN public.pending_bookings.terminal_anchor_reference IS 'Non-personal reviewed evidence reference. Do not put customer information here.';
CREATE INDEX pending_bookings_retention_terminal ON public.pending_bookings(terminal_at,id)
WHERE pii_redacted_at IS NULL AND status IN ('confirmed','denied','no_answer','failed');

-- Existing event rows record an arrival time but not an outcome snapshot. They
-- cannot establish that the CURRENT terminal state was reached at that time.
-- Therefore no automatic legacy backfill is safe. Unknown anchors remain in the
-- reported hold until reviewed supported history or a NEW observed classification.
CREATE FUNCTION public.guard_booking_retention() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.pii_redacted_at IS NOT NULL THEN
    -- Replay tombstone is immutable to every ordinary writer, including stale
    -- service-role handlers; preserve identity, outcome and terminal anchor.
    NEW.venue_name:=''; NEW.venue_phone:=''; NEW.customer_name:=''; NEW.customer_phone:='';
    NEW.party_size:=0; NEW.booking_date:=''; NEW.booking_time:='';
    NEW.special_requests:=NULL; NEW.outcome_message:=NULL;
    NEW.status:=OLD.status; NEW.terminal_at:=OLD.terminal_at;
    NEW.terminal_anchor_source:=OLD.terminal_anchor_source;
    NEW.terminal_anchor_reference:=OLD.terminal_anchor_reference;
    NEW.pii_redacted_at:=OLD.pii_redacted_at;
    NEW.idempotency_key:=OLD.idempotency_key; NEW.conversation_id:=OLD.conversation_id;
    RETURN NEW;
  END IF;
  IF NEW.status IN ('confirmed','denied','no_answer','failed') THEN
    IF TG_OP='INSERT' THEN
      IF NEW.terminal_at IS NULL THEN NEW.terminal_at:=clock_timestamp(); NEW.terminal_anchor_source:='observed_transition'; END IF;
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.terminal_at:=clock_timestamp(); NEW.terminal_anchor_source:='observed_transition'; NEW.terminal_anchor_reference:=NULL;
    END IF;
  ELSE
    NEW.terminal_at:=NULL; NEW.terminal_anchor_source:=NULL; NEW.terminal_anchor_reference:=NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_booking_retention() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_booking_retention_guard BEFORE INSERT OR UPDATE ON public.pending_bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_booking_retention();

-- This view is service-only, contains no PII and reports all hold reasons.
CREATE VIEW public.booking_retention_eligibility WITH (security_barrier=true) AS
SELECT b.id, b.terminal_at, b.created_at, b.pii_redacted_at,
  CASE
    WHEN b.pii_redacted_at IS NOT NULL THEN 'redacted'
    WHEN b.status NOT IN ('confirmed','denied','no_answer','failed') THEN 'nonterminal_or_reconciliation'
    WHEN b.terminal_at IS NULL THEN 'unknown_terminal_anchor'
    WHEN EXISTS (SELECT 1 FROM public.booking_sms_jobs j WHERE j.booking_id=b.id AND j.status NOT IN ('sent','dead')) THEN 'outstanding_sms'
    WHEN EXISTS (
      SELECT 1 FROM public.payments p JOIN public.bookings linked ON linked.id=p.booking_id
      WHERE p.phone_call_id=b.id AND (
        p.status NOT IN ('captured','refunded','voided','expired','capture_failed')
        OR p.compensation_reason IS NOT NULL
        OR linked.status NOT IN ('confirmed','cancelled','expired','refunded')
        OR (linked.status='confirmed' AND linked.slot_date >= CURRENT_DATE)
        OR (linked.invoice_id IS NOT NULL AND COALESCE(linked.invoice_status,'unknown') NOT IN ('paid','cancelled'))
      )
    ) THEN 'linked_reconciliation'
    -- A phone-confirmation key with no durable payment link is an orphan, even
    -- when a late webhook has changed its call status to a terminal value.
    WHEN b.idempotency_key LIKE 'phone-confirmation:%' AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.phone_call_id=b.id) THEN 'unlinked_phone_confirmation'
    ELSE 'eligible_terminal'
  END AS disposition
FROM public.pending_bookings b;
REVOKE ALL ON public.booking_retention_eligibility FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.booking_retention_eligibility TO service_role;

-- Human review can only start a fresh observed anchor, not manufacture a past
-- timestamp. CAS prevents classification based on an outdated row snapshot.
CREATE FUNCTION public.review_booking_retention_anchor(
  p_booking_id uuid, p_expected_updated_at timestamptz, p_evidence_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_evidence_reference IS NULL OR length(trim(p_evidence_reference))<3 OR length(p_evidence_reference)>200 THEN
    RAISE EXCEPTION 'non_personal_review_reference_required';
  END IF;
  UPDATE public.pending_bookings
  SET terminal_at=clock_timestamp(),terminal_anchor_source='reviewed_observation',terminal_anchor_reference=p_evidence_reference
  WHERE id=p_booking_id AND updated_at=p_expected_updated_at AND terminal_at IS NULL
    AND pii_redacted_at IS NULL AND status IN ('confirmed','denied','no_answer','failed');
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.review_booking_retention_anchor(uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_booking_retention_anchor(uuid,timestamptz,text) TO service_role;

-- RPC writers below acquire parent before SMS. Direct table writers already
-- hold their SMS tuple at BEFORE UPDATE, so NOWAIT makes contention a visible
-- retryable lock error instead of a parent/SMS lock cycle. Replay links cannot
-- be reassigned to another parent during either path.
CREATE FUNCTION public.guard_retained_booking_sms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE retained timestamptz;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.event_key IS DISTINCT FROM OLD.event_key) THEN
    RAISE EXCEPTION 'booking_sms_replay_link_immutable';
  END IF;
  SELECT pii_redacted_at INTO retained FROM public.pending_bookings WHERE id=NEW.booking_id FOR UPDATE NOWAIT;
  IF retained IS NOT NULL OR (TG_OP='UPDATE' AND OLD.pii_redacted_at IS NOT NULL) THEN
    IF TG_OP='INSERT' THEN RETURN NULL; END IF;
    NEW.to_phone:='';NEW.message:='';NEW.last_error:=NULL;NEW.lease_expires_at:=NULL;
    NEW.pii_redacted_at:=COALESCE(OLD.pii_redacted_at,retained);
    NEW.status:=CASE WHEN OLD.status IN ('sent','dead') THEN OLD.status ELSE 'dead' END;
    NEW.booking_id:=OLD.booking_id;NEW.event_key:=OLD.event_key;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_retained_booking_sms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_booking_sms_retention_guard BEFORE INSERT OR UPDATE ON public.booking_sms_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_retained_booking_sms();

-- A new payment must not attach to an already redacted call; otherwise a late
-- reconciliation could create a dependency after the eligibility check.
CREATE FUNCTION public.guard_retained_phone_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE retained timestamptz;
BEGIN
  IF NEW.phone_call_id IS NOT NULL THEN
    SELECT pii_redacted_at INTO retained FROM public.pending_bookings WHERE id=NEW.phone_call_id FOR UPDATE;
    IF retained IS NOT NULL AND (TG_OP='INSERT' OR OLD.phone_call_id IS DISTINCT FROM NEW.phone_call_id) THEN
      RAISE EXCEPTION 'retained_phone_call_cannot_be_linked';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_retained_phone_payment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_phone_payment_retention_guard BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_retained_phone_payment();

CREATE FUNCTION public.redact_expired_bookings(
  p_as_of timestamptz DEFAULT now(), p_batch_limit integer DEFAULT 100, p_dry_run boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; redacted integer:=0; eligible integer:=0; unknown_count integer; dependency_count integer;
  oldest_days integer; expected_count integer; locked_count integer; next_id uuid;
BEGIN
  IF p_as_of IS NULL OR p_batch_limit IS NULL OR p_batch_limit NOT BETWEEN 1 AND 1000 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'invalid_retention_parameters';
  END IF;
  SELECT count(*) FILTER(WHERE disposition='unknown_terminal_anchor'),
    count(*) FILTER(WHERE disposition NOT IN ('unknown_terminal_anchor','eligible_terminal','redacted','nonterminal_or_reconciliation')),
    floor(extract(epoch FROM (p_as_of-min(created_at) FILTER(WHERE disposition NOT IN ('eligible_terminal','redacted'))))/86400)::integer
  INTO unknown_count,dependency_count,oldest_days FROM public.booking_retention_eligibility;
  FOR r IN
    SELECT b.id,b.terminal_at,b.updated_at FROM public.pending_bookings b
    JOIN public.booking_retention_eligibility e ON e.id=b.id
    WHERE e.disposition='eligible_terminal' AND b.terminal_at<=p_as_of-interval '90 days'
    ORDER BY b.terminal_at,b.id LIMIT p_batch_limit FOR UPDATE OF b SKIP LOCKED
  LOOP
    -- Lock existing dependencies without waiting behind a writer that may be
    -- waiting on this parent. A busy dependency makes this batch retain the row.
    SELECT count(*) INTO expected_count FROM public.booking_sms_jobs WHERE booking_id=r.id;
    SELECT count(*) INTO locked_count FROM (SELECT id FROM public.booking_sms_jobs WHERE booking_id=r.id FOR UPDATE SKIP LOCKED) locked;
    IF locked_count<>expected_count THEN dependency_count:=dependency_count+1;CONTINUE;END IF;
    SELECT count(*) INTO expected_count FROM public.payments WHERE phone_call_id=r.id;
    SELECT count(*) INTO locked_count FROM (SELECT id FROM public.payments WHERE phone_call_id=r.id FOR UPDATE SKIP LOCKED) locked;
    IF locked_count<>expected_count THEN dependency_count:=dependency_count+1;CONTINUE;END IF;
    SELECT count(*) INTO expected_count FROM public.bookings WHERE id IN(SELECT booking_id FROM public.payments WHERE phone_call_id=r.id);
    SELECT count(*) INTO locked_count FROM (SELECT id FROM public.bookings WHERE id IN(SELECT booking_id FROM public.payments WHERE phone_call_id=r.id) FOR UPDATE SKIP LOCKED) locked;
    IF locked_count<>expected_count THEN dependency_count:=dependency_count+1;CONTINUE;END IF;
    IF NOT EXISTS(SELECT 1 FROM public.booking_retention_eligibility WHERE id=r.id AND disposition='eligible_terminal') THEN dependency_count:=dependency_count+1;CONTINUE;END IF;
    eligible:=eligible+1;next_id:=r.id;
    IF NOT p_dry_run THEN
      UPDATE public.pending_bookings SET venue_name='',venue_phone='',customer_name='',customer_phone='',party_size=0,booking_date='',booking_time='',special_requests=NULL,outcome_message=NULL,pii_redacted_at=p_as_of
      WHERE id=r.id AND pii_redacted_at IS NULL AND terminal_at=r.terminal_at AND updated_at=r.updated_at;
      IF FOUND THEN
        UPDATE public.booking_sms_jobs SET to_phone='',message='',last_error=NULL,lease_expires_at=NULL,pii_redacted_at=p_as_of WHERE booking_id=r.id AND status IN ('sent','dead');
        redacted:=redacted+1;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('eligible',eligible,'redacted',redacted,'held_unknown_anchor',unknown_count,'held_dependencies',dependency_count,'oldest_hold_days',oldest_days,'next_cursor',next_id,
    'recovery_action','Review booking_retention_eligibility. Resolve reconciliation/SMS holds; use review_booking_retention_anchor with a current updated_at and non-personal review reference for unknown anchors, then wait a full 90 days. Retry failed batches unchanged.');
END $$;
REVOKE ALL ON FUNCTION public.redact_expired_bookings(timestamptz,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redact_expired_bookings(timestamptz,integer,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.process_elevenlabs_event_idempotent(
  p_event_key text,
  p_booking_id uuid,
  p_outcome text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
  v_booking_id uuid;
BEGIN
  PERFORM 1 FROM public.pending_bookings WHERE id=p_booking_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.pending_bookings WHERE id=p_booking_id AND pii_redacted_at IS NOT NULL) THEN RETURN 'retained'; END IF;
  INSERT INTO public.elevenlabs_webhook_events (event_key, booking_id)
  VALUES (p_event_key, p_booking_id)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  UPDATE public.pending_bookings
  SET status = p_outcome
  WHERE id = p_booking_id
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    DELETE FROM public.elevenlabs_webhook_events
    WHERE id = v_inserted;
    RETURN 'booking_missing';
  END IF;

  RETURN 'processed';
END;
$$;

COMMENT ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text) IS
  'Claims an ElevenLabs webhook event once and atomically persists the booking outcome.';

REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text) TO service_role;


-- Both public signatures stay callable. Removing modern trailing defaults
-- avoids PostgREST PGRST203 ambiguity for the legacy three-key request.
DROP FUNCTION public.process_elevenlabs_event_idempotent(text,uuid,text,text,text);
CREATE FUNCTION public.process_elevenlabs_event_idempotent(
  p_event_key text,
  p_booking_id uuid,
  p_outcome text,
  p_to_phone text,
  p_sms_message text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
  v_booking_id uuid;
BEGIN
  PERFORM 1 FROM public.pending_bookings WHERE id=p_booking_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.pending_bookings WHERE id=p_booking_id AND pii_redacted_at IS NOT NULL) THEN RETURN 'retained'; END IF;
  INSERT INTO public.elevenlabs_webhook_events (event_key, booking_id)
  VALUES (p_event_key, p_booking_id)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  UPDATE public.pending_bookings
  SET status = p_outcome
  WHERE id = p_booking_id
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    DELETE FROM public.elevenlabs_webhook_events
    WHERE id = v_inserted;
    RETURN 'booking_missing';
  END IF;

  IF p_to_phone IS NOT NULL AND p_sms_message IS NOT NULL THEN
    INSERT INTO public.booking_sms_jobs (
      event_key,
      booking_id,
      to_phone,
      message,
      status,
      updated_at
    )
    VALUES (
      p_event_key,
      p_booking_id,
      p_to_phone,
      p_sms_message,
      'pending',
      now()
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN 'processed';
END;
$$;

COMMENT ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) IS
  'Claims an ElevenLabs webhook event once and atomically persists the booking outcome and optional SMS outbox row.';

REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) TO service_role;


CREATE OR REPLACE FUNCTION public.enqueue_booking_sms_job(
  p_event_key text,
  p_booking_id uuid,
  p_to_phone text,
  p_message text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  PERFORM 1 FROM public.pending_bookings WHERE id=p_booking_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.pending_bookings WHERE id=p_booking_id AND pii_redacted_at IS NOT NULL) THEN RETURN 'retained'; END IF;
  INSERT INTO public.booking_sms_jobs (
    event_key,
    booking_id,
    to_phone,
    message,
    status,
    lease_expires_at,
    last_error,
    updated_at
  )
  VALUES (
    p_event_key,
    p_booking_id,
    p_to_phone,
    p_message,
    'pending',
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (event_key) DO UPDATE
  SET
    booking_id = EXCLUDED.booking_id,
    to_phone = EXCLUDED.to_phone,
    message = EXCLUDED.message,
    status = CASE
      WHEN public.booking_sms_jobs.status = 'sent' THEN 'sent'
      ELSE 'pending'
    END,
    lease_expires_at = CASE
      WHEN public.booking_sms_jobs.status = 'sent' THEN public.booking_sms_jobs.lease_expires_at
      ELSE NULL
    END,
    last_error = CASE
      WHEN public.booking_sms_jobs.status = 'sent' THEN NULL
      ELSE public.booking_sms_jobs.last_error
    END,
    updated_at = now()
  RETURNING status INTO v_status;

  IF v_status = 'sent' THEN
    RETURN 'sent';
  END IF;

  RETURN 'queued';
END;
$$;

COMMENT ON FUNCTION public.enqueue_booking_sms_job(text, uuid, text, text) IS
  'Enqueues or refreshes a durable SMS delivery job for an ElevenLabs webhook event.';

REVOKE ALL ON FUNCTION public.enqueue_booking_sms_job(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_booking_sms_job(text, uuid, text, text) TO service_role;


REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(text,uuid,text), public.process_elevenlabs_event_idempotent(text,uuid,text,text,text), public.enqueue_booking_sms_job(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(text,uuid,text), public.process_elevenlabs_event_idempotent(text,uuid,text,text,text), public.enqueue_booking_sms_job(text,uuid,text,text) TO service_role;

-- Consistent parent-first ordering for every active SMS mutation RPC. The retry
-- claim first bounds/locks eligible parents deterministically, then locks their
-- SMS jobs with SKIP LOCKED. This prevents enqueue/completion lock inversions.
CREATE OR REPLACE FUNCTION public.claim_booking_sms_job(
  p_event_key text,
  p_lease_seconds integer DEFAULT 900
) RETURNS TABLE (
  booking_id uuid,
  event_key text,
  to_phone text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.pending_bookings b WHERE b.id=(SELECT j.booking_id FROM public.booking_sms_jobs j WHERE j.event_key=p_event_key) FOR UPDATE;
  RETURN QUERY
  WITH candidate AS (
    SELECT j.id
    FROM public.booking_sms_jobs j
    WHERE j.event_key = p_event_key
      AND (
        j.status = 'pending'
        OR j.status = 'failed'
        OR (
          j.status = 'processing'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at <= now()
        )
      )
    ORDER BY j.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.booking_sms_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    updated_at = now()
  FROM candidate
  WHERE j.id = candidate.id
  RETURNING j.booking_id, j.event_key, j.to_phone, j.message;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_booking_sms_job(
  p_event_key text,
  p_provider_sid text DEFAULT NULL,
  p_outcome_message text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  PERFORM 1 FROM public.pending_bookings b WHERE b.id=(SELECT j.booking_id FROM public.booking_sms_jobs j WHERE j.event_key=p_event_key) FOR UPDATE;
  UPDATE public.booking_sms_jobs
  SET
    status = 'sent',
    provider_sid = p_provider_sid,
    sent_at = now(),
    lease_expires_at = NULL,
    last_error = NULL,
    updated_at = now()
  WHERE event_key = p_event_key
  RETURNING booking_id INTO v_booking_id;

  IF p_outcome_message IS NOT NULL AND v_booking_id IS NOT NULL THEN
    UPDATE public.pending_bookings
    SET
      outcome_message = p_outcome_message,
      updated_at = now()
    WHERE id = v_booking_id;
  END IF;

  RETURN v_booking_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_booking_sms_job(
  p_event_key text,
  p_error text,
  p_max_attempts integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.pending_bookings b WHERE b.id=(SELECT j.booking_id FROM public.booking_sms_jobs j WHERE j.event_key=p_event_key) FOR UPDATE;
  UPDATE public.booking_sms_jobs
  SET
    status = CASE
      WHEN p_max_attempts IS NOT NULL AND attempts >= p_max_attempts THEN 'dead'
      ELSE 'failed'
    END,
    lease_expires_at = NULL,
    last_error = p_error,
    updated_at = now()
  WHERE event_key = p_event_key;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_retryable_booking_sms_jobs(
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 900,
  p_max_attempts integer DEFAULT 3
) RETURNS TABLE (
  booking_id uuid,
  event_key text,
  to_phone text,
  message text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH locked_parents AS MATERIALIZED (
    SELECT b.id FROM public.pending_bookings b
    WHERE b.pii_redacted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.booking_sms_jobs j WHERE j.booking_id=b.id
        AND (j.status IN ('pending','failed') OR (j.status='processing' AND j.lease_expires_at<=now()))
        AND j.attempts<GREATEST(p_max_attempts,1)
    )
    ORDER BY b.id LIMIT GREATEST(p_limit,1) FOR UPDATE OF b SKIP LOCKED
  ), candidates AS (
    SELECT j.id
    FROM public.booking_sms_jobs j JOIN locked_parents b ON b.id=j.booking_id
    WHERE (
        j.status IN ('pending', 'failed')
        OR (
          j.status = 'processing'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at <= now()
        )
      )
      AND j.attempts < GREATEST(p_max_attempts, 1)
    ORDER BY j.updated_at, j.created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE OF j SKIP LOCKED
  )
  UPDATE public.booking_sms_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    updated_at = now()
  FROM candidates
  WHERE j.id = candidates.id
  RETURNING j.booking_id, j.event_key, j.to_phone, j.message, j.attempts;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_booking_sms_job(text,integer),public.complete_booking_sms_job(text,text,text),public.fail_booking_sms_job(text,text,integer),public.claim_retryable_booking_sms_jobs(integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_sms_job(text,integer),public.complete_booking_sms_job(text,text,text),public.fail_booking_sms_job(text,text,integer),public.claim_retryable_booking_sms_jobs(integer,integer,integer) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Installed but explicitly inactive. Activation and first production redaction
-- require a reviewed dry-run manifest and the owner's separate authorization.
DO $$ DECLARE retention_job bigint; BEGIN
  retention_job:=cron.schedule('booking-pii-retention','20 2 * * *',
    'SELECT public.redact_expired_bookings(now(),100,false);');
  PERFORM cron.alter_job(retention_job,active:=false);
END $$;
