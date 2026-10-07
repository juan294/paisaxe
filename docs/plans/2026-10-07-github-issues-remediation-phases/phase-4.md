# Phase 4: Stripe entitlement lifecycle and paid voice journey

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #923, #932, #797. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

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
