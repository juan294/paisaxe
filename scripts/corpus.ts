/** Offline validation is the default. This CLI never authors or embeds content. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corpusSchema, validateCorpus } from "./lib/corpus-manifest";
import { contentHash } from "./lib/corpus-provenance";
import { validateQualityEvidence } from "./lib/corpus-quality-evidence";
import { verifyOfficialSnapshot } from "./lib/official-structured-facts";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const receipt = z.object({ manifestHash: sha, reviewer: z.string().trim().min(1), evidenceSha256: sha }).passthrough();
const approvalsSchema = z.object({ sample: receipt, rights: receipt, overlap: receipt, quality: receipt, photos: receipt }).strict();
type ReadyCorpus = ReturnType<typeof validateCorpus>;
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
export async function stageCorpus(corpus: ReadyCorpus, rpc: Rpc, batchSize = 100): Promise<void> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error("Invalid import batch size");
  // Every batch is a transaction. Same manifest + row hashes resume idempotently.
  // No approval/promotion happens here, including after the final batch.
  const batches = Math.max(Math.ceil(corpus.rows.length / batchSize), Math.ceil(corpus.images.length / batchSize));
  for (let i = 0; i < batches; i++) {
    const rows = corpus.rows.slice(i * batchSize, (i + 1) * batchSize);
    const result = await rpc("stage_corpus", { p_manifest: corpus.manifestPayload, p_hash: corpus.manifestHash,
      p_rows: rows, p_images: corpus.images.slice(i * batchSize, (i + 1) * batchSize) });
    if (result.error) throw new Error(`Staging batch ${i + 1}/${batches} failed; selection unchanged; resume this exact manifest: ${result.error.message ?? "database error"}`);
    if (result.data !== rows.length) throw new Error(`Staging batch ${i + 1}/${batches} acknowledgment mismatch; selection unchanged`);
  }
}

function json(path: string): unknown { return JSON.parse(readFileSync(resolve(path), "utf8")); }
export async function main(args: string[]) {
  const option = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const mode = option("mode") ?? "dry-run";
  const action = option("action") ?? "stage";
  if (!["dry-run", "local", "apply"].includes(mode) || !["stage", "approve", "select"].includes(action)) throw new Error("Use --mode=dry-run|local|apply --action=stage|approve|select");
  const manifestPath = option("manifest");
  if (!manifestPath) throw new Error("--manifest=FILE is required (draft samples cannot be imported)");
  const input = corpusSchema.parse(json(manifestPath));
  const corpus = validateCorpus(input);
  const officialSources = input.sources.flatMap(source => source.official ? [source.official] : []);
  if (officialSources.length) {
    const path = option("official-snapshots");
    if (!path) throw new Error("--official-snapshots=FILE is required for official source evidence, including dry-run");
    const snapshots = z.record(sha, z.string().min(1)).parse(json(path));
    const raw = new Map<string, string>();
    for (const source of officialSources) {
      const snapshotPath = snapshots[source.snapshotSha256];
      if (!snapshotPath) throw new Error("Official snapshot evidence is missing");
      let bytes = raw.get(source.snapshotSha256);
      if (bytes === undefined) { bytes = readFileSync(resolve(snapshotPath), "utf8"); raw.set(source.snapshotSha256, bytes); }
      verifyOfficialSnapshot(source, bytes);
    }
  }
  if (mode === "dry-run") {
    console.log(JSON.stringify({ mode, action, version: corpus.version, manifestHash: corpus.manifestHash, chunks: corpus.rows.length, images: corpus.images.length, writes: 0 })); return;
  }
  const target = process.env.CORPUS_TARGET_URL?.trim();
  const key = process.env.CORPUS_SERVICE_KEY?.trim();
  if (!target || !key) throw new Error("Explicit CORPUS_TARGET_URL and CORPUS_SERVICE_KEY are required; no production defaults");
  const url = new URL(target);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid corpus target");
  if (mode === "local" && (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Local mode requires a literal loopback target");
  const authorizationPath = option("authorization");
  if (!authorizationPath) throw new Error("Exact target/action/hash authorization receipt required before any write, including local fixtures");
  const authorization = z.object({ targetUrl: z.string(), action: z.enum(["stage", "approve", "select"]), manifestHash: sha,
    targetVersion: z.string(), expectedVersion: z.string(), rollbackVersion: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).refine(v => v !== "legacy"), rollbackManifestHash: sha, reviewer: z.string().trim().min(1), evidenceSha256: sha }).strict().parse(json(authorizationPath));
  if (authorization.targetUrl !== target || authorization.action !== action || authorization.manifestHash !== corpus.manifestHash || authorization.targetVersion !== corpus.version) throw new Error("Authorization differs from exact target/action/manifest");
  if (mode === "apply" && url.protocol !== "https:") throw new Error("Apply mode requires HTTPS");
  const client = createClient(target, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc: Rpc = (name, parameters) => client.rpc(name, parameters);
  if (action === "stage") await stageCorpus(corpus, rpc);
  else if (action === "approve") {
    const file = option("approvals");
    if (!file) throw new Error("--approvals=FILE with externally accepted review receipts required");
    const approvals = approvalsSchema.parse(json(file));
    if (Object.values(approvals).some(r => r.manifestHash !== corpus.manifestHash)) throw new Error("Approval receipt is for another manifest");
    const qualityPath = option("quality");
    if (!qualityPath) throw new Error("--quality=FILE with recorded blind-scored baseline and candidate required");
    const quality = json(qualityPath);
    const queriesPath = option("queries");
    const baselinePath = option("baseline-answers");
    const candidatePath = option("candidate-answers");
    if (!queriesPath || !baselinePath || !candidatePath) throw new Error("Frozen queries and both recorded answer files are required");
    if (contentHash(quality) !== approvals.quality.evidenceSha256) throw new Error("Quality evidence receipt mismatch");
    validateQualityEvidence(quality, json(queriesPath), json(baselinePath), json(candidatePath), corpus.manifestHash, corpus.version, new Date());
    const result = await rpc("approve_corpus", { p_version: corpus.version, p_hash: corpus.manifestHash, p_approvals: approvals });
    if (result.error || result.data !== true) throw new Error("Corpus approval failed; selection unchanged");
  } else {
    const result = await rpc("select_corpus", { p_version: corpus.version, p_hash: corpus.manifestHash, p_expected_version: authorization.expectedVersion, p_authorization: authorization });
    if (result.error || result.data !== corpus.version) throw new Error("Corpus selection failed; inspect exact active selection before any retry");
  }
  console.log(JSON.stringify({ mode, action, version: corpus.version, manifestHash: corpus.manifestHash, status: "completed" }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : "Corpus operation failed"); process.exitCode = 1; });
}
