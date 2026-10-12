// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { corpusContentHash, validateCorpus, type CorpusInput } from "../../scripts/lib/corpus-manifest";
import { canonicalJson, contentHash } from "../../scripts/lib/corpus-provenance";
import { requiredValue } from "@/test/required-value";
import { LOCAL_ANON_KEY, LOCAL_API_URL, LOCAL_REST_URL, LOCAL_SERVICE_ROLE_KEY, isLocalSupabaseReachable, localServiceClient, psql, warnLocalSupabaseUnreachable } from "@/test/local-supabase";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "./image-provenance";
import { officialAttribution, officialDatasetDetails, type OfficialSource } from "../../scripts/lib/official-structured-facts";

vi.setConfig({ testTimeout: 20000, hookTimeout: 30000 });
const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("corpus.postgrest-integration.test.ts");

const nonce = randomUUID();
const versions = new Set<string>();
const storyIds: string[] = [];
const userIds: string[] = [];
const tokens: Record<string, string> = { anon: LOCAL_ANON_KEY, service_role: LOCAL_SERVICE_ROLE_KEY };
const vector = [1, ...Array<number>(511).fill(0)];
const service = localServiceClient();
let originalSelection: { singleton: boolean; active_version: string | null; generation: number } | undefined;
type Fixture = ReturnType<typeof validateCorpus>;
let privateFixture: Fixture;
const privateDraftStoryId = randomUUID();

function proof(assetUrl: string) {
  return { assetUrl, originalSha256: "a".repeat(64), replacementSha256: "b".repeat(64), sourcePage: "https://owner.example.test/photo", photographer: "Synthetic owner", license: "owner-permission", permission: "Synthetic test-only approval", date: "2026-10-11", credit: "Synthetic owner · Thematic landscape", context: "thematic", alt: "Thematic illustration, not a named place", crop: { mobile: "center reviewed", desktop: "center reviewed" }, reviewer: "Synthetic reviewer", reviewReceipt: "c".repeat(64), status: "approved", flow: "manual" };
}

function fixture(): Fixture {
  const version = `p12-${randomUUID()}`;
  versions.add(version);
  const first = randomUUID(), second = randomUUID(), document = randomUUID();
  const path = `/images/reviewed/${version}.webp`;
  // Ordinary fixtures represent evidence acquired yesterday. Explicit date
  // negatives below test freshness; success cases need no cross-process race
  // between host Date.now() and PostgreSQL's transaction-start timestamp.
  const now = new Date(Date.now() - 86400000);
  const input: CorpusInput = {
    schemaVersion: 1, version, model: "voyage-context-3", dimensions: 512,
    sources: [{ id: "synthetic-owner", canonicalUrl: "https://owner.example.test/facts", revision: "fixture-v1", retrievedAt: now.toISOString(), license: "owner-permission", allowedUse: "owner-material", namespace: "owner", attribution: "Synthetic owner", refreshAfter: new Date(now.getTime() + 366 * 86400000).toISOString().slice(0, 10), evidenceSha256: "d".repeat(64), reviewReceiptSha256: "e".repeat(64) }],
    facts: [{ id: "synthetic-fact", sourceId: "synthetic-owner", property: "fixture-label", value: "Synthetic fact", statementId: "fixture-statement" }],
    documents: [{ id: document, version, title: "Synthetic corpus document", language: "es", region: "fixture-region", topic: "fixture-topic", season: "all", chunkIds: [first, second] }],
    chunks: [
      { id: first, documentId: document, content: `First independently authored test fact ${version}`, sourceIds: ["synthetic-owner"], factIds: ["synthetic-fact"], imageRefs: [path], embedding: vector },
      { id: second, documentId: document, content: `Second independently authored test fact ${version}`, sourceIds: ["synthetic-owner"], factIds: ["synthetic-fact"], imageRefs: [], embedding: vector },
    ],
    images: [{ id: randomUUID(), storyId: "synthetic-story", path, provenance: proof(path) }],
    rights: { contentHash: "0".repeat(64), reviewer: "Synthetic reviewer", evidenceSha256: "f".repeat(64), recordedAt: now.toISOString() },
    overlap: { contentHash: "0".repeat(64), reviewer: "Synthetic reviewer", evidenceSha256: "1".repeat(64), recordedAt: now.toISOString() },
  };
  const hash = corpusContentHash(input);
  input.rights.contentHash = hash; input.overlap.contentHash = hash;
  return validateCorpus(input, now);
}

function manifestPatch(f: Fixture, patch: Record<string, unknown>): Fixture {
  const manifest = { ...JSON.parse(f.manifestPayload), ...patch };
  return { ...f, manifestPayload: canonicalJson(manifest), manifestHash: contentHash(manifest) };
}

function rowPatch(f: Fixture, patch: Record<string, unknown>): Fixture {
  const first = requiredValue(f.rows[0], "Synthetic corpus row");
  const row = { ...JSON.parse(first.payload), ...patch };
  const changed = { id: first.id, payload: canonicalJson(row), hash: contentHash(row) };
  const rows = [changed, ...f.rows.slice(1)];
  return { ...manifestPatch(f, { chunks: rows.map(({ id, hash }) => ({ id, hash })) }), rows };
}

async function request(path: string, role = "service_role", method = "GET", body?: unknown) {
  return fetch(`${LOCAL_REST_URL}/${path}`, { method, headers: { apikey: LOCAL_ANON_KEY, Authorization: `Bearer ${requiredValue(tokens[role], `Token for ${role}`)}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function stageArgs(f: Fixture, rows = f.rows, images = f.images) { return { p_manifest: f.manifestPayload, p_hash: f.manifestHash, p_rows: rows, p_images: images }; }
function approvals(f: Fixture) { return Object.fromEntries(["sample", "rights", "overlap", "quality", "photos"].map(gate => [gate, { manifestHash: f.manifestHash, reviewer: "Synthetic test reviewer", evidenceSha256: "2".repeat(64) }])); }
function approveArgs(f: Fixture) { return { p_version: f.version, p_hash: f.manifestHash, p_approvals: approvals(f) }; }
function selectArgs(f: Fixture, expected = "legacy") { return { p_version: f.version, p_hash: f.manifestHash, p_expected_version: expected, p_authorization: { manifestHash: f.manifestHash, targetVersion: f.version, expectedVersion: expected, rollbackVersion: f.version, rollbackManifestHash: f.manifestHash, reviewer: "Synthetic test operator", evidenceSha256: "3".repeat(64) } }; }
async function stage(f: Fixture, rows = f.rows, images = f.images) { return request("rpc/stage_corpus", "service_role", "POST", stageArgs(f, rows, images)); }
async function approve(f: Fixture) { return request("rpc/approve_corpus", "service_role", "POST", approveArgs(f)); }
async function select(f: Fixture, expected = "legacy") { return request("rpc/select_corpus", "service_role", "POST", selectArgs(f, expected)); }
async function successful(res: Response) { expect(res.status, await res.clone().text()).toBe(200); return res.json(); }
async function rejected(res: Response, message: RegExp) { expect(res.status).toBe(400); expect((await res.json()).message).toMatch(message); }
async function denied(res: Response) { expect(res.status).toBeOneOf([401, 403]); const error = await res.json(); expect(error.code).toBe("42501"); expect(error.message).toMatch(/permission denied|row-level security/i); }
async function active(role = "service_role") { return successful(await request("rpc/active_corpus_version", role, "POST", {})); }

function restoreSelection() {
  if (!originalSelection) return;
  const current = JSON.parse(psql("SELECT row_to_json(s)::text FROM public.corpus_selection s WHERE singleton;"));
  if (current.active_version !== null && !versions.has(current.active_version)) throw new Error("Refusing to overwrite an unrelated corpus selection");
  psql(`UPDATE public.corpus_selection SET active_version=NULL,generation=${originalSelection.generation} WHERE singleton;`);
  expect(JSON.parse(psql("SELECT row_to_json(s)::text FROM public.corpus_selection s WHERE singleton;"))).toEqual(originalSelection);
}

describe.skipIf(!dbReachable)("Authored corpus version and permission boundaries (real PostgREST)", () => {
  beforeAll(async () => {
    originalSelection = JSON.parse(psql("SELECT row_to_json(s)::text FROM public.corpus_selection s WHERE singleton;"));
    expect(requiredValue(originalSelection, "Original task corpus selection").active_version).toBeNull();
    expect(psql("SELECT value FROM public.webhook_config WHERE key='base_url';")).toBe("");
    for (const role of ["owner", "nonowner"]) {
      const email = `corpus-${nonce}-${role}@example.test`, password = "Synthetic-corpus-contract-523!";
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
      expect(created.error).toBeNull();
      if (created.error || !created.data?.user) throw new Error("Corpus fixture user creation failed");
      userIds.push(created.data.user.id);
      const client = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } });
      try {
        const signed = await client.auth.signInWithPassword({ email, password });
        expect(signed.error).toBeNull();
        if (signed.error || !signed.data?.session) throw new Error("Corpus fixture sign-in failed");
        tokens[role] = signed.data.session.access_token;
      } finally { client.auth.dispose(); }
    }
    privateFixture = fixture();
    expect(await successful(await stage(privateFixture))).toBe(2);
    storyIds.push(privateDraftStoryId);
    const draftStory = await request("stories", "service_role", "POST", { id: privateDraftStoryId, slug: `corpus-${privateDraftStoryId}`, title: "Synthetic private draft", category: "nature", image_path: "/images/reviewed/unapproved-fixture.webp", image_source: "Unreviewed synthetic credit" });
    expect(draftStory.status, await draftStory.clone().text()).toBe(201);
    const drafts = await successful(await request(`story_image_drafts?story_id=eq.${privateDraftStoryId}&select=story_id,requested_path,requested_source,status`));
    expect(drafts).toEqual([{ story_id: privateDraftStoryId, requested_path: "/images/reviewed/unapproved-fixture.webp", requested_source: "Unreviewed synthetic credit", status: "permission-review-required" }]);
  });
  afterEach(() => { restoreSelection(); });
  afterAll(async () => {
    restoreSelection();
    // Only fixture-generated IDs enter these sets. Batch the exact inventory:
    // a separate Docker/psql process per version made cleanup exceed its bound.
    const literals = (values: Iterable<string>) => [...values].map(value => `'${value.replaceAll("'", "''")}'`).join(",");
    if (storyIds.length) {
      const ids = literals(storyIds);
      psql(`DELETE FROM public.stories WHERE id IN (${ids});`);
      expect(psql(`SELECT count(*) FROM public.story_image_drafts WHERE story_id IN (${ids});`)).toBe("0");
    }
    if (versions.size) {
      const ids = literals(versions);
      psql(`DELETE FROM public.corpus_images WHERE version IN (${ids}); DELETE FROM public.corpus_chunks WHERE version IN (${ids}); DELETE FROM public.corpus_versions WHERE version IN (${ids});`);
      expect(psql(`SELECT count(*) FROM public.corpus_versions WHERE version IN (${ids});`)).toBe("0");
    }
    for (const id of userIds) { const deleted = await service.auth.admin.deleteUser(id); expect(deleted.error).toBeNull(); }
    service.auth.dispose();
  });

  it("service stages privately and resumes identical partial batches without duplicates or selection changes", async () => {
    const f = fixture();
    expect(await successful(await stage(f, f.rows.slice(0, 1)))).toBe(1);
    expect(await successful(await stage(f, f.rows.slice(0, 1)))).toBe(1);
    expect(await successful(await stage(f, f.rows.slice(1)))).toBe(1);
    const rows = await successful(await request(`corpus_chunks?version=eq.${f.version}&select=id`));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row: { id: string }) => row.id)).size).toBe(2);
    expect(await active()).toBe("legacy");
  });

  it("independently validates official dataset, snapshot, fields and unknown publisher dates in SQL", async () => {
    const original = fixture();
    const manifest = JSON.parse(original.manifestPayload);
    const fields = { "Nombre.content": "Synthetic restaurant", "CodigoDGT.content": "R9999", "Contacto.Concejo.content": "Synthetic municipality" };
    const official: OfficialSource = { dataset: "asturias-restaurants", snapshotSha256: "d".repeat(64), recordId: "R9999", rowIndex: 0, fields,
      projectionSha256: contentHash(fields), termsEvidenceSha256: "a".repeat(64), termsDispositionSha256: "b".repeat(64), publisherUpdatedAt: null, publisherRevision: null, productYear: null };
    const source = { ...requiredValue(manifest.sources[0], "Official fixture source"), allowedUse: "official-structured-facts", namespace: "official-dataset", license: "CC-BY-4.0",
      canonicalUrl: "https://www.turismoasturiasprofesional.es/open-data/turismoasturias", revision: `sha256:${official.snapshotSha256}`, official,
      attribution: officialAttribution(official, manifest.sources[0].retrievedAt), refreshAfter: new Date(Date.now() + 89 * 86400000).toISOString().slice(0, 10) };
    const valid = manifestPatch(original, { sources: [source], facts: [{ ...manifest.facts[0], property: "Contacto.Concejo.content", value: fields["Contacto.Concejo.content"], statementId: "R9999:Contacto.Concejo.content" }] });
    for (const patch of [
      { dataset: "unreviewed-dataset" }, { recordId: "R1111" }, { snapshotSha256: "9".repeat(64) },
      { projectionSha256: "9".repeat(64) }, { publisherUpdatedAt: "2026-10-10" }, { productYear: 2026 },
      { termsDispositionSha256: "" }, { fields: { ...fields, "Contacto.Email.content": "private@example.test" } },
    ]) {
      const invalid = manifestPatch(valid, { sources: [{ ...source, official: { ...official, ...patch } }] });
      await rejected(await stage(invalid, [], []), /invalid_corpus_source/);
      expect(await successful(await request(`corpus_versions?version=eq.${valid.version}&select=version`))).toEqual([]);
    }
    for (const blank of ["\t", "\n", "\u00a0", "\ufeff"]) {
      const blankFields = { ...fields, "Nombre.content": blank };
      const invalid = manifestPatch(valid, { sources: [{ ...source, official: { ...official, fields: blankFields, projectionSha256: contentHash(blankFields) } }] });
      await rejected(await stage(invalid, [], []), /invalid_corpus_source/);
    }
    await rejected(await stage(manifestPatch(valid, { sources: [{ ...source, official: { ...official, rowIndex: 9007199254740992 } }] }), [], []), /invalid_corpus_source/);
    for (const patch of [{ value: "Altered municipality" }, { property: "opening-hours", value: "Always open" }, { statementId: "wrong:Contacto.Concejo.content" }]) {
      const invalid = manifestPatch(valid, { facts: [{ ...JSON.parse(valid.manifestPayload).facts[0], ...patch }] });
      await rejected(await stage(invalid, [], []), /invalid_official_corpus_fact/);
    }
    const citation = { title: "Synthetic corpus document", url: source.canonicalUrl, license: source.license, revision: source.revision, attribution: source.attribution };
    const rows = valid.rows.map(originalRow => { const row = { ...JSON.parse(originalRow.payload), citation }; return { id: originalRow.id, payload: canonicalJson(row), hash: contentHash(row) }; });
    const complete = { ...manifestPatch(valid, { chunks: rows.map(({ id, hash }) => ({ id, hash })) }), rows };
    expect(await successful(await stage(complete))).toBe(2);
    const saved = await successful(await request(`corpus_versions?version=eq.${valid.version}&select=manifest`));
    expect(saved[0].manifest.sources[0].official.publisherUpdatedAt).toBeNull();
    expect(saved[0].manifest.sources[0].official.productYear).toBeNull();
    expect(await successful(await approve(complete))).toBe(true);
    expect(await successful(await select(complete))).toBe(complete.version);
    const retrieved = await successful(await request("rpc/match_corpus_chunks", "anon", "POST", { query_embedding: JSON.stringify(vector), corpus_version: complete.version, match_threshold: 0.5, match_count: 5 }));
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].citation).toEqual(citation);
    expect(retrieved[0].source_pdf).toBeNull();
    expect(retrieved[0].page_number).toBeNull();
  });

  it("rejects changed manifests and payload hashes on retry without modifying staged rows", async () => {
    const f = fixture(); await successful(await stage(f));
    const changed = manifestPatch(f, { contentHash: "4".repeat(64), rights: { contentHash: "4".repeat(64) }, overlap: { contentHash: "4".repeat(64) } });
    await rejected(await stage(changed), /corpus_manifest_changed/);
    const first = requiredValue(f.rows[0], "First staged row");
    await rejected(await stage(f, [{ ...first, payload: canonicalJson({ ...JSON.parse(first.payload), content: "Tampered synthetic content" }) }]), /invalid_corpus_row/);
    const rows = await successful(await request(`corpus_chunks?version=eq.${f.version}&select=row_hash`));
    expect(rows.map((row: { row_hash: string }) => row.row_hash).sort()).toEqual(f.rows.map(row => row.hash).sort());
  });

  for (const dataset of ["asturias-beaches", "asturias-viewpoints"] as const) {
    it(`independently admits the ${dataset} SQL branch and rejects malformed OIDs`, async () => {
      const f = fixture(), manifest = JSON.parse(f.manifestPayload);
      const fields = { objectid: 123, nombre: "Synthetic place", concejo: "Synthetic municipality" };
      const official: OfficialSource = { dataset, fields, recordId: "123", rowIndex: 0, snapshotSha256: "d".repeat(64), projectionSha256: contentHash(fields), termsEvidenceSha256: "a".repeat(64), termsDispositionSha256: "b".repeat(64), publisherUpdatedAt: null, publisherRevision: null, productYear: null };
      const source = { ...manifest.sources[0], official, license: "CC-BY-4.0", allowedUse: "official-structured-facts", namespace: "official-dataset", canonicalUrl: officialDatasetDetails[dataset].url, revision: `sha256:${official.snapshotSha256}`, attribution: officialAttribution(official, manifest.sources[0].retrievedAt), refreshAfter: new Date(Date.now() + 89 * 86400000).toISOString().slice(0, 10) };
      const valid = manifestPatch(f, { sources: [source], facts: [{ ...manifest.facts[0], property: "concejo", value: fields.concejo, statementId: "123:concejo" }] });
      for (const objectid of [0, 1.5, 9007199254740992, "123"]) {
        const badFields = { ...fields, objectid };
        const badOfficial = { ...official, fields: badFields, recordId: String(objectid), projectionSha256: contentHash(badFields) };
        await rejected(await stage(manifestPatch(valid, { sources: [{ ...source, official: badOfficial, attribution: officialAttribution(badOfficial, source.retrievedAt) }] }), [], []), /invalid_corpus_source/);
      }
      expect(await successful(await stage(valid, [], []))).toBe(0);
    });
  }

  it("rechecks expired approved sources for approval, target selection and rollback selection", async () => {
    const current = fixture(), rollback = fixture();
    for (const f of [current, rollback]) { await successful(await stage(f)); await successful(await approve(f)); }
    await successful(await select(current));
    // Simulate elapsed source freshness in this owned fixture without changing
    // application time or bypassing payload/hash consistency checks.
    const manifest = JSON.parse(rollback.manifestPayload);
    const expired = manifestPatch(rollback, { sources: manifest.sources.map((source: Record<string, unknown>) => ({ ...source, refreshAfter: "2000-01-01" })) });
    const patched = await request(`corpus_versions?version=eq.${rollback.version}`, "service_role", "PATCH", { manifest: JSON.parse(expired.manifestPayload), manifest_payload: expired.manifestPayload, manifest_hash: expired.manifestHash, approvals: approvals(expired) });
    expect(patched.status, await patched.clone().text()).toBe(200);
    await rejected(await approve(expired), /corpus_source_needs_refresh/);
    await rejected(await request("rpc/select_corpus", "service_role", "POST", { ...selectArgs(expired, current.version), p_authorization: { ...selectArgs(expired, current.version).p_authorization, rollbackVersion: current.version, rollbackManifestHash: current.manifestHash } }), /corpus_source_needs_refresh/);
    await rejected(await request("rpc/select_corpus", "service_role", "POST", { ...selectArgs(current, current.version), p_authorization: { ...selectArgs(current, current.version).p_authorization, rollbackVersion: expired.version, rollbackManifestHash: expired.manifestHash } }), /corpus_source_needs_refresh/);
    expect(await active()).toBe(current.version);
    expect(psql("SELECT generation FROM public.corpus_selection WHERE singleton;")).toBe(String(requiredValue(originalSelection, "Original expiry selection").generation + 1));
  });

  for (const problem of ["model", "dimensions", "source", "zero vector", "short vector", "citation"] as const) {
    it(`rejects independently hashed invalid ${problem} metadata at the database boundary`, async () => {
      let f = fixture();
      if (problem === "model") f = manifestPatch(f, { model: "unapproved-model" });
      if (problem === "dimensions") f = manifestPatch(f, { dimensions: 511 });
      if (problem === "source") {
        for (const { patch, message } of [
          { patch: { allowedUse: null }, message: /invalid_corpus_source/ },
          { patch: { refreshAfter: "2000-01-01" }, message: /corpus_source_needs_refresh/ },
          { patch: { refreshAfter: psql("SELECT (now() AT TIME ZONE 'UTC')::date::text;") }, message: /corpus_source_needs_refresh/ },
          { patch: { retrievedAt: new Date(Date.now() + 86400000).toISOString() }, message: /corpus_source_needs_refresh/ },
          { patch: { allowedUse: "structured-facts", license: "CC0-1.0", namespace: "main", canonicalUrl: "https://www.wikidata.org/wiki/Q42", revision: "not-a-numeric-revision" }, message: /corpus_source_needs_refresh/ },
        ]) {
          const fresh = fixture();
          const manifest = JSON.parse(fresh.manifestPayload);
          const invalid = manifestPatch(fresh, { sources: manifest.sources.map((source: Record<string, unknown>) => ({ ...source, ...patch })) });
          // Empty partial batches isolate the source gate: a citation/vector
          // mismatch cannot make this negative pass for an unrelated reason.
          await rejected(await stage(invalid, [], []), message);
          expect(await successful(await request(`corpus_versions?version=eq.${fresh.version}&select=version`))).toEqual([]);
          expect(await successful(await stage(fresh))).toBe(2);
          expect(await active()).toBe("legacy");
        }
        const structured = fixture();
        const manifest = JSON.parse(structured.manifestPayload);
        const validStructured = manifestPatch(structured, { sources: manifest.sources.map((source: Record<string, unknown>) => ({ ...source, allowedUse: "structured-facts", license: "CC0-1.0", namespace: "main", canonicalUrl: "https://www.wikidata.org/wiki/Q42", revision: "12345" })) });
        expect(await successful(await stage(validStructured, [], []))).toBe(0);
        return;
      }
      if (problem === "zero vector") f = rowPatch(f, { embedding: Array<number>(512).fill(0) });
      if (problem === "short vector") f = rowPatch(f, { embedding: [1] });
      if (problem === "citation") f = rowPatch(f, { citation: { url: "https://owner.example.test/facts", license: "owner-permission", revision: "fixture-v1" } });
      const response = await stage(f);
      expect(response.status, await response.clone().text()).toBe(400);
      expect((await response.json()).message).toMatch(/invalid_corpus_(manifest|source|row)/);
      expect(await active()).toBe("legacy");
    });
  }

  it("a partial corpus permits service preview before quality but cannot approve or select", async () => {
    const f = fixture(); await successful(await stage(f, f.rows.slice(0, 1)));
    const preview = await successful(await request("rpc/preview_corpus_chunks", "service_role", "POST", { query_embedding: JSON.stringify(vector), corpus_version: f.version, match_count: 10 }));
    expect(preview).toHaveLength(1);
    expect(preview[0].citation.url).toBe("https://owner.example.test/facts");
    await rejected(await approve(f), /corpus_import_incomplete/);
    await rejected(await select(f), /corpus_target_not_authorized/);
    expect(await active()).toBe("legacy");
  });

  it("missing exact quality/rights/photo approval receipts prevent approval", async () => {
    const f = fixture(); await successful(await stage(f));
    for (const gate of ["sample", "rights", "overlap", "quality", "photos"]) {
      const wrong = { ...approvals(f), [gate]: { manifestHash: "0".repeat(64), reviewer: "Synthetic reviewer", evidenceSha256: "2".repeat(64) } };
      await rejected(await request("rpc/approve_corpus", "service_role", "POST", { ...approveArgs(f), p_approvals: wrong }), /corpus_gate_missing/);
    }
    expect(await active()).toBe("legacy");
  });

  it("orphan image references prevent approval even when all declared rows are staged", async () => {
    const f = rowPatch(fixture(), { imageRefs: ["/images/reviewed/nonexistent.webp"] });
    await successful(await stage(f));
    await rejected(await approve(f), /corpus_import_incomplete/);
    expect(await active()).toBe("legacy");
  });

  it("rejects orphan vector rows and rolls back the entire staging transaction", async () => {
    const f = fixture(), first = requiredValue(f.rows[0], "Orphan row source");
    const row = { ...JSON.parse(first.payload), id: randomUUID() };
    const orphan = { id: row.id, payload: canonicalJson(row), hash: contentHash(row) };
    await rejected(await stage(f, [...f.rows, orphan]), /invalid_corpus_row/);
    expect(await successful(await request(`corpus_versions?version=eq.${f.version}&select=version`))).toEqual([]);
    expect(await active()).toBe("legacy");
  });

  it("approval is idempotent only for the exact retained external receipts", async () => {
    const f = fixture(); await successful(await stage(f));
    expect(await successful(await approve(f))).toBe(true);
    expect(await successful(await approve(f))).toBe(true);
    const changed = { ...approvals(f), quality: { manifestHash: f.manifestHash, reviewer: "Another reviewer", evidenceSha256: "9".repeat(64) } };
    await rejected(await request("rpc/approve_corpus", "service_role", "POST", { ...approveArgs(f), p_approvals: changed }), /corpus_approval_changed/);
  });

  it("selection rechecks approved bytes rather than promoting a tampered staged corpus", async () => {
    const f = fixture(); await successful(await stage(f)); await successful(await approve(f));
    const first = requiredValue(f.rows[0], "Approved row");
    await successful(await request(`corpus_chunks?version=eq.${f.version}&id=eq.${first.id}`, "service_role", "PATCH", { content: "Unhashed replacement after approval" }));
    await rejected(await select(f), /corpus_staged_content_changed/);
    expect(await active()).toBe("legacy");
  });

  it("approval rejects staged title/reference tampering rather than trusting only the stored row hash", async () => {
    for (const field of ["title", "image_refs"]) {
      const f = fixture(); await successful(await stage(f));
      const first = requiredValue(f.rows[0], "Staged tamper fixture");
      const patch = field === "title" ? { title: "Unhashed replacement title" } : { image_refs: [] };
      await successful(await request(`corpus_chunks?version=eq.${f.version}&id=eq.${first.id}`, "service_role", "PATCH", patch));
      await rejected(await approve(f), /corpus_staged_content_changed/);
    }
  });

  for (const role of ["anon", "owner", "nonowner"]) {
    it(`${role} cannot stage, approve, select or privately preview a corpus`, async () => {
      for (const [name, args] of [
        ["stage_corpus", stageArgs(privateFixture)], ["approve_corpus", approveArgs(privateFixture)],
        ["select_corpus", selectArgs(privateFixture)], ["preview_corpus_chunks", { query_embedding: JSON.stringify(vector), corpus_version: privateFixture.version, match_count: 10 }],
        ["image_provenance_valid", { p: proof("/images/reviewed/fixture.webp"), asset_url: "/images/reviewed/fixture.webp" }],
        ["official_corpus_source_valid", { s: {} }],
      ] as const) await denied(await request(`rpc/${name}`, role, "POST", args));
      expect(await active(role)).toBe("legacy");
    });

    it(`${role} cannot inspect private draft tables or write any corpus table`, async () => {
      for (const table of ["corpus_versions", "corpus_selection", "corpus_chunks"]) await denied(await request(`${table}?select=*`, role));
      await denied(await request(`story_image_drafts?story_id=eq.${privateDraftStoryId}&select=*`, role));
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const path = method === "POST" ? "story_image_drafts" : `story_image_drafts?story_id=eq.${privateDraftStoryId}`;
        const body = method === "DELETE" ? undefined : method === "POST" ? { story_id: privateDraftStoryId, requested_path: "/images/reviewed/unauthorized.webp" } : { requested_source: "Unauthorized replacement" };
        await denied(await request(path, role, method, body));
      }
      const drafts = await successful(await request(`corpus_images?version=eq.${privateFixture.version}&select=version,id,path,provenance`, role));
      expect(drafts).toEqual([]);
      await denied(await request("corpus_images?select=payload", role));
      for (const table of ["corpus_versions", "corpus_selection", "corpus_chunks", "corpus_images"]) {
        for (const method of ["POST", "PATCH", "DELETE"]) {
          const path = method === "POST" ? table : table === "corpus_selection" ? `${table}?singleton=eq.true` : `${table}?version=eq.${privateFixture.version}`;
          const body = method === "DELETE" ? undefined : table === "corpus_selection" ? { generation: 999 } : { version: privateFixture.version };
          await denied(await request(path, role, method, body));
        }
      }
    });
  }

  it("the private image validator has a real service-role positive and exact arguments for every corpus RPC", async () => {
    expect(await successful(await request("rpc/image_provenance_valid", "service_role", "POST", { p: proof("/images/reviewed/fixture.webp"), asset_url: "/images/reviewed/fixture.webp" }))).toBe(true);
    const signatures: Record<string, string[]> = {
      "active_corpus_version()": [],
      "stage_corpus(text,text,jsonb,jsonb)": ["p_manifest", "p_hash", "p_rows", "p_images"],
      "approve_corpus(text,text,jsonb)": ["p_version", "p_hash", "p_approvals"],
      "select_corpus(text,text,text,jsonb)": ["p_version", "p_hash", "p_expected_version", "p_authorization"],
      "match_corpus_chunks(vector,text,double precision,integer)": ["query_embedding", "corpus_version", "match_threshold", "match_count"],
      "preview_corpus_chunks(vector,text,integer)": ["query_embedding", "corpus_version", "match_count"],
      "corpus_related_images(text,text[])": ["corpus_version", "image_paths"],
      "image_provenance_valid(jsonb,text)": ["p", "asset_url"],
      "official_corpus_source_valid(jsonb)": ["s"],
    };
    for (const [signature, args] of Object.entries(signatures)) {
      expect(JSON.parse(psql(`SELECT coalesce(to_json(proargnames[1:pronargs]),'[]'::json)::text FROM pg_proc WHERE oid='public.${signature}'::regprocedure;`))).toEqual(args);
    }
  });

  it("exact approvals atomically select authored rows for all roles and block old tables and mismatched versions", async () => {
    const f = fixture(); await successful(await stage(f)); expect(await successful(await approve(f))).toBe(true);
    expect(await successful(await select(f))).toBe(f.version);
    for (const role of ["anon", "owner", "nonowner", "service_role"]) {
      expect(await active(role)).toBe(f.version);
      const rows = await successful(await request("rpc/match_corpus_chunks", role, "POST", { query_embedding: JSON.stringify(vector), corpus_version: f.version, match_threshold: 0.5, match_count: 5 }));
      expect(rows).toHaveLength(2);
      for (const row of rows) { expect(row.citation.url).toBe("https://owner.example.test/facts"); expect(row.source_pdf).toBeNull(); expect(row.page_number).toBeNull(); }
      const mismatch = await request("rpc/match_corpus_chunks", role, "POST", { query_embedding: JSON.stringify(vector), corpus_version: "legacy", match_threshold: 0.5, match_count: 5 });
      expect(mismatch.status).toBe(409); expect((await mismatch.json()).message).toMatch(/corpus_version_changed/);
      const imagePath = JSON.parse(requiredValue(f.images[0], "Approved corpus image").payload).path;
      const related = await successful(await request("rpc/corpus_related_images", role, "POST", { corpus_version: f.version, image_paths: [imagePath] }));
      expect(related).toHaveLength(1);
      expect(related[0]).toEqual({ id: requiredValue(f.images[0], "Approved corpus image").id, path: imagePath, provenance: expect.any(String) });
      expect(JSON.parse(related[0].provenance)).toEqual(proof(imagePath));
      expect(await successful(await request("rpc/corpus_related_images", role, "POST", { corpus_version: f.version, image_paths: [] }))).toEqual([]);
      const imageMismatch = await request("rpc/corpus_related_images", role, "POST", { corpus_version: "legacy", image_paths: [imagePath] });
      expect(imageMismatch.status).toBe(409); expect((await imageMismatch.json()).message).toMatch(/corpus_version_changed/);
      const emptyMismatch = await request("rpc/corpus_related_images", role, "POST", { corpus_version: "legacy", image_paths: [] });
      expect(emptyMismatch.status).toBe(409); expect((await emptyMismatch.json()).message).toMatch(/corpus_version_changed/);
      if (role !== "service_role") {
        for (const table of ["chunks", "images"]) expect(await successful(await request(`${table}?select=id`, role))).toEqual([]);
        const old = await successful(await request("rpc/match_chunks", role, "POST", { query_embedding: JSON.stringify(vector), match_threshold: 0, match_count: 5 }));
        expect(old).toEqual([]);
        const photos = await successful(await request(`corpus_images?version=eq.${f.version}&select=version,id,path,provenance`, role));
        expect(photos).toHaveLength(1);
      }
    }
    expect(JSON.parse(psql("SELECT generation FROM public.corpus_selection WHERE singleton;"))).toBe(requiredValue(originalSelection, "Original selection").generation + 1);
  });

  it("stale compare-and-swap cannot change the active approved corpus", async () => {
    const a = fixture(), b = fixture();
    for (const f of [a, b]) { await successful(await stage(f)); await successful(await approve(f)); }
    await successful(await select(a));
    const rejectedSelection = await select(b, "legacy");
    expect(rejectedSelection.status).toBe(409); expect((await rejectedSelection.json()).message).toMatch(/corpus_version_changed/);
    expect(await active()).toBe(a.version);
  });

  it("rollback selects only an approved permitted version and rejects revoked or legacy targets", async () => {
    const a = fixture(), b = fixture();
    for (const f of [a, b]) { await successful(await stage(f)); await successful(await approve(f)); }
    const unapproved = fixture(), revoked = fixture();
    await successful(await stage(unapproved));
    await successful(await stage(revoked)); await successful(await approve(revoked));
    await successful(await request(`corpus_versions?version=eq.${revoked.version}`, "service_role", "PATCH", { rights_revoked: true }));
    const validAuthorization = selectArgs(a).p_authorization;
    const missingRollback = Object.fromEntries(Object.entries(validAuthorization).filter(([key]) => key !== "rollbackVersion" && key !== "rollbackManifestHash"));
    for (const authorization of [
      missingRollback,
      { ...validAuthorization, rollbackVersion: unapproved.version, rollbackManifestHash: unapproved.manifestHash },
      { ...validAuthorization, rollbackVersion: revoked.version, rollbackManifestHash: revoked.manifestHash },
      { ...validAuthorization, rollbackVersion: b.version, rollbackManifestHash: "0".repeat(64) },
    ]) {
      await rejected(await request("rpc/select_corpus", "service_role", "POST", { ...selectArgs(a), p_authorization: authorization }), /corpus_rollback_not_authorized/);
      expect(await active()).toBe("legacy");
      expect(psql("SELECT generation FROM public.corpus_selection WHERE singleton;")).toBe(String(requiredValue(originalSelection, "Original rollback selection").generation));
    }
    await successful(await select(a));
    await successful(await request("rpc/select_corpus", "service_role", "POST", { ...selectArgs(b, a.version), p_authorization: { ...selectArgs(b, a.version).p_authorization, rollbackVersion: a.version, rollbackManifestHash: a.manifestHash } }));
    for (const role of ["anon", "owner", "nonowner", "service_role"]) {
      const staleImages = await request("rpc/corpus_related_images", role, "POST", { corpus_version: a.version, image_paths: [JSON.parse(requiredValue(a.images[0], "Previous corpus image").payload).path] });
      expect(staleImages.status).toBe(409); expect((await staleImages.json()).message).toMatch(/corpus_version_changed/);
    }
    await successful(await select(a, b.version)); expect(await active()).toBe(a.version);
    await successful(await request(`corpus_versions?version=eq.${b.version}`, "service_role", "PATCH", { rights_revoked: true }));
    await rejected(await select(b, a.version), /corpus_target_not_authorized/);
    await rejected(await request("rpc/select_corpus", "service_role", "POST", { ...selectArgs(a, a.version), p_version: "legacy", p_authorization: { ...selectArgs(a, a.version).p_authorization, targetVersion: "legacy" } }), /corpus_target_not_authorized/);
    expect(await active()).toBe(a.version);
  });

  it("rights revocation of the active version fails closed instead of silently returning legacy", async () => {
    const f = fixture(); await successful(await stage(f)); await successful(await approve(f)); await successful(await select(f));
    await successful(await request(`corpus_versions?version=eq.${f.version}`, "service_role", "PATCH", { rights_revoked: true }));
    const response = await request("rpc/active_corpus_version", "anon", "POST", {});
    await rejected(response, /corpus_selection_unavailable/);
    await rejected(await request("rpc/corpus_related_images", "anon", "POST", { corpus_version: f.version, image_paths: [] }), /corpus_selection_unavailable/);
  });

  it("unknown or missing story permissions preserve a private draft and serve only the disclosed neutral asset", async () => {
    for (const image_source of [null, "Turismo de Asturias", JSON.stringify({ ...proof("/images/reviewed/old.webp"), status: "rejected" })]) {
      const id = randomUUID(); storyIds.push(id);
      const inserted = await request("stories", "service_role", "POST", { id, slug: `corpus-${id}`, title: "Synthetic image boundary", category: "nature", is_active: true, curation_status: "approved", image_path: "/images/reviewed/unknown.webp", image_source, metadata: { fixture_nonce: nonce } });
      expect(inserted.status).toBe(201);
      const row = requiredValue((await inserted.json())[0], "Inserted neutral story");
      expect(row.image_path).toBe(NEUTRAL_IMAGE); expect(row.image_source).toBe(NEUTRAL_CREDIT);
      expect(row.metadata).toEqual({ fixture_nonce: nonce });
      const drafts = await successful(await request(`story_image_drafts?story_id=eq.${id}&select=story_id,requested_path,requested_source,status`));
      expect(drafts).toEqual([{ story_id: id, requested_path: "/images/reviewed/unknown.webp", requested_source: image_source, status: "permission-review-required" }]);
      const publicRow = await successful(await request(`stories?id=eq.${id}&select=id,image_path,image_source`, "anon"));
      expect(publicRow[0]).toMatchObject({ image_path: NEUTRAL_IMAGE, image_source: NEUTRAL_CREDIT });
      const publicMetadata = await successful(await request(`stories?id=eq.${id}&select=metadata`, "anon"));
      expect(publicMetadata).toEqual([{ metadata: { fixture_nonce: nonce } }]);
      for (const role of ["anon", "owner", "nonowner"]) await denied(await request(`story_image_drafts?story_id=eq.${id}&select=*`, role));
    }
  });

  it("valid structured story credit survives roundtrip and cannot follow a path-only replacement", async () => {
    const id = randomUUID(); storyIds.push(id);
    const path = `/images/reviewed/${id}.webp`, source = canonicalJson(proof(path));
    const oldBlur = "data:image/webp;base64,c3ludGhldGljLW9sZC1ibHVy";
    const inserted = await request("stories", "service_role", "POST", { id, slug: `corpus-${id}`, title: "Synthetic reviewed photo", category: "nature", image_path: path, image_source: source, blur_data_url: oldBlur });
    expect(inserted.status).toBe(201);
    expect((await inserted.json())[0]).toMatchObject({ image_path: path, image_source: source, blur_data_url: oldBlur });
    const replacementPath = `/images/reviewed/replacement-${id}.webp`;
    const replaced = await successful(await request(`stories?id=eq.${id}`, "service_role", "PATCH", { image_path: replacementPath, image_source: canonicalJson(proof(replacementPath)) }));
    expect(replaced[0]).toMatchObject({ image_path: replacementPath, image_source: canonicalJson(proof(replacementPath)), blur_data_url: null });
    // A writer supplying a fresh derivative retains it; only inherited blur
    // from the old image must be discarded by the shared SQL boundary.
    const newBlur = "data:image/webp;base64,c3ludGhldGljLW5ldy1ibHVy";
    const restored = await successful(await request(`stories?id=eq.${id}`, "service_role", "PATCH", { image_path: path, image_source: source, blur_data_url: newBlur }));
    expect(restored[0]).toMatchObject({ image_path: path, image_source: source, blur_data_url: newBlur });
    const changed = await successful(await request(`stories?id=eq.${id}`, "service_role", "PATCH", { image_path: `/images/reviewed/another-${id}.webp` }));
    expect(changed[0]).toMatchObject({ image_path: NEUTRAL_IMAGE, image_source: NEUTRAL_CREDIT, blur_data_url: null });
    const draft = await successful(await request(`story_image_drafts?story_id=eq.${id}&select=requested_path,requested_source,status`));
    expect(draft).toEqual([{ requested_path: `/images/reviewed/another-${id}.webp`, requested_source: source, status: "permission-review-required" }]);
    const recovered = await successful(await request(`stories?id=eq.${id}`, "service_role", "PATCH", { image_path: path, image_source: source }));
    expect(recovered[0]).toMatchObject({ image_path: path, image_source: source });
  });

  it("the database story boundary rejects impossible dates, unsafe links and blank permission evidence", async () => {
    for (const patch of [{ date: "2026-02-30" }, { sourcePage: "https://user:password@owner.example.test/photo" }, { assetUrl: "javascript:alert(1)" }, { permission: "   " }, { permission: false }, { photographer: 123 }, { crop: { mobile: 123, desktop: "reviewed" } }]) {
      const id = randomUUID(); storyIds.push(id);
      const p = { ...proof(`/images/reviewed/${id}.webp`), ...patch };
      expect(await successful(await request("rpc/image_provenance_valid", "service_role", "POST", { p, asset_url: p.assetUrl }))).toBe(false);
      const inserted = await request("stories", "service_role", "POST", { id, slug: `corpus-${id}`, title: "Synthetic malformed review", category: "nature", image_path: p.assetUrl, image_source: canonicalJson(p) });
      expect(inserted.status).toBe(201);
      expect((await inserted.json())[0]).toMatchObject({ image_path: NEUTRAL_IMAGE, image_source: NEUTRAL_CREDIT });
    }
  });
});
