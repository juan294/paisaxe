-- One-time compatibility repair of historical migration053 drift, NOT full053 parity.
-- Preserve legacy NULL request identities; do not fabricate/backfill keys.
-- Retention remains absent/inactive. A legacy NULL-key hold is REQUIRED before activation.
-- Target transport MUST independently bind project axoishtlumlswzhegseq; SQL does not discover project identity.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.pending_bookings IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE compatibility053_expected (value jsonb) ON COMMIT DROP;
INSERT INTO compatibility053_expected VALUES ($expected${"constraints":[{"definition":"UNIQUE (conversation_id)","name":"pending_bookings_conversation_id_key"},{"definition":"PRIMARY KEY (id)","name":"pending_bookings_pkey"}],"indexes":["CREATE INDEX idx_pending_bookings_conversation_id ON public.pending_bookings USING btree (conversation_id)","CREATE INDEX idx_pending_bookings_customer_phone ON public.pending_bookings USING btree (customer_phone)","CREATE INDEX idx_pending_bookings_status ON public.pending_bookings USING btree (status)","CREATE UNIQUE INDEX pending_bookings_conversation_id_key ON public.pending_bookings USING btree (conversation_id)","CREATE UNIQUE INDEX pending_bookings_pkey ON public.pending_bookings USING btree (id)"],"ledger":["001","002","003","004","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089","090","091","092","093","094","095","096","097","098","099","100","101","102","103","104","105","106","107","108","109","110","111","112","113","114","115","116","117","118","119","120","121","122","123","124","125","126","127"],"columns":[{"default":"gen_random_uuid()","name":"id","nullable":"NO","table":"pending_bookings","type":"uuid"},{"default":null,"name":"conversation_id","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"venue_name","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"venue_phone","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"customer_name","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"customer_phone","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"party_size","nullable":"NO","table":"pending_bookings","type":"int4"},{"default":null,"name":"booking_date","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"booking_time","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"special_requests","nullable":"YES","table":"pending_bookings","type":"text"},{"default":"'pending'::text","name":"status","nullable":"NO","table":"pending_bookings","type":"text"},{"default":null,"name":"outcome_message","nullable":"YES","table":"pending_bookings","type":"text"},{"default":"now()","name":"created_at","nullable":"YES","table":"pending_bookings","type":"timestamptz"},{"default":"now()","name":"updated_at","nullable":"YES","table":"pending_bookings","type":"timestamptz"}]}$expected$::jsonb);
DO $guard$
DECLARE actual jsonb; expected jsonb;
BEGIN
 SELECT value INTO expected FROM compatibility053_expected;
 SELECT jsonb_build_object(
 'ledger',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='pending_bookings'),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.pending_bookings'::regclass),
 'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='pending_bookings')) INTO actual;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'compatibility053_schema_or_ledger_drift'; END IF;
 IF to_regclass('public.booking_retention_eligibility') IS NOT NULL
 OR to_regclass('public.idx_pending_bookings_idempotency_key') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.pending_bookings'::regclass AND attname='idempotency_key' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'compatibility053_prerequisite_already_changed'; END IF;
END $guard$;
CREATE TEMP TABLE compatibility053_rows ON COMMIT DROP AS
 SELECT id,to_jsonb(b) AS original,md5(to_jsonb(b)::text) AS row_hash FROM public.pending_bookings b;
CREATE TEMP VIEW compatibility053_security AS
 SELECT jsonb_build_object(
 'relation',(SELECT jsonb_build_object('owner',relowner,'rls',relrowsecurity,'forced',relforcerowsecurity,'acl',relacl) FROM pg_class WHERE oid='public.pending_bookings'::regclass),
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'acl',attacl) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.pending_bookings'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'idempotency_key'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public' AND tablename='pending_bookings'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled,'function',pg_get_functiondef(tgfoid)) ORDER BY oid) FROM pg_trigger WHERE tgrelid='public.pending_bookings'::regclass)) AS value;
CREATE TEMP TABLE compatibility053_security_before ON COMMIT DROP AS SELECT * FROM compatibility053_security;
ALTER TABLE public.pending_bookings ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX idx_pending_bookings_idempotency_key ON public.pending_bookings(idempotency_key);
ALTER TABLE public.pending_bookings ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE public.pending_bookings ALTER COLUMN status SET DEFAULT 'initiating';
DO $verify$
DECLARE expected jsonb; after_columns jsonb; wanted_columns jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM compatibility053_rows old FULL JOIN public.pending_bookings b USING(id)
 WHERE old.id IS NULL OR b.id IS NULL OR b.idempotency_key IS NOT NULL
 OR old.original IS DISTINCT FROM (to_jsonb(b)-'idempotency_key')
 OR old.row_hash IS DISTINCT FROM md5((to_jsonb(b)-'idempotency_key')::text))
 THEN RAISE EXCEPTION 'compatibility053_row_preservation_failed'; END IF;
 IF (SELECT value FROM compatibility053_security) IS DISTINCT FROM (SELECT value FROM compatibility053_security_before)
 THEN RAISE EXCEPTION 'compatibility053_security_metadata_changed'; END IF;
 SELECT value INTO expected FROM compatibility053_expected;
 SELECT jsonb_agg(CASE WHEN value->>'name'='conversation_id' THEN value||'{"nullable":"YES"}'::jsonb WHEN value->>'name'='status' THEN value||jsonb_build_object('default',quote_literal('initiating')||'::text') ELSE value END ORDER BY ord)
 INTO wanted_columns FROM jsonb_array_elements(expected->'columns') WITH ORDINALITY AS e(value,ord);
 wanted_columns:=wanted_columns||jsonb_build_array(jsonb_build_object('table','pending_bookings','name','idempotency_key','type','text','nullable','YES','default',NULL));
 SELECT jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) ORDER BY ordinal_position) INTO after_columns FROM information_schema.columns WHERE table_schema='public' AND table_name='pending_bookings';
 IF after_columns IS DISTINCT FROM wanted_columns THEN RAISE EXCEPTION 'compatibility053_result_columns_mismatch'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.pending_bookings'::regclass) IS DISTINCT FROM expected->'constraints'
 OR (SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='pending_bookings' AND indexname<>'idx_pending_bookings_idempotency_key') IS DISTINCT FROM expected->'indexes'
 THEN RAISE EXCEPTION 'compatibility053_existing_constraint_or_index_changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid='public.idx_pending_bookings_idempotency_key'::regclass AND indisunique AND indisvalid AND indisready AND indpred IS NULL AND indexprs IS NULL AND indnatts=1 AND indkey::text=(SELECT attnum::text FROM pg_attribute WHERE attrelid='public.pending_bookings'::regclass AND attname='idempotency_key')) THEN RAISE EXCEPTION 'compatibility053_unique_index_invalid'; END IF;
 IF (SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM expected->'ledger' OR to_regclass('public.booking_retention_eligibility') IS NOT NULL THEN RAISE EXCEPTION 'compatibility053_retention_or_ledger_changed'; END IF;
END $verify$;
DROP VIEW compatibility053_security;
SELECT jsonb_build_object('status','verified_before_commit','preserved_rows',(SELECT count(*) FROM compatibility053_rows),'legacy_null_keys',(SELECT count(*) FROM public.pending_bookings WHERE idempotency_key IS NULL),'row_values_unchanged',true,'security_metadata_unchanged',true,'ledger_changed',false,'source053_not_null_parity',false,'retention_installed',false,'legacy_null_hold_required_before_retention_activation',true) AS compatibility053_receipt;
COMMIT;
