# Phase 1 test-size investigation (#866)

Scope: repository-authored tests under `src/`, `e2e/` and `scripts/`; inspect the largest outliers, distinguish composition coverage from direct unit coverage, and consolidate only proven duplicates. Integration worktree `/Users/juan/code/paisaxe-issues-phase1`, base `fe1843713a49277bc66460e4ae7470025d01e1c6`. This is local evidence, with no hosted, provider or deployed qualification.

## Inventory method and result

Measured 2026-10-07T14:50:14+00:00. `rg --files src e2e scripts` respects repository ignore rules and avoids generated `.next/`, coverage, dependency and copied skill output; names ending in `.test.[jt]s(x)` or `.spec.[jt]s(x)` are counted by physical lines, including comments and blanks. This snapshot contains **559 test files and 169,758 test lines**. The full sorted inventory is `/Users/juan/code/paisaxe/.git/issues-phase1-verification-2026-10-07/checks/paisaxe-phase1-test-size-inventory.tsv`; preserve it with the parent phase evidence. These are source sizes, not executed test counts. Concurrent Phase 1 edits are included; this is not a clean-baseline coverage report.

| Test file | Lines | Direct source lines |
| --- | ---: | ---: |
| `src/app/api/mcp/make-booking/route.test.ts:1` | 3,030 | 478 |
| `src/components/immersive/story-viewer.test.tsx:1` | 2,758 | 558 |
| `src/lib/claude.test.ts:1` | 2,377 | 700 |
| `src/components/immersive/voice-chat.test.tsx:1` | 1,997 | 393 |
| `src/proxy.test.ts:1` | 1,796 | 108 |
| `src/app/api/webhooks/elevenlabs/route.test.ts:1` | 1,773 | 548 |
| `src/hooks/use-stream-chat.test.ts:1` | 1,756 | 443 |
| `src/app/api/admin/costs-analytics/route.test.ts:1` | 1,583 | 454 |
| `src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx:1` | 1,555 | No direct counterpart |
| `src/components/admin/stories-tab-panel.test.tsx:1` | 1,535 | 508 |
| `src/app/api/admin/stories/[id]/image/route.test.ts:1` | 1,526 | 435 |
| `src/components/admin/image-editor-dialog.test.tsx:1` | 1,480 | 516 |
| `src/app/api/chat/stream/route.test.ts:1` | 1,404 | 448 |
| `src/lib/translate-story.test.ts:1` | 1,390 | 420 |
| `src/components/immersive/voice-chat-elevenlabs.test.tsx:1` | 1,348 | 482 |
| `src/app/favorites/page.test.tsx:1` | 1,324 | 400 |
| `src/app/api/admin/elevenlabs-analytics/route.test.ts:1` | 1,236 | 337 |
| `src/lib/admin-api.test.ts:1` | 1,133 | No direct counterpart |
| `src/app/api/health/route.test.ts:1` | 1,115 | 489 |
| `src/app/api/mcp/places/route.test.ts:1` | 1,101 | 515 |
| `src/lib/chat-safety.test.ts:1` | 1,079 | 245 |
| `src/hooks/use-stories.test.ts:1` | 1,060 | 369 |
| `src/components/auth/auth-provider.test.tsx:1` | 1,048 | 198 |
| `src/app/api/admin/agents/run/route.test.ts:1` | 1,038 | 346 |
| `src/lib/stories-data.test.ts:1` | 1,028 | 276 |

Reproduce with `rg --files src e2e scripts`, filter the test/spec suffixes, count `Path(path).read_text().splitlines()`, and compare an existing counterpart after removing the `.test` or `.spec` segment. Do not infer a defect from the ratio: `src/proxy.ts:1` has 108 lines but composes 653 further lines in `src/lib/proxy/`; `src/app/api/mcp/make-booking/route.ts:1` has 478 lines and depends on 636 lines in `booking-service.ts` and `elevenlabs-call-service.ts`, plus schema/auth/rate-limit modules. The composition tests exercise those real owned implementations while substituting third-party network/database interfaces.

Graph navigation used local `query_graph` through `/Users/juan/code/paisaxe/graphify-out`, generation `2026-10-07t11-51-17-328z-ee64bd`; its large result was truncated and supplied navigation only. Current source confirmed every conclusion below.

## Proxy sample: duplicate direct calls versus composition invariants

The following four whole tests in baseline `src/proxy.test.ts` called the imported helper directly. Their full input/output assertions already exist in `src/lib/proxy/maintenance.test.ts`; they add no invocation of `proxy()` and no additional boundary. They were removed, preserving the lower-layer exact oracles:

| Removed baseline test | Preserved exact inputs and outcomes | Lower-layer oracle |
| --- | --- | --- |
| `src/proxy.test.ts:449` | `/admin`, `/admin/dashboard` → true | `src/lib/proxy/maintenance.test.ts:18` |
| `src/proxy.test.ts:464` | `/coming-soon` → true | `src/lib/proxy/maintenance.test.ts:27` |
| `src/proxy.test.ts:492` | `/immersive` → false | `src/lib/proxy/maintenance.test.ts:45` |
| `src/proxy.test.ts:496` | `/a/static/array.js`, `/a/e/` → true; `/about`, `/agenda` → false | `src/lib/proxy/maintenance.test.ts:50`, `src/lib/proxy/maintenance.test.ts:55` |

Baseline `src/proxy.test.ts:1576` only asserted `expect(true).toBe(true)` and was also removed. It exercised no production code and had no possible production mutation that could make it fail. Other direct helper tests remain because they include distinct inputs, such as `/api`, `/auth`, `/_next/static/main.js`, `/icon.svg`, `/some-page`, `/story/123` and `/pricing/success` (`src/proxy.test.ts:448`). No global fixture, product source, threshold or configuration was changed. The test file fell from 1,820 to 1,796 lines, with exactly five test declarations removed.

Composition coverage was retained. In particular, canonical/root/maintenance ordering has externally visible consequences (`src/proxy.ts:19`, `src/proxy.ts:34`, `src/proxy.ts:44`). The root redirect test with maintenance enabled (`src/proxy.test.ts:214`) proves the root response remains the `/immersive` 308 redirect rather than a maintenance 307. The separate no-fetch test (`src/proxy.test.ts:689`) retains its performance assertion, although its environment override is false and it alone does not prove ordering. API fast-path tests retain page/API CSP differences, CSRF enforcement and CORS decoration (`src/proxy.test.ts:1661`). Lower `handleCORS` or `setCsrfCookie` unit calls cannot detect their accidental omission/reordering in `proxy()`.

Source-linked historical regression relevance is explicit: root lookup avoidance references #805 and immersive maintenance #824 in `src/proxy.ts:25`; real story rendering/maintenance rather than proxy rewriting is documented at `src/proxy.test.ts:485`. These are source references to regression contracts, not independently verified current GitHub issue states.

## Booking sample: retain the interaction contract

No booking tests were edited. The 3,030-line route suite is large, but lower service tests do not replace its HTTP outcome and cross-service side-effect boundaries:

- `src/app/api/mcp/make-booking/route.test.ts:2475` records insert → ElevenLabs request → update ordering. `src/lib/services/booking-service.test.ts:220` verifies inserted fields for `claimPendingBooking()` but cannot observe whether the route invokes `initiateCall()` first. `src/app/api/mcp/make-booking/route.ts:295` and `src/app/api/mcp/make-booking/route.ts:321` are the concrete ordering seam.
- `src/app/api/mcp/make-booking/route.test.ts:1023`, `:2333`, `:2607` repeat closely related persistence failures. The unit oracle at `src/lib/services/booking-service.test.ts:282` only returns `persistence_failed`; it cannot prove HTTP 500 or absence of an outbound call. These are candidates for a future same-boundary setup consolidation, but no equivalent lower-layer replacement for the complete route oracle was demonstrated. Retain rather than delete by size.
- Formatting examples at `src/app/api/mcp/make-booking/route.test.ts:1574`, `:1632`, `:2158`, `:2190`, `:2224` overlap `src/lib/services/booking-service.test.ts:82` and `:99`. The route examples still check that parsed date/time reach the actual provider payload. The supposedly 12:45-specific test at `:2190` actually supplies **0:45** and expects nighttime wording, so removing it based on its title would discard a different boundary. Retain; no unsupported equivalence claim.
- The phone safety gate has exact reject/accept boundaries: premium prefixes versus legitimate nearby ranges in `src/lib/services/booking-service.test.ts:46` and `:59`, and route rejection before provider I/O in `src/app/api/mcp/make-booking/route.test.ts:240`. Malformed visitor phone inputs are routed through the customer gate at `src/app/api/mcp/make-booking/route.ts:213`, with regression cases at `src/app/api/mcp/make-booking/route.test.ts:497` and `:523` (#779).
- `src/app/api/mcp/make-booking/route.test.ts:2952` and `:2994` distinguish TimeoutError and AbortError, retain reconciliation state and verify HTTP 202. `src/lib/services/elevenlabs-call-service.test.ts:239` and `:250` classify both provider errors but cannot prove the route avoids terminal persistence. The test named late webhook does not actually deliver a webhook; its local evidence is the nonterminal response/state boundary only.
- Prior-state replay (#605), failed call persistence (#455), accepted call with failed identifier persistence (#456), and accepted provider response without an identifier (#628) have separate route outcomes at `src/app/api/mcp/make-booking/route.test.ts:862`, `:1397`, `:1437`, `:1494`. The production handler distinguishes those states at `src/app/api/mcp/make-booking/route.ts:308`, `:339`, `:357`, `:389`. Preserve those differences.

Other large files likewise have concrete interaction risks. `src/components/immersive/voice-chat.test.tsx:1309` and `:1346` distinguish suggested questions in text/voice modes; `src/lib/claude.test.ts:2122` verifies that a stream yielding partial text is not retried, while `:2144` permits a retry before any text. File length alone does not establish redundant behavior in those suites. This investigation sampled the two selected composition outliers deeply and inventoried the broader largest files; it does not claim exhaustive semantic equivalence analysis of all 559 tests.

## Check evidence and disposition

Commands were sequential in a parent-granted slot, Vitest 5.0.3 / Node 24.21.0:

1. Initial `npx vitest run src/proxy.test.ts src/lib/proxy/maintenance.test.ts --maxWorkers=1 --minWorkers=1` exited 1 before discovery because this Vitest version rejects `--minWorkers`. Preserved at `/Users/juan/code/paisaxe/.git/issues-phase1-verification-2026-10-07/checks/paisaxe-phase1-test-size-before.log`; it is not a product-test failure or a passing baseline.
2. Corrected baseline `npx vitest run src/proxy.test.ts src/lib/proxy/maintenance.test.ts --maxWorkers=1`: exit 0, 2 files / 162 tests passed. `/Users/juan/code/paisaxe/.git/issues-phase1-verification-2026-10-07/checks/paisaxe-phase1-test-size-before-corrected.log`.
3. Same command after five removals: exit 0, 2 files / 157 tests passed. `/Users/juan/code/paisaxe/.git/issues-phase1-verification-2026-10-07/checks/paisaxe-phase1-test-size-after.log`.
4. Temporarily moved the real maintenance branch ahead of the root branch in `src/proxy.ts`, then `npx vitest run src/proxy.test.ts --maxWorkers=1 -t 'redirects root path to /immersive without checking maintenance mode'`: exit 1, 1 failed / 126 skipped. The retained ordering oracle expected 308 and observed 307. `/Users/juan/code/paisaxe/.git/issues-phase1-verification-2026-10-07/checks/paisaxe-phase1-test-size-ordering-mutant.log`.
5. Restored `src/proxy.ts` byte-for-byte in a Python `finally`, reran the same focused command: exit 0, 1 passed / 126 intentionally deselected. `/Users/juan/code/paisaxe/.git/issues-phase1-verification-2026-10-07/checks/paisaxe-phase1-test-size-ordering-restored.log`. Those selection skips are not claimed as full-suite passes.

After the passing checks, simplify removed five leftover empty lines only. Test semantics and production bytes are unchanged; parent integrated verification must record the final candidate identity. Final `src/proxy.test.ts` SHA256 `39274ae4be06b88366e65066d0160ef301a515dfb0114e5cb103ad96fed2062d`; unchanged/restored `src/proxy.ts` SHA256 `7e0a5cdc805f468e2d132daba94031ad877989c1844345b0840213b3648cdcb7`; retained maintenance unit test SHA256 `9ae92e60cc2b186cda51cb3e8cb32e5aef429d2932e75334a34f9acff5dfa444`. `git diff --check` passed. Booking source/test remained unchanged (SHA256 `cd6791a02bda3b3792d5d9d7df4a460681532f82b1724d119a3a1af0693efa24` / `368767a2f39c1896b68e6097344d5342b8de41dac0fb7e8c751fa842265849fe`).

**Disposition:** #866's requested investigation is implemented locally with a bounded, evidence-backed reduction. Four exact pure-helper duplicates and one tautology were removed; composition/order/replay/timeout boundaries were retained. No deletion quota or ratio target was used. Independent review approved the disposition; the complete integrated Phase 1 gates passed as recorded in [implementation notes](../2026-10-07-github-issues-remediation-notes.md). Owner acceptance and any eventual issue mutation remain separate. No remote mutation occurred.
