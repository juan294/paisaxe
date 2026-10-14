-- Forward-only Stripe entitlement ledger. Provider facts and audit claims share
-- the PaymentIntent row lock and transaction with the original purchase grant.
ALTER TABLE public.voice_purchases ADD COLUMN entitlement_state text NOT NULL DEFAULT 'active'
  CHECK (entitlement_state IN ('active','suspended','revoked'));
CREATE TABLE public.stripe_entitlement_payments (
  payment_intent text PRIMARY KEY,
  reconciliation_reasons text[] NOT NULL DEFAULT '{}',
  matched boolean NOT NULL DEFAULT false,
  reconciliation_evidence text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stripe_entitlement_facts (
  kind text NOT NULL CHECK(kind IN ('charge','refund','dispute')),
  object_id text NOT NULL,
  payment_intent text NOT NULL REFERENCES public.stripe_entitlement_payments ON DELETE CASCADE,
  charge_id text,
  amount bigint,
  currency text,
  status text NOT NULL,
  observed_at bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(kind,object_id)
);
CREATE INDEX stripe_entitlement_facts_payment_kind_idx ON public.stripe_entitlement_facts(payment_intent,kind);
ALTER TABLE public.stripe_entitlement_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_entitlement_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_entitlement_payments,public.stripe_entitlement_facts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.stripe_entitlement_payments,public.stripe_entitlement_facts TO service_role;

CREATE FUNCTION public.process_stripe_entitlement_event(
 p_event_id text,p_event_type text,p_payment_intent text,p_facts jsonb,p_grant jsonb DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_claim uuid; v_stored text; v_fact jsonb; v_old public.stripe_entitlement_facts;
 v_purchase public.voice_purchases; v_reasons text[]; v_state text := 'active';
 v_refunded boolean; v_lost boolean; v_open boolean; v_existed boolean;
BEGIN
 IF p_grant IS NOT NULL AND (jsonb_typeof(p_grant)<>'object' OR p_grant->>'user_id' IS NULL OR p_grant->>'expires_at' IS NULL OR p_grant->>'amount_paid' IS NULL OR p_grant->>'purchase_type' IS NULL) THEN RAISE EXCEPTION 'complete grant identity required'; END IF;
 IF p_payment_intent IS NULL OR p_payment_intent='' THEN RAISE EXCEPTION 'payment identity required'; END IF;
 INSERT INTO public.stripe_entitlement_payments(payment_intent) VALUES(p_payment_intent) ON CONFLICT DO NOTHING;
 SELECT reconciliation_reasons INTO v_reasons FROM public.stripe_entitlement_payments WHERE payment_intent=p_payment_intent FOR UPDATE;
 INSERT INTO public.stripe_webhook_events(event_id,event_type,payment_provider_id,user_id,amount_paid,expires_at,purchase_type)
 VALUES(p_event_id,p_event_type,p_payment_intent,(p_grant->>'user_id')::uuid,(p_grant->>'amount_paid')::integer,(p_grant->>'expires_at')::timestamptz,p_grant->>'purchase_type')
 ON CONFLICT(event_id) DO NOTHING RETURNING id INTO v_claim;
 IF v_claim IS NULL THEN RETURN 'duplicate'; END IF;
 FOR v_fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
   IF v_fact->>'kind'='reconciliation' THEN
     v_reasons := array_append(v_reasons,v_fact->>'reason'); CONTINUE;
   END IF;
   SELECT * INTO v_old FROM public.stripe_entitlement_facts WHERE kind=v_fact->>'kind' AND object_id=v_fact->>'id';
   IF FOUND AND (v_old.payment_intent<>p_payment_intent OR
      (v_old.amount IS NOT NULL AND v_fact->>'amount' IS NOT NULL AND v_old.amount<>(v_fact->>'amount')::bigint) OR
      (v_old.currency IS NOT NULL AND v_fact->>'currency' IS NOT NULL AND v_old.currency<>v_fact->>'currency') OR
      (v_old.charge_id IS NOT NULL AND v_fact->>'charge_id' IS NOT NULL AND v_old.charge_id<>v_fact->>'charge_id')) THEN
     v_reasons := array_append(v_reasons,'conflicting_'||(v_fact->>'kind')||':'||(v_fact->>'id')); CONTINUE;
   END IF;
   -- Successful refunds never regress on delayed pending/failed snapshots.
   -- Terminal disputes dominate delayed open events, independent of timestamps.
   IF v_old.kind='refund' AND v_old.status='succeeded' THEN
     IF v_fact->>'status' IN ('failed','canceled') THEN v_reasons:=array_append(v_reasons,'conflicting_refund_status:'||v_old.object_id); END IF;
     CONTINUE;
   END IF;
   IF v_old.kind='dispute' AND v_old.status IN ('won','lost') THEN
     IF v_fact->>'status' IN ('won','lost') AND v_old.status<>v_fact->>'status' THEN
       v_reasons := array_append(v_reasons,'conflicting_dispute_terminal:'||(v_fact->>'id'));
       IF v_fact->>'status'='lost' THEN UPDATE public.stripe_entitlement_facts SET status='lost' WHERE kind=v_old.kind AND object_id=v_old.object_id; END IF;
     END IF;
     CONTINUE;
   END IF;
   IF v_old.object_id IS NOT NULL AND v_old.observed_at>COALESCE((v_fact->>'created')::bigint,0) AND NOT ((v_fact->>'kind'='dispute' AND v_fact->>'status' IN ('won','lost')) OR (v_fact->>'kind'='refund' AND v_fact->>'status'='succeeded')) THEN CONTINUE; END IF;
   INSERT INTO public.stripe_entitlement_facts(kind,object_id,payment_intent,charge_id,amount,currency,status,observed_at)
   VALUES(v_fact->>'kind',v_fact->>'id',p_payment_intent,v_fact->>'charge_id',(v_fact->>'amount')::bigint,v_fact->>'currency',v_fact->>'status',COALESCE((v_fact->>'created')::bigint,0))
   ON CONFLICT(kind,object_id) DO UPDATE SET status=excluded.status,observed_at=excluded.observed_at,
     amount=COALESCE(excluded.amount,stripe_entitlement_facts.amount),currency=COALESCE(excluded.currency,stripe_entitlement_facts.currency),charge_id=COALESCE(excluded.charge_id,stripe_entitlement_facts.charge_id)
   WHERE stripe_entitlement_facts.payment_intent=excluded.payment_intent
     AND (stripe_entitlement_facts.amount IS NULL OR excluded.amount IS NULL OR stripe_entitlement_facts.amount=excluded.amount)
     AND (stripe_entitlement_facts.currency IS NULL OR excluded.currency IS NULL OR stripe_entitlement_facts.currency=excluded.currency)
     AND (stripe_entitlement_facts.charge_id IS NULL OR excluded.charge_id IS NULL OR stripe_entitlement_facts.charge_id=excluded.charge_id)
   RETURNING object_id INTO v_stored;
   IF v_stored IS NOT NULL AND v_fact->>'kind'='charge' AND v_fact->>'status'='complete' THEN v_reasons:=array_remove(array_remove(v_reasons,'incomplete_refund_pagination:'||(v_fact->>'id')),'missing_physical_refunds:'||(v_fact->>'id')); END IF;
   IF v_stored IS NULL THEN v_reasons:=array_append(v_reasons,'conflicting_'||(v_fact->>'kind')||':'||(v_fact->>'id')); END IF;
 END LOOP;
 SELECT * INTO v_purchase FROM public.voice_purchases WHERE payment_provider_id=p_payment_intent;
 v_existed := FOUND;
 IF p_grant IS NOT NULL THEN
   IF v_existed AND (v_purchase.user_id<>(p_grant->>'user_id')::uuid OR v_purchase.purchase_type<>p_grant->>'purchase_type' OR v_purchase.amount_paid<>(p_grant->>'amount_paid')::integer) THEN
     RAISE EXCEPTION 'conflicting purchase identity';
   END IF;
   IF NOT v_existed THEN
     -- No redundant exception subtransaction: any real INSERT failure rolls
     -- back the audit claim, payment row and facts with this transaction.
     INSERT INTO public.voice_purchases(user_id,purchase_type,payment_provider_id,expires_at,amount_paid)
     VALUES((p_grant->>'user_id')::uuid,p_grant->>'purchase_type',p_payment_intent,(p_grant->>'expires_at')::timestamptz,(p_grant->>'amount_paid')::integer)
     RETURNING * INTO v_purchase;
   END IF;
 END IF;
 -- A refund without its captured charge cannot establish a denominator.
 v_reasons:=ARRAY(SELECT reason FROM unnest(v_reasons) reason WHERE reason NOT LIKE 'missing_captured_charge:%' AND reason NOT LIKE 'currency_mismatch:%');
 v_reasons:=v_reasons || ARRAY(SELECT DISTINCT 'missing_captured_charge:'||r.charge_id FROM public.stripe_entitlement_facts r WHERE r.payment_intent=p_payment_intent AND r.kind='refund' AND r.status='succeeded' AND NOT EXISTS(SELECT 1 FROM public.stripe_entitlement_facts c WHERE c.kind='charge' AND c.object_id=r.charge_id AND c.payment_intent=r.payment_intent AND c.amount>0));
 v_reasons:=v_reasons || ARRAY(SELECT 'currency_mismatch:'||r.object_id FROM public.stripe_entitlement_facts r JOIN public.stripe_entitlement_facts c ON c.kind='charge' AND c.object_id=r.charge_id AND c.payment_intent=r.payment_intent WHERE r.payment_intent=p_payment_intent AND r.kind='refund' AND r.currency IS DISTINCT FROM c.currency);
 SELECT EXISTS(SELECT 1 FROM public.stripe_entitlement_facts c WHERE c.payment_intent=p_payment_intent AND c.kind='charge' AND c.amount>0 AND
   c.amount <= (SELECT COALESCE(sum(r.amount),0) FROM public.stripe_entitlement_facts r WHERE r.payment_intent=p_payment_intent AND r.kind='refund' AND r.status='succeeded' AND r.charge_id=c.object_id AND r.currency=c.currency)) INTO v_refunded;
 SELECT EXISTS(SELECT 1 FROM public.stripe_entitlement_facts WHERE payment_intent=p_payment_intent AND kind='dispute' AND status='lost'),
        EXISTS(SELECT 1 FROM public.stripe_entitlement_facts WHERE payment_intent=p_payment_intent AND kind='dispute' AND status IN ('needs_response','under_review','warning_needs_response','warning_under_review')) INTO v_lost,v_open;
 IF v_refunded OR v_lost THEN v_state:='revoked'; ELSIF v_open OR cardinality(v_reasons)>0 THEN v_state:='suspended'; END IF;
 UPDATE public.voice_purchases SET entitlement_state=v_state WHERE payment_provider_id=p_payment_intent;
 UPDATE public.stripe_entitlement_payments SET matched=v_purchase.id IS NOT NULL,reconciliation_reasons=ARRAY(SELECT DISTINCT unnest(v_reasons)),updated_at=now() WHERE payment_intent=p_payment_intent;
 IF p_grant IS NOT NULL THEN RETURN CASE WHEN v_existed THEN 'duplicate' ELSE 'granted' END; END IF;
 RETURN CASE WHEN cardinality(v_reasons)>0 THEN 'reconciliation_required' WHEN v_purchase.id IS NULL THEN 'unmatched' ELSE v_state END;
END $$;
REVOKE ALL ON FUNCTION public.process_stripe_entitlement_event(text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_entitlement_event(text,text,text,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_day_pass_idempotent(p_event_id text,p_event_type text,p_user_id uuid,p_payment_provider_id text,p_expires_at timestamptz,p_amount_paid integer,p_purchase_type text DEFAULT 'day_pass') RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.process_stripe_entitlement_event(p_event_id,p_event_type,p_payment_provider_id,'[]'::jsonb,
 jsonb_build_object('user_id',p_user_id,'expires_at',p_expires_at,'amount_paid',p_amount_paid,'purchase_type',p_purchase_type));
$$;
REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(text,text,uuid,text,timestamptz,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(text,text,uuid,text,timestamptz,integer,text) TO service_role;
CREATE OR REPLACE FUNCTION public.has_active_voice_access(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.voice_purchases WHERE user_id=p_user_id AND expires_at>now() AND entitlement_state='active');
$$;
CREATE OR REPLACE FUNCTION public.get_active_voice_purchase(p_user_id uuid) RETURNS TABLE(id uuid,purchase_type text,expires_at timestamptz,created_at timestamptz) LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT vp.id,vp.purchase_type,vp.expires_at,vp.created_at FROM public.voice_purchases vp WHERE vp.user_id=p_user_id AND vp.expires_at>now() AND vp.entitlement_state='active' ORDER BY vp.expires_at DESC LIMIT 1;
$$;

-- Explicit operator recovery, separate from provider event IDs. The caller must
-- first correct quarantined facts from authoritative evidence in the same
-- transaction. CAS prevents resolving a reason added since the review.
CREATE FUNCTION public.reconcile_stripe_entitlement(p_payment_intent text,p_expected_reasons text[],p_resolved_reasons text[],p_evidence_reference text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_reasons text[]; v_state text; v_refunded boolean; v_lost boolean; v_open boolean;
BEGIN
 IF p_expected_reasons IS NULL OR p_resolved_reasons IS NULL THEN RAISE EXCEPTION 'review reason arrays required'; END IF;
 IF length(trim(p_evidence_reference))<8 OR p_evidence_reference IS NULL THEN RAISE EXCEPTION 'review evidence required'; END IF;
 SELECT reconciliation_reasons INTO v_reasons FROM public.stripe_entitlement_payments WHERE payment_intent=p_payment_intent FOR UPDATE;
 IF NOT FOUND OR v_reasons IS DISTINCT FROM p_expected_reasons OR NOT p_resolved_reasons <@ v_reasons THEN RAISE EXCEPTION 'reconciliation review stale'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.stripe_entitlement_facts c WHERE c.payment_intent=p_payment_intent AND c.kind='charge' AND c.amount>0 AND c.amount <= (SELECT COALESCE(sum(r.amount),0) FROM public.stripe_entitlement_facts r WHERE r.payment_intent=p_payment_intent AND r.kind='refund' AND r.status='succeeded' AND r.charge_id=c.object_id AND r.currency=c.currency)) INTO v_refunded;
 SELECT EXISTS(SELECT 1 FROM public.stripe_entitlement_facts WHERE payment_intent=p_payment_intent AND kind='dispute' AND status='lost'), EXISTS(SELECT 1 FROM public.stripe_entitlement_facts WHERE payment_intent=p_payment_intent AND kind='dispute' AND status IN ('needs_response','under_review','warning_needs_response','warning_under_review')) INTO v_lost,v_open;
 v_reasons:=ARRAY(SELECT reason FROM unnest(v_reasons) reason WHERE NOT reason=ANY(p_resolved_reasons));
 -- Missing charge evidence is an objective gap, never an operator override.
 IF EXISTS(SELECT 1 FROM public.stripe_entitlement_facts r WHERE r.payment_intent=p_payment_intent AND r.kind='refund' AND r.status='succeeded' AND NOT EXISTS(SELECT 1 FROM public.stripe_entitlement_facts c WHERE c.payment_intent=r.payment_intent AND c.kind='charge' AND c.object_id=r.charge_id AND c.amount>0)) THEN RAISE EXCEPTION 'captured charge evidence still missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.stripe_entitlement_facts r JOIN public.stripe_entitlement_facts c ON c.kind='charge' AND c.object_id=r.charge_id AND c.payment_intent=r.payment_intent WHERE r.payment_intent=p_payment_intent AND r.kind='refund' AND r.currency IS DISTINCT FROM c.currency) THEN RAISE EXCEPTION 'refund currency evidence still conflicting'; END IF;
 v_state:=CASE WHEN v_refunded OR v_lost THEN 'revoked' WHEN v_open OR cardinality(v_reasons)>0 THEN 'suspended' ELSE 'active' END;
 UPDATE public.voice_purchases SET entitlement_state=v_state WHERE payment_provider_id=p_payment_intent;
 UPDATE public.stripe_entitlement_payments SET reconciliation_reasons=v_reasons,reconciliation_evidence=p_evidence_reference,updated_at=now() WHERE payment_intent=p_payment_intent;
 RETURN v_state;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_stripe_entitlement(text,text[],text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stripe_entitlement(text,text[],text[],text) TO service_role;
