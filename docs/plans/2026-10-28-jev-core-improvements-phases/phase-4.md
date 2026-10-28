# Phase 4 — Offline call-outcome advisor

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Entry: Phase 3 accepted. Deliver developer inspection and comparison only.

## Changes and contract

Create `scripts/lib/jev-call-outcome.ts` and tests, `scripts/eval/jev-call-outcome.ts` and CLI tests, plus synthetic call fixtures under `scripts/eval/fixtures/jev/`. Register the suite/report projection through the Phase 2 integration owner. Keep production webhook, SMS, call and settlement modules unchanged.

The current baseline flattens speaker turns and applies phrase patterns (`src/lib/services/elevenlabs-webhook-service.ts:161`, `src/lib/services/elevenlabs-webhook-service.ts:182`). Its `BookingOutcome` controls consequential downstream behavior and stays unchanged (`src/lib/services/elevenlabs-webhook-service.ts:23`, `src/lib/booking/phone-confirmation.ts:383`). Import only the pure baseline classifier function for comparison; its module's existing formatter/SMS dependencies are permitted imports, not callable advisor capabilities. Test zero database/SMS/payment transport on import and execution. Never import the new advisor into production webhooks or create a converter from advisory output to `BookingOutcome`.

Input contains a synthetic call's requested date/time/party, ordered utterances, explicit `merchant | paisaxe_agent | system` speaker mapping with original role retained, and separately identified status/summary. Role mapping is supplied by the fixture with provenance; it is not inferred from generic assistant/user names. Missing or ambiguous role mapping yields `uncertain`. Extract exact date/time/party candidates in code, retaining utterance IDs. Code checks equality with the requested reservation; Jev cannot decide arithmetic or invent a date. No default import of customer transcripts, provider dashboard fetch, database read, SMS or payment capability exists.

Ask independent questions for human merchant contact, merchant acceptance of the requested reservation, rejection, offered alternative, and later withdrawal/correction. Identify supporting utterance IDs from a finite list. Revalidate sequence, speakers and exact candidate equality in code. Missing transcript, missing requested criteria, conflicts between summary and utterances, multiple unresolved bookings, weak judgments or contradictory signals yield `uncertain`. A summary alone cannot support acceptance. Generic agent enthusiasm and voicemail greetings are not merchant acceptance.

Output is `{ advisory: true, label: merchant_accepted | merchant_declined | no_contact | uncertain, evidenceUtteranceIds, reasons, decisionMetadata }`; provider failure is the shared `unavailable` result, not `no_contact`. Labels deliberately differ from settlement labels. Show baseline disagreement and exact supporting turns in the inspector. Never produce approval receipts or an instruction to capture/void payment.

```text
@ adviseCall(snapshot) -> AdvisoryResult
ctx: synthetic ordered turns; typed adapter; pure legacy comparator
pre: valid snapshot identity; no transaction capability
do:
  1. validate roles, sequence and requested exact criteria
  2. parse deterministic candidate values with utterance IDs
  3. lookup independent contact, acceptance and correction judgments
  4. compute advisory label from evidence and equality checks
  5. emit comparison with uncertainty and evidence provenance
fail: incomplete evidence -> uncertain; provider failure -> unavailable
```

## Acceptance and recovery

Implement `CALL-01`–`CALL-06` in [oracles](behavioral-oracles.md). Include agent-only “perfecto”, explicit merchant confirmation, alternative date/party, acceptance then withdrawal, voicemail, missing roles, empty transcript, contradictory summary and prompt injection. Assert all production payment/SMS/webhook boundaries remain unreachable from the command. The fixture runner must work without any database or provider credentials. A failed case remains in the denominator and returns the Phase 2 partial/nonzero status; a new supplied snapshot or capped resume can resolve it without overwriting failure evidence.

Focused command: `npx vitest run scripts/lib/jev-call-outcome.test.ts scripts/eval/jev-call-outcome.test.ts src/lib/services/elevenlabs-webhook-service.test.ts src/lib/booking/phone-confirmation.test.ts`; run all parent gates. Freeze 40 tuning and 120 held-out synthetic cases with independently reviewed labels before live tuning. Zero held-out false acceptance only qualifies the advisor for developer assistance; report missed acceptance and abstention so an always-uncertain classifier cannot be presented as useful. At least 80% of truth-labelled, fully evidenced acceptance/decline/no-contact cases must receive the correct non-uncertain label; otherwise retain “experimental/unqualified”.

Human review checks role mapping, the synthetic rubric and usefulness of disagreements; it does not approve real bookings. Missing roles/criteria display precisely which fields to supply. Ambiguous evidence shows the contradictory turns and requests a corrected explicit snapshot, not an invented resolution. Provider errors show the failed case and a bounded retry command. Recovery tests prove a corrected snapshot or later successful provider response produces a fresh linked result.

After the input/rubric is frozen, `[batch-eligible]` units are the advisor/tests and independent fixture authorship/label review. Integration owner owns CLI registration and report changes. Stop after Phase 4 acceptance; live webhook adoption would require a separate design and authorization.
