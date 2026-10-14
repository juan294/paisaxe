# Local content review and consolidation

The owner authorized local consolidation into `develop`, local browser review and pruning of temporary worktrees on 2026-10-12. This does not accept Phase 12, authorize publication or change the open issue dispositions.

The local review page is at **http://127.0.0.1:3007**. The application is intended to run at **http://localhost:3006/immersive** after local qualification. The read-only review artifact and restart instructions are retained under the root checkout's ignored `logs/local-consolidation-2026-10-12/`; they are not published website routes.

The review page contains the retained 2026-10-11 metadata inventory: 195 story records, 185 existing image URLs and ten records without an image. It also displays the accepted twenty text samples and forty evaluation questions. These are existing images, not newly sourced replacements. The complete writing and answer comparison remain incomplete; 77 subjects have some reviewed factual basis and 118 still lack one.

The owner states that they personally created the stories, downloaded their photos and uploaded them through admin. Upload history is distinct from the original source and reuse permission. Only seven local story files match historical PDF-image mappings; no guide origin is inferred for the remaining photographs. A story's `source_pdf` field likewise does not establish the origin of its image.

Authenticated admin retains the stored original image and attribution for review (`src/types/admin.ts:32`; `src/components/admin/story-editor-dialog/use-image-editor.ts:217`). The Phase 12 public resolver displays the disclosed illustration wherever the new structured photo review is missing (`src/lib/image-provenance.ts:51`). This is a conservative serving rule, not a finding that all old photographs were guide-derived. No stored image or credit is changed by this resolver. The current upload endpoint requires an operator-prepared reviewed JSON record with byte hashes; the existing attribution input does not assemble that record. The ordinary file-plus-credit workflow is not ready for publication under this change.

Merging code does not import or select the replacement corpus. Local browsing must disclose which corpus and fixtures it actually serves. Provider calls remain disabled in the review server; it cannot establish answer quality. Production data, deployments, service configuration and issue status remain unchanged.
