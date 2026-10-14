-- Shadow staging is private. Legacy serving is explicit and is not a rights approval.
-- No existing content or storage object is deleted by this migration.
SET search_path = public, extensions;

CREATE TABLE public.corpus_versions (
  version text PRIMARY KEY CHECK (version ~ '^[a-z0-9][a-z0-9-]{0,79}$' AND version <> 'legacy'),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^[a-f0-9]{64}$'),
  manifest_payload text NOT NULL,
  manifest jsonb NOT NULL,
  approvals jsonb,
  approved boolean NOT NULL DEFAULT false,
  rights_revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.corpus_selection (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_version text REFERENCES public.corpus_versions(version),
  generation bigint NOT NULL DEFAULT 0
);
INSERT INTO public.corpus_selection(singleton) VALUES(true);
CREATE TABLE public.corpus_chunks (
  version text NOT NULL REFERENCES public.corpus_versions(version),
  id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) > 0),
  title text NOT NULL,
  citation jsonb NOT NULL,
  image_refs text[] NOT NULL DEFAULT '{}',
  embedding extensions.vector(512) NOT NULL,
  row_hash text NOT NULL,
  payload text NOT NULL,
  PRIMARY KEY(version,id)
);
CREATE INDEX corpus_chunks_embedding_idx ON public.corpus_chunks USING hnsw(embedding extensions.vector_cosine_ops);
CREATE TABLE public.corpus_images (
  version text NOT NULL REFERENCES public.corpus_versions(version),
  id uuid NOT NULL,
  path text NOT NULL,
  provenance text NOT NULL,
  payload text NOT NULL,
  row_hash text NOT NULL,
  PRIMARY KEY(version,id),
  UNIQUE(version,path)
);
CREATE TABLE public.story_image_drafts (
  story_id uuid PRIMARY KEY REFERENCES public.stories(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  requested_path text,
  requested_source text,
  status text NOT NULL DEFAULT 'permission-review-required' CHECK (status='permission-review-required'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.corpus_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_image_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_image_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.story_image_drafts TO service_role;
REVOKE ALL ON public.corpus_versions,public.corpus_selection,public.corpus_chunks,public.corpus_images FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.corpus_versions,public.corpus_selection,public.corpus_chunks,public.corpus_images TO service_role;

CREATE FUNCTION public.image_provenance_valid(p jsonb,asset_url text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE date_value date;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'crop') IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['status','flow','assetUrl','sourcePage','license','originalSha256','replacementSha256','reviewReceipt','date','photographer','credit','permission','reviewer','alt','context']) k WHERE jsonb_typeof(p->k) IS DISTINCT FROM 'string')
    OR jsonb_typeof(p->'crop'->'mobile') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'crop'->'desktop') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  date_value := (p->>'date')::date;
  RETURN coalesce(p->>'status'='approved' AND p->>'flow'='manual' AND p->>'assetUrl'=asset_url
    AND ((asset_url ~* '^https://[a-z0-9.-]+(:[0-9]+)?([/?#]|$)') OR (asset_url ~ '^/[a-zA-Z0-9_./-]+$' AND asset_url NOT LIKE '//%' AND asset_url !~ '(^|/)\.\.(/|$)'))
    AND p->>'sourcePage' ~* '^https://[a-z0-9.-]+(:[0-9]+)?([/?#]|$)'
    AND p->>'license' IN ('owner-permission','CC0-1.0','CC-BY-4.0','Unsplash-manual')
    AND p->>'originalSha256' ~ '^[a-f0-9]{64}$' AND p->>'replacementSha256' ~ '^[a-f0-9]{64}$' AND p->>'reviewReceipt' ~ '^[a-f0-9]{64}$'
    AND length(btrim(p->>'photographer'))>0 AND length(btrim(p->>'credit'))>0 AND length(btrim(p->>'permission'))>0
    AND length(btrim(p->>'reviewer'))>0 AND length(btrim(p->>'alt'))>0 AND length(btrim(p->'crop'->>'mobile'))>0 AND length(btrim(p->'crop'->>'desktop'))>0
    AND p->>'context' IN ('named-place','thematic') AND p->>'date' ~ '^\d{4}-\d{2}-\d{2}$' AND date_value::text=p->>'date',false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.image_provenance_valid(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.image_provenance_valid(jsonb,text) TO service_role;

CREATE FUNCTION public.active_corpus_version() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected text;
BEGIN
  SELECT active_version INTO selected FROM public.corpus_selection WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'corpus_selection_unavailable'; END IF;
  IF selected IS NULL THEN RETURN 'legacy'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.corpus_versions WHERE version=selected AND approved AND NOT rights_revoked) THEN
    RAISE EXCEPTION 'corpus_selection_unavailable';
  END IF;
  RETURN selected;
END $$;
REVOKE ALL ON FUNCTION public.active_corpus_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_corpus_version() TO anon,authenticated,service_role;

-- Staging is resumable and immutable: an interrupted batch never changes selection.
-- Each JSON payload is canonicalized and hashed by the offline validator, then
-- independently hashed here before any insert. A changed retry is an error.
CREATE FUNCTION public.official_corpus_source_valid(s jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE o jsonb := s->'official'; fields jsonb := o->'fields'; dataset text := o->>'dataset';
  source_url text; source_title text; expected_fields text[]; projection text; expected_attribution text;
  whitespace text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
  IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR jsonb_typeof(fields) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  CASE dataset
    WHEN 'asturias-restaurants' THEN
      source_url := 'https://www.turismoasturiasprofesional.es/open-data/turismoasturias'; source_title := 'Restaurantes y sidrerías';
      expected_fields := ARRAY['Nombre.content','CodigoDGT.content','Contacto.Concejo.content'];
    WHEN 'asturias-beaches' THEN
      source_url := 'https://sig.asturias.es/servicios/rest/services/Visor/Turismo/MapServer/2'; source_title := 'Turismo — Playas (capa 2)';
      expected_fields := ARRAY['objectid','nombre','concejo'];
    WHEN 'asturias-viewpoints' THEN
      source_url := 'https://sig.asturias.es/servicios/rest/services/Visor/Turismo/MapServer/6'; source_title := 'Turismo — Miradores (capa 6)';
      expected_fields := ARRAY['objectid','nombre','concejo'];
    ELSE RETURN false;
  END CASE;
  IF o - ARRAY['dataset','snapshotSha256','recordId','rowIndex','fields','projectionSha256','termsEvidenceSha256','termsDispositionSha256','publisherUpdatedAt','publisherRevision','productYear'] <> '{}'::jsonb
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['snapshotSha256','projectionSha256','termsEvidenceSha256','termsDispositionSha256']) k
      WHERE jsonb_typeof(o->k) IS DISTINCT FROM 'string' OR coalesce(o->>k,'') !~ '^[a-f0-9]{64}$')
    OR jsonb_typeof(o->'recordId') IS DISTINCT FROM 'string' OR length(btrim(coalesce(o->>'recordId',''),whitespace))=0
    OR jsonb_typeof(o->'rowIndex') IS DISTINCT FROM 'number' OR coalesce(o->>'rowIndex','') !~ '^[0-9]+$'
    OR (o->>'rowIndex')::numeric>9007199254740991
    OR o->'publisherUpdatedAt' IS DISTINCT FROM 'null'::jsonb OR o->'publisherRevision' IS DISTINCT FROM 'null'::jsonb OR o->'productYear' IS DISTINCT FROM 'null'::jsonb
    OR (SELECT count(*) FROM jsonb_object_keys(fields))<>3
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(fields) k WHERE NOT k=ANY(expected_fields))
    OR EXISTS(SELECT 1 FROM unnest(expected_fields) k WHERE k<>'objectid' AND
      (jsonb_typeof(fields->k) IS DISTINCT FROM 'string' OR length(btrim(coalesce(fields->>k,''),whitespace))=0)) THEN RETURN false; END IF;
  IF dataset='asturias-restaurants' THEN
    IF o->>'recordId' IS DISTINCT FROM fields->>'CodigoDGT.content' THEN RETURN false; END IF;
  ELSE
    IF jsonb_typeof(fields->'objectid') IS DISTINCT FROM 'number' OR coalesce(fields->>'objectid','') !~ '^[1-9][0-9]*$'
      OR (fields->>'objectid')::numeric>9007199254740991 OR o->>'recordId' IS DISTINCT FROM fields->>'objectid' THEN RETURN false; END IF;
  END IF;
  SELECT '{'||string_agg(to_jsonb(key)::text||':'||value::text,',' ORDER BY key COLLATE "C")||'}' INTO projection FROM jsonb_each(fields);
  expected_attribution := 'Administración del Principado de Asturias · '||source_title||' · '||(o->>'recordId')||' · actualización no facilitada · año del producto no facilitado · consulta '||left(s->>'retrievedAt',10)||' · campos sin modificar; selección y redacción propia; sin respaldo del editor';
  RETURN coalesce(s->>'allowedUse'='official-structured-facts' AND s->>'namespace'='official-dataset' AND s->>'license'='CC-BY-4.0'
    AND s->>'canonicalUrl'=source_url AND s->>'revision'='sha256:'||(o->>'snapshotSha256') AND s->>'evidenceSha256'=o->>'snapshotSha256'
    AND o->>'projectionSha256'=encode(extensions.digest(projection,'sha256'),'hex') AND s->>'attribution'=expected_attribution
    AND (s->>'refreshAfter')::date <= ((s->>'retrievedAt')::timestamptz AT TIME ZONE 'UTC')::date+90,false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.official_corpus_source_valid(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.official_corpus_source_valid(jsonb) TO service_role;

CREATE FUNCTION public.stage_corpus(p_manifest text,p_hash text,p_rows jsonb,p_images jsonb DEFAULT '[]') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m jsonb := p_manifest::jsonb; v text := m->>'version'; item jsonb; row jsonb; expected text; old text; inserted integer := 0;
BEGIN
  IF encode(extensions.digest(p_manifest,'sha256'),'hex') IS DISTINCT FROM p_hash OR m->>'model' IS DISTINCT FROM 'voyage-context-3'
     OR (m->>'dimensions')::integer IS DISTINCT FROM 512 OR jsonb_typeof(m->'chunks') IS DISTINCT FROM 'array'
     OR jsonb_typeof(m->'images') IS DISTINCT FROM 'array' OR jsonb_typeof(m->'sources') IS DISTINCT FROM 'array'
     OR coalesce(m->>'contentHash','') !~ '^[a-f0-9]{64}$' OR jsonb_array_length(m->'chunks')=0
     OR m->'rights'->>'contentHash' IS DISTINCT FROM m->>'contentHash'
     OR m->'overlap'->>'contentHash' IS DISTINCT FROM m->>'contentHash' THEN RAISE EXCEPTION 'invalid_corpus_manifest'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(m->'sources') s WHERE
    coalesce(s->>'reviewReceiptSha256','') !~ '^[a-f0-9]{64}$' OR coalesce(s->>'revision','')='' OR
    NOT coalesce(((s->>'allowedUse'='structured-facts' AND s->>'license'='CC0-1.0' AND s->>'namespace'='main' AND s->>'canonicalUrl' ~ '^https://www\.wikidata\.org/(wiki|entity)/Q[1-9][0-9]*$' AND NOT s ? 'official') OR
      (s->>'allowedUse'='owner-material' AND s->>'license'='owner-permission' AND s->>'namespace'='owner' AND NOT s ? 'official') OR public.official_corpus_source_valid(s)),false))
    THEN RAISE EXCEPTION 'invalid_corpus_source'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(m->'facts') f JOIN jsonb_array_elements(m->'sources') s ON s->>'id'=f->>'sourceId'
    WHERE s->>'allowedUse'='official-structured-facts' AND (NOT (s->'official'->'fields') ? (f->>'property')
      OR f->'value' IS DISTINCT FROM s->'official'->'fields'->(f->>'property') OR f->>'statementId' IS DISTINCT FROM (s->'official'->>'recordId')||':'||(f->>'property')))
    THEN RAISE EXCEPTION 'invalid_official_corpus_fact'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(m->'sources') s WHERE
    coalesce(s->>'refreshAfter','') !~ '^\d{4}-\d{2}-\d{2}$' OR ((s->>'refreshAfter')::date::timestamp AT TIME ZONE 'UTC') < now()
    OR coalesce(s->>'retrievedAt','')='' OR (s->>'retrievedAt')::timestamptz > now()
    OR (s->>'allowedUse'='structured-facts' AND coalesce(s->>'revision','') !~ '^[1-9][0-9]*$'))
    THEN RAISE EXCEPTION 'corpus_source_needs_refresh'; END IF;
  INSERT INTO public.corpus_versions(version,manifest_hash,manifest_payload,manifest) VALUES(v,p_hash,p_manifest,m)
    ON CONFLICT(version) DO NOTHING;
  SELECT manifest_hash INTO old FROM public.corpus_versions WHERE version=v FOR UPDATE;
  IF old IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'corpus_manifest_changed'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    row := (item->>'payload')::jsonb;
    -- The manifest stores an ordered [{id,hash}] inventory, not arbitrary IDs.
    SELECT value->>'hash' INTO expected FROM jsonb_array_elements(m->'chunks') WHERE value->>'id'=row->>'id';
    IF expected IS NULL OR expected IS DISTINCT FROM item->>'hash' OR encode(extensions.digest(item->>'payload','sha256'),'hex') IS DISTINCT FROM expected
      OR jsonb_array_length(row->'embedding') IS DISTINCT FROM 512 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row->'embedding') n WHERE n::text::double precision<>0)
      OR coalesce(row->'citation'->>'url','') NOT LIKE 'https://%' OR length(btrim(coalesce(row->'citation'->>'title','')))=0 OR length(btrim(coalesce(row->'citation'->>'attribution','')))=0
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'sources') s WHERE s->>'canonicalUrl'=row->'citation'->>'url' AND s->>'license'=row->'citation'->>'license' AND s->>'revision'=row->'citation'->>'revision')
      OR jsonb_typeof(row->'sourceIds') IS DISTINCT FROM 'array' OR jsonb_typeof(row->'factIds') IS DISTINCT FROM 'array'
      OR jsonb_array_length(row->'factIds')=0 OR jsonb_array_length(row->'sourceIds')=0
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'documents') d WHERE d->>'id'=row->>'documentId' AND d->>'version'=v AND d->>'title'=row->>'title' AND d->'chunkIds' ? (row->>'id'))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(row->'sourceIds') sid WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'sources') s WHERE s->>'id'=sid))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(row->'factIds') fid WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'facts') f WHERE f->>'id'=fid AND row->'sourceIds' ? (f->>'sourceId')))
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'facts') f JOIN jsonb_array_elements(m->'sources') s ON s->>'id'=f->>'sourceId' WHERE row->'factIds' ? (f->>'id') AND row->'sourceIds' ? (s->>'id') AND s->>'canonicalUrl'=row->'citation'->>'url' AND s->>'license'=row->'citation'->>'license' AND s->>'revision'=row->'citation'->>'revision' AND s->>'attribution'=row->'citation'->>'attribution')
      THEN RAISE EXCEPTION 'invalid_corpus_row'; END IF;
    SELECT row_hash INTO old FROM public.corpus_chunks WHERE version=v AND id=(row->>'id')::uuid;
    IF FOUND AND old IS DISTINCT FROM expected THEN RAISE EXCEPTION 'corpus_row_changed'; END IF;
    INSERT INTO public.corpus_chunks(version,id,content,title,citation,image_refs,embedding,row_hash,payload)
      VALUES(v,(row->>'id')::uuid,row->>'content',row->>'title',row->'citation',
        ARRAY(SELECT jsonb_array_elements_text(row->'imageRefs')),(row->'embedding')::text::extensions.vector,expected,item->>'payload') ON CONFLICT DO NOTHING;
    inserted := inserted+1;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_images) LOOP
    row := (item->>'payload')::jsonb;
    SELECT value->>'hash' INTO expected FROM jsonb_array_elements(m->'images') WHERE value->>'id'=row->>'id';
    IF expected IS NULL OR expected IS DISTINCT FROM item->>'hash' OR encode(extensions.digest(item->>'payload','sha256'),'hex') IS DISTINCT FROM expected
      OR NOT public.image_provenance_valid(row->'provenance',row->>'path')
      THEN RAISE EXCEPTION 'invalid_corpus_image'; END IF;
    SELECT row_hash INTO old FROM public.corpus_images WHERE version=v AND id=(row->>'id')::uuid;
    IF FOUND AND old IS DISTINCT FROM expected THEN RAISE EXCEPTION 'corpus_image_changed'; END IF;
    INSERT INTO public.corpus_images(version,id,path,provenance,payload,row_hash)
      VALUES(v,(row->>'id')::uuid,row->>'path',(row->'provenance')::text,item->>'payload',expected) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN inserted;
END $$;
REVOKE ALL ON FUNCTION public.stage_corpus(text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_corpus(text,text,jsonb,jsonb) TO service_role;

-- External receipts are supplied by the operator; this function never generates approval.
CREATE FUNCTION public.approve_corpus(p_version text,p_hash text,p_approvals jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m jsonb; prior jsonb; gate text;
BEGIN
  SELECT manifest,approvals INTO m,prior FROM public.corpus_versions WHERE version=p_version AND manifest_hash=p_hash AND NOT rights_revoked FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'corpus_manifest_changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.corpus_versions WHERE version=p_version AND encode(extensions.digest(manifest_payload,'sha256'),'hex')=p_hash AND manifest=manifest_payload::jsonb) THEN RAISE EXCEPTION 'corpus_manifest_changed'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(m->'sources') s WHERE s->>'allowedUse'='official-structured-facts' AND NOT public.official_corpus_source_valid(s))
    THEN RAISE EXCEPTION 'invalid_corpus_source'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(m->'sources') s WHERE
    coalesce(s->>'refreshAfter','') !~ '^\d{4}-\d{2}-\d{2}$' OR ((s->>'refreshAfter')::date::timestamp AT TIME ZONE 'UTC') < now()
    OR coalesce(s->>'retrievedAt','')='' OR (s->>'retrievedAt')::timestamptz > now()
    OR (s->>'allowedUse'='structured-facts' AND coalesce(s->>'revision','') !~ '^[1-9][0-9]*$'))
    THEN RAISE EXCEPTION 'corpus_source_needs_refresh'; END IF;
  IF prior IS NOT NULL AND prior IS DISTINCT FROM p_approvals THEN RAISE EXCEPTION 'corpus_approval_changed'; END IF;
  FOREACH gate IN ARRAY ARRAY['sample','rights','overlap','quality','photos'] LOOP
    IF p_approvals->gate->>'manifestHash' IS DISTINCT FROM p_hash OR length(coalesce(p_approvals->gate->>'reviewer',''))=0
      OR coalesce(p_approvals->gate->>'evidenceSha256','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'corpus_gate_missing: %',gate; END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.corpus_chunks WHERE version=p_version) <> jsonb_array_length(m->'chunks')
    OR (SELECT count(*) FROM public.corpus_images WHERE version=p_version) <> jsonb_array_length(m->'images')
    OR EXISTS(SELECT 1 FROM public.corpus_chunks c,unnest(c.image_refs) ref WHERE c.version=p_version AND NOT EXISTS(SELECT 1 FROM public.corpus_images i WHERE i.version=p_version AND i.path=ref))
    THEN RAISE EXCEPTION 'corpus_import_incomplete'; END IF;
  IF EXISTS(SELECT 1 FROM public.corpus_chunks c WHERE c.version=p_version AND
      (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'chunks') r WHERE r->>'id'=c.id::text AND r->>'hash'=c.row_hash)
       OR encode(extensions.digest(c.payload,'sha256'),'hex')<>c.row_hash OR c.payload::jsonb->>'content' IS DISTINCT FROM c.content
       OR c.payload::jsonb->'citation' IS DISTINCT FROM c.citation OR c.payload::jsonb->>'title' IS DISTINCT FROM c.title
       OR ARRAY(SELECT jsonb_array_elements_text(c.payload::jsonb->'imageRefs')) IS DISTINCT FROM c.image_refs
       OR ((c.payload::jsonb->'embedding')::text::extensions.vector)::text IS DISTINCT FROM c.embedding::text))
    OR EXISTS(SELECT 1 FROM public.corpus_images i WHERE i.version=p_version AND
      (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'images') r WHERE r->>'id'=i.id::text AND r->>'hash'=i.row_hash)
       OR encode(extensions.digest(i.payload,'sha256'),'hex')<>i.row_hash OR i.payload::jsonb->>'path' IS DISTINCT FROM i.path OR i.payload::jsonb->'provenance' IS DISTINCT FROM i.provenance::jsonb))
    THEN RAISE EXCEPTION 'corpus_staged_content_changed'; END IF;
  UPDATE public.corpus_versions SET approvals=p_approvals,approved=true WHERE version=p_version;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.approve_corpus(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_corpus(text,text,jsonb) TO service_role;

-- Both promotion and rollback use the same CAS. Legacy is deliberately not a target.
CREATE FUNCTION public.select_corpus(p_version text,p_hash text,p_expected_version text,p_authorization jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected text;
BEGIN
  SELECT coalesce(active_version,'legacy') INTO selected FROM public.corpus_selection WHERE singleton FOR UPDATE;
  IF selected IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'corpus_version_changed' USING ERRCODE='PT409'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.corpus_versions WHERE version=p_version AND manifest_hash=p_hash AND approved AND NOT rights_revoked)
    OR p_authorization->>'manifestHash' IS DISTINCT FROM p_hash OR p_authorization->>'targetVersion' IS DISTINCT FROM p_version
    OR p_authorization->>'expectedVersion' IS DISTINCT FROM p_expected_version OR length(coalesce(p_authorization->>'reviewer',''))=0
    OR coalesce(p_authorization->>'evidenceSha256','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'corpus_target_not_authorized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.corpus_versions WHERE version=p_authorization->>'rollbackVersion' AND manifest_hash=p_authorization->>'rollbackManifestHash' AND approved AND NOT rights_revoked) THEN
    RAISE EXCEPTION 'corpus_rollback_not_authorized';
  END IF;
  PERFORM public.approve_corpus(p_authorization->>'rollbackVersion',p_authorization->>'rollbackManifestHash',(SELECT approvals FROM public.corpus_versions WHERE version=p_authorization->>'rollbackVersion'));
  PERFORM public.approve_corpus(p_version,p_hash,(SELECT approvals FROM public.corpus_versions WHERE version=p_version));
  UPDATE public.corpus_selection SET active_version=p_version,generation=generation+1 WHERE singleton;
  RETURN p_version;
END $$;
REVOKE ALL ON FUNCTION public.select_corpus(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.select_corpus(text,text,text,jsonb) TO service_role;

CREATE FUNCTION public.match_corpus_chunks(query_embedding extensions.vector,corpus_version text,match_threshold double precision DEFAULT 0.5,match_count integer DEFAULT 5)
RETURNS TABLE(id uuid,content text,section_title text,citation jsonb,image_refs text[],similarity double precision,source_pdf text,page_number integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' SET hnsw.ef_search='100' AS $$
BEGIN
  IF corpus_version IS DISTINCT FROM public.active_corpus_version() THEN RAISE EXCEPTION 'corpus_version_changed' USING ERRCODE='PT409'; END IF;
  IF corpus_version='legacy' THEN
    RETURN QUERY SELECT c.id,c.content,c.section_title,NULL::jsonb,c.image_refs,c.similarity,c.source_pdf,c.page_number FROM public.match_chunks(query_embedding,match_threshold,least(greatest(match_count,1),100)) c;
    RETURN;
  END IF;
  RETURN QUERY SELECT c.id,c.content,c.title,c.citation,c.image_refs,1-(c.embedding OPERATOR(extensions.<=>) query_embedding),NULL::text,NULL::integer
    FROM public.corpus_chunks c WHERE c.version=corpus_version AND 1-(c.embedding OPERATOR(extensions.<=>) query_embedding)>match_threshold ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding LIMIT least(greatest(match_count,1),100);
END $$;
REVOKE ALL ON FUNCTION public.match_corpus_chunks(extensions.vector,text,double precision,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_corpus_chunks(extensions.vector,text,double precision,integer) TO anon,authenticated,service_role;

-- Text and image retrieval use the same captured selection. A promotion race
-- is an explicit conflict, never a successful empty lookup cached for the old version.
CREATE FUNCTION public.corpus_related_images(corpus_version text,image_paths text[])
RETURNS TABLE(id uuid,path text,provenance text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF corpus_version IS DISTINCT FROM public.active_corpus_version() THEN RAISE EXCEPTION 'corpus_version_changed' USING ERRCODE='PT409'; END IF;
  IF coalesce(cardinality(image_paths),0)>1000 THEN RAISE EXCEPTION 'too_many_corpus_image_refs'; END IF;
  IF corpus_version='legacy' THEN RETURN; END IF;
  RETURN QUERY SELECT i.id,i.path,i.provenance FROM public.corpus_images i WHERE i.version=corpus_version AND i.path=ANY(image_paths) ORDER BY i.id;
END $$;
REVOKE ALL ON FUNCTION public.corpus_related_images(text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.corpus_related_images(text,text[]) TO anon,authenticated,service_role;

CREATE FUNCTION public.preview_corpus_chunks(query_embedding extensions.vector,corpus_version text,match_count integer DEFAULT 10)
RETURNS TABLE(id uuid,content text,section_title text,citation jsonb,image_refs text[],similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' SET hnsw.ef_search='100' AS $$
  SELECT c.id,c.content,c.title,c.citation,c.image_refs,1-(c.embedding OPERATOR(extensions.<=>) query_embedding) FROM public.corpus_chunks c
  JOIN public.corpus_versions v ON v.version=c.version AND NOT v.rights_revoked
  WHERE c.version=corpus_version ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding LIMIT least(greatest(match_count,1),100);
$$;
REVOKE ALL ON FUNCTION public.preview_corpus_chunks(extensions.vector,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preview_corpus_chunks(extensions.vector,text,integer) TO service_role;

CREATE POLICY corpus_image_active ON public.corpus_images FOR SELECT TO anon,authenticated USING(version=public.active_corpus_version());
GRANT SELECT(version,id,path,provenance) ON public.corpus_images TO anon,authenticated;
ALTER POLICY "Public read access for chunks" ON public.chunks USING(public.active_corpus_version()='legacy');
ALTER POLICY "Public read access for images" ON public.images USING(public.active_corpus_version()='legacy');

-- All story writers share this boundary, including SQL seeders, discovery and
-- path-only maps. Unknown/rejected records are preserved privately as drafts;
-- they cannot become a served image or inherit another image's attribution.
CREATE FUNCTION public.guard_story_image_provenance() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE p jsonb; valid boolean := false;
BEGIN
  IF TG_OP='UPDATE' AND NEW.image_path IS NOT DISTINCT FROM OLD.image_path AND NEW.image_source IS NOT DISTINCT FROM OLD.image_source THEN RETURN NEW; END IF;
  IF NEW.image_path='/images/neutral-landscape.svg' THEN
    NEW.image_source := 'Paisaxe · Ilustración temática, no representa un lugar concreto'; NEW.blur_data_url := NULL; RETURN NEW;
  END IF;
  BEGIN
    p := NEW.image_source::jsonb;
    valid := public.image_provenance_valid(p,NEW.image_path);
  EXCEPTION WHEN invalid_text_representation THEN valid := false;
  END;
  IF TG_OP='UPDATE' AND (NEW.image_path IS DISTINCT FROM OLD.image_path OR NEW.image_source IS DISTINCT FROM OLD.image_source) AND NEW.blur_data_url IS NOT DISTINCT FROM OLD.blur_data_url THEN
    NEW.blur_data_url := NULL;
  END IF;
  IF NOT coalesce(valid,false) THEN
    INSERT INTO public.story_image_drafts(story_id,requested_path,requested_source) VALUES(NEW.id,NEW.image_path,NEW.image_source)
      ON CONFLICT(story_id) DO UPDATE SET requested_path=excluded.requested_path,requested_source=excluded.requested_source,updated_at=now();
    NEW.image_path := '/images/neutral-landscape.svg';
    NEW.image_source := 'Paisaxe · Ilustración temática, no representa un lugar concreto';
    NEW.blur_data_url := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_story_image_provenance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER story_image_provenance BEFORE INSERT OR UPDATE OF image_path,image_source ON public.stories FOR EACH ROW EXECUTE FUNCTION public.guard_story_image_provenance();
