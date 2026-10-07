# PayPal booking plan review assessment

Date: 2026-10-03. Status: assessment complete; recommended plan corrections remain open.

The original review below is preserved as history. The revision 2 follow-up at the end supersedes its finding dispositions.

The question is whether `docs/plans/2026-10-03-paypal-hackathon-booking.md` is both executable and a strong route to a winning PayPal AI Hackathon submission. This review covers the master plan, all nine phase files, the full linked proposal, selected current source, and current official event and PayPal documentation. It does not implement or revise the plan.

Reviewed checkout: `/Users/juan/code/paisaxe`, `develop`, commit `51140e54940f394cc33f071de923dd13789a1b95`. The plan records `bb225b2f`; the tracked diff from that baseline changes only the two deploy skill files. The master plan, phase directory and earlier research were untracked inputs and were preserved. References below describe these working files, not deployed behavior.

Reference shorthand: `master` means `docs/plans/2026-10-03-paypal-hackathon-booking.md`; each `phase-N.md` means the corresponding file under `docs/plans/2026-10-03-paypal-hackathon-booking-phases/`. The earlier proposal is `docs/research/2026-10-02-paypal-ai-hackathon-proposal-assessment.md`.

My recommendation is to keep the direction and revise the contracts before implementation. The plan makes sensible choices about narrow merchant scope, server-owned prices, buyer approval, early sandbox evidence and payment recovery. However, several algorithms contradict their own acceptance criteria. Competitive preparation also lost work that the research explicitly proposed: validation with prospective users and a provider.

The current [event rules](https://paypalaihackathon.devpost.com/rules) allow significant updates to existing projects, require central PayPal sandbox use plus AI, and require working access, public licensed source and English submission materials. The proposed scope addresses those requirements. The five judging criteria are equally weighted. Technical completeness alone therefore does not establish competitiveness. These are current observations retrieved October 3, not predictions of prize outcomes.

| Criterion | Assessment of the plan | Highest-value addition |
| --- | --- | --- |
| Implementation | Substantive PayPal and AI work, with useful real-provider spikes; state transitions need correction | One consistent transition contract exercised through return, webhook and reconciliation |
| Design | Clear intended offer/payment/management journey; entry and continuation behavior are underspecified | A fresh-browser mobile walkthrough that reaches the correct chat and proceeds without unexplained extra prompts |
| Impact | Specific audience, but only fixture mechanics have acceptance gates | Restore the proposed five-user and one-provider validation task |
| Innovation | Constraint-to-booking coordination is plausible; the demonstration could still look like conversational checkout | Show a meaningful constraint, rejected unsuitable option or changed slot, and an explainable resolution |
| Presentation | Sensible short video and genuine sandbox transaction | Rehearse the story early and include measured user/provider evidence |

The rubric is from the [official event overview](https://paypalaihackathon.devpost.com/). Assessments and recommended additions in the table are this review's judgment.

**F01 — High: cancellation preview can trigger a refund without confirmation.**

`docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-5.md:16` makes the model-callable cancellation request set `cancel_pending` while presenting a confirmation card. At `phase-5.md:37`, cron retries refunds for that same state after ten minutes. Consequently, a user who asks to inspect cancellation terms and never presses Confirm can still lose the booking and receive a refund. This contradicts the button-only authorization boundary at `docs/plans/2026-10-03-paypal-hackathon-booking.md:160`.

Make the preview read-only, or store a proposed state distinct from an authorized cancellation operation. Only the confirmation endpoint should record authorization. Cron must retry that operation, not infer consent from a preview. Required oracle: preview cancellation, leave the card untouched, advance time beyond ten minutes, and prove no refund or inventory release; then confirm and prove one refund under retries.

**F02 — High: recovery after buyer approval cannot deliver the promised result.**

Capture starts from the return page at `phase-4.md:79`. Its webhook handles capture/refund events at `phase-4.md:113`; reconciliation explicitly never captures at `phase-4.md:136`. Nevertheless, the manual gate at `phase-4.md:161` closes the browser after approval but before return and expects cron to confirm the booking. No component then initiates the capture. PayPal documents buyer approval and completed capture as distinct events in its [webhook catalog](https://developer.paypal.com/api/rest/webhooks/event-names/).

Choose and specify the behavior: either a server worker captures verified buyer-approved orders against an accepted offer and eligible hold, or the system expires the unpaid booking and provides a clear resumable path. The first better preserves the stated recovery objective. In either case, revise the actors, allowed transitions and acceptance test together. Also bound `capture_pending` when `getOrder` returns `APPROVED`; `phase-4.md:131` currently leaves it indefinitely. The page polls for two minutes (`phase-4.md:77`) while cron runs every five (`phase-4.md:119`), so its pending UI also needs a refresh/resume behavior that outlasts one cron interval.

**F03 — High: webhook deduplication can discard an event whose processing failed.**

`phase-4.md:112` durably records an event and immediately acknowledges duplicates. The next step applies payment/booking changes separately; a database error returns 500 (`phase-4.md:116`). If the recording succeeds and the update fails, the retry receives 200 as a duplicate without completing the update. A `processed_at` column exists in the sketch (`phase-1.md:26`), but the algorithm does not use it.

Use one database transaction for event recording and state application, or a durable inbox that distinguishes received from processed and retries unfinished events. The existing Stripe implementation explicitly prevents this same failure at `supabase/migrations/099_grant_day_pass_purchase_type.sql:99`. Test failure immediately after receipt and successful redelivery with one final effect. Reconciliation is valuable redundancy, but does not make the specified retry behavior correct.

**F04 — High: inventory is counted twice, and quote acceptance needs an atomic retry contract.**

The availability formula subtracts pending bookings and live holds (`2026-10-03-paypal-hackathon-booking.md:131`). Acceptance creates both for the same party (`phase-1.md:88`). A four-person booking therefore temporarily consumes eight places as written. An unpaid booking can continue consuming capacity after its hold expires until cron changes its state.

Define exactly one inventory owner at each stage: an active hold before confirmation and a confirmed reservation afterwards. Transition atomically. Acceptance currently consists of separate hold creation, booking insertion and quote/draft updates (`phase-1.md:84`); specify unique quote/hold-to-booking relationships and idempotent response recovery after intermediate failure or lost response. Test acceptance, expiry, confirmation and cancellation against availability, plus two simultaneous accepts of the same quote. The existing raw last-slot hold test alone does not cover these cases.

**F05 — High: capability links need a complete lifecycle and telemetry treatment.**

Only the SHA-256 hash of the random booking token is persisted, and the raw token is returned once (`phase-1.md:89`). Later, an order tool accepting only `bookingId` must generate a return URL containing that raw token (`phase-4.md:35`, `phase-4.md:60`). The master also promises to reissue lost links through chat (`2026-10-03-paypal-hackathon-booking.md:295`). Neither operation can reconstruct a random token from its hash. Specify authenticated rotation, a reproducible signed capability, or another explicit secure design, including how already-issued PayPal return links remain usable. Keep capability secrets out of model-visible text/history.

There is also a concrete existing integration gap: PostHog sends full path and query in page views (`src/components/posthog-provider.tsx:30`), and the root layout installs that tracker (`src/app/layout.tsx:158`). Sentry strips queries but preserves the path (`src/lib/sentry-before-send.ts:35`). New `/booking/<token>` and `/operator/<token>` URLs would therefore expose bearer capabilities to those telemetry paths unless scrubbed or excluded. Include route-aware redaction, appropriate cache/referrer handling and tests proving the raw tokens do not reach analytics or error events. Database hashing alone does not address URL disclosure.

**F06 — High for the demo: voucher entry can open the wrong agent, and acceptance does not define the next step.**

Phase 2 grants voice access and redirects to `/immersive?booking=1` (`phase-2.md:68`). The current immersive page handles `story` and `voice` query parameters, not `booking` (`src/app/immersive/immersive-page-content.tsx:149`). More significantly, active voice access supplies an agent ID (`src/hooks/use-voice-access.ts:95`), and `VoiceChat` automatically selects voice mode (`src/components/immersive/voice-chat.tsx:139`). Phase 3 swaps the text hook but does not alter that mode selection (`phase-3.md:87`). The new payment tools live in the text route; the voice booking frontend is explicitly deferred in the research (`2026-10-02-paypal-ai-hackathon-proposal-assessment.md:145`).

Specify a booking entry that selects and opens the text booking experience, with an explicit optional route to discovery voice. After quote acceptance, the client currently only swaps the card (`phase-3.md:84`); specify what triggers the next agent turn and payment-order tool, rather than requiring the visitor to invent another instruction. Test from a genuinely fresh voucher session through approval-link appearance, including voice-access resolution, reload and mobile navigation.

**F07 — Medium/high competitive gap: the central constraint-matching claim lacks a data and evaluation contract.**

The representative request includes a step-free route (`docs/research/2026-10-02-paypal-ai-hackathon-proposal-assessment.md:49`). The schema/fixture sketch specifies price, capacity, party size and times (`phase-1.md:27`, `phase-1.md:30`), while matching tests cover party/date/budget (`phase-3.md:95`). No phase pins provider-confirmed accessibility/language/transport facts, unknown values, contradictory constraints, or the refusal to claim suitability without evidence. These might be added by an implementer, but are not currently acceptance obligations.

Make the fixture contract explicit: distinguish supported, unsupported and unknown constraints; carry evidence into the offer; require a clarification or an honest no-match response when necessary. Add a small recorded evaluation set using the real model alongside deterministic tool tests: the representative request, impossible budget, unavailable slot, unknown accessibility, changed party size and an attempt to override price/consent. Mocked E2E sequences (`phase-6.md:44`) establish wiring, not model judgment. Record completion, clarification turns and latency; define success before selecting the video take.

This is also the clearest way to make AI visibly useful within the approved scope. A short “that option cannot meet your constraint; here is a valid alternative with these terms” interaction can establish more than another happy-path API operation. It is a recommended demonstration strategy, not a claim of unique market novelty.

**F08 — High-value opportunity: impact and usability validation disappeared from the plan.**

The research proposes five prospective users and one local provider, measuring unassisted completion, time, abandonment and understanding of deposit/balance/cancellation (`2026-10-02-paypal-ai-hackathon-proposal-assessment.md:397`), and schedules it before release (`:408`). The implementation phases and master manual acceptance (`2026-10-03-paypal-hackathon-booking.md:266`) cover technical rehearsals but assign no owner, time or acceptance evidence to that validation.

Restore a small task before candidate freeze: observe unfamiliar users, obtain a provider's assessment of the existing booking problem, fix the largest demonstrated friction, and record results and limitations for the pitch. The provider need not become a live merchant; the fixture scope can stay. Contact still requires the owner's authorization. These observations would support the impact/design story; do not describe a five-person trial as proof of broad demand or fabricate improvement percentages without a comparator.

**F09 — High, easy correction: the deadline is two hours early relative to the plan.**

The master `:8` and `phase-7.md:3` say November 12 at 23:00 Madrid. The current [official schedule](https://paypalaihackathon.devpost.com/details/dates) and [rules](https://paypalaihackathon.devpost.com/rules) say November 12, 2026 at 12:00 PST, which is **21:00 Madrid**. Keep November 11 as the internal target. The research's judging-start date at `:311` also needs refreshing: current judging is December 1–15, not November 13–December 15. Existing December 16 access expiry extends beyond the stated judging end.

**F10 — Medium/high: gate guarantees and the proposed probe do not establish the intended access boundary.**

The master requires an active voucher session on booking-status/payment routes (`:101`); Phase 2 says every later booking route begins with that gate (`phase-2.md:53`). Phase 4 deliberately permits token-only polling (`phase-4.md:100`), and Phase 5 permits guest-token cancellation (`phase-5.md:21`). The guest design is reasonable, but the contract must state which routes require voucher identity, which accept a booking capability, and what happens after voucher expiry or flag disablement.

The claim that the gate also hides the surface on Previews is not enforced by the described flag-plus-redemption checks. The current environment helper defaults non-local deployments to production (`src/lib/environment.ts:21`), and server flags use that value (`src/lib/feature-flags-server.ts:88`). If Preview isolation is required even with a valid voucher, add an explicit deployment/origin rule and test it.

The proposed deployed probe only requests a nonexistent token (`phase-6.md:40`). That can return 404 even when authentication is broken. Retain it as a small read-only route check, but add local positive and negative tests with valid fixtures: valid token without cookies, foreign identity, missing/expired voucher and the Preview context. Such tests must fail if the relevant gate is removed.

**F11 — Medium: production webhook provisioning is absent from the release sequence.**

Phase 0 provisions a listener for the tunnel (`phase-0.md:55`), Phase 6 copies configuration into Vercel (`phase-6.md:53`), and Phase 7 expects a real production webhook (`phase-7.md:20`). Add an explicitly authorized step to create or update the sandbox app's listener for `https://paisaxe.es/api/webhooks/paypal`, subscribe to the selected events, and configure the matching webhook ID before deployment. PayPal's [webhook integration documentation](https://developer.paypal.com/api/rest/webhooks/rest/) binds subscriptions to listener URLs. The tunnel's successful delivery is not evidence that the production listener exists.

**F12 — Medium: phase dependencies and parallel ownership need correction.**

| Conflict | Evidence | Correction |
| --- | --- | --- |
| Phases 2 and 3 claim no shared files but both edit all six locale files | `phase-2.md:29`; `phase-3.md:90`; master `:236` | Assign one translation owner or sequence integration explicitly |
| Phase 3 depends only on Phase 1 but imports/tests Phase 2 gate and metering | `phase-3.md:5`, `phase-3.md:29` | Distinguish parallel preparation from executable acceptance; require Phase 2 before integrated verification |
| Phase 4 reconciliation needs refund compensation before Phase 5's refund flow | `phase-4.md:132`; `phase-5.md:14` | Own the minimal compensation primitive in Phase 4 and reserve user cancellation UI for Phase 5 |
| Phase 8 requires every core acceptance item before Nov 3, including items that occur in production/video Phase 7 | `phase-8.md:3`; master `:268` | Define applicable pre-release gates, reconcile Nov 3 freeze with Phase 6's Nov 1–5 window, and leave production evidence for release |

Parallel labels do not eliminate dependencies. Correct these before using the date windows as delivery estimates. Preserve a working end-to-end rehearsal and video draft early enough that usability or narrative problems can still change the build.

**F13 — Medium: judging continuity and spend bounds are only partly specified.**

The research requires voice-minute metering and a worst-case voucher cost (`2026-10-02-paypal-ai-hackathon-proposal-assessment.md:198`, `:384`). The plan caps chat turns, loop iterations and booking attempts but replaces the voice-minute bound with an expiry (`2026-10-03-paypal-hackathon-booking.md:104`). Current voice access/session issuance checks purchase expiry, not cumulative voucher minutes (`src/app/api/voice-access/route.ts:28`; `src/app/api/voice-session/route.ts:49`). An expiry is not a quantified usage budget. Either define/enforce the promised voice allowance or explicitly record the boundedness claim as withdrawn and the provider-level operational limit that will be relied on.

For judge continuity, the fresh-browser rehearsal is immediate (`phase-7.md:26`), while the contract promises weeks-later availability (`master:273`). Add date-advanced fixture/access tests, a voucher replacement/reset procedure, and a light pre-judging availability check. At redemption, return an existing eligible redemption before rejecting new redemptions at the global cap (`phase-2.md:43`), so one user's valid repeat access does not fail merely because other users reached the cap. Dynamic dates and fixed expiries are good foundations, but do not prove the whole December journey remains usable.

Several smaller contract corrections belong with those findings:

| Correction | Evidence |
| --- | --- |
| Add `voided_local` to the chosen state contract or stop writing it; it is absent from the specified payment CHECK list | master `:125`; `phase-4.md:130` |
| Make already-completed orders, return capture, webhooks and cron use the same validated capture-finalization path; the fast path currently skips the normal validation steps | `phase-4.md:89` and `phase-4.md:131` |
| Define failed/pending refund outcomes, and verify the precise event names for the chosen API in the sandbox spike | `phase-4.md:113`, `phase-4.md:133`; [PayPal event catalog](https://developer.paypal.com/api/rest/webhooks/event-names/) |
| If invoicing ships, verify settled outstanding balance before marking `balance_paid`; the invoice-paid event also covers partial/pending payments | `phase-8.md:15`; [PayPal event catalog](https://developer.paypal.com/api/rest/webhooks/event-names/) |
| Add `booking_chat` to the closed usage-source type and record each model iteration | `phase-3.md:45`; `src/lib/costs/anthropic-usage.ts:27` |

**Alternatives and recommended direction.**

| Option | Benefit | Trade-off | Judgment |
| --- | --- | --- | --- |
| Implement unchanged | Immediate start with detailed phase files | Known consent, recovery and UX contradictions become implementation rework | Revise first |
| Correct the contracts and restore validation within the current scope | Better correctness, more credible impact evidence and a clearer demo without expanding infrastructure | Some documentation and bounded evaluation work before/alongside coding | Recommended |
| Make phone confirmation mandatory or add more sponsor integrations | Potentially more distinctive visible behavior | More external dependencies, authorization/capture states and testing; conflicts with the settled lean/extension order | Requires a new product decision and early feasibility evidence; not necessary to resolve this review |

Keep the fixture merchant, direct REST-backed tools, native operator fallback, sandbox capture/refund, and approved extension order. The core should stand on its own if every extension is cut. A provider validation result demonstrating that another workflow is materially more valuable could justify revisiting priorities; this review did not obtain that evidence.

The earlier research explicitly accepts the remaining content-rights risk and defers the content/image work (`2026-10-02-paypal-ai-hackathon-proposal-assessment.md:470`). This review does not reclassify that accepted risk as a newly discovered blocker or claim it has been resolved. Likewise, the historical charter conflict and release Preview exception already have planned dispositions.

**Evidence limits and handoff.**

Graphify local orientation was followed by source confirmation; graph-indexed plans were not treated as implemented behavior. Two bounded read-only investigations covered event/rules/phase scheduling and payment/booking invariants; both completed and their material findings were checked against the phase text. All external sources above were retrieved on October 3, 2026; the PayPal event catalog identifies an update date of September 10, 2026. No application tests, payment operations, deployments, account changes, provider contacts or remote writes were performed. Findings are plan contradictions, source-backed integration gaps or explicitly identified recommendations, not reproduced defects in an implemented booking feature.

Disposition: F01–F13 remain open for plan revision; no finding has been represented as repaired. The only task-owned repository addition is this assessment. Original plan/research inputs and the existing checkout remain intact. The next action is a plan revision that incorporates the selected corrections and acceptance oracles, followed by the plan's acceptance gate. Implementation and external actions remain separate; this assessment grants no additional authority.

**Revision 2 follow-up — 2026-10-03.**

The user requested a second assessment after revising the master and nine phase files. The actual files were reread at the same checkout and commit, `develop` `51140e54940f394cc33f071de923dd13789a1b95`. They remain untracked. The parent checked the revised contracts, access, evaluation, validation and delivery sections; an independent read-only payment investigation checked phases 1, 4 and 5. Prior source observations remain applicable because the tracked code identity has not changed. No implementation, runtime test, provider call or external action occurred in this follow-up.

The product and submission strategy are substantially stronger. The constraint evaluation, explicit booking entry, user/provider validation, early rehearsal, corrected event dates, production webhook step and judging continuity are concrete additions. The choice to withdraw the per-voucher voice-minute guarantee is an explicit scope decision, not a claim that metering was implemented. I would keep the scope and finish a small correctness revision before treating every finding as resolved.

| Original finding | Revision 2 disposition |
| --- | --- |
| F01 cancellation preview consent | Addressed in the plan: preview is read-only and only confirmation authorizes cancellation. The newly explicit recomputation needs the changed-terms rule in R2-05 below. |
| F02 recovery after approval | Improved by shared capture and three callers; remains partly open because R2-01 and R2-02 can lose truthful recovery. |
| F03 webhook durability | Inbox/retry direction addressed; replay data is still missing in R2-04. |
| F04 inventory and acceptance | Double-counting fixed in the contract; concurrent idempotency remains open in R2-03. |
| F05 capabilities and telemetry | Addressed in the plan through derived, revocable links and redaction acceptance tests; implementation evidence is future work. |
| F06 booking entry and continuation | Addressed in the plan with explicit text mode, an acceptance event and a payment-button fallback. |
| F07 constraint evidence and model evaluation | Addressed in the plan with provider facts and six real-model scenarios. |
| F08 impact/usability validation | Restored as Phase 5b with observations, limits and a remediation disposition. |
| F09 event dates | Corrected consistently with the official sources read in the original review. No new participant-count claim was independently checked in this follow-up. |
| F10 access contract | Explicit route table and Preview checks address the substantive finding; stale summary wording remains below. |
| F11 production webhook | Explicit listener provisioning step added before release. |
| F12 dependencies | Substantive merge/acceptance dependencies and freeze clarified; one stale phase header remains below. |
| F13 voice cost and judging continuity | Voice-minute bound openly withdrawn; continuity tests/checks added. Workspace backstop is still a Phase 6 verification prerequisite. |

**R2-01 — High: a completed capture can become an unpaid expiry.** At `phase-4.md:66`, the shared function admits both `APPROVED` and `COMPLETED` orders. At `phase-4.md:68`, failed capacity reacquisition marks either one expired with the explanation that nothing was captured. That explanation is false for a completed capture. Compensation at `phase-4.md:71` is reached only later in the algorithm.

Separate the already-captured branch before making the capacity decision. Persist/validate the capture evidence and enter a durable compensating-refund operation when fulfillment is impossible. The oracle must include: PayPal captured successfully, the response was lost, the hold expired, another booking took the slot, and reconciliation refunds exactly once without a webhook or visitor return. This is an unresolved part of F02, not an objection to using one shared capture function.

**R2-02 — High: three inconclusive passes cannot establish a failed payment.** `phase-4.md:168` moves unresolved `capture_pending` to `capture_failed`. Subsequent reconciliation branches at `phase-4.md:167` through `:171` do not revisit that state. A delayed settlement after pass three can therefore remain unhandled when the webhook is absent.

Bound the visible wait and escalate to `needs_attention`, while retaining an uncertain payment state that stays eligible for reconciliation. Only authoritative provider evidence should establish success or failure. Add a late-completion-after-pass-three test with webhook delivery disabled. A retry/attention threshold is useful; it cannot manufacture knowledge of the payment outcome.

**R2-03 — Medium/high: same-quote concurrent accepts can still fail instead of returning one booking.** `phase-1.md:72` checks for an existing booking before acquiring the experience lock at `:73`, with no second check once the lock is acquired. Two requests can both miss the existing row. After the first commits, the second can fail availability or uniqueness instead of returning that booking, contradicting `phase-1.md:168`.

Recheck for the existing quote booking inside the lock, or handle the uniqueness conflict by returning the committed row. The fast preliminary lookup may remain, but is insufficient as the sole idempotency check. Keep the existing simultaneous-same-quote acceptance test as the behavioral oracle.

**R2-04 — Medium: the inbox does not retain enough data for its promised replay.** The schema at `phase-1.md:27` stores event ID, type and resource ID with processing metadata, but not the verified event or its normalized order/booking relationships. Cron at `phase-4.md:166` must later replay it through `processPaypalEvent`. A capture event may be the first evidence of a capture after the original call timed out; its capture ID alone need not already be associated with a local payment. The specified adapter at `phase-4.md:52` has no event/capture retrieval operation that supplies the missing relationship.

Persist the verified payload, or explicitly store the minimal normalized identifiers and fields required by each handler. Acceptance: receive the event, fail processing, end the request, and successfully replay using only durable inbox contents and the specified provider reads. This completes F03 without a new subsystem.

**R2-05 — Medium: cancellation may execute on worse terms than the button displays.** The preview computes a refund at `phase-5.md:26`, and the confirmation button names that amount at `phase-5.md:51`. The endpoint recomputes it and immediately cancels at `phase-5.md:40`. If the cancellation cutoff passes between display and click, a button promising EUR 30 can silently cancel with EUR 0 refunded.

Send the expected refund/policy version with confirmation and compare it to the server calculation. If terms changed, return an updated preview and require renewed confirmation. The client-supplied amount is an expectation to verify, never authority to set the refund. Test a preview just before the cutoff and a click just after it; no cancellation should occur until the revised terms are accepted.

Two small wording cleanups also remain: master `:102` still says all payment/status routes require a voucher, and the stuck-state table's flag-off row still says every booking route returns 404; both conflict with the capability exception at master `:142`. The header at `phase-3.md:3` still says there are no shared files, although its dependency paragraph correctly acknowledges shared locales. These do not require a product decision; align the summaries with the detailed contracts.

On voice scope, the honest withdrawal is acceptable for this narrow submission. The 50-redemption maximum limits distinct guest identities, not cumulative renewable voice use; the existing-identity path at `phase-2.md:46` renews without consuming another redemption. The 10-per-minute session limit controls starts, not minutes. Consequently the workspace backstop must remain a verified operational assumption, and its evidence should say whether it stops spending or only alerts, whether overage remains possible, and what shared paid users would experience when it is reached. No per-voucher cost guarantee should be inferred. A new minute-metering feature is not needed merely to close this review if that residual is accepted.

Current recommendation: retain the revised product scope and close R2-01 through R2-05 in the plan, then proceed to Phase 0's evidence gate. F02, F03 and F04 remain only partly resolved; the other original findings have an explicit plan disposition, with F13 partly withdrawn. All remedies above are contract corrections and targeted acceptance cases. No new sponsor integration or broad redesign is recommended. This follow-up modifies only this assessment; it does not revise the plan or authorize implementation.
