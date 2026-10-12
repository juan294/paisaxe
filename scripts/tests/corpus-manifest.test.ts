// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { corpusContentHash, validateCorpus, type CorpusInput } from "../lib/corpus-manifest";
import { requiredValue } from "../../src/test/required-value";
import { contentHash } from "../lib/corpus-provenance";
import { officialAttribution, officialDatasetDetails } from "../lib/official-structured-facts";

const NOW = new Date("2026-10-11T12:00:00Z");
const HASH = "a".repeat(64);
const DOC = "11111111-1111-4111-8111-111111111111";
const CHUNK = "22222222-2222-4222-8222-222222222222";
const IMAGE = "33333333-3333-4333-8333-333333333333";

function bindReceipts(input: CorpusInput): CorpusInput {
  const hash = corpusContentHash(input);
  input.rights.contentHash = hash;
  input.overlap.contentHash = hash;
  return input;
}

/** All content, evidence and approvals below are synthetic test fixtures.
 * Q29 is a structural URL fixture, not evidence for this invented garden.
 * These receipts do not approve real material, assets or production import. */
function fixture(): CorpusInput {
  return bindReceipts({
    schemaVersion: 1,
    version: "phase12-synthetic-test",
    model: "voyage-context-3",
    dimensions: 512,
    sources: [{
      id: "fixture-source", canonicalUrl: "https://www.wikidata.org/wiki/Q29",
      revision: "2090000000", retrievedAt: "2026-10-10T12:00:00Z",
      license: "CC0-1.0", allowedUse: "structured-facts", namespace: "main",
      attribution: "Wikidata contributors; synthetic fixture only",
      refreshAfter: "2027-01-01", evidenceSha256: HASH, reviewReceiptSha256: HASH,
    }],
    facts: [{ id: "fixture-fact", sourceId: "fixture-source", property: "fixture-count", value: 7, statementId: "fixture-statement" }],
    documents: [{ id: DOC, version: "phase12-synthetic-test", title: "Invented test garden", language: "en", region: "fixture-region", topic: "fixture-geography", season: "all", chunkIds: [CHUNK] }],
    chunks: [{ id: CHUNK, documentId: DOC, content: "The imaginary test garden has seven blue markers. This sentence describes a synthetic fixture only.", sourceIds: ["fixture-source"], factIds: ["fixture-fact"], imageRefs: ["/images/phase12-synthetic.svg"], embedding: [1, ...Array.from({ length: 511 }, () => 0)] }],
    images: [{ id: IMAGE, storyId: "synthetic-story", path: "/images/phase12-synthetic.svg", provenance: {
      assetUrl: "/images/phase12-synthetic.svg", originalSha256: HASH, replacementSha256: HASH,
      sourcePage: "https://example.org/synthetic-owner-permission", photographer: "Synthetic illustrator",
      license: "owner-permission", permission: "TEST FIXTURE ONLY: no actual permission or asset",
      date: "2026-10-10", credit: "Synthetic fixture illustration", context: "thematic",
      alt: "Seven invented blue markers", crop: { mobile: "Synthetic mobile review", desktop: "Synthetic desktop review" },
      reviewer: "TEST FIXTURE reviewer", reviewReceipt: HASH, status: "approved", flow: "manual",
    } }],
    rights: { contentHash: HASH, reviewer: "TEST FIXTURE rights reviewer", evidenceSha256: HASH, recordedAt: "2026-10-10T12:00:00Z" },
    overlap: { contentHash: HASH, reviewer: "TEST FIXTURE overlap reviewer", evidenceSha256: HASH, recordedAt: "2026-10-10T12:00:00Z" },
  });
}

const chunk = (input: CorpusInput) => requiredValue(input.chunks[0], "fixture chunk");
const document = (input: CorpusInput) => requiredValue(input.documents[0], "fixture document");
const source = (input: CorpusInput) => requiredValue(input.sources[0], "fixture source");
const fact = (input: CorpusInput) => requiredValue(input.facts[0], "fixture fact");
const image = (input: CorpusInput) => requiredValue(input.images[0], "fixture image");

describe("corpus manifest payload and exact approval binding", () => {
  it("emits usable deterministic payloads whose hashes cover their actual bytes", () => {
    const input = fixture();
    const result = validateCorpus(input, NOW);
    const reorderedSource = source(input);
    const { revision, ...remainingSource } = reorderedSource;
    const again = validateCorpus({ ...input, version: input.version, sources: [{ revision, ...remainingSource }] }, NOW);
    expect(result).toEqual(again);
    expect(result.rows).toHaveLength(1);
    expect(result.images).toHaveLength(1);
    const row = requiredValue(result.rows[0], "emitted chunk");
    expect(row.hash).toBe(createHash("sha256").update(row.payload).digest("hex"));
    expect(result.manifestHash).toBe(createHash("sha256").update(result.manifestPayload).digest("hex"));
    expect(JSON.parse(row.payload)).toMatchObject({ id: CHUNK, content: chunk(input).content, citation: { url: source(input).canonicalUrl, revision: source(input).revision, license: "CC0-1.0" } });
    expect(row.payload).not.toContain("sourcePdf");
    expect(row.payload).not.toContain("pageNumber");
  });

  it.each(["rights", "overlap"] as const)("rejects a stale %s receipt after content changes", receipt => {
    const input = fixture();
    chunk(input).content += " A ninth synthetic marker was added.";
    input[receipt === "rights" ? "overlap" : "rights"].contentHash = corpusContentHash(input);
    expect(() => validateCorpus(input, NOW)).toThrow(/receipts.*exact content hash/i);
  });

  it("requires renewed review for changed source revision even when prose is unchanged", () => {
    const input = fixture();
    source(input).revision = "2090000001";
    expect(() => validateCorpus(input, NOW)).toThrow(/exact content hash/i);
  });

  it("keeps text approvals stable across vector changes while sealing the new vector payload", () => {
    const input = fixture();
    const before = validateCorpus(input, NOW);
    chunk(input).embedding[0] = 2;
    expect(corpusContentHash(input)).toBe(input.rights.contentHash);
    const after = validateCorpus(input, NOW);
    expect(requiredValue(after.rows[0], "changed row").hash).not.toBe(requiredValue(before.rows[0], "original row").hash);
    expect(after.manifestHash).not.toBe(before.manifestHash);
  });

  it.each(["sources", "facts", "documents", "chunks", "images"] as const)("rejects duplicate %s identities", field => {
    const input = fixture();
    if (field === "sources") input.sources.push({ ...source(input) });
    if (field === "facts") input.facts.push({ ...fact(input) });
    if (field === "documents") input.documents.push({ ...document(input) });
    if (field === "chunks") input.chunks.push({ ...chunk(input) });
    if (field === "images") input.images.push({ ...image(input) });
    bindReceipts(input);
    expect(() => validateCorpus(input, NOW)).toThrow(/duplicate/i);
  });

  it.each(["source", "fact", "document", "image"] as const)("rejects a dangling chunk %s reference", field => {
    const input = fixture();
    if (field === "source") chunk(input).sourceIds = ["missing-source"];
    if (field === "fact") chunk(input).factIds = ["missing-fact"];
    if (field === "document") chunk(input).documentId = "missing-document";
    if (field === "image") chunk(input).imageRefs = ["/images/missing.svg"];
    bindReceipts(input);
    expect(() => validateCorpus(input, NOW)).toThrow(/missing|orphan|unsupported/i);
  });

  it("rejects a fact belonging to an uncited source", () => {
    const input = fixture();
    input.sources.push({ ...source(input), id: "other-source" });
    fact(input).sourceId = "other-source";
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/unsupported fact/i);
  });

  it("rejects a fact whose source is absent from the manifest", () => {
    const input = fixture();
    fact(input).sourceId = "absent-source";
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/has no source/i);
  });

  it.each(["missing", "extra", "duplicate", "wrong-version"] as const)("rejects %s document/chunk membership", mode => {
    const input = fixture();
    if (mode === "missing") document(input).chunkIds = [];
    if (mode === "extra") document(input).chunkIds.push("44444444-4444-4444-8444-444444444444");
    if (mode === "duplicate") document(input).chunkIds.push(CHUNK);
    if (mode === "wrong-version") document(input).version = "another-version";
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow();
  });

  it.each(["sourceIds", "factIds", "imageRefs"] as const)("rejects duplicate chunk %s", field => {
    const input = fixture();
    const value = requiredValue(chunk(input)[field][0], "fixture reference");
    chunk(input)[field].push(value);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/duplicate/i);
  });

  it("rejects normalized duplicate content even with different valid chunk IDs", () => {
    const input = fixture();
    const second = { ...chunk(input), id: "44444444-4444-4444-8444-444444444444", content: `  ${chunk(input).content}  ` };
    input.chunks.push(second);
    document(input).chunkIds.push(second.id);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/duplicate chunk content/i);
  });

  it("rejects two image records sharing a storage path", () => {
    const input = fixture();
    input.images.push({ ...image(input), id: "44444444-4444-4444-8444-444444444444" });
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/duplicate image paths/i);
  });
});

describe("corpus fail-closed input boundaries", () => {
  it.each([
    ["missing revision", { revision: "" }],
    ["nonnumeric Wikidata revision", { revision: "not-a-revision" }],
    ["missing evidence hash", { evidenceSha256: "" }],
    ["missing source review", { reviewReceiptSha256: "" }],
    ["Wikipedia prose URL", { canonicalUrl: "https://en.wikipedia.org/wiki/Asturias" }],
    ["non-main namespace", { namespace: "owner" }],
    ["wrong structured license", { license: "owner-permission" }],
    ["credential-bearing URL", { canonicalUrl: "https://user:secret@www.wikidata.org/wiki/Q29" }],
    ["non-item Wikidata URL", { canonicalUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing" }],
    ["stale source", { refreshAfter: "2026-10-10" }],
    ["future retrieval", { retrievedAt: "2026-10-12T12:00:00Z" }],
  ] satisfies Array<[string, Record<string, unknown>]>)("rejects %s independently of content receipts", (_label, patch) => {
    const input = fixture();
    Object.assign(source(input), patch);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow();
  });

  it.each([
    ["wrong model", { model: "voyage-3.5" }],
    ["wrong dimensions", { dimensions: 1024 }],
    ["legacy version", { version: "legacy" }],
    ["missing rights", { rights: undefined }],
    ["missing overlap", { overlap: undefined }],
    ["partial chunks", { chunks: [] }],
    ["partial sources", { sources: [] }],
    ["partial facts", { facts: [] }],
    ["partial documents", { documents: [] }],
    ["extra unchecked payload", { unreviewedPayload: "must not silently survive" }],
  ] satisfies Array<[string, Record<string, unknown>]>)("rejects %s", (_label, patch) => {
    expect(() => validateCorpus({ ...fixture(), ...patch }, NOW)).toThrow();
  });

  it.each([
    { embedding: [] },
    { embedding: [1] },
    { embedding: Array.from({ length: 512 }, () => 0) },
    { embedding: [NaN, ...Array.from({ length: 511 }, () => 0)] },
    { embedding: [Infinity, ...Array.from({ length: 511 }, () => 0)] },
  ])("rejects a missing, wrong-sized, zero or nonfinite vector", ({ embedding }) => {
    const input = fixture();
    chunk(input).embedding = embedding;
    expect(() => validateCorpus(input, NOW)).toThrow(/vector|number/i);
  });

  it.each(["not-a-uuid", "22222222-2222-2222-2222-222222222222"])("rejects malformed chunk ID %s", id => {
    const input = fixture();
    chunk(input).id = id;
    document(input).chunkIds = [id];
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow();
  });

  it("rejects a malformed document UUID even when its chunk reference agrees", () => {
    const input = fixture();
    document(input).id = "not-a-document-uuid";
    chunk(input).documentId = "not-a-document-uuid";
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow();
  });

  it.each(["rights", "overlap"] as const)("rejects missing reviewer evidence in the %s receipt", receipt => {
    const input = fixture();
    input[receipt].reviewer = " ";
    input[receipt].evidenceSha256 = "";
    expect(() => validateCorpus(input, NOW)).toThrow();
  });

  it.each([
    ["unreviewed image", { status: "pending" }],
    ["automatic permission inference", { flow: "automatic" }],
    ["wrong replacement bytes", { replacementSha256: "wrong" }],
    ["missing crop", { crop: { desktop: "reviewed" } }],
    ["missing permission receipt", { reviewReceipt: "" }],
    ["different asset", { assetUrl: "/images/a-different-file.svg" }],
  ] satisfies Array<[string, Record<string, unknown>]>)("rejects %s", (_label, patch) => {
    const input = fixture();
    const provenance = image(input).provenance;
    if (typeof provenance !== "object" || provenance === null) throw new Error("Missing synthetic image provenance");
    image(input).provenance = { ...provenance, ...patch };
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/accepted permission\/crop\/byte review/i);
  });
});

describe("official structured source admission (synthetic evidence only)", () => {
  function officialFixture() {
    const input = fixture();
    Object.assign(source(input), {
      canonicalUrl: "https://www.turismoasturiasprofesional.es/open-data/turismoasturias",
      revision: `sha256:${HASH}`, license: "CC-BY-4.0", allowedUse: "official-structured-facts", namespace: "official-dataset",
      attribution: "Administración del Principado de Asturias · Restaurantes y sidrerías · R9999 · actualización no facilitada · año del producto no facilitado · consulta 2026-10-10 · campos sin modificar; selección y redacción propia; sin respaldo del editor",
      official: { dataset: "asturias-restaurants", snapshotSha256: HASH, recordId: "R9999", rowIndex: 0,
        fields: { "Nombre.content": "Restaurante sintético", "CodigoDGT.content": "R9999", "Contacto.Concejo.content": "Concejo sintético" },
        projectionSha256: createHash("sha256").update('{"CodigoDGT.content":"R9999","Contacto.Concejo.content":"Concejo sintético","Nombre.content":"Restaurante sintético"}').digest("hex"),
        termsEvidenceSha256: HASH, termsDispositionSha256: HASH, publisherUpdatedAt: null, publisherRevision: null, productYear: null },
    });
    Object.assign(fact(input), { property: "Contacto.Concejo.content", value: "Concejo sintético", statementId: "R9999:Contacto.Concejo.content" });
    return bindReceipts(input);
  }

  it("admits a separately reviewed exact snapshot and preserves the complete attribution", () => {
    const input = officialFixture();
    const result = validateCorpus(input, NOW);
    const citation = JSON.parse(requiredValue(result.rows[0], "official row").payload).citation;
    expect(citation.license).toBe("CC-BY-4.0");
    expect(citation.attribution).toBe(source(input).attribution);
    expect(citation.revision).toBe(`sha256:${HASH}`);
    expect(JSON.parse(result.manifestPayload).sources[0].official.publisherUpdatedAt).toBeNull();
  });

  it.each(["asturias-beaches", "asturias-viewpoints"] as const)("admits only the exact reviewed %s identity projection", dataset => {
    const input = officialFixture();
    const s = source(input);
    const official = requiredValue(s.official, "Official synthetic metadata");
    Object.assign(official, { dataset, recordId: "7", fields: { objectid: 7, nombre: "Synthetic place", concejo: "Synthetic municipality" } });
    official.projectionSha256 = contentHash(official.fields);
    s.canonicalUrl = officialDatasetDetails[dataset].url;
    s.attribution = officialAttribution(official, s.retrievedAt);
    Object.assign(fact(input), { property: "concejo", value: "Synthetic municipality", statementId: "7:concejo" });
    expect(validateCorpus(bindReceipts(input), NOW).rows).toHaveLength(1);
  });

  it("requires an official source re-review within ninety days of acquisition", () => {
    const input = officialFixture();
    source(input).refreshAfter = "2027-01-10";
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/official scope/i);
  });

  it.each(["\t", "\n", "\u00a0", "\ufeff"])("rejects an unchanged but whitespace-only official name (%j)", blank => {
    const input = officialFixture();
    const official = requiredValue(source(input).official, "Official metadata");
    official.fields["Nombre.content"] = blank;
    official.projectionSha256 = contentHash(official.fields);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/official source/i);
  });

  it.each([
    ["unreviewed dataset", { dataset: "asturias-hotels" }],
    ["changed snapshot", { snapshotSha256: "b".repeat(64) }],
    ["wrong projection", { projectionSha256: "b".repeat(64) }],
    ["unreviewed terms disposition", { termsDispositionSha256: "" }],
    ["invented publisher update", { publisherUpdatedAt: "2026-10-10" }],
    ["invented product year", { productYear: 2026 }],
    ["wrong row identity", { recordId: "R1111" }],
    ["unchecked contact fields", { fields: { "Nombre.content": "Synthetic", "CodigoDGT.content": "R9999", "Contacto.Concejo.content": "Synthetic", "Contacto.Email.content": "private@example.test" } }],
  ])("rejects %s", (_label, patch) => {
    const input = officialFixture();
    const current = source(input) as unknown as { official: Record<string, unknown> };
    Object.assign(current.official, patch);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow();
  });

  it.each([
    { canonicalUrl: "https://www.turismoasturiasprofesional.es/unreviewed-page" },
    { canonicalUrl: "https://www.turismoasturiasprofesional.es/open-data/turismoasturias?other=data" },
    { attribution: "Turismo Asturias" }, { revision: "2026-10-10" },
    { allowedUse: "structured-facts" }, { namespace: "owner" }, { official: undefined },
  ])("rejects mislabelled official source metadata", patch => {
    const input = officialFixture();
    Object.assign(source(input), patch);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow();
  });

  it.each([
    { property: "opening-hours", value: "Always open", statementId: "R9999:opening-hours" },
    { value: "Altered municipality" }, { statementId: "wrong-record:Contacto.Concejo.content" },
  ])("rejects facts outside the exact source projection", patch => {
    const input = officialFixture();
    Object.assign(fact(input), patch);
    expect(() => validateCorpus(bindReceipts(input), NOW)).toThrow(/official fact/i);
  });
});
