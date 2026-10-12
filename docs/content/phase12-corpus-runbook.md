# Authored corpus validation and promotion

Status, 2026-10-11: the owner accepted the exact 20-chunk [review sample](phase12-sample-review.md). This does not establish replacement coverage for the full 195-story catalog. The sample is not an importable embedded corpus. Full authoring, embedding generation, recorded quality evidence, photo review and production promotion remain separate pending work. This runbook grants no provider, production, retention or deletion authority.

The controlling contract is [Phase 12](../plans/2026-10-07-github-issues-remediation-phases/phase-12.md). The implementation entry point is `scripts/corpus.ts:31`; it validates supplied files and never authors text, generates embeddings, captures answers or manufactures review receipts.

## Files and identities

The existing review assets are `content/provenance/phase12-sample.json`, `content/provenance/phase12-queries.json` and `content/provenance/phase12-overlap-reviews.json`. Their acceptance or sample overlap results do not certify a future full corpus. Keep restricted guide text out of manifests, authoring prompts, committed fixtures and public evidence. Any separately authorized local overlap scan retains only permitted counts, hashes and narrow review decisions in its report.

An import requires a separately prepared complete manifest conforming to `scripts/lib/corpus-manifest.ts:16`. No complete embedded replacement manifest or real quality approval is supplied by this runbook. Synthetic test receipts are never operational receipts.

| Manifest field | Required contract |
| --- | --- |
| `schemaVersion`, `version`, `model`, `dimensions` | Version 1 schema; lowercase version matching `^[a-z0-9][a-z0-9-]{0,79}$`, excluding `legacy`; `voyage-context-3`; 512 dimensions. |
| `sources` | Distinct IDs; canonical HTTPS URL, revision, `retrievedAt`, license, allowed use, namespace, attribution, `refreshAfter`, evidence hash and review receipt hash. Wikidata structured facts require a canonical Q URL, positive numeric revision, main namespace and `CC0-1.0`. Owner material requires owner namespace and explicit owner permission. |
| `facts` | Distinct IDs with existing `sourceId`, property, value and statement ID. Metadata and receipts require actual source review; schema validity does not establish factual truth. |
| `documents` | UUID, matching corpus version, title, Spanish or English language, region/topic/season and the exact nonempty chunk UUID inventory. |
| `chunks` | UUID, document ID, independently authored content, existing source/fact references, image references and a finite nonzero 512-dimensional vector. The first cited source must support at least one referenced fact. |
| `images` | UUID, story ID, distinct asset path and accepted structured manual provenance bound to that path. Empty image inventories are allowed; they do not certify the catalog's photos. |
| `rights`, `overlap` | Each supplies the exact `contentHash`, reviewer, evidence SHA-256 and ISO timestamp. These are externally supplied review records. |

The validator rejects duplicate IDs, normalized duplicate chunk text, document membership mismatches and orphan references. Source freshness is checked at the current time. `refreshAfter` is interpreted at UTC midnight, not at the end of that date. Sources with future retrieval times or expired refresh dates need renewed review (`scripts/lib/corpus-manifest.ts:26`).

`corpusContentHash` excludes the rights/overlap receipts and embedding values while binding the rest of the input. The final manifest hash also seals canonical row payload hashes, including embeddings. Use the actual canonical `contentHash` implementation in `scripts/lib/corpus-provenance.ts:14`; a file-byte SHA-256 is not interchangeable with a canonical JSON hash. Vector shape/model labels alone do not prove how an embedding was generated.

## Offline validation and local commands

The following command forms are schematic. Each required environment variable naming a file must already contain the path to its real reviewed file; no example receipts, hashes, target credentials or approvals are supplied. Run from the repository root with installed dependencies. The explicit local binary avoids downloading tooling.

```sh
./node_modules/.bin/tsx scripts/corpus.ts --mode=dry-run --action=stage \
  --manifest="${CORPUS_MANIFEST:?Existing complete reviewed manifest required}"
```

Dry-run is also the default mode. It validates the manifest, prints its version/hash/counts with `writes:0`, and returns before reading service credentials or contacting Supabase. Even `--action=approve` or `select` in dry-run validates only the manifest; it does not exercise quality evidence, authorization, staged completeness or selection readiness (`scripts/corpus.ts:39`).

Every write requires explicit `CORPUS_TARGET_URL` and `CORPUS_SERVICE_KEY` in the authorized process environment. The CLI does not borrow application Supabase defaults. Never print or commit the service key. Local mode accepts only literal HTTP loopback hosts `127.0.0.1` or `[::1]`; `localhost` is rejected. Targets cannot contain credentials, a non-root path, query or fragment. Apply mode requires HTTPS and separate exact-target authority (`scripts/corpus.ts:42`).

```sh
./node_modules/.bin/tsx scripts/corpus.ts --mode=local --action=stage \
  --manifest="${CORPUS_MANIFEST:?Reviewed manifest required}" \
  --authorization="${CORPUS_STAGE_AUTHORIZATION:?Exact stage authorization required}"

./node_modules/.bin/tsx scripts/corpus.ts --mode=local --action=approve \
  --manifest="${CORPUS_MANIFEST:?Reviewed manifest required}" \
  --authorization="${CORPUS_APPROVE_AUTHORIZATION:?Exact approval authorization required}" \
  --approvals="${CORPUS_APPROVALS:?Externally accepted gate receipts required}" \
  --queries=content/provenance/phase12-queries.json \
  --quality="${CORPUS_QUALITY:?Recorded quality evidence required}" \
  --baseline-answers="${CORPUS_BASELINE_ANSWERS:?Recorded baseline answers required}" \
  --candidate-answers="${CORPUS_CANDIDATE_ANSWERS:?Recorded candidate answers required}"

./node_modules/.bin/tsx scripts/corpus.ts --mode=local --action=select \
  --manifest="${CORPUS_MANIFEST:?Reviewed manifest required}" \
  --authorization="${CORPUS_SELECT_AUTHORIZATION:?Exact selection authorization required}"
```

These local forms apply only to an authorized disposable local target. Production preparation must bind the exact HTTPS target, candidate, approved recovery corpus and evidence before any separately authorized `--mode=apply` execution. Neither changing the flag nor possessing a service key grants that authority. File options use `--name=value`; the CLI has no general help, embedding or generation command.

## Authorization and external gate receipts

Every action's strict authorization JSON requires `targetUrl`, `action`, `manifestHash`, `targetVersion`, `expectedVersion`, `rollbackVersion`, `rollbackManifestHash`, `reviewer` and `evidenceSha256`. Target URL, action, candidate version and manifest hash must match the invocation exactly. Rollback version must use the nonlegacy version format. SHA fields require 64 lowercase hexadecimal characters. Use a separately accepted record for each action; do not infer new authority from an earlier staging receipt (`scripts/corpus.ts:50`).

Approval requires five receipts named `sample`, `rights`, `overlap`, `quality` and `photos`. Each binds the same candidate `manifestHash` and includes a nonblank reviewer and evidence hash. The quality receipt's `evidenceSha256` must equal the canonical hash of the entire quality JSON. The CLI validates the recorded quality package; the other receipt hashes identify externally accepted evidence rather than causing the CLI to perform those reviews (`scripts/corpus.ts:60`).

Receipt metadata and matching hashes establish consistency, not authenticity, legal rights, actual human review, a paid-call authorization or production permission. Preserve the real acceptance records privately and bind their exact scope. Missing evidence stays pending. The accepted sample does not replace full-corpus rights/overlap, native/cultural judgment, manual photo crops or the final performance/browser gates.

## Recorded quality package

`scripts/lib/corpus-quality-evidence.ts:5` defines the strict quality JSON: `schemaVersion:1`, `querySetHash`, `candidateRun`, `baselineRun`, `baselineAcceptance`, `blindReview`, and the `candidate`/`baseline` score arrays. The frozen queries require exactly 40 unique IDs, nonblank question text and `answerability` of `answerable`, `unknown` or `safety`; the complete query object is hashed.

Each run records `runId`, `recordedAt`, `manifestHash`, `corpusVersion`, `embeddingModel`, `dimensions`, `answerModel`, `configSha256` and `answersSha256`. Both use contextualized model `voyage-context-3` and 512 dimensions. Candidate corpus version/hash must match the supplied manifest, and its answer model must match `CHAT_MODEL` in `src/lib/models.ts:7`. Baseline may record a nonblank historical answer model and a legacy identity; this describes historical evidence and does not authorize legacy serving.

Each strict answer file contains `schemaVersion:1`, `runId` and exactly 40 distinct `answers`, each with `id`, nonblank `answer`, and `sources` containing strict `{url,title}` records. Source URLs require HTTPS without credentials and nonblank titles. Each artifact's answer IDs must equal the frozen query inventory, and its canonical hash and run ID must match the respective run metadata. A candidate answer scored source-correct and answerable must contain recorded attribution. The validator does not determine whether that citation actually supports the answer.

The baseline acceptance receipt contains `subjectHash`, `reviewer`, `recordedAt` and `evidenceSha256`. Its subject hash seals `{querySetHash, run:baselineRun}`. Blind review contains `comparisonHash`, `scoresHash`, `reviewers`, `recordedAt` and `evidenceSha256`. Comparison seals `{querySetHash,candidateRun,baselineRun}`; scores seal `{candidate,baseline}`. Reviewer records contain `name` and `kind` from `independent-agent`, `owner` or `native-reviewer`. The implemented gate requires an independent-agent and owner with distinct normalized identities; a native reviewer alone is insufficient. Native-language judgment remains a separate manual criterion.

Timestamps must not be future-dated. Baseline acceptance cannot predate its answers, and blind review cannot predate either run or baseline acceptance. Every score ID and answerability must match the frozen query. Four dimensions use integer scores 0–4. Unsupported candidate claims block approval; source correctness must reach 95% of answerable queries. Aggregate factual support and grounding cannot regress. Each dimension's per-query drop greater than one is rejected; the CLI implements no owner-waiver mechanism. Relevance and safe-handling aggregates remain disclosed without an additional aggregate rejection rule (`scripts/lib/corpus-provenance.ts:56`).

## Stage, approve, select and recover

Staging calls `stage_corpus` in batches of at most 100 rows and 100 images. Image-only tail batches are included. Each transaction independently verifies canonical hashes; an acknowledgment must equal that batch's row count. A failing batch stops the CLI, leaves selection unchanged and can be resumed by rerunning the same manifest. Already staged identical rows are accepted; a different manifest under the same version is rejected. Correcting content requires a new reviewed identity, not overwriting a partially staged version (`scripts/corpus.ts:16`; `supabase/migrations/130_authored_corpus.sql:101`).

Approval verifies complete staged counts, image references, immutable hashes and stored row/image values before marking a version approved. It does not select that version. Source freshness is rechecked; an expired staged version cannot be approved unchanged. Existing approval receipts cannot be silently replaced (`supabase/migrations/130_authored_corpus.sql:163`). The CLI checks quality evidence before this RPC; direct service-role calls are a trusted operator boundary, not an independent blind-scoring engine.

Selection uses an atomic compare-and-swap against `expectedVersion`. It requires an approved, nonrevoked target with the exact hash, plus an approved, nonrevoked rollback version with its exact `rollbackManifestHash`. Both versions undergo approval integrity and freshness revalidation in the transaction. A conflict or failed guard leaves selection unchanged; inspect the actual selected version before preparing a new authorization or retry (`supabase/migrations/130_authored_corpus.sql:201`).

Rollback uses the same authorized `select` action with the approved recovery manifest as the target and the observed current version as `expectedVersion`. A rollback authorization must also name a valid approved recovery version/hash for its own selection guard. An explicitly accepted minimal corpus can be that recovery version; the implementation checks approval/integrity, while the rights decision must establish that its contents are permitted. `legacy` cannot be a selection or rollback target. An initial legacy selection is compatibility behavior, not a rights approval. No selection deletes old rows, public assets or storage objects.

Retrieval captures the active corpus version before result-cache access and includes it in the cache namespace. Shadow retrieval is service-role-only through `preview_corpus_chunks`; serving retrieval RPCs reject a version that changed after capture instead of mixing versions. Preserve the exact manifest/evidence hashes, target, commands, outcomes, selected version and recovery read-back. Schema success or a synthetic local test does not substitute for released health/search/attribution evidence.

## Photo evidence and public metadata

Structured photo provenance requires exact asset URL, original/replacement SHA-256, source page, photographer, license, permission, date, credit, contextual classification, alt text, mobile/desktop crop review, reviewer, review receipt hash, approved status and manual flow (`src/lib/image-provenance.ts:5`). The implemented parser supports the manual license choices `owner-permission`, `CC0-1.0`, `CC-BY-4.0` and `Unsplash-manual`; it does not implement an Unsplash API approval flow.

Treat all persisted provenance fields as potentially public. Put only a safe permission summary and a hash reference in public records. Keep permission documents, private correspondence, credentials, signatures and personal contact data in separately controlled evidence storage. Use public-safe reviewer identifiers. The schema does not redact arbitrary strings: a hash field is a reference, not a place to embed a private document. Public UI shows credit/license/source and contextual disclosure, but API consumers may receive structured metadata.

The reviewed asset must match its path and byte hashes. Review every actual replacement at desktop/mobile crops, resolution, overlay readability, contextual accuracy, alt text and watermark absence before acceptance. Unknown/missing/rejected provenance uses the locally authored neutral illustration; it must not fall back to a guide image or imply a named-place photo. Attribution follows the actual served asset, including image-load recovery (`src/components/permitted-story-image.tsx:8`).

## Pending authority and completion

Prepare exact quantities, model/config, estimated cost, permitted source scope, target and approved rollback manifest before requesting any billed generation, re-embedding or new quality capture. Photo acquisition/review and native/cultural judgment need their actual evidence. Production import/promotion, serving-scope retirement, external storage deletion and restricted-reference retention each require their separately scoped authorization. No history purge is part of this procedure.

Before production closure, verify 100% of the promoted chunks/images, resolve every overlap and unknown guide-source claim, run the required final-candidate browser/performance gates, and read back the released version's health, retrieval and attribution. Local implementation, sample acceptance and consistent receipt hashes do not close #986 or #987 by themselves.
