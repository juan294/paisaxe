# Stripe entitlement lifecycle rollout and reconciliation

Migration `129_stripe_entitlement_lifecycle.sql` preserves original purchase expiry and the seven-argument grant RPC. It introduces private payment and physical-object ledgers. Only `service_role` can inspect or mutate those ledgers or call either new RPC. The public access predicates remain invoker functions subject to purchase ownership/RLS.

## Deployment prerequisites

This document performs no provider or production operation. Production publication, database migration, provider configuration and subsequent live evidence require separate explicit authorization. Keep the current endpoint API version unchanged. Before publishing the reviewed application candidate, apply migration 129 using the repository's authorized deployment workflow and verify the private relation/RPC privilege matrix. Then publish that exact candidate and verify effective access and signed-session denial with approved read-only runtime evidence. Do not close #923/#932/#797 from local fixtures alone.

The existing Stripe endpoint must subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed`. Inspect the existing subscription before a separately authorized change. These handlers never create a payment, refund, dispute, redelivery or conversation and never retrieve missing provider objects automatically.

Existing granted passes default to active when the migration is applied. Historical refunds/disputes that predate the ledger are not automatically discovered. Their existing records require separately authorized retrieval and reconciliation before claiming historical completeness. Unknown PaymentIntent identity emits `STRIPE_UNRECOVERABLE`; unmatched or incomplete facts emit `STRIPE_ENTITLEMENT_RECONCILIATION` and remain queryable in the private ledger. Provider API version, webhook subscriptions and real production lifecycle evidence are rollout gates.

## Policy and operator census

Each grant or adjustment locks its PaymentIntent before claiming the Stripe event ID. Two grant event IDs for one payment converge without renewing expiry. Refund totals count unique successful physical refund IDs against their matching charge's `amount_captured` and currency. Charge cumulative `amount_refunded` snapshots are never added. Open disputes suspend; terminal won/lost dominates delayed open. Winning one dispute clears only that dispute's reason. Full refunds and lost disputes independently revoke. An unrelated active payment or voucher still authorizes access. Session issuance checks the current active state; this does not terminate already minted or connected sessions.

Use the following read-only query through an authorized service connection. A `matched=false` row needs the authentic paid checkout event for the same PaymentIntent, delivered through the existing verified handler under separately authorized delivery/replay authority. A later authentic grant matches it automatically. Do not invent a provider event ID or insert a replacement purchase to bypass a tombstone.

```sql
SELECT p.payment_intent, p.matched, p.reconciliation_reasons,
       p.reconciliation_evidence, p.updated_at,
       vp.entitlement_state, vp.expires_at,
       f.kind, f.object_id, f.charge_id, f.amount, f.currency, f.status
FROM public.stripe_entitlement_payments p
LEFT JOIN public.voice_purchases vp ON vp.payment_provider_id=p.payment_intent
LEFT JOIN public.stripe_entitlement_facts f ON f.payment_intent=p.payment_intent
WHERE NOT p.matched OR cardinality(p.reconciliation_reasons)>0
ORDER BY p.updated_at, f.kind, f.object_id;
```

`incomplete_refund_pagination:charge-id` requires the complete existing refund list for that charge. A later authenticated, accepted complete charge snapshot clears that pagination reason while preserving other reasons. A stale complete snapshot cannot clear a newer incomplete snapshot. A missing captured charge requires its existing `amount_captured`, currency and identity; reconciliation refuses to clear that objective gap until the charge fact exists. `unsupported_refund`, `unsupported_dispute`, conflicting identity/amount/currency, and conflicting terminal status require the exact existing physical object's current authoritative record and a documented operator disposition. A succeeded-to-failed refund is quarantined instead of silently interpreted as an older snapshot. Unsupported dispute dispositions such as `warning_closed` do not restore access.

## Executable reviewed reconciliation

The new service-only `reconcile_stripe_entitlement` RPC is the explicit recovery action. It requires the exact reviewed reason array, selected reasons to resolve and a nonempty evidence reference. It compares the expected array under the payment lock, rejects stale reviews and null arrays, recomputes independent refund/dispute reasons, and leaves expiry unchanged. It records the evidence reference without manufacturing another Stripe event. Resolving a reason is an operator decision about authoritative evidence, not a waiver of refund/dispute policy.

For a local disposable task, retrieve the connection internally from its validated manifest/status workflow. The command below requires operator-selected existing identity, exact reason and retained evidence reference in environment variables; it does not supply a production target. Do not put personal data, credentials or raw provider payloads in the evidence reference. The same procedure against a remote target requires separate authorization.

```sh
: "${SUPABASE_LOCAL_DB_URL:?validated owned local task connection required}"
: "${STRIPE_RECONCILIATION_PAYMENT_INTENT:?existing reviewed PaymentIntent required}"
: "${STRIPE_RECONCILIATION_REASON:?exact existing reason required}"
: "${STRIPE_RECONCILIATION_EVIDENCE:?retained authoritative evidence reference required}"
psql "$SUPABASE_LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 \
  -v payment_intent="$STRIPE_RECONCILIATION_PAYMENT_INTENT" \
  -v reason="$STRIPE_RECONCILIATION_REASON" \
  -v evidence="$STRIPE_RECONCILIATION_EVIDENCE" <<'SQL'
BEGIN;
SELECT reconciliation_reasons::text AS expected_reasons
FROM public.stripe_entitlement_payments
WHERE payment_intent=:'payment_intent' FOR UPDATE \gset
-- Before the call below, review the physical facts against retained evidence.
-- If a physical fact is wrong, make the separately reviewed, exact-object
-- correction here in this same transaction; never change expiry or another PI.
SELECT public.reconcile_stripe_entitlement(
  :'payment_intent', :'expected_reasons'::text[], ARRAY[:'reason'], :'evidence'
);
SELECT entitlement_state,expires_at FROM public.voice_purchases
WHERE payment_provider_id=:'payment_intent';
COMMIT;
SQL
```

The lifecycle integration tests execute the actual reconciliation RPC, prove stale/null-array refusal and successful reviewed recovery, prove unmatched grant recovery, and exercise real signature verification, database grants, rollback and concurrent convergence. Local synthetic evidence proves the mechanism; it does not authenticate a real provider correction. Preserve failed attempts and exact candidate/schema identities. A session issuance 403 invalidates the previous client grant before the reason is refreshed. If that reason request is rate-limited or unavailable, the buyer sees a generic unavailable state with retry/support, without a dispute explanation or purchase-again prompt. A successful fresh access response supplies the specific reason or restores eligible access; ordinary refresh rate limits retain their existing confirmed-access behavior.

After reconciliation, check the current access endpoint and new session issuance; never require a temporarily suspended buyer to purchase again.

## Local paid voice proof

`CONTRACT_STACK_DIR` must identify a newly prepared owned disposable stack. Use a new private evidence directory for every attempt. The default mode refuses a missing or stale production artifact seal. With the same validated stack, build and then test sequentially:

```sh
: "${CONTRACT_STACK_DIR:?validated owned local task required}"
: "${PAID_VOICE_BUILD_RECEIPT:?new private artifact-seal path required}"
: "${PAID_VOICE_EVIDENCE_DIR:?new private build evidence directory required}"
node scripts/run-paid-voice-local.mjs --build-artifact
# Set PAID_VOICE_EVIDENCE_DIR to a different new private test evidence directory.
node scripts/run-paid-voice-local.mjs
```

The build mode executes `npm run build` with production NODE_ENV, the owned local public keys and the native transport preload. It seals BUILD_ID, production artifact content, the application/E2E/config/fixture input digest and public configuration binding. The test mode verifies the seal before `next start` and checks input and artifact identity afterwards. The private receipt never prints local key values. Explicit `PAID_VOICE_ARTIFACT_MODE=development` exists for RED/scoped diagnostics and never supplies final production-artifact evidence. The runner validates marker, schema and migration identity, derives task-local keys internally, creates an ephemeral TLS certificate trusted only by its test connector and starts a fresh loopback Next server. The browser uses genuine task-local password authentication and SSR cookies. Access routes, RPCs, server credential checks/native fetch and the installed ElevenLabs SDK/WebAudio remain real. Only the exact provider TLS and browser WebSocket network boundaries stand in. External Node sockets/fetch and browser HTTP/WebSocket requests are denied; no payment, model or provider conversation is created. The harness is a test process boundary, not an OS network sandbox. It is excluded from ordinary desktop/mobile projects and cannot reuse a running server.

The proof covers allowed Pelayo UI/session connection, anonymous/expired/revoked/suspended denial without additional issuance, independent pass access, support instead of a suspension purchase prompt, same-dialog server403 access refresh without another TLS issuance, SDK story/language/auth context and rendered provider transcript, provider credential rejection, text fallback and corrected retry. Check the private receipt and actual assertions before reporting a pass. A denied resampler/CDN or incomplete SDK handshake is a failed/incomplete browser proof, never a simulated success.
