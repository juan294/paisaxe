# Phase 4: Stripe entitlement lifecycle and paid voice journey

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #923, #932, #797. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: locally implemented, independently reviewed and qualified; owner acceptance and production closure remain open. Phase 3 was owner-accepted and locally integrated before entry on `6bbff7c9a5d004f236149aa63796a6e0499cf98a` in worktree `paisaxe-issues-phase4`. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Implement the owner-approved refund/dispute truth table and prove the real paid-access path. Sources: `src/app/api/webhooks/stripe/route.ts:19`, `src/app/api/webhooks/stripe/route.ts:111`, `src/app/api/voice-access/route.ts:32`, `src/app/api/voice-session/route.ts:54`, `src/app/api/webhooks/stripe/route.postgrest-integration.test.ts:120`, `supabase/migrations/099_grant_day_pass_purchase_type.sql:105`. Entry requires Phase 3 DB acceptance; the owner explicitly accepted the refund/dispute policy below.

## Design and ownership

One commerce owner handles SQL migrations/RPC, Stripe route, access/session gates, real auth E2E and all purchase fixtures. No parallel edit of this shared state. Add entitlement state/reasons separate from original expiry, durable payment-identity adjustments/tombstones and atomic event-ID dedup. Match PaymentIntent, not every purchase for a user. Grant and refund/dispute transitions serialize by payment identity; distinct event IDs converge. An adjustment arriving before purchase is retained unmatched and applied when the purchase appears. For each dispute ID, a terminal won/lost disposition dominates a delayed open event; payment locking alone is insufficient. Detect a full refund from successful cumulative refunded amount against the original charge, so several partial refunds that total the charge revoke access. Preserve independent refund reasons. Event timestamps cannot prove delivery order; [Stripe's webhook contract](https://docs.stripe.com/webhooks#event-ordering) explicitly permits unordered events.

Encode the selected policy as executable truth-table fixtures. The owner-approved policy is: full refund revokes; partial refund retains; open dispute suspends; merchant win restores only the original unexpired entitlement and never clears a separate refund revocation; lost dispute remains revoked. No renewed expiry on reinstatement. Voucher/unrelated payment entitlements remain independent. Server issuance rechecks effective access. Do not promise already-minted or connected provider sessions terminate unless separately supported and scoped.

Remove redundant nested BEGIN/EXCEPTION RAISE from the current grant RPC in a forward migration while preserving transactional rollback and service-only execute (#797). A forced insert failure must roll back dedup and allow corrected retry; SQL string inspection is insufficient.

#932 E2E uses a genuine task-local auth session and real paid entitlement/session route. Stub only provider/payment network boundaries for deterministic local proof, never the owned access/RPC logic. Verify allowed Pelayo session, unauthenticated/expired/revoked denial, unrelated valid pass, provider rejection handling and recoverable text fallback. A separate authorized live contract stage verifies provider payload and signed-session issuance without starting a paid conversation unless explicitly authorized.

```text
@ applyStripeEvent(event) -> acknowledgement
ctx: verified webhook, transactional payment ledger and entitlement
pre: signature valid; event type supported
do:
  1. validate payment identity and event ID
  2. lookup locked payment ledger and current entitlement
  3. write dedup and policy transition atomically
  4. emit classified acknowledgement and safe audit evidence
br: purchase missing -> retain adjustment for later grant
fail: DB failure -> retryable response with no committed dedup
```

## Automated criteria

Real local RPC tests: partial/full, dispute open/lost/won, replay, refund-before-grant, dispute.closed won/lost before delayed dispute.created/open, cumulative partial refunds reaching full, permutations with grant before/after adjustment, concurrent handlers, multiple revocation reasons, overlapping passes, natural expiry, expired reinstatement, voucher coexistence and retry after forced insert failure. New signed session is denied after revocation/suspension; an unrelated valid pass still works. Real-auth Playwright verifies actual access-granted UI through session issuance, plus suspension reason/support recovery, rather than ending at a ready payment dialog. No real payments or model calls in local fixtures.

## Manual and external criteria

Prepare Stripe event-subscription and deployed migration rollout prerequisites without changing endpoint configuration/API version. Exact authorized production release and subsequent provider/read-only runtime evidence are needed for production closure. Live checkout/payment/voice activity has separate bounded authority.

## Stuck states and recovery

Buyer sees reasoned suspended/revoked/expired state and a support or purchase action appropriate to that reason, not a misleading purchase-again prompt for a temporary dispute. Merchant-win event recovers unexpired eligible access; full-refund reason still blocks. Unmatched adjustments remain visible to operators with reconciliation action and later grant converges. DB failure is retryable with rolled-back dedup. Provider session rejection offers text/retry and a restored credential succeeds. Tests prove each transition or disclosure.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).

## Local implementation checkpoint (2026-10-08)

Forward migration `supabase/migrations/129_stripe_entitlement_lifecycle.sql:1` adds private physical-object/payment ledgers, serialized atomic grant/adjustment processing, explicit service-only reviewed reconciliation and effective access state. `src/lib/stripe-entitlements.ts:1` normalizes physical successful refunds against captured charges and quarantines unsupported/incomplete/conflicting facts. `src/lib/stripe-entitlements.postgrest-integration.test.ts:1` supplies 27 actual local database cases, including deterministic unique-index conflict contention, terminal precedence independent of event timestamps, rollback/retry, before-grant facts and reconciliation controls. The expanded full service/RLS inventory includes both relations and new RPCs. Original applied migrations remain unchanged.

The local scoped receipt `logs/issues-phase4-2026-10-08/review-repair-green-v2-summary.json` records 939 passed, zero failed/skipped, with unchanged tested inputs and verified schema/owned stack. The final indexed-schema receipt `backend-final-scoped-v3-summary.json` also records 939/939 passing with both actual SQL access helpers and exact unrelated purchase/voucher IDs asserted; its independent backend re-review approved the frozen 14-file subset. Earlier meaningful RED attempts, the unexplained one-off native psql connection failure and subsequent source repairs are retained separately; a passing rerun does not erase them. The case census declares 1002 required contract cases and 1003 ordinary environment-gated cases; these declarations are not execution receipts.

The dedicated `scripts/run-paid-voice-local.mjs:1` launcher defaults to a sealed loopback production artifact, with real auth/access/RPC/server fetch/installed browser SDK and only exact TLS/WebSocket boundary stand-ins. Development-browser attempts are diagnostic evidence only. `paid-voice-attempt8-repaired-dev/receipt.json` records one passed real-auth journey, unchanged app/E2E/config/public inputs, four exact local TLS requests (three accepted, one rejected), real SDK story/language/auth context, rendered transcript and same-dialog 403 refresh. The failed attempts remain separate. Final production-build/browser, complete required DB contract and ordinary/coverage/type/lint/security gates, independent review and simplify acceptance remain pending the integration owner's sequential qualification. Concrete authorized rollout prerequisites and executable operator recovery are in [the operator runbook](../../operations/stripe-entitlement-lifecycle.md). No remote migration, provider operation, checkout/conversation, push, deployment or issue closure was performed. Stop at the phase acceptance gate after those results are reviewed.

Independent frontend review also found issuance403 followed by a rate-limited reason read retaining a stale grant. `red-denial-429-summary.json` retains the actual hook failure; `green-denial-final-summary.json` records 147/147 hook/component cases after repair, including generic support/retry disclosure without an invented dispute reason, failed-read blocking, corrected recovery and unchanged ordinary refresh429 behavior. Backend14-file approval remains valid. The final frontend freeze and fresh production browser proof supersede earlier development candidate identities; no phase acceptance is implied.


## Final local qualification and acceptance boundary (2026-10-08)

The implementation checkpoint above is historical. The final candidate source digest is `353c0e367a0109c5bc196a1fd683e0be52b4b3657a92774fd4131dc9e77a4087`, tracked/nonignored input digest `d3af0d3578093017ec80120ad10f5db838c283c21539fc4affd6dfc6bbe919d5`, based on `6bbff7c9a5d004f236149aa63796a6e0499cf98a`. Independent backend/frontend reviews, repair reviews, three simplify lenses and the final handoff audit have no unresolved actionable source finding. Full application tests and coverage passed 10,555/10,555 with zero failures/skips. Coverage is 98.08/95.41/97.95/98.75 percent (statements/branches/functions/lines), unchanged thresholds. The actual DB tier passed 1,002/1,002 in 21 suites, zero failures/skips. These full application/DB results retain original candidate `230dcd4929757497b4941f28d2aa78dae1f2f443f7c6db87a6ddf452f65d41d6`; independently approved reuse covers unchanged selected inputs after the native artifact-helper-only repair. The combined contract command remains exit 1 for unqualified provider provenance.

Fresh final-candidate native cadence passed 1,048/1,048; generated definitions, four typecheck scopes, source/scripts lint, Knip, dependency/environment/migration/probe/verification checks, production builds and bundle scans passed. The sealed real-auth paid production journey passed 1/1, separate Auth UI passed 1/1, desktop/mobile/QA passed 377 with the exact original 28 mobile exclusions (405 selected; all 11 QA journeys passed), and original local release probes passed 3/3. All browser executions used zero retries and had zero failures/flaky cases. Real owned access/RPC/server fetch and installed SDK were exercised; exact external TLS/WebSocket stand-ins do not prove live provider compatibility. The paid artifact was independently archived and all 3,856 selected file bytes verified. Existing source/runtime ownership guards and production CSP remain intact.

Detailed original identities, review finding dispositions, earlier failed/interrupted/unmeasured attempts, the exact Next runtime-cache seal repair and new archive correction are in [implementation notes](../2026-10-07-github-issues-remediation-notes.md). Private evidence is `logs/issues-phase4-2026-10-08/parent-verification/`; the integration owner records actual native commit-hook/local-integration/cleanup identities there after this documentation checkpoint. No hook bypass, push, hosted rerun, remote migration/subscription change, payment/refund/dispute, metered conversation, deployment or issue mutation is included.

Local disposition: #923 entitlement lifecycle and #797 transactional grant repair are implemented and qualified locally; #932 real authenticated paid journey is qualified against the local production artifact and external-boundary stand-ins. All three issues remain OPEN pending their required accepted integration and separate released/runtime evidence. ElevenLabs compatibility is still unqualified; the last authorized attempt failed a prerequisite and cleaned up its temporary key before any capture. No new attempt is inferred. Stop for Phase 4 owner acceptance; Phase 5 requires accepted prerequisites and authorized continuation. Production rollout must follow the operator runbook and separately authorized release workflow.
