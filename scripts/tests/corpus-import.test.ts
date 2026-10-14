// @vitest-environment node
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main, stageCorpus } from "../corpus";
import { corpusContentHash, validateCorpus, type CorpusInput } from "../lib/corpus-manifest";
import { contentHash, type QualityScore } from "../lib/corpus-provenance";
import { imageProvenanceFixture } from "../../src/test/image-provenance-fixture";
import { requiredValue } from "../../src/test/required-value";
import { officialAttribution, projectOfficialSnapshot } from "../lib/official-structured-facts";

const NOW = new Date("2026-10-11T12:00:00Z");
const HASH = "a".repeat(64);
const TARGET = "http://127.0.0.1:54321";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Invented content, vectors, permission and review receipts only.
 * No source assertion, real review, quality approval or production authority
 * is established by these fixtures. The actual owned validators are exercised. */
function inputFixture(): CorpusInput {
  const documentId = uuid(1);
  const images = Array.from({ length: 5 }, (_, i) => {
    const path = `/images/synthetic-import-${i}.svg`;
    const provenance: unknown = JSON.parse(imageProvenanceFixture(path));
    return { id: uuid(100 + i), storyId: `synthetic-story-${i}`, path, provenance };
  });
  const chunks = Array.from({ length: 3 }, (_, i) => ({
    id: uuid(10 + i), documentId,
    content: `Synthetic garden marker ${i + 1} is an independently invented test sentence.`,
    sourceIds: ["synthetic-source"], factIds: ["synthetic-fact"],
    imageRefs: i === 0 ? images.map(image => image.path) : [],
    embedding: [1, ...Array.from({ length: 511 }, () => 0)],
  }));
  const input: CorpusInput = {
    schemaVersion: 1, version: "synthetic-import-test", model: "voyage-context-3", dimensions: 512,
    sources: [{ id: "synthetic-source", canonicalUrl: "https://www.wikidata.org/wiki/Q29", revision: "2090000000",
      retrievedAt: "2026-10-10T12:00:00Z", license: "CC0-1.0", allowedUse: "structured-facts", namespace: "main",
      attribution: "Synthetic source fixture; not evidence for the invented content", refreshAfter: "2027-01-01", evidenceSha256: HASH, reviewReceiptSha256: HASH }],
    facts: [{ id: "synthetic-fact", sourceId: "synthetic-source", property: "synthetic-property", value: "invented", statementId: "synthetic-statement" }],
    documents: [{ id: documentId, version: "synthetic-import-test", title: "Synthetic garden", language: "en", region: "fixture", topic: "fixture", season: "all", chunkIds: chunks.map(c => c.id) }],
    chunks, images,
    rights: { contentHash: HASH, reviewer: "Synthetic rights reviewer", evidenceSha256: HASH, recordedAt: "2026-10-10T12:00:00Z" },
    overlap: { contentHash: HASH, reviewer: "Synthetic overlap reviewer", evidenceSha256: HASH, recordedAt: "2026-10-10T12:00:00Z" },
  };
  input.rights.contentHash = input.overlap.contentHash = corpusContentHash(input);
  return input;
}

type RpcCall = { name: string; args: Record<string, unknown> };
function rowCount(args: Record<string, unknown>): number {
  if (!Array.isArray(args.p_rows)) throw new Error("Missing actual RPC row array");
  return args.p_rows.length;
}

describe("real corpus staging orchestration with only its RPC boundary substituted", () => {
  it("batches the entire exact manifest including the image-only tail without approving or selecting", async () => {
    const corpus = validateCorpus(inputFixture(), NOW);
    const calls: RpcCall[] = [];
    await stageCorpus(corpus, async (name, args) => { calls.push({ name, args }); return { data: rowCount(args), error: null }; }, 2);
    expect(calls).toHaveLength(3);
    expect(calls.map(call => call.name)).toEqual(["stage_corpus", "stage_corpus", "stage_corpus"]);
    expect(calls.map(call => call.args.p_rows)).toEqual([corpus.rows.slice(0, 2), corpus.rows.slice(2), []]);
    expect(calls.map(call => call.args.p_images)).toEqual([corpus.images.slice(0, 2), corpus.images.slice(2, 4), corpus.images.slice(4)]);
    for (const call of calls) {
      expect(call.args.p_hash).toBe(corpus.manifestHash);
      expect(call.args.p_manifest).toBe(corpus.manifestPayload);
    }
  });

  it("stops after a partial batch error and retries only the identical manifest/batch bytes", async () => {
    const corpus = validateCorpus(inputFixture(), NOW);
    const first: RpcCall[] = [];
    await expect(stageCorpus(corpus, async (name, args) => {
      first.push({ name, args });
      return first.length === 2 ? { data: null, error: { message: "Synthetic second-batch denial" } } : { data: rowCount(args), error: null };
    }, 2)).rejects.toThrow(/batch 2\/3 failed.*selection unchanged.*exact manifest/i);
    expect(first).toHaveLength(2);
    const resumed: RpcCall[] = [];
    await stageCorpus(corpus, async (name, args) => { resumed.push({ name, args }); return { data: rowCount(args), error: null }; }, 2);
    expect(resumed.slice(0, 2)).toEqual(first);
    expect(resumed).toHaveLength(3);
    expect([...first, ...resumed].every(call => call.name === "stage_corpus")).toBe(true);
    // Real database idempotency/atomicity is a separate PostgREST qualification.
  });

  it.each([0, -1, 1.5, 1001, NaN])("rejects invalid batch size %s before any RPC", async size => {
    const rpc = vi.fn(async () => ({ data: 0, error: null }));
    await expect(stageCorpus(validateCorpus(inputFixture(), NOW), rpc, size)).rejects.toThrow(/batch size/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([null, false, 0, 1, 3])("does not treat malformed/short staging acknowledgment %s as complete", async data => {
    const rpc = vi.fn(async () => ({ data, error: null }));
    await expect(stageCorpus(validateCorpus(inputFixture(), NOW), rpc, 2)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("actual corpus CLI authorization and quality-file boundaries", () => {
  let directory: string;
  let input: CorpusInput;
  let ready: ReturnType<typeof validateCorpus>;
  const requests: { url: string; body: unknown; method: string | undefined }[] = [];
  const fetchMock = vi.fn<typeof fetch>();

  const file = (name: string, value: unknown): string => {
    const path = join(directory, name);
    writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
    return path;
  };
  const authorization = (action: "stage" | "approve" | "select", patch: Record<string, unknown> = {}) => ({
    targetUrl: TARGET, action, manifestHash: ready.manifestHash, targetVersion: ready.version,
    expectedVersion: "legacy", rollbackVersion: "synthetic-approved-minimal", rollbackManifestHash: HASH, reviewer: "Synthetic operator only", evidenceSha256: HASH, ...patch,
  });
  function args(action: "stage" | "approve" | "select", patch: Record<string, unknown> = {}): string[] {
    return ["--mode=local", `--action=${action}`, `--manifest=${file("manifest.json", input)}`, `--authorization=${file("authorization.json", authorization(action, patch))}`];
  }
  function qualityFixture() {
    const queries = { schemaVersion: 1, queries: Array.from({ length: 40 }, (_, i) => ({
      id: `synthetic-q${i + 1}`, query: `Synthetic test question ${i + 1}?`, language: i % 2 ? "en" : "es",
      region: "fixture", topic: "fixture", season: "all", answerability: i < 20 ? "answerable" : i < 30 ? "unknown" : "safety",
      expectedSourceIds: i < 20 ? ["synthetic-source"] : [], unsupportedClaimsToReject: ["Unsupported synthetic advice"],
    })) };
    const judgments: QualityScore[] = queries.queries.map(q => ({ id: q.id, answerable: q.answerability === "answerable", factualSupport: 3, relevance: 3, grounding: 3, safeHandling: 3, sourceCorrect: true, unsupportedClaim: false }));
    const answers = (runId: string) => ({ schemaVersion: 1, runId, answers: queries.queries.map(q => ({ id: q.id,
      answer: `Invented test response for ${q.id}; not actual tourism evidence.`,
      sources: q.answerability === "answerable" ? [{ url: "https://example.com/synthetic-source", title: "Synthetic source" }] : [],
    })) });
    const baselineAnswers = answers("synthetic-baseline"); const candidateAnswers = answers("synthetic-candidate");
    const run = (artifact: typeof baselineAnswers) => ({ runId: artifact.runId, recordedAt: "2026-10-10T10:00:00Z",
      manifestHash: ready.manifestHash, corpusVersion: ready.version, embeddingModel: "voyage-context-3", dimensions: 512,
      answerModel: "claude-sonnet-5-5", configSha256: HASH, answersSha256: contentHash(artifact),
    });
    const quality = { schemaVersion: 1, querySetHash: contentHash(queries),
      baselineRun: { ...run(baselineAnswers), answerModel: "synthetic-historical-model", corpusVersion: "legacy" }, candidateRun: run(candidateAnswers),
      baselineAcceptance: { subjectHash: HASH, reviewer: "Synthetic owner", recordedAt: "2026-10-10T11:00:00Z", evidenceSha256: HASH },
      blindReview: { comparisonHash: HASH, scoresHash: HASH, recordedAt: "2026-10-10T12:00:00Z", evidenceSha256: HASH,
        reviewers: [{ name: "Synthetic independent agent", kind: "independent-agent" }, { name: "Synthetic owner", kind: "owner" }],
      }, baseline: judgments.map(s => ({ ...s })), candidate: judgments.map(s => ({ ...s })),
    };
    quality.baselineAcceptance.subjectHash = contentHash({ querySetHash: quality.querySetHash, run: quality.baselineRun });
    quality.blindReview.comparisonHash = contentHash({ querySetHash: quality.querySetHash, candidateRun: quality.candidateRun, baselineRun: quality.baselineRun });
    quality.blindReview.scoresHash = contentHash({ candidate: quality.candidate, baseline: quality.baseline });
    return { queries, quality, baselineAnswers, candidateAnswers };
  }
  function resealReview(fixture: ReturnType<typeof qualityFixture>) {
    const q = fixture.quality;
    q.baselineAcceptance.subjectHash = contentHash({ querySetHash: q.querySetHash, run: q.baselineRun });
    q.blindReview.comparisonHash = contentHash({ querySetHash: q.querySetHash, candidateRun: q.candidateRun, baselineRun: q.baselineRun });
    q.blindReview.scoresHash = contentHash({ candidate: q.candidate, baseline: q.baseline });
  }
  function approvalFixture(evidenceHash: string) {
    const receipt = { manifestHash: ready.manifestHash, reviewer: "Synthetic externally accepted review fixture", evidenceSha256: HASH };
    return { sample: { ...receipt }, rights: { ...receipt }, overlap: { ...receipt }, quality: { ...receipt, evidenceSha256: evidenceHash }, photos: { ...receipt } };
  }
  function approvalArgs(fixture = qualityFixture()): string[] {
    return [...args("approve"), `--queries=${file("queries.json", fixture.queries)}`, `--quality=${file("quality.json", fixture.quality)}`,
      `--baseline-answers=${file("baseline-answers.json", fixture.baselineAnswers)}`, `--candidate-answers=${file("candidate-answers.json", fixture.candidateAnswers)}`,
      `--approvals=${file("approvals.json", approvalFixture(contentHash(fixture.quality)))}`];
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "paisaxe-corpus-import-fixture-"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    input = inputFixture(); ready = validateCorpus(input, NOW);
    requests.length = 0; fetchMock.mockReset();
    fetchMock.mockImplementation(async (url, init) => {
      const target = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (!target.startsWith(`${TARGET}/rest/v1/rpc/`)) throw new Error("Unexpected synthetic HTTP egress");
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      requests.push({ url: target, body, method: init?.method });
      const result = target.endsWith("approve_corpus") ? true : target.endsWith("select_corpus") ? ready.version : ready.rows.length;
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CORPUS_TARGET_URL", TARGET);
    vi.stubEnv("CORPUS_SERVICE_KEY", "synthetic-service-key-not-a-real-credential");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers();
    rmSync(directory, { recursive: true, force: true });
  });

  it("defaults to validation-only dry-run with no service credentials or HTTP", async () => {
    vi.stubEnv("CORPUS_TARGET_URL", ""); vi.stubEnv("CORPUS_SERVICE_KEY", "");
    await main([`--manifest=${file("manifest.json", input)}`]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"writes":0'));
  });

  it("requires actual official snapshots even for dry-run and rejects altered fields with recomputed hashes before HTTP", async () => {
    const raw = { articles: { article: [{ Nombre: { content: "Synthetic restaurant" }, CodigoDGT: { content: "R9999" }, Contacto: { Concejo: { content: "Synthetic municipality" } } }] } };
    const snapshotPath = file("official-raw.json", raw);
    const projected = projectOfficialSnapshot("asturias-restaurants", JSON.stringify(raw));
    const row = requiredValue(projected.records[0], "Official CLI fixture row");
    const official = { dataset: "asturias-restaurants" as const, ...row, snapshotSha256: projected.snapshotSha256, projectionSha256: contentHash(row.fields), termsEvidenceSha256: HASH, termsDispositionSha256: HASH, publisherUpdatedAt: null, publisherRevision: null, productYear: null };
    input.sources[0] = { ...requiredValue(input.sources[0], "CLI source"), official, license: "CC-BY-4.0", allowedUse: "official-structured-facts", namespace: "official-dataset", canonicalUrl: "https://www.turismoasturiasprofesional.es/open-data/turismoasturias", revision: `sha256:${official.snapshotSha256}`, evidenceSha256: official.snapshotSha256, attribution: officialAttribution(official, "2026-10-10T12:00:00Z") };
    input.facts[0] = { ...requiredValue(input.facts[0], "CLI fact"), property: "Contacto.Concejo.content", value: "Synthetic municipality", statementId: "R9999:Contacto.Concejo.content" };
    input.rights.contentHash = input.overlap.contentHash = corpusContentHash(input);
    ready = validateCorpus(input, NOW);
    const dry = [`--manifest=${file("manifest.json", input)}`];
    await expect(main(dry)).rejects.toThrow(/official.*snapshot/i);
    const snapshots = `--official-snapshots=${file("snapshots.json", { [official.snapshotSha256]: snapshotPath })}`;
    await main([...dry, snapshots]);
    const alteredFields = { ...official.fields, "Nombre.content": "Fabricated name" };
    input.sources[0].official = { ...official, fields: alteredFields, projectionSha256: contentHash(alteredFields) };
    input.rights.contentHash = input.overlap.contentHash = corpusContentHash(input);
    ready = validateCorpus(input, NOW); // Structural checks deliberately pass.
    await expect(main([...args("stage"), snapshots])).rejects.toThrow(/snapshot|record/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only stage RPC for a valid exact local authorization", async () => {
    await main(args("stage"));
    expect(requests).toHaveLength(1);
    expect(requiredValue(requests[0], "stage HTTP call")).toMatchObject({ url: `${TARGET}/rest/v1/rpc/stage_corpus`, method: "POST", body: { p_hash: ready.manifestHash, p_manifest: ready.manifestPayload, p_rows: ready.rows, p_images: ready.images } });
  });

  it("requires an explicit write receipt even for loopback fixtures", async () => {
    await expect(main(args("stage").filter(a => !a.startsWith("--authorization=")))).rejects.toThrow(/authorization/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { targetUrl: "http://127.0.0.1:54322" }, { action: "select" }, { manifestHash: "b".repeat(64) }, { targetVersion: "another-corpus" },
  ])("[case %#] blocks a receipt for a different target/action/hash/version before HTTP", async patch => {
    await expect(main(args("stage", patch))).rejects.toThrow(/authorization differs/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["http://localhost:54321", "http://127.0.0.1.example.org:54321", "http://192.0.2.1:54321", "https://127.0.0.1:54321", "http://user:password@127.0.0.1:54321", `${TARGET}/rest/v1`, `${TARGET}/?other=1`, `${TARGET}/#other`])("rejects nonliteral or decorated local target %s before HTTP", async target => {
    vi.stubEnv("CORPUS_TARGET_URL", target);
    await expect(main(args("stage", { targetUrl: target }))).rejects.toThrow(/target|loopback/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not borrow unrelated Supabase environment defaults", async () => {
    vi.stubEnv("CORPUS_TARGET_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", TARGET);
    await expect(main(args("stage"))).rejects.toThrow(/explicit CORPUS_TARGET_URL/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires HTTPS for separately authorized apply mode", async () => {
    await expect(main(args("stage").map(a => a === "--mode=local" ? "--mode=apply" : a))).rejects.toThrow(/HTTPS/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", " ", "legacy"])("rejects absent or prohibited rollback identity %j before selection", async rollbackVersion => {
    await expect(main(args("select", { rollbackVersion }))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("binds selection to the exact expected version without implicitly approving", async () => {
    await main(args("select"));
    expect(requests).toHaveLength(1);
    expect(requiredValue(requests[0], "selection HTTP call")).toMatchObject({ url: `${TARGET}/rest/v1/rpc/select_corpus`, body: { p_version: ready.version, p_hash: ready.manifestHash, p_expected_version: "legacy", p_authorization: authorization("select") } });
  });

  it("approves only the supplied exact reviewed manifest and quality evidence without selecting it", async () => {
    await main(approvalArgs());
    expect(requests).toHaveLength(1);
    expect(requiredValue(requests[0], "approval HTTP call")).toMatchObject({ url: `${TARGET}/rest/v1/rpc/approve_corpus`, body: { p_version: ready.version, p_hash: ready.manifestHash } });
  });

  it.each(["sample", "rights", "overlap", "quality", "photos"] as const)("rejects missing %s approval before HTTP", async gate => {
    const argv = approvalArgs(); const fixture = qualityFixture();
    const approvals = approvalFixture(contentHash(fixture.quality));
    const partial = Object.fromEntries(Object.entries(approvals).filter(([key]) => key !== gate));
    file("approvals.json", partial);
    await expect(main(argv)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a review receipt for another manifest", async () => {
    const argv = approvalArgs(); const fixture = qualityFixture(); const approvals = approvalFixture(contentHash(fixture.quality));
    approvals.rights.manifestHash = "b".repeat(64); file("approvals.json", approvals);
    await expect(main(argv)).rejects.toThrow(/another manifest/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["quality", "queries", "baseline-answers", "candidate-answers"] as const)("requires the actual %s file before approval HTTP", async option => {
    await expect(main(approvalArgs().filter(a => !a.startsWith(`--${option}=`)))).rejects.toThrow(/quality|queries|query|answers/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["baseline", "candidate"] as const)("rejects edited %s answer-file bytes before approval HTTP", async run => {
    const fixture = qualityFixture(); const argv = approvalArgs(fixture);
    const artifact = run === "baseline" ? fixture.baselineAnswers : fixture.candidateAnswers;
    file(`${run}-answers.json`, { ...artifact, answers: artifact.answers.map((answer, i) => i === 0 ? { ...answer, answer: "Changed synthetic recorded response" } : answer) });
    await expect(main(argv)).rejects.toThrow(/answer.*hash|hash.*answer/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects edited baseline scores despite otherwise passing quality thresholds", async () => {
    const fixture = qualityFixture(); const argv = approvalArgs(fixture);
    fixture.quality.baseline = fixture.quality.baseline.map((s, i) => i === 0 ? { ...s, relevance: 2 } : s);
    file("quality.json", fixture.quality);
    await expect(main(argv)).rejects.toThrow(/Quality evidence receipt mismatch/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects changed query wording under the same IDs when its frozen hash no longer matches", async () => {
    const fixture = qualityFixture(); const argv = approvalArgs(fixture);
    fixture.queries.queries = fixture.queries.queries.map((q, i) => i === 0 ? { ...q, query: "A different invented query?" } : q);
    file("queries.json", fixture.queries);
    await expect(main(argv)).rejects.toThrow(/Frozen query hash mismatch/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not approve forty unrelated judgments merely because they share IDs with each other", async () => {
    const fixture = qualityFixture();
    fixture.quality.baseline = fixture.quality.baseline.map((s, i) => ({ ...s, id: `unfrozen-${i}` }));
    fixture.quality.candidate = fixture.quality.candidate.map((s, i) => ({ ...s, id: `unfrozen-${i}` }));
    resealReview(fixture);
    await expect(main(approvalArgs(fixture))).rejects.toThrow(/query|frozen|identity|mismatch/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not approve jointly changed answerability contrary to the frozen query set", async () => {
    const fixture = qualityFixture();
    fixture.quality.baseline = fixture.quality.baseline.map((s, i) => i === 0 ? { ...s, answerable: false } : s);
    fixture.quality.candidate = fixture.quality.candidate.map((s, i) => i === 0 ? { ...s, answerable: false } : s);
    resealReview(fixture);
    await expect(main(approvalArgs(fixture))).rejects.toThrow(/query|frozen|answerab|mismatch/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["missing", "duplicate"] as const)("rejects a %s frozen query even with a self-consistent file hash", async defect => {
    const fixture = qualityFixture();
    fixture.queries.queries = defect === "missing" ? fixture.queries.queries.slice(1) : fixture.queries.queries.map((q, i) => i === 39 ? { ...q, id: "synthetic-q1" } : q);
    fixture.quality.querySetHash = contentHash(fixture.queries);
    resealReview(fixture);
    await expect(main(approvalArgs(fixture))).rejects.toThrow(/query|forty|distinct|mismatch|40/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks unsupported claims even when their review-file hashes agree", async () => {
    const fixture = qualityFixture();
    fixture.quality.candidate = fixture.quality.candidate.map((s, i) => i === 39 ? { ...s, unsupportedClaim: true } : s);
    resealReview(fixture);
    await expect(main(approvalArgs(fixture))).rejects.toThrow(/unsupported/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
