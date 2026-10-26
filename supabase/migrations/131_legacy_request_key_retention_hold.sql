-- 131: forward reconciliation of historical migration 053 drift and an explicit
-- retention hold for legacy calls without a request key (#1032).
--
-- Two shapes of pending_bookings reach this migration:
--   Fresh reset (053 as edited by ba17dc9e): idempotency_key NOT NULL, and the
--     partial unique index idx_pending_bookings_conversation_id.
--   1.9.0 production (original 053 plus the one-time compatibility repair in
--     docs/release/1.9.0-historical-schema-reconciliation.sql): idempotency_key
--     nullable with legacy NULL rows, the UNIQUE constraint
--     pending_bookings_conversation_id_key and a plain lookup index.
-- Both converge on one schema. Legacy NULL keys stay NULL: no request identity
-- is rewritten or fabricated, and no existing row is updated. A NOT NULL
-- constraint cannot coexist with those rows, so a trigger requires the key on
-- every new row instead. Any other shape aborts the migration unchanged.
-- Repeatable: a second run finds the converged shape and changes nothing.
-- Retention stays inactive; this migration runs no redaction.
SET LOCAL lock_timeout = '5s';

DO $shape$
DECLARE
  key_attnum smallint;
  conversation_attnum smallint;
  conversation_index record;
  legacy_constraint boolean;
BEGIN
  SELECT attnum INTO key_attnum FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.pending_bookings'::regclass AND attname = 'idempotency_key'
    AND NOT attisdropped AND atttypid = 'pg_catalog.text'::regtype;
  IF key_attnum IS NULL THEN
    RAISE EXCEPTION 'pending_bookings_request_key_column_unrecognized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index
    WHERE indexrelid = to_regclass('public.idx_pending_bookings_idempotency_key')
      AND indrelid = 'public.pending_bookings'::regclass
      AND indisunique AND indisvalid AND indpred IS NULL AND indexprs IS NULL
      AND indnatts = 1 AND indkey[0] = key_attnum
  ) THEN
    RAISE EXCEPTION 'pending_bookings_request_key_index_unrecognized';
  END IF;

  SELECT attnum INTO conversation_attnum FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.pending_bookings'::regclass AND attname = 'conversation_id' AND NOT attisdropped;
  SELECT indisunique AS is_unique, pg_catalog.pg_get_expr(indpred, indrelid) AS predicate,
    (indnatts = 1 AND indkey[0] = conversation_attnum AND indexprs IS NULL AND indisvalid) AS on_conversation
  INTO conversation_index FROM pg_catalog.pg_index
  WHERE indexrelid = to_regclass('public.idx_pending_bookings_conversation_id')
    AND indrelid = 'public.pending_bookings'::regclass;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.pending_bookings'::regclass AND conname = 'pending_bookings_conversation_id_key'
      AND contype = 'u' AND conkey = ARRAY[conversation_attnum]
  ) INTO legacy_constraint;

  IF conversation_index.on_conversation AND conversation_index.is_unique
     AND conversation_index.predicate = '(conversation_id IS NOT NULL)' AND NOT legacy_constraint THEN
    NULL; -- already the fresh-reset shape
  ELSIF conversation_index.on_conversation AND NOT conversation_index.is_unique
     AND conversation_index.predicate IS NULL AND legacy_constraint THEN
    -- Build the replacement first so conversation_id is never without a
    -- uniqueness guarantee. NULLs were already distinct under the constraint,
    -- so the partial index admits exactly the same rows.
    CREATE UNIQUE INDEX pending_bookings_conversation_id_131 ON public.pending_bookings (conversation_id)
      WHERE conversation_id IS NOT NULL;
    ALTER TABLE public.pending_bookings DROP CONSTRAINT pending_bookings_conversation_id_key;
    DROP INDEX public.idx_pending_bookings_conversation_id;
    ALTER INDEX public.pending_bookings_conversation_id_131 RENAME TO idx_pending_bookings_conversation_id;
  ELSE
    RAISE EXCEPTION 'pending_bookings_conversation_index_unrecognized';
  END IF;
END $shape$;

ALTER TABLE public.pending_bookings ALTER COLUMN idempotency_key DROP NOT NULL;
ALTER TABLE public.pending_bookings ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE public.pending_bookings ALTER COLUMN status SET DEFAULT 'initiating';
COMMENT ON COLUMN public.pending_bookings.idempotency_key IS
  'Caller-supplied request claim key, unique and required for every new row. NULL only on legacy calls that predate the claim protocol; those are held from retention (booking_retention_eligibility: legacy_null_request_key).';

-- A NULL key is legacy history, never a new request. Its presence cannot change
-- in either direction: filling it would fabricate a historical identity and
-- clearing it would escape the insert rule. The SQLSTATE matches NOT NULL, so
-- callers see the same error as before.
CREATE OR REPLACE FUNCTION public.guard_pending_booking_request_key() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'not_null_violation',
      MESSAGE = 'null value in column "idempotency_key" of relation "pending_bookings" violates the request key rule',
      SCHEMA = 'public', TABLE = 'pending_bookings', COLUMN = 'idempotency_key';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.idempotency_key IS NULL) <> (NEW.idempotency_key IS NULL) THEN
    RAISE EXCEPTION 'pending_booking_request_key_presence_immutable';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_pending_booking_request_key() FROM PUBLIC, anon, authenticated;
-- Fires after a_booking_retention_guard, which restores a redacted row's key.
CREATE OR REPLACE TRIGGER a_pending_booking_request_key_guard BEFORE INSERT OR UPDATE ON public.pending_bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_pending_booking_request_key();

-- Same view as 128 with one hold placed before every other classification: a
-- legacy call's identity cannot be recovered, so neither a new terminal
-- transition nor a reviewed anchor releases it. Only a separate owner decision
-- can. Before this, NULL LIKE 'phone-confirmation:%' fell through to eligible.
CREATE OR REPLACE VIEW public.booking_retention_eligibility WITH (security_barrier=true) AS
SELECT b.id, b.terminal_at, b.created_at, b.pii_redacted_at,
  CASE
    WHEN b.pii_redacted_at IS NOT NULL THEN 'redacted'
    WHEN b.idempotency_key IS NULL THEN 'legacy_null_request_key'
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

-- Same function as 128, except legacy holds are reported on their own instead
-- of as dependencies, and both the batch query and the redaction UPDATE also
-- refuse a NULL key directly.
CREATE OR REPLACE FUNCTION public.redact_expired_bookings(
  p_as_of timestamptz DEFAULT now(), p_batch_limit integer DEFAULT 100, p_dry_run boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; redacted integer:=0; eligible integer:=0; unknown_count integer; legacy_count integer; dependency_count integer;
  oldest_days integer; expected_count integer; locked_count integer; next_id uuid;
BEGIN
  IF p_as_of IS NULL OR p_batch_limit IS NULL OR p_batch_limit NOT BETWEEN 1 AND 1000 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'invalid_retention_parameters';
  END IF;
  SELECT count(*) FILTER(WHERE disposition='unknown_terminal_anchor'),
    count(*) FILTER(WHERE disposition='legacy_null_request_key'),
    count(*) FILTER(WHERE disposition NOT IN ('unknown_terminal_anchor','legacy_null_request_key','eligible_terminal','redacted','nonterminal_or_reconciliation')),
    floor(extract(epoch FROM (p_as_of-min(created_at) FILTER(WHERE disposition NOT IN ('eligible_terminal','redacted'))))/86400)::integer
  INTO unknown_count,legacy_count,dependency_count,oldest_days FROM public.booking_retention_eligibility;
  FOR r IN
    SELECT b.id,b.terminal_at,b.updated_at FROM public.pending_bookings b
    JOIN public.booking_retention_eligibility e ON e.id=b.id
    WHERE e.disposition='eligible_terminal' AND b.idempotency_key IS NOT NULL AND b.terminal_at<=p_as_of-interval '90 days'
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
      WHERE id=r.id AND pii_redacted_at IS NULL AND idempotency_key IS NOT NULL AND terminal_at=r.terminal_at AND updated_at=r.updated_at;
      IF FOUND THEN
        UPDATE public.booking_sms_jobs SET to_phone='',message='',last_error=NULL,lease_expires_at=NULL,pii_redacted_at=p_as_of WHERE booking_id=r.id AND status IN ('sent','dead');
        redacted:=redacted+1;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('eligible',eligible,'redacted',redacted,'held_unknown_anchor',unknown_count,'held_legacy_null_request_key',legacy_count,'held_dependencies',dependency_count,'oldest_hold_days',oldest_days,'next_cursor',next_id,
    'recovery_action','Review booking_retention_eligibility. Resolve reconciliation/SMS holds; use review_booking_retention_anchor with a current updated_at and non-personal review reference for unknown anchors, then wait a full 90 days. Retry failed batches unchanged. legacy_null_request_key rows are never redacted here; releasing them needs a separate owner decision.');
END $$;
REVOKE ALL ON FUNCTION public.redact_expired_bookings(timestamptz,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redact_expired_bookings(timestamptz,integer,boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
