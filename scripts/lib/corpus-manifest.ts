import { z } from "zod";
import { canonicalJson, contentHash, validateVector } from "./corpus-provenance";
import { parseImageProvenance } from "../../src/lib/image-provenance";
import { officialAttribution, officialDatasetDetails, officialSourceSchema, validateOfficialSource } from "./official-structured-facts";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const nonempty = z.string().trim().min(1);
const https = z.url().refine(v => { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; });
const receipt = z.object({ contentHash: sha, reviewer: nonempty, evidenceSha256: sha, recordedAt: z.iso.datetime() }).strict();
const source = z.object({ id: nonempty, canonicalUrl: https, revision: nonempty, retrievedAt: z.iso.datetime(),
  license: z.enum(["CC0-1.0", "owner-permission", "CC-BY-4.0"]), allowedUse: z.enum(["structured-facts", "owner-material", "official-structured-facts"]),
  namespace: z.enum(["main", "owner", "official-dataset"]), attribution: nonempty, refreshAfter: z.iso.date(), evidenceSha256: sha, reviewReceiptSha256: sha,
  official: officialSourceSchema.optional() }).strict();
const fact = z.object({ id: nonempty, sourceId: nonempty, property: nonempty, value: z.unknown(), statementId: nonempty }).strict();
const document = z.object({ id: nonempty, version: nonempty, title: nonempty, language: z.enum(["es", "en"]), region: nonempty, topic: nonempty, season: nonempty, chunkIds: z.array(z.uuid()).min(1) }).strict();
const chunk = z.object({ id: z.uuid(), documentId: nonempty, content: nonempty, sourceIds: z.array(nonempty).min(1), factIds: z.array(nonempty).min(1), imageRefs: z.array(nonempty), embedding: z.array(z.number()) }).strict();
const image = z.object({ id: z.uuid(), storyId: nonempty, path: nonempty, provenance: z.unknown() }).strict();
export const corpusSchema = z.object({ schemaVersion: z.literal(1), version: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).refine(v => v !== "legacy"),
  model: z.literal("voyage-context-3"), dimensions: z.literal(512), sources: z.array(source).min(1), facts: z.array(fact).min(1),
  documents: z.array(document).min(1), chunks: z.array(chunk).min(1), images: z.array(image), rights: receipt, overlap: receipt }).strict();
export type CorpusInput = z.infer<typeof corpusSchema>;

export function corpusContentHash(input: CorpusInput): string {
  return contentHash({ ...input, rights: null, overlap: null, chunks: input.chunks.map(({ embedding: _embedding, ...c }) => c) });
}

/** Produces only deterministic payloads. It never authors, embeds, approves or connects. */
export function validateCorpus(input: unknown, now = new Date()) {
  const corpus = corpusSchema.parse(input);
  const fail = (message: string): never => { throw new Error(message); };
  const distinct = (values: string[], label: string) => { if (new Set(values).size !== values.length) fail(`Duplicate ${label}`); };
  for (const [label, rows] of Object.entries({ sources: corpus.sources, facts: corpus.facts, documents: corpus.documents, chunks: corpus.chunks, images: corpus.images })) distinct(rows.map(r => r.id), label);
  distinct(corpus.images.map(i => i.path), "image paths");
  distinct(corpus.chunks.map(c => contentHash(c.content.normalize("NFKC").trim())), "chunk content");
  for (const s of corpus.sources) {
    if (Date.parse(s.refreshAfter) < now.getTime() || Date.parse(s.retrievedAt) > now.getTime()) fail(`Source ${s.id} needs refresh`);
    if (s.allowedUse === "structured-facts" && (!/^[1-9][0-9]*$/.test(s.revision) || s.namespace !== "main" || s.license !== "CC0-1.0" || !/^https:\/\/www\.wikidata\.org\/(?:wiki|entity)\/Q[1-9][0-9]*$/.test(s.canonicalUrl))) fail(`Source ${s.id} is outside reviewed structured scope`);
    if (s.allowedUse === "owner-material" && (s.namespace !== "owner" || s.license !== "owner-permission")) fail(`Source ${s.id} lacks owner permission`);
    if (s.allowedUse === "official-structured-facts") {
      const official = s.official;
      if (!official) return fail(`Source ${s.id} lacks official evidence`);
      if (s.namespace !== "official-dataset" || s.license !== "CC-BY-4.0" ||
          s.canonicalUrl !== officialDatasetDetails[official.dataset].url || s.revision !== `sha256:${official.snapshotSha256}` ||
          s.evidenceSha256 !== official.snapshotSha256 || s.attribution !== officialAttribution(official, s.retrievedAt) ||
          Date.parse(s.refreshAfter) > Date.parse(s.retrievedAt) + 90 * 86400000) fail(`Source ${s.id} is outside reviewed official scope`);
      validateOfficialSource(official);
    } else if (s.official) fail(`Source ${s.id} has mislabelled official evidence`);
  }
  const sources = new Map(corpus.sources.map(s => [s.id, s]));
  const facts = new Map(corpus.facts.map(f => [f.id, f]));
  const documents = new Map(corpus.documents.map(d => [d.id, d]));
  const imagePaths = new Set(corpus.images.map(i => i.path));
  for (const f of corpus.facts) {
    const s = sources.get(f.sourceId);
    if (!s) return fail(`Fact ${f.id} has no source`);
    if (s.official && (!Object.hasOwn(s.official.fields, f.property) || canonicalJson(f.value) !== canonicalJson(s.official.fields[f.property]) || f.statementId !== `${s.official.recordId}:${f.property}`)) fail(`Unsupported official fact ${f.id}`);
  }
  for (const d of corpus.documents) {
    if (!z.uuid().safeParse(d.id).success) fail(`Invalid or missing document UUID: ${d.id}`);
    if (d.version !== corpus.version) fail(`Document ${d.id} has wrong version`);
    distinct(d.chunkIds, "document chunk references");
    const actual = corpus.chunks.filter(c => c.documentId === d.id).map(c => c.id).sort();
    if (canonicalJson(actual) !== canonicalJson([...d.chunkIds].sort())) fail(`Document ${d.id} has missing or orphan chunks`);
  }
  const rows = corpus.chunks.map(c => {
    validateVector(c.embedding);
    const d = documents.get(c.documentId);
    const firstSource = sources.get(c.sourceIds[0] ?? "");
    if (!d || !firstSource || c.sourceIds.some(id => !sources.has(id))) return fail(`Chunk ${c.id} has missing document/source`);
    distinct(c.sourceIds, "chunk sources"); distinct(c.factIds, "chunk facts"); distinct(c.imageRefs, "chunk image references");
    if (c.factIds.some(id => { const f = facts.get(id); return !f || !c.sourceIds.includes(f.sourceId); })) fail(`Chunk ${c.id} has unsupported fact references`);
    if (!c.factIds.some(id => facts.get(id)?.sourceId === firstSource.id)) fail(`Chunk ${c.id} primary citation does not support a referenced fact`);
    if (c.imageRefs.some(path => !imagePaths.has(path))) fail(`Chunk ${c.id} has orphan image reference`);
    const payload = canonicalJson({ id: c.id, documentId: c.documentId, sourceIds: c.sourceIds, factIds: c.factIds, content: c.content, title: d.title, embedding: c.embedding, imageRefs: c.imageRefs,
      citation: { title: d.title, url: firstSource.canonicalUrl, license: firstSource.license, revision: firstSource.revision, attribution: firstSource.attribution } });
    return { id: c.id, payload, hash: contentHash(JSON.parse(payload)) };
  });
  const images = corpus.images.map(i => {
    const provenance = parseImageProvenance(JSON.stringify(i.provenance));
    if (!provenance || provenance.assetUrl !== i.path) return fail(`Image ${i.id} lacks accepted permission/crop/byte review`);
    const payload = canonicalJson({ id: i.id, storyId: i.storyId, path: i.path, provenance });
    return { id: i.id, payload, hash: contentHash(JSON.parse(payload)) };
  });
  const digest = corpusContentHash(corpus);
  if (corpus.rights.contentHash !== digest || corpus.overlap.contentHash !== digest) fail("Rights and overlap receipts must bind the exact content hash");
  const manifest = { ...corpus, contentHash: digest, chunks: rows.map(({ id, hash }) => ({ id, hash })), images: images.map(({ id, hash }) => ({ id, hash })) };
  const manifestPayload = canonicalJson(manifest);
  return { version: corpus.version, manifestHash: contentHash(manifest), manifestPayload, rows, images };
}
