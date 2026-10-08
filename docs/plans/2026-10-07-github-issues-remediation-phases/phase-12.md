# Phase 12: Content and image provenance

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #986, #987. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Retain the issues' post-hackathon timing unless publisher/owner instructions supersede it. Sources: `scripts/process-pdfs.ts:61`, `scripts/process-pdfs.ts:145`, `scripts/seed-database.ts:43`, `scripts/seed-database.ts:71`, `scripts/seed-database.ts:412`, `scripts/seed-database.ts:547`, `scripts/seed-database.ts:560`, `src/lib/embeddings.ts:17`, `src/lib/claude.ts:594`, `content/story-image-mappings.json:7`, `scripts/map-story-images.ts:95`, `src/types/immersive.ts:276`, `src/components/immersive/story-info-panel.tsx:125`.

## Design and ownership

One content integration owner owns corpus schema/provenance/import/promotion and shared image/type/seed files; authoring and image review can run independently after manifests freeze, but are not file-edit batches by default. Inventory all production-visible chunks and every story image including inactive/unknown sources, fallback/seed mappings, image refs/storage/public files. Seven known PDF mappings are not the full scope. Existing source facts and publisher response are recorded without assuming absent permission grants rights.

Use independently authored factual text with source/fact/document version manifests, supported by owner material and individually verified permitted structured sources. Do not ingest original guide sentences into authoring prompts or commit guide text as fixtures. Each source records canonical identifier, revision/date, permission/license, allowed use, attribution and refresh. Wikidata structured data's CC0 scope is documented by [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing); it does not license every text namespace. Wikipedia prose, OSM datasets and Google content are excluded unless separately reviewed/approved under their own terms. This is a provenance design, not a legal determination about paraphrasing.

Approve 20 representative newly authored chunks before full generation. Overlap gate normalizes Unicode/case/punctuation and cross-chunk boundaries: zero reused nontrivial guide sentences and zero unreviewed eight-token overlaps; shorter/common-name matches receive narrow documented review. Transformed copied-sentence fixtures must fail. Retain current voyage-context-3 contextualized 512-dimensional query/seed parity; the issue's voyage-3.5 request is stale.

Freeze 40 tourism queries across region/topic/season, Spanish/English, safety and unknown cases. Capture a valid approved baseline or prepare a bounded budget request for new provider capture. Blind-score factual support/relevance/grounding/safe handling on 0–4: no unsupported safety/price/opening claims, aggregate factual support/grounding no worse, no individual drop >1 without owner acceptance, source correctness >=95% of answerable queries. Independent agent review plus owner sample if two human reviewers are unavailable. Deterministic checks cover IDs, provenance, topic coverage, vectors, duplicates and orphan image refs. Native/cultural judgment is manual evidence; model scores alone are insufficient.

Use versioned shadow-corpus staging and atomic active-version selection; import is dry-run/local/apply with manifest/hash and resumable failure, never seed-db --clear in production. Current group-error-and-continue behavior cannot prove complete replacement. Cache namespace includes corpus version. If rights prevent serving the old corpus, rollback targets an approved minimal corpus, not prohibited wording. Restricted reference retention and remote old-data deletion receive a separate exact manifest/authorization; no history purge here.

Image manifest records story ID, original/replacement hash, source page, photographer/permission/license/date, credit, contextual accuracy, crop/alt and reviewer. Prefer owner photos or individually verified permitted manual-license photos. An API sourced photo must instead follow [Unsplash API terms](https://unsplash.com/api-terms), including returned-URL/credit rules; never treat manual and API flows interchangeably. Generic thematic images are disclosed rather than falsely labeled as a named place. Verify every replacement visually at mobile/desktop crop, readable overlay, resolution, alt and no watermark.

Fix seed/admin/upload/import/map/fallback writers so source cannot become null or guide-derived imagery reappear. Shared provenance types/rendered citation links migrate together; no fabricated PDF page label for authored content. Superseded public files are removed only after zero references and approved serving-scope inventory. External storage/CDN deletion is separately scoped.

```text
@ promoteCorpus(version, manifest) -> activeVersion
ctx: staged authored chunks, image provenance, vector store and cache
pre: overlap, quality and rights gates accepted; target authorized
do:
  1. validate complete version hashes and every source record
  2. write staged rows without changing current selection
  3. validate retrieval and image references on staged version
  4. write active selection atomically and invalidate versioned cache
fail: incomplete import -> keep prior permitted version and resume safely
risk: rollback must never restore content disallowed by rights decision
```

## Automated criteria

Overlap positive/negative fixtures, complete provenance/vector/model/ID validation, fail-on-partial-import and resumable retry, atomic promotion/approved rollback, cache version isolation, no orphan refs. Seed/admin roundtrip retains source; missing/rejected image uses permitted neutral fallback. Story/immersive/favorites/OG citation/photo surfaces work. Final quality set passes with evidence, not keyword-only validators. Run the existing required Lighthouse/browser budgets for affected story/immersive routes on the final content/photo candidate, compare a valid same-environment baseline, preserve Phase 8 thresholds and reject asset/citation/image regressions. Earlier Phase 8 evidence cannot cover these later replacements.

## Manual and external criteria

Every source and photo has permission/provenance review; all replacement contact-sheet crops and 20-chunk sample accepted. Before billed authoring/re-embedding or production import, prepare exact quantities/model/estimated cost, approved source set and target/rollback manifest for separate authorization. Production closure requires 100% promoted chunks/images verified, no unresolved overlaps/unknown guide sources, authorized retirement in serving scope and read-back health/search/attribution at the released version.

## Stuck states and recovery

Rejected/missing provenance stays draft with exact source/review instruction and cannot embed/promote; corrected source passes. Partial import retains current permitted active version and resumably retries. Missing photo shows disclosed neutral fallback, not an old guide image. Quality regression blocks promotion with query-level evidence. Tests prove corrected retry and safe rollback; old material never silently re-enters service.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
