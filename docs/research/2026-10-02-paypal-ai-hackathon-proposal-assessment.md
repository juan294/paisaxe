# Paisaxe: from discovery to a confirmed, paid local experience

**Full proposal and sponsor assessment for the PayPal AI Hackathon**

Date: 2026-10-02. Owner: Juan. Status: **product direction approved; revision 3 incorporates the owner's review decisions and a second independent review, both of the same day; implementation not started by this assessment**.

**Revision 2 note.** Revision 1 was reviewed against the repository and the official event pages on October 2. This revision records the owner's decisions (section 1), adds the baseline gaps that review found (section 3) and updates scope, architecture, sponsor strategy, demo, acceptance evidence, timeline and publication to match. Where it matters, a claim is marked **verified** when it was read or run on October 2 and the evidence is cited. Everything else is a proposal, an inference or an unchecked external claim, and says so.

**Revision 3 note.** A second independent review of revision 2 raised six gaps and two corrections. Each was checked against the repository, the GitHub branch protection and the event rules, and each held. This revision adds the release-path conflict and the content-rights gap to section 3, makes scheduled reconciliation required, defines what a voucher meters, gives judge access a repeatability contract, turns the sandbox spike into an implementation phase with a development tunnel, separates authorization from execution in section 11, and corrects the Channel3 and day-pass statements. Section 14 lists the corrections. The owner then ruled on the three questions this raised; they are decisions 11 to 13.

## 1. Decision and proposal

Extend Paisaxe so a visitor can discover a local experience, agree its details through conversation, reserve a real slot and pay an approved deposit through PayPal. Keep Paisaxe's photography, local knowledge and conversational character. Add a reliable commercial outcome to the experience people already discover.

**Pitch:** “See somewhere you want to go. Tell Paisaxe what you need. Leave with an agreed experience, a confirmed reservation and a paid deposit.”

The proposed first release serves one participating local activity provider in Asturias, with a small catalog, EUR prices and one reservation per checkout. AI understands the visitor's constraints, coordinates the steps and calls the PayPal operations as tools. PayPal completes the buyer-approved transaction. The application controls prices, capacity, permissions and payment state.

Juan explicitly approved this new direction on October 2, 2026, including the intent to make the repository public for the event. The existing charter excludes bookings and monetization at `docs/project/project-charter.md:67` and `docs/project/project-charter.md:71`, with related values at lines 96 and 99. **That historical restriction is superseded for this approved extension. Do not reopen the direction decision in the next session.** The charter is loaded into every agent session through `CLAUDE.md:5`, so the contradiction is live until it is fixed. Reconciling it is the first planning deliverable (section 11), while preserving its principles of simplicity, visual discovery and respect for sources.

Keep Stripe for existing voice-pass purchases. Use a separate, direct PayPal integration for experience deposits and refunds. AgreePay remains a possible future fallback; it is outside this proposal.

Sponsor strategy after owner review: build the core with PayPal, use **APIMatic** to assist integration development and **Postman** to make it reproducible, and build a **plain native operator view**. **AG Studio** replaces the native view only if a half-day trial of AG Grid's boilerplate succeeds. **Bryntum is not selected.** Zapier stays an optional extension. The remaining sponsors have conditional uses described in section 7.

### Owner decisions recorded on October 2

These are settled. Do not reopen them in the planning session; new owner direction is the only thing that changes them.

| # | Decision | What it means for the plan |
| --- | --- | --- |
| 1 | **Direction approved.** Paisaxe extends into paid local experiences. | The charter restriction is superseded. Record it in a decision record and reconcile the charter first. |
| 2 | **Lean operation.** Choose the smallest option that satisfies the rules. | The demo video is the primary judging artifact. In the owner's experience judges rarely log in. Do not propose infrastructure whose only purpose is judge access. |
| 3 | **No separate demo stack.** | The feature ships to the existing live site behind an access gate. Judges receive a voucher, or an equally simple method, so they can use everything without paying. |
| 4 | **Guest booking by signed link, and a seeded demo operator.** | A visitor books without Google sign-in. The operator view has a seeded account limited to the fixture merchant. |
| 5 | **Publish the existing repository after a light cleanup.** | No new repository and no history rewriting. The owner accepts the exposure of existing history. |
| 6 | **Sponsors:** APIMatic and Postman, native operator view, AG Studio only on a successful half-day trial, Bryntum dropped. | One sponsor prize is the maximum, and APIMatic already provides eligibility. |
| 7 | **Payment shape:** capture, then refund where needed. | Authorize, capture and void belong only to the phone-confirmation stretch goal. |
| 8 | **The agent drives PayPal.** Order creation, status and refund run as model tool calls behind server validation. | Targets the two PayPal-specific honorable mentions. Buyer approval and server-side capture checks remain. |
| 9 | **Extension order:** invoice the balance through PayPal, then the phone-confirmation stretch, then Zapier. | Extensions start only when the core is green and are the first things cut. |
| 10 | **Tighter video.** Open on the transaction and drop the closing repository segment. | See section 9. |
| 11 | **The release pull request's Preview is the standing exception** to the rule against creating Previews. | The required check `Smoke test Vercel preview` stays. The exception is written into the release checklist. No other Preview is created. |
| 12 | **Production verification is a separate, owner-authorized acceptance step.** | The required probes stay read-only. After them, one voucher-gated sandbox journey runs against the fixture merchant, writes only fixture-labelled rows and keeps its evidence apart from the probe evidence. The step is written into the release checklist. |
| 13 | **Content is published with its existing attribution, kept simple.** | The owner's position is that the guides are offered free to the public by the Asturian government and that Paisaxe re-presents their information with attribution. The owner accepts the remaining rights risk and will adjust later if it ever matters. No rights record is a prerequisite. **Amended October 3:** an authorization request is pending and planning now assumes a refusal; the contingency in section 12 is in execution. |

## 2. Audience, problem and differentiation

The initial visitor is planning an activity with constraints: party size, date, budget, language, transport or accessibility. The initial merchant is a small local provider who needs a usable booking, an agreed price and a deposit. The product hypothesis is that conversational discovery can remove the gap between finding an attractive experience and completing that agreement.

A representative request is: “Somos cuatro, queremos hacer algo mañana por la mañana, tenemos un presupuesto de 120 euros y una persona necesita un recorrido sin escalones.” Paisaxe should clarify what is missing, retrieve provider-supplied facts and present a suitable bookable offer. It must state when accessibility information has not been confirmed by the provider.

The broad audience is travelers and local leisure customers. Asturias is the initial market for a reusable pattern: conversational discovery connected to the operating reality of small providers. Mass-market appeal is a **hypothesis**, not a measured result. Merchant participation, conversion improvements and willingness to pay remain unmeasured.

Generic AI itinerary planning is established. Booking.com has a conversational [AI Trip Planner](https://news.booking.com/bookingcom-launches-new-ai-trip-planner-to-enhance-travel-planning-experience/), and [PayPal's agentic commerce page](https://www.paypal.ai/) includes travel partners. Paisaxe's proposed distinction is the complete, inspectable agreement for a local experience: constraints, merchant-confirmed offer, held capacity, approved deposit, confirmation and cancellation recovery. This assessment does not establish that no competitor provides a similar flow.

The event page showed 3,269 registered participants on October 3 (an earlier read on October 2 recorded 674). Conversation followed by a checkout is the obvious build, so many entries will resemble the core journey. The element least likely to be repeated is one Paisaxe already owns: an AI agent that telephones a venue with no booking system (`src/app/api/mcp/make-booking/route.ts:321`). That is why the phone-confirmation flow is the named stretch goal in section 5 rather than a discarded idea.

The emotional experience should remain simple: inspiration, a helpful conversation and a clear confirmation. Merchant tools belong in an authenticated operator view. Spanish remains the product's baseline language; the submission can use English narration and captions.

## 3. Baseline and reusable implementation

Observed baseline: `/Users/juan/code/paisaxe`, branch `develop`, commit `28c3aea736d0b0f5e192527597e959fad18443ac`. GitHub inspection found `juan294/paisaxe` private and no detected repository license on October 2. The public-source direction is approved; visibility and licensing have not been changed by this work.

The following are source observations, not claims about currently deployed behavior:

| Existing capability | Evidence at the baseline | Role in the proposed extension |
| --- | --- | --- |
| Asturias discovery product | `README.md:13`; `docs/project/project-charter.md:17` | Preserve the visual entry point and local identity. |
| AI responses using retrieved context | `src/lib/claude.ts:597` | Reuse grounded conversation, with a separate authoritative offer lookup. |
| Vector retrieval and Voyage reranking | `src/lib/search.ts:16`; `src/lib/search.ts:85` | Retain the existing discovery retrieval system. A retrieved description cannot establish price or availability. |
| Idempotent booking request and outbound call initiation | `src/app/api/mcp/make-booking/route.ts:295`; `src/app/api/mcp/make-booking/route.ts:321` | Reuse suitable coordination patterns after confirming their contracts. Basis of the stretch goal. |
| Explicit distinction between call initiation and booking confirmation | `src/app/api/mcp/make-booking/route.ts:382` | Preserve this distinction throughout the payment journey. |
| ElevenLabs outbound telephone integration | `src/lib/services/elevenlabs-call-service.ts:139` | Merchant channel for the stretch goal; a live phone call is not required for the core demo. |
| Existing booking tools | `docs/project/features.md:132` | Extend the user journey without claiming existing tools already collect a merchant deposit. |
| Stripe checkout for voice access | `src/app/api/checkout/embedded/route.ts:45`; `src/app/api/checkout/embedded/route.ts:102` | Keep voice-pass purchases separate from merchant bookings. |
| Day-pass grant function | `supabase/migrations/099_grant_day_pass_purchase_type.sql:56` | **Not reusable as it stands.** It records every grant in `stripe_webhook_events` (`:74`), and pass types are limited to three Stripe products by a check constraint (`:39`). A voucher grant needs its own audit contract. |
| Administrative navigation and Stripe revenue reporting | `src/components/admin/admin-tabs.tsx:12`; `docs/project/features.md:403` | Add a distinct booking operations view; do not mix deposits with voice-pass revenue. |
| Booking cleanup and notification retries | `docs/operations/operations.md:207` | Assess existing scheduled work before introducing another hosting platform. |
| Full-history secret scanning in CI | `.github/workflows/security.yml:27` through `:47`, with `fetch-depth: 0` | Covers the one publication risk that cannot be undone later. |

### Gaps observed at the baseline

All rows are **verified** on October 2 unless the row says otherwise. Each one is new work or a constraint that revision 1 did not count.

| Gap | Evidence | Consequence |
| --- | --- | --- |
| The text chat has no tool calling. | A search of `src` outside tests for `tool_use`, `tool_choice` and `tools: [` returned nothing. The text path retrieves at `src/app/api/chat/stream/route.ts:205` and streams at `:305` through `src/lib/claude.ts:141`. | The AI orchestration layer is new: tool definitions, a streaming tool loop and the changes to the chat stream protocol. |
| Existing tools serve only the voice agent. | `src/app/api/mcp/make-booking/route.ts:146` checks a shared secret from `src/lib/mcp-auth.ts:16`, and the route is flag-gated at `:174`. | They are not callable from the text chat as they stand. |
| Google OAuth is the only sign-in method. | `src/components/auth/auth-provider.tsx:148` is the only `signInWith…` call in `src`. No anonymous sign-in exists. | Guest booking and the demo operator both need an access path that does not depend on a judge's Google account. |
| Paid features require a signed-in user. | `src/app/api/checkout/embedded/route.ts:69` through `:72`; `src/app/api/voice-session/route.ts:26` through `:28`. | A voucher must establish an identity or session by itself. |
| No voucher or promotion mechanism exists. | A search of `src` and `supabase/migrations` for voucher, promo, coupon and redeem returned nothing. | Small new work. |
| The admin role opens the real dashboard. | `src/lib/admin-auth.ts:90`; Stripe analytics at `src/app/api/admin/stripe-analytics/route.ts:81`. | The demo operator must not be an admin. It needs its own role limited to the fixture merchant. |
| There are only two runtime environments in code. | `src/lib/environment.ts:21` through `:41` returns `development` or `production`. `vercel.json:3` skips non-production builds outside pull requests. | With no demo stack, the feature is exercised locally and on production only. |
| Preview deployments share the production database and live Stripe keys. | Recorded in July 2026. **Not rechecked on October 2.** | No mutating test may target a Preview URL. This supports the decision not to build around previews. |
| Publication exposes a large history. | 1,893 commits and a 1.97 GiB pack; 37 files under `content/pdfs`; 103 files under `public/images/stories`; 23 tracked files under `docs/agents`, with no ignore entry for that folder. | Accepted by the owner (decision 5). Section 12 lists the light cleanup. |
| The README states MIT but no license file exists. | `README.md:270` through `:272`; no `LICENSE` file; GitHub reports no license. | The rules require a detectable license file. |
| A review workflow can be triggered by a comment. | `.github/workflows/claude-review.yml:6`; the job condition at `:17` through `:24` has no author check. Whether the action itself rejects outside commenters is **unverified**. | Add an author check before the repository becomes public. |
| The release procedure contradicts itself on Previews. | Branch protection on `main` requires the check `Smoke test Vercel preview` (GitHub API, October 2). That check runs on pull requests to `main` and waits for a Preview (`.github/workflows/preview-smoke.yml:25` and `:40`), which `vercel.json:3` builds for pull requests. `.rpi/rules/deployment-safety.md:28` says never to create Vercel Previews. | A release pull request cannot satisfy both. **Resolved by decision 11.** |
| Deployed probes must be read-only. | `docs/runbooks/release-checklist.md:123`; `quality/required-probes.yaml:10`. | A sandbox transaction on production writes rows. The checklist has no step that permits it. **Resolved by decision 12.** |
| No record of permission to republish the tourism content. | `README.md:262` describes 37 official guides. `content/story-image-mappings.json` covers 20 stories: 13 with Unsplash origins and 7 taken from the PDFs. `stories.image_source` holds attribution (`supabase/migrations/007_image_source.sql:5`). A search of `docs/project` and `docs/operations` found no permission or license record for the guides or the photographs. Whether permission exists outside the repository is **unknown**. | Attribution is recorded; permission is not. **Risk accepted by decision 13**; section 12 records the evidence. |

New work therefore includes text-chat tool calling, an authoritative merchant offer catalog, expiring capacity holds, accepted quote versions, direct PayPal order/capture/refund handling, payment reconciliation, booking confirmation, cancellation policy enforcement, guest access by signed link, a voucher gate, a scoped demo operator and an operator view. This assessment has not implemented or runtime-tested those additions.

## 4. The complete first journey

0. **Enter.** A judge or tester opens the site with a voucher. The voucher unlocks the booking flow, which is otherwise not reachable on the live site, and grants voice access without a Stripe payment. No Google sign-in is required.
1. **Discover.** A visitor opens an experience from Paisaxe's image-led discovery interface and describes the people, date, budget and relevant constraints.
2. **Clarify and match.** AI asks only necessary questions, retrieves descriptive context and calls a tool that checks structured, provider-approved offers. It explains why an offer matches and identifies any unknowns.
3. **Agree.** Show the provider, activity, location, date and timezone, duration, party size, confirmed constraints, total price, deposit, remaining balance, cancellation terms and quote expiry. The visitor explicitly accepts this offer version.
4. **Hold.** The server obtains an expiring hold against real catalog capacity. It returns the hold reference and expiry. It also issues the booking reference and its signed link at this point, before any payment, so the visitor can return to the booking if the browser closes during or after approval. If the slot disappears or terms change, obtain a new agreement before starting a new payment.
5. **Pay.** The agent requests a PayPal sandbox order through a tool. The server builds the order from the persisted accepted offer, never from model-supplied amounts. The buyer approves through PayPal. Before capture, the server validates the order against the accepted offer, guest identity, merchant, amount and currency, and checks that the hold remains eligible for completion. It then captures the approved order and verifies the returned capture status and details.
6. **Confirm.** Finalize the reservation, show its reference and receipt, and explain any balance due. The signed link issued at the hold now opens the confirmed booking. Only show “confirmed” when both the reservation and captured payment are verified.
7. **Manage changes.** Through the signed link, a visitor can inspect the booking, request cancellation and see the applicable refund. A refund remains pending until the payment provider confirms its result. A changed price or slot creates a fresh offer for acceptance.

Illustrative demo fixture: a four-person experience costs **EUR 120**, with **EUR 30 paid now** and **EUR 90** remaining. These are invented test values, not a real merchant's prices. The demo must label its test provider/catalog and PayPal sandbox clearly. A full refund within a simple, published cancellation window is sufficient for the first build.

The strongest impact evidence would be a participating provider supplying the offers and describing their actual booking process. If that is unavailable, demonstrate the software with explicit merchant fixtures and make no claim of live provider adoption.

## 5. Scope and commercial model

### Required first scope

- One merchant, one currency, a small set of experiences and a single party per booking.
- A merchant-managed catalog with prices, deposit amounts, capacity, booking windows and cancellation terms.
- Tool calling in the text chat, with conversational discovery and constraint matching grounded in merchant facts.
- Quote acceptance, capacity hold, agent-requested and buyer-approved PayPal sandbox deposit, server-side capture and verified booking confirmation.
- Guest booking with a signed link for status and cancellation.
- Booking status, cancellation, refund and recovery from an uncertain payment response.
- A voucher gate that keeps the sandbox booking flow away from ordinary visitors and gives judges free, repeatable and metered access.
- Scheduled reconciliation that brings a paid booking to confirmed or refunded without the visitor, the conversation or the AI.
- Fixture availability that stays bookable for the whole judging period.
- A plain native operator view showing slots, bookings, deposits, remaining balances and exceptions, opened by a seeded demo operator limited to the fixture merchant.
- The existing repository made public with a license, fixture data and a reproducible demonstration.

### Extensions after the core is reliable, in this order

1. **Invoice the remaining balance through PayPal.** PayPal's agent toolkit lists `create_invoice` and `send_invoice`. This replaces “balance due at the venue” with a second PayPal operation driven by the agent.
2. **Phone-confirmation stretch goal.** For a provider with no bookable catalog: authorize the deposit, let the existing voice agent telephone the provider, then capture on confirmation or void on decline. PayPal documents a 29-day authorization with a 3-day honor period, captured at `POST /v2/payments/authorizations/{id}/capture` and released at `…/void`. Demonstrate it against a test phone, never an unprepared real venue.
3. **Zapier synchronization** to the participating merchant's calendar or booking sheet.
4. **AG Studio** as the operator view, only under the condition in section 7.

Extensions start only when every core acceptance item in section 10 passes. They are cut first when time is short.

### Deferred product areas

Multi-merchant onboarding, marketplace commissions, split payouts, escrow, consumer-to-consumer transfers, multiple currencies, installment credit, arbitrary-site shopping and dynamic price negotiation are outside the first build. The existing voice interface as a second front end for the same booking contract is also deferred.

For the sandbox prototype, one sandbox merchant receives the deposit. A production launch with independent merchants needs an explicit merchant/account model and the applicable PayPal onboarding path. Do not treat a single sandbox account as proof that a production marketplace is ready.

Taking deposits for third-party tourism activities in Spain may bring tourism-intermediary and consumer-law obligations. **This was not researched.** It does not affect a sandbox demonstration. It does limit what the submission may claim about production readiness and impact.

Possible future revenue models are a merchant subscription for booking operations or a booking fee with explicit merchant terms. These are commercial hypotheses for later validation. The hackathon flow does not require a platform fee or fee splitting.

## 6. Architecture and payment boundaries

Retain the current Next.js application, Vercel hosting, Supabase persistence and existing AI/retrieval stack. Add the booking domain and PayPal adapter within that foundation. These are proposed responsibilities; exact files, schemas and tool contracts belong in the implementation plan.

| Component | Responsibility |
| --- | --- |
| Access gate | Redeem a voucher, establish a guest session without Google sign-in, unlock the booking flow and grant voice access under its own audit trail. Meter use and enforce an expiry. |
| Visitor interface | Conversation, offer review, explicit acceptance, PayPal approval and booking status through a signed link. |
| AI orchestration | Interpret requests, ask questions, match documented constraints, call allowed tools in a streaming tool loop and explain verified results. **New at the baseline.** |
| Booking service | Validate offers, own capacity and holds, bind accepted versions to a guest identity, enforce cancellation rules and maintain booking state. |
| PayPal adapter | Create/read orders, capture approved payments, issue authorized refunds and reconcile uncertain outcomes. |
| Webhook handler | Verify authenticity, deduplicate events and apply valid state transitions against the expected payment. |
| Operator view | Display authoritative booking/payment data for the fixture merchant and expose explicitly authorized actions. Uses a role separate from admin. |
| Scheduled reconciliation | **Required.** On a schedule, resolve every booking left between approval and confirmation, or between cancellation and refund, from PayPal's own records. Retry idempotent notifications. The existing scheduled-route pattern (`src/app/api/cron/fail-stale-bookings/route.ts`) is the default host. |
| Optional separate worker | A different runtime for that job, only when the existing one cannot meet measured requirements. |

The AI should never invent a merchant price, alter the accepted amount, claim a reservation from an unconfirmed phone call, or treat natural-language interest as permission to spend. Tool inputs and permissions must be checked by the server. A payment tool accepts an accepted-offer reference, not an amount. Provider descriptions and retrieved content are data; they cannot grant tool authority or change payment rules. Operator queries must stay within the fixture merchant's data scope.

Keep booking state and payment state distinct. Useful concepts include quote expiry, held capacity, pending buyer approval, capture pending, captured payment, confirmed reservation, cancellation pending, refund pending and refunded payment. The exact state machines are a planning deliverable.

There is no atomic transaction across the reservation system and PayPal. Persist an operation identifier and provider identifiers before retryable steps. A timeout after capture requires status reconciliation before any retry that could charge again. If payment succeeds but reservation finalization fails, show a recovery state and reconcile or refund; never manufacture a successful booking. Expired holds and late approvals must have a deterministic outcome.

Recovery cannot depend on the conversation. After the buyer approves, the visitor may close the browser, the webhook may never arrive and the AI may be unavailable. Scheduled reconciliation alone must then bring the booking to confirmed or refunded. The visitor must also be able to find the booking afterwards, which is why the signed link is issued at the hold, before payment, rather than on the confirmation screen. Whether PayPal's return address should carry the same reference is a planning detail.

Bind all money operations to a specific accepted offer version, guest identity, merchant, currency and amount. Use integer minor units internally and validate provider decimal formats at the adapter boundary. Capture/refund retries need application-level deduplication as well as the applicable PayPal idempotency mechanism. A late event cannot move a completed refund back to a paid booking. Duplicate notifications must not create duplicate calendar entries or receipts.

### The agent and PayPal

PayPal documents order/capture/refund capabilities in its [agent tool reference](https://developer.paypal.com/ai-tools/agent-tools/), which also describes a remote MCP server. The [agent toolkit](https://github.com/paypal/agent-toolkit) is the npm package `@paypal/agent-toolkit`, with tools including `create_order`, `get_order`, `pay_order`, `create_refund`, `get_refund`, `create_invoice` and `send_invoice`. Its documentation names the Vercel AI SDK, the OpenAI Agents SDK, LangChain and MCP. It does not name the Anthropic SDK, which Paisaxe calls directly (`src/lib/claude.ts:141`), and it lists no authorize or void tool.

The first integration spike therefore answers one question: do the PayPal tools reach the model through the PayPal MCP server, through the toolkit's functions wrapped as Paisaxe tool definitions, or through Paisaxe tool definitions over the Orders API. In every case the model's tool calls pass through server validation, and the stretch goal's authorize and void steps use the direct API. Decision 8 is satisfied by any of the three, provided the agent visibly drives the PayPal operations.

PayPal's [JavaScript SDK setup](https://developer.paypal.com/sdk/js/set-up) supplies the buyer-facing approval path. The toolkit does not remove buyer approval, server authorization or payment verification. PayPal's [Orders flow](https://developer.paypal.com/api/rest/integration/orders-api), [authorization guide](https://developer.paypal.com/docs/checkout/standard/customize/authorization/), [webhook documentation](https://developer.paypal.com/api/rest/webhooks/rest/) and [idempotency reference](https://developer.paypal.com/api/rest/reference/idempotency/) are the implementation starting points. Keep secrets server-side and publish only empty environment templates and non-sensitive fixtures.

The content security policy currently names Stripe as the only external script and frame source (`src/lib/proxy/csp.ts:43` and `:58`). The PayPal JavaScript SDK needs its script, frame and connection origins added there, within the project's existing rule against `'strict-dynamic'` and nonce-only policies.

### Where it runs

There is no separate demo stack (decision 3). Development and automated tests run against the local Docker database and the PayPal sandbox. The submitted build runs on the existing production site behind the voucher gate.

- **One production release is on the critical path.** It follows `docs/runbooks/release-checklist.md` and needs the owner's explicit authorization. Section 11 schedules it with margin before the deadline. Two conflicts in that procedure were settled by the owner; see the next subsection.
- **Sandbox credentials live in production configuration.** Changing Vercel environment variables needs the owner's authorization, and secret values are the owner's to supply (section 11). New variables must also pass `npm run check-env` (`package.json:27`). If the release pull request builds a Preview, the same variables are needed in that scope.
- **New tables reach the production database.** Test every migration on the local Docker stack first. The release gates include `npm run check-migrations`.
- **Fixture data lives in the production database.** Label the test merchant, catalog and demo bookings. Keep them out of Stripe revenue reporting and any real analytics.
- **Real webhooks need a public address.** A mocked webhook does not establish that a real event can be authenticated and reconciled. Revision 3 chooses a temporary development tunnel during Phase 0 (section 11), so the first real webhook is authenticated in the first week rather than in release week. Production verification repeats it after the release. A tunnel to a local server is not a Vercel Preview. The owner may instead defer this evidence to production, accepting that a webhook fault would then surface days before the deadline.
- **Spend is bounded by metering, not by redemptions alone.** Counting redemptions does not limit what one redemption costs. The plan defines limits for each unit that costs money: chat turns per guest session, tool-loop iterations per turn, voice minutes per voucher, and booking attempts per session. Together they give a worst-case cost for one voucher. The existing limiter (`src/lib/rate-limit.ts:335`) is the starting point. Earlier operations notes record a July 2026 outage caused by exhausted AI credits; that note was not rechecked here.
- **Judge access must be repeatable.** A judge may return, and another may arrive weeks later in a fresh browser. A voucher therefore cannot be single-use, voice access granted by it must last through December 15, and fixture slots must never be in the past or sold out. Rolling fixture dates with replenished capacity, or a scheduled fixture reset, are the candidates.

### Release path rulings

Two conflicts in the release procedure were verified on October 2. Both predate this proposal, and the owner ruled on both the same day.

1. **Previews (decision 11).** `main` requires the check `Smoke test Vercel preview`, and that check needs a Preview of the release pull request, while the deployment rule forbids creating Previews. The release pull request's Preview is now the standing exception, which the project instructions already anticipate as “a documented, non-destructive bypass”. No other Preview is created.
2. **Mutating verification on production (decision 12).** The checklist's deployed probes stay strictly read-only. A separate, owner-authorized acceptance step follows them: one voucher-gated sandbox journey against the fixture merchant, writing only fixture-labelled rows, with its evidence recorded apart from the probe evidence.

Neither ruling is in force until it is written down where the procedure lives. The release checklist is the single procedural authority, so both go into it, as documentation work in the first week. The rule file that forbids Previews is installed from a shared source, so the exception is recorded in the checklist and the project instructions rather than by editing that file.

A Preview built for the release pull request would run the new code against the production database, as recorded in July. The voucher gate must therefore hold on a Preview address too.

### Stripe and PayPal coexistence

Stripe continues to sell voice passes; PayPal processes the new experience deposits and refunds. Keep their identifiers, webhook handlers and revenue categories distinct. Neither requires replacing the other for this design. Stripe itself documents [PayPal as a payment method](https://docs.stripe.com/payments/paypal), which illustrates that the products can coexist. A direct PayPal integration gives this submission a clearer PayPal-specific transaction flow than routing the new journey through Stripe. No Stripe migration is proposed. A voucher grants voice access without touching Stripe: it does not call the Stripe grant function, it writes no row to `stripe_webhook_events`, and it has its own audit record.

## 7. Sponsor opportunities and recommendation

Evaluation criteria: connection to the customer outcome, visible contribution to the demonstration, fit with existing architecture, correctness, maintenance, implementation effort, ongoing cost, access through judging and prize value. Priorities and effort below are assessments, not tested integrations or estimates of winning probability. No sponsor software or account was activated during this assessment.

A project can win at most one sponsor prize (section 8). APIMatic is already in the plan and already provides eligibility for one. An additional sponsor is therefore worth its effort only if it improves the demonstration or raises the prize ceiling. Two sponsors raise it: AG Grid, and Channel3 with one prize of $1,500. Channel3 stays excluded because retail product discovery is outside the booking flow.

| Sponsor | Prize | Where it fits in Paisaxe | Disposition after owner review | Relative effort |
| --- | --- | --- | --- | --- |
| AG Grid / AG Studio | $5,000, $2,000, three at $1,000 | Merchant booking/payment dashboard with an operations agent and custom booking timeline widget | **Conditional** on a half-day trial of the sponsor boilerplate | Medium to high |
| APIMatic | Three at $1,000 plus subscription | Development of the PayPal adapter and its integration tests | **Use** | Low |
| Astropods | None | Independently hosted merchant coordination agent | Not used | Medium to high |
| Bryntum | Three at $1,000 | Provider calendar and resource/capacity scheduling | **Not selected** | Medium |
| Channel3 | One at $1,500 | Retail equipment discovery associated with an activity | Not used; outside the booking flow | Medium |
| Elastic | None | Retrieval over offers, provider constraints and cancellation policies | Not used without a demonstrated retrieval gap | Medium to high |
| KERNEL | None | Authorized browser workflow for a venue with no usable booking API | Not used without a real partner need | Medium |
| Postman | None | Runnable API collection, payment checks and judge/developer instructions | **Use** | Low |
| Render | Credits: $1,000, $750, $500 | Durable reconciliation or merchant-coordination background tasks | Not used without a measured hosting gap | Medium |
| Zapier | None | Calendar/sheet updates after verified booking and refund events | Optional third extension | Low to medium |

The subsections below keep the revision 1 analysis for the record, with the disposition updated where the owner review changed it.

### AG Grid / AG Studio: an agent for merchant operations

Proposed placement: a separate authenticated operator page with booking rows, deposits collected, balances due and pending exceptions. The operator asks “Which bookings still need a deposit?” or “Show refunds by activity.” A custom Paisaxe agent produces a filtered view and a booking timeline widget from authoritative records. Keep booking and payment access read-only; allow dashboard configuration. Refunds remain explicit authorized actions.

The [AG Grid sponsor brief](https://paypalaihackathon.devpost.com/details/aggrid) emphasizes AG Studio, its agent framework, custom widgets and useful dashboard experiences. A basic table would use the technology but provide a weaker sponsor story. Formal eligibility allows AG Grid tools; the Studio emphasis is competitive guidance, not an extra rule invented by this proposal.

Studio provides [built-in agents](https://www.ag-grid.com/studio/react/ai-builtin-agents/), [agent runners](https://www.ag-grid.com/studio/react/ai-agents/) and [custom widgets](https://www.ag-grid.com/studio/react/custom-widgets/). Its commercial [trial and pricing](https://www.ag-grid.com/studio/license-pricing/) must cover the intended demo and judging period. The [license coverage](https://www.ag-grid.com/studio/react/enterprise-licence/) for built-in widgets does not automatically cover separate Enterprise grids/charts elsewhere.

**Disposition after owner review: conditional.** The sponsor page offers a [boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate) with AG Studio and PayPal already set up and a free 45-day trial license. Its award text asks for custom widgets, theming and layout rather than a plain grid, and for use of the Studio agent framework. Spend at most half a day on the boilerplate in the first week. Adopt AG Studio as the operator view only if all four hold: the boilerplate runs; a booking table and one custom widget render from fixture data; the Studio agent answers one booking question from authoritative records; and AG Grid confirms that the license covers judging through December 15. Otherwise build the plain native view. Of the two sponsors whose cash prize exceeds APIMatic's, AG Grid is the one that fits the product.

### APIMatic: improve the PayPal implementation workflow

Use the [PayPal Context Plugin](https://context.apimatic.io/plugins/paypal/) while developing the order, capture and refund adapter and associated tests. It supplies SDK context and skills for authentication, endpoint calls, errors, resilience and testing; its listing covers Claude Code, Cursor, VS Code and Codex and installs with `npx context-plugins install paypal`. The [event offer](https://paypalaihackathon.devpost.com/details/apimatic) says this PayPal plugin needs no additional APIMatic credentials and includes subscription benefits for participants and winners.

**Disposition after owner review: use.** Three prizes of $1,000 plus a subscription make this the plan's baseline sponsor eligibility at almost no cost. The event page points to a separate resource page and a form for participants who used the plugin; complete whatever registration it requires, and attend the October 7 webinar.

This is a development tool, not a new customer-facing dependency. Preserve the actual integration choices and sandbox evidence in the submission's technical description. Review generated changes and test them. Do not add an unnecessary SDK or claim runtime reliability solely because the plugin was used.

### Astropods: a separate coordination agent if the product needs one

Astropods provides [agent hosting](https://docs.astropods.com/welcome) with [declarative deployments](https://docs.astropods.com/deploy-agent), tools and observability. It could host a merchant coordination agent with an independent lifecycle, while Paisaxe remains the customer interface. The [event page](https://paypalaihackathon.devpost.com/details/astropods) offers a free account but does not establish a fixed credit amount.

The current product already has an application runtime and a calling service. Another deployment adds packaging, secrets and operational work. Its documented [AI SDK telemetry adapter](https://docs.astropods.com/monitor-ai-sdk) does not establish a drop-in observability service for Paisaxe's current Vercel deployment. [Usage limits](https://docs.astropods.com/usage-limits) matter once signup credit is exhausted. Defer unless a separately deployed agent solves a concrete need.

### Bryntum: make the reservation operationally real

**Disposition after owner review: not selected.** Its three prizes of $1,000 add nothing to the ceiling APIMatic already provides, and the licensing question below is unresolved. A 45-day trial started before November 1 would also expire before judging ends on December 15. The analysis is kept for the record.

Use Scheduler when resources are guides, rooms or equipment; use Calendar for a simpler provider diary. Show available slots, active holds, confirmed bookings and cancellation/payment status. When the server verifies a captured deposit, the relevant reservation changes visibly. When cancellation is accepted, the view shows the released capacity and separate refund state. This closely supports the [sponsor's booking and payment use cases](https://paypalaihackathon.devpost.com/details/bryntum).

The [Scheduler data model](https://bryntum.com/products/scheduler/docs/guide/Scheduler/understanding-data/introduction) and [Next.js integration guide](https://bryntum.com/products/scheduler/docs-llm/guide/Scheduler/quick-start/nextjs.md) support this placement. Capacity enforcement, hold expiry and financial state remain backend responsibilities; a calendar widget alone cannot prevent overbooking.

**Licensing is an unresolved adoption prerequisite.** The [trial page](https://bryntum.com/download/) and event advertise 45 days, while the linked [EULA dated 20260909, section 13](https://bryntum.com/legal/Bryntum%20EULA.pdf) describes internal evaluation and a 30-day trial plus a further period to agree terms. Confirm the applicable hackathon/public-demo rights and access through judging before adopting it. [Commercial licensing](https://bryntum.com/products/license/) also needs review for a later paid SaaS launch. Keep a simple native operator view as a fallback so licensing does not block the PayPal product.

### Channel3: useful retail context, outside the core proposal

Channel3 supplies [retail product discovery](https://docs.trychannel3.com/), including prices and merchant offers. Its [coverage documentation](https://docs.trychannel3.com/faq/catalog-and-coverage) includes Spain, Spanish and EUR, with growing non-US coverage. A plausible later feature is equipment recommendations for a booked hike or water activity. The [event offer](https://paypalaihackathon.devpost.com/details/channel3) includes 20,000 API credits and requires meaningful API/MCP use.

This assessment did not establish local experience inventory, reservation support or a usable PayPal checkout contract for those merchant offers. Equipment discovery would introduce a second shopping journey. Defer it for this submission. Revisit only if the product scope deliberately expands to retail purchases.

### Elastic: only for a retrieval improvement we can demonstrate

Potential placement: source-backed search over activity descriptions, accessibility facts and cancellation policies, returning offer identifiers for a separate authoritative availability check. The [event brief](https://paypalaihackathon.devpost.com/details/elastic) suggests Elasticsearch with Jina embeddings; current documentation covers [semantic retrieval](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text-setup-configuration) and [Agent Builder](https://www.elastic.co/docs/explore-analyze/ai-features/elastic-agent-builder).

Paisaxe already has vector retrieval and Voyage reranking. One merchant's small catalog does not justify another index without evidence of a retrieval problem. A convincing adoption case would measure constraint-answer accuracy or retrieval quality against the current stack on a fixed set of queries. Account for indexing freshness and tier-dependent features. The event warns that its 14-day cloud trial project is deleted when the trial ends. Defer unless the benefit and judging-period access are established.

### KERNEL: reach one authorized browser-only provider

KERNEL offers hosted browsers, automation and session replay, with [$50 in event credits](https://paypalaihackathon.devpost.com/details/kernel). It could operate a participating venue's browser-only booking system and capture the actual hold or confirmation reference. That would make merchant coordination visible and potentially distinctive.

The documented [Vercel AI SDK integration](https://www.kernel.sh/docs/integrations/vercel/ai-sdk) is one route, not proof of a drop-in adapter for Paisaxe's current AI calls. A specific SDK/CDP integration would need a spike. Page observations cannot establish a reservation; the venue adapter must return a real hold/booking reference or a clear failure. Keep payments on the PayPal API. [Browser and replay limits](https://www.kernel.sh/pricing) affect the demo. Adopt only for a named, authorized partner workflow; arbitrary website automation would make the first demo fragile.

### Postman: make the transaction easy to inspect and reproduce

Create a sanitized collection for offer lookup, hold/order creation, payment status, booking status, cancellation and refund. Add assertions for stale offers, invalid amounts, duplicate events and unauthorized access. Include an empty environment template and exact instructions for completing the interactive sandbox buyer approval step.

The [event resources](https://paypalaihackathon.devpost.com/details/postman), [PayPal workspace](https://www.postman.com/paypal), [test-script documentation](https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/) and [CLI collection runner](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection/) support this approach. Collections provide useful review evidence but do not replace the real checkout UI or establish merchant adoption. Keep secrets and customer data out of shared collections. This is a small, useful addition even if no other sponsor interface is selected. **Disposition after owner review: use.** Postman has no sponsor prize; its value is review evidence.

### Render: durable work when existing hosting is insufficient

Potential placement: reconcile uncertain captures, process late merchant results or deliver idempotent booking notifications outside a web request. The [event offer](https://paypalaihackathon.devpost.com/details/render) includes $50 credits. [Render Workflows](https://render.com/docs/workflows) supports TypeScript/Python tasks and configurable retries.

Workflow runs do not expose incoming ports, so a PayPal webhook would remain on an HTTP endpoint and dispatch work. Workflows also needs an external scheduler for scheduled execution. Retry support does not make capture or refund calls safe automatically; the application still owns idempotency and reconciliation. Paisaxe already documents scheduled booking cleanup, so keep Vercel unless a measured duration/reliability gap justifies an additional runtime. Do not migrate the whole app to earn a sponsor mention.

### Zapier: meet merchants where they already work

After a booking and deposit are verified, create or update an entry in the merchant's existing calendar or booking sheet. After cancellation/refund, update that same record. Use a stable booking identifier to avoid duplicates. This offers practical value to a small provider and can be demonstrated in a few seconds. **Disposition after owner review: optional third extension**, after the balance invoice and the phone-confirmation stretch.

Zapier's [MCP quickstart](https://docs.zapier.com/mcp/get-started/quickstart) supports connected-app actions. Scope connections to the participating merchant and allow only the intended actions. [Usage documentation](https://docs.zapier.com/mcp/overview/usage) charges two tasks per successful MCP call, including tests; the [event offer](https://paypalaihackathon.devpost.com/details/zapier) describes a 14-day Professional trial followed by Free.

Keep Supabase and PayPal as the booking/payment sources of truth. A failed calendar synchronization must not misreport a captured payment or erase a reservation. The documented [PayPal connector](https://help.zapier.com/hc/en-us/articles/8495999676045-How-to-get-started-with-PayPal-on-Zapier) does not justify assuming all capture/refund operations are available. Use direct PayPal integration for those operations.

## 8. Event fit and submission strategy

The [official rules](https://paypalaihackathon.devpost.com/rules), checked October 2, allow existing projects with significant event-period updates and ask entrants to explain those updates. They require central PayPal sandbox use, AI, a working project, public GitHub source with an open-source license file that GitHub detects and shows in the About section, and a public YouTube demonstration under three minutes. Submission materials need English or English translations. The deadline is **November 12, 2026, 12:00 Pacific / 21:00 Madrid**; judging runs December 1 through December 15, 08:00 Pacific. **Corrected on October 3:** revisions 1 to 3 said 14:00 Pacific / 23:00 Madrid and a judging start of November 13. Both came from a summarized read of the rules page and were wrong; the [official schedule](https://paypalaihackathon.devpost.com/details/dates) and the rules page were re-read on October 3.

Judges must be able to run or interact with a working build. The rules accept **either** complete setup and run instructions in the repository **or** a hosted demo URL, with login credentials if access is restricted. The project must stay available free of charge until judging ends. The voucher on the live site satisfies this without a dedicated environment.

The five equally weighted criteria are implementation, design, impact, innovation and presentation, after a pass/fail first stage on viability and theme fit. A project can receive **at most one sponsor prize**, alongside either one grand prize or one honorable mention. Do not optimize for collecting sponsor integrations. Recheck the rules before submission.

| Award | Amount |
| --- | --- |
| Grand prizes | $12,000, $8,000, $5,000 |
| Honorable mentions: Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce | $5,000 each |
| AG Grid | $5,000, $2,000, three at $1,000 |
| APIMatic | Three at $1,000 plus a six-month subscription |
| Bryntum | Three at $1,000 |
| Channel3 | One at $1,500 |
| Render | Credits of $1,000, $750 and $500 |
| Astropods, Elastic, KERNEL, Postman, Zapier | No prize |

The rules give no definition for the two PayPal-specific honorable mentions. Decision 8 targets both: the agent itself requests the order, reads its status and issues the refund, and the invoice extension adds a second agent-driven PayPal operation. The phone-confirmation stretch is the strongest innovation evidence if it is reached.

The event page lists four webinars. Attend the first three, because they may clarify what PayPal's judges value and they are the place to ask about sponsor license coverage.

| Date | Pacific | Madrid | Session |
| --- | --- | --- | --- |
| October 6 | 09:00 | 18:00 | Start building with PayPal |
| October 7 | 09:00 | 18:00 | APIMatic Context Plugins for the hackathon |
| October 12 | 07:00 | 16:00 | Build a payments dashboard without building a dashboard |
| October 13 | 01:00 | 10:00 | Start building with PayPal, repeated |

Our proposed evidence for the criteria:

| Criterion | What Paisaxe should demonstrate |
| --- | --- |
| Implementation | Agent-driven sandbox order, real approval/capture/refund, verified state, duplicate-event handling and a working reservation contract. |
| Design | A coherent path from attractive discovery to a comprehensible offer, payment and confirmation. |
| Impact | A specific provider problem supported by interviews or a pilot, with clearly stated limits. |
| Innovation | AI turns personal constraints into an agreed local experience and completes its paid reservation; with the stretch, it also telephones a provider that has no booking system. |
| Presentation | A short, visible transaction with an intelligible merchant outcome and recovery example. |

The significant new work is the tool-calling conversation, the booking/payment lifecycle and its merchant operations surface. Preserve an event-period baseline and change summary so reviewers can distinguish existing Paisaxe capabilities from the submission additions. The baseline commit in section 3 is that reference.

## 9. Demo script: target 2 minutes 40 seconds

The video is the primary judging artifact (decision 2). It opens on the transaction and has no closing repository segment; the repository link is part of the submission form.

| Time | On-screen action | Point to establish |
| --- | --- | --- |
| 0:00-0:10 | Asturias imagery with the visitor already typing; one sentence about the traveler/provider problem | Who the product serves and why payment belongs in the journey. |
| 0:10-0:40 | Visitor gives date, party, budget and a constraint; AI clarifies, calls the offer tool and presents an offer | AI performs useful work with provider-grounded facts. |
| 0:40-1:00 | Visitor reviews price, deposit, balance and cancellation policy; accepts | The agreement is explicit and inspectable. |
| 1:00-1:30 | The agent requests the order; real PayPal sandbox approval; verified capture; booking confirmation | A real sandbox transaction, driven by the agent, completes the reservation. |
| 1:30-1:50 | Operator view shows the new booking, the deposit and the reduced capacity | The merchant can operate the booking. |
| 1:50-2:15 | Cancel through the signed link; show verified refund status and released slot | The product handles what happens after payment. |
| 2:15-2:40 | The best extension that works: the balance invoice, or the agent phoning the provider and capturing on confirmation. If neither shipped, summarize the provider benefit | Depth of PayPal use, or the distinctive capability. |

Record the actual functioning build on the production site after the release. Clearly label fixture merchants and sandbox payments. Editing may shorten waiting time, but must not imply mocked or unfinished steps ran successfully. Use English narration/captions while retaining the Spanish interface where appropriate. If external API timing is slow, trim the final segment before obscuring payment evidence.

## 10. Proposed acceptance evidence

These are targets for future planning and validation, not completed tests:

- A fresh guest session completes the buyer-approved sandbox journey and obtains a matching capture ID, booking ID, merchant, amount and currency.
- The model reaches the offer, order, status and refund operations only through tool calls, and each call is validated by the server.
- Two requests for the last available slot cannot produce two confirmed bookings.
- A stale quote, changed price, invalid amount or expired hold cannot silently charge a different offer.
- Buyer approval received after hold expiry or offer replacement cannot trigger capture without a valid, matching accepted booking contract. Reacquire capacity and obtain renewed acceptance/approval where the contract has changed.
- Repeated capture requests and duplicate/out-of-order webhooks cannot double-charge or regress completed states.
- A timeout after capture produces a recoverable pending state; reconciliation resolves it without a second charge.
- If capture succeeds and reservation finalization fails, the UI exposes recovery and the system reaches confirmed reservation or verified refund.
- An authorized cancellation produces one refund; repeated requests cannot refund twice. Booking cancellation, inventory release and refund status remain distinguishable.
- Forged events and requests carrying another guest's or merchant's reference cannot alter or reveal the booking. A signed link opens exactly one booking.
- The model cannot override prices, ownership or cancellation rules through user or retrieved-content instructions.
- Without a valid voucher, the booking flow and the sandbox checkout are unreachable on the live site and on any Preview address. An expired voucher is refused.
- A judge who returns with the same voucher, and a second judge in a fresh browser later in the judging period, can each complete the whole journey. Fixture slots are never in the past or sold out, and voice access has not lapsed.
- Use beyond the defined limits for chat turns, tool-loop iterations, voice minutes or booking attempts is refused with a clear message. The limits give a stated worst-case cost for one voucher.
- A voucher grant has its own audit record and never appears as a Stripe event or as revenue.
- After capture, with the browser closed, no webhook delivered and the AI unavailable, scheduled reconciliation alone brings the booking to confirmed or refunded.
- A guest whose payment succeeded before any confirmation screen appeared can reopen the booking with the link issued before payment.
- The demo operator sees only the fixture merchant and cannot open any existing admin route or real analytics.
- Fixture bookings and deposits do not appear in Stripe revenue reporting.
- The operator view displays the same authoritative state as the customer view, and synchronization failures remain visible.
- Existing Stripe voice-pass purchases and booking features pass the applicable regression checks.
- A fresh clone can follow documented setup with permitted dependencies and test fixtures.
- For the stretch goal only: a declined or unanswered provider call voids the authorization, and nothing is captured without a recorded confirmation.

Record exact code identity, test commands and observed results. Use deterministic unit/integration tests for invariants and actual PayPal sandbox/browser evidence for the end-to-end payment claim. Keep mocked-provider evidence separate from real merchant confirmation, and mocked webhook evidence separate from real webhook evidence. A Postman collection is supporting evidence, not a substitute for all these checks.

For impact validation, a reasonable initial target is five prospective users and one local provider. Measure unassisted booking completion, time to a confirmed offer, abandoned steps and whether users correctly understand deposit/balance/cancellation terms. Ask the provider which steps save work. These are proposed research targets, not completed interviews or statistically established demand.

## 11. Delivery outline and scope control

This is a sequencing recommendation, not an approved phased implementation specification. The next RPI plan must turn it into concrete changes, behavioral oracles and local validation gates. Revision 1's outline omitted the tool-calling work, the access gate, the publication cleanup and the production release; all four are now placed. The sandbox spike is implementation work. The planning session does not run it; the plan makes it Phase 0, and later phases are adjusted if its findings change the contract.

| Suggested window | Deliverable | Exit evidence |
| --- | --- | --- |
| October 2-8 | Decision record and charter reconciliation. The two release rulings written into the release checklist (section 6). The planning session writes the plan and stops at its gate. **Phase 0**, the first implementation phase with its own acceptance gate: PayPal sandbox spike covering order, approval, capture, refund and one real webhook through a development tunnel, settling how the tools reach the model; APIMatic plugin installed; half-day AG Studio boilerplate trial with a recorded yes or no. Webinars on October 6 and 7 | Charter no longer contradicts the direction. A release has a compliant path. Exact payable offer, one successful minimal sandbox transaction, one authenticated real webhook and recorded dependency decisions. |
| October 9-22 | Tool calling in the text chat. Offer catalog, quote acceptance, capacity hold, agent-requested order, capture and confirmation. Guest signed link. Voucher gate | Working visitor flow from voucher to confirmed booking, with core invariants tested locally. |
| October 23-29 | Cancellation, refund, reconciliation and webhook handling. Operator view and the scoped demo operator | Failure cases resolve truthfully; operator and customer states agree. |
| October 30-November 3 | Tests with target users/provider. Postman collection. Publication cleanup from section 12. Extensions in the order of decision 9, only if every core item passes | Usability findings addressed; release candidate identified; extensions either complete or cut. |
| November 4-6 | The single production release, on the owner's authorization, through the release checklist. Production verification with the sandbox, including a real webhook | Deployed identity matches the candidate; the journey completes on the live site behind the voucher. |
| November 7-11 | Record the video on production. Make the repository public (the history purge, #985, is already done). Write the English testing instructions, change summary and known limitations. Buffer for one corrective release if needed | Final submission materials; voucher, sandbox buyer and operator access rehearsed from a clean browser. |
| November 12 | Submit with time margin before 21:00 Madrid; internal target November 11 | Submission receipt, accessible source/video and judging access. |

If time is constrained, remove in this order: Zapier, the phone-confirmation stretch, the balance invoice, AG Studio. Keep truthful payment state, cancellation/refund recovery, a clear visitor experience and a reproducible submission. Do not exchange core correctness for an extra logo.

Authorization and execution are separate. The owner decides; an agent executes through the command line or the browser wherever it can, and hands a step back only when both have failed or the step needs the owner's own identity or secrets.

| Action | Owner authorizes | Who executes |
| --- | --- | --- |
| PayPal developer account, sandbox application, sandbox merchant and buyer accounts | Yes | The owner signs in. An agent can then operate the dashboard in the browser. |
| Secret values, such as the sandbox client secret | Yes | The owner supplies or sets them. The project instructions keep credentials out of agent hands. |
| Production and Preview environment variables | Yes, in the current conversation | An agent through the Vercel command line once authorized, except secret values. |
| Production release | Yes, in the current conversation | An agent, following the release checklist. |
| Repository visibility change | Yes | An agent through the GitHub command line. |
| Sponsor trial sign-up | Yes | An agent in the browser, in the owner's name. |
| Video upload and the submission form | Yes | An agent in the browser where the owner is signed in. |
| Contact with a provider | Yes | The owner by default, since it is outward-facing and personal. An agent can draft. |

The recommendation does not authorize paid accounts or new cloud deployments.

Sponsor trials are 45 days and judging ends December 15. A trial that starts before November 1 expires during judging; one started on October 5 ends on November 19. This applies to AG Studio if it is adopted. Ask AG Grid, in the event Discord or at the October 12 webinar, whether the event license covers the judging period before making AG Studio the operator view.

## 12. Public repository and judging readiness

The existing repository becomes public after a light cleanup (decision 5). There is no new repository and no history rewriting. The owner accepts that the full history becomes visible, including past operational reports, the tourism PDFs and the story photographs. Decision 13 covers the rights position for that content; see Content rights below.

The one exposure that cannot be undone later is a live secret in history. CI already scans the full history for secrets on pushes to `develop` (`.github/workflows/security.yml:27` through `:47`). Confirm that the most recent scan is green on the day of the change.

Cleanup before the visibility change, and nothing more:

1. Add an MIT `LICENSE` file, matching `README.md:270`, and confirm GitHub shows it in the About section.
2. **Done on October 3 (#984, pushed to `develop` as `fef5694c`).** The 37 PDFs are no longer tracked, `content/pdfs/` is ignored, the README names the publisher and explains how to obtain the guides, and the License section states that MIT covers the code only. The notice is attribution, not permission.
3. Add an author check to the comment trigger in `.github/workflows/claude-review.yml` so that outside commenters cannot start it.
4. Stop tracking `docs/agents` and ignore it from now on, following the project's own rule for public repositories. Earlier reports stay in history under the accepted risk.
5. Supply environment templates, setup instructions, merchant fixtures and English testing instructions. Separate required services from optional integrations.
6. Add a submission-period change summary against the baseline commit and a known-limitations section.

Judge access goes in the private testing instructions on the submission form, never in the repository: the voucher, the sandbox buyer credentials for the PayPal approval step and the demo operator access. Vouchers stay valid until judging ends on December 15, can be used again by a returning judge, and always find a bookable fixture slot (section 6).

### Content rights

**Owner decision 13.** The guides are published free of charge by the Asturian government for the public to use. Paisaxe processed them and presents their information in a different format, and it attributes its images to their sources. The content is published as it is, with that attribution, and the position is revisited only if it ever becomes a problem. No rights record is required before publication or before recording the video.

The evidence below is recorded so the decision is an informed one. It does not reopen it.

- **The event rules**, read on October 2. An entrant integrating third-party data “must be authorized to use them”. The video “must not include third party trademarks, or copyrighted music or other material unless the Entrant has permission to use such material”. Submitted content must not be subject to third-party rights “unless entrant is the owner of such rights or has permission from their rightful owner to post the content”.
- **The publisher's legal notice.** The [legal notice of turismoasturias.es](https://www.turismoasturias.es/es/aviso-legal), downloaded on October 2, reserves all rights. It prohibits “la reproducción, la distribución y la comunicación pública … de la totalidad o parte de los contenidos de esta página web, con fines comerciales … sin la autorización” of the publisher, and it allows copying “única y exclusivamente, para su uso personal y privado”. The repository does not record where the guides were downloaded; the February correspondence below supports this publisher as their source. The notice concerns the website's contents and does not mention the downloadable guides separately.
- **Earlier correspondence with the publisher.** The owner asked the publisher in February 2026 for permission to use photographs and videos from its archive on Paisaxe and its social accounts, with attribution. The publisher replied on February 16, 2026 from `contacto@turismoycultura.asturias.es`: “Si el uso del material no tiene fines económicos, podemos ceder fotografías de nuestro archivo sin problema.” It asked how many images and which themes were needed. The owner's mailbox shows no answer to that question. This confirms that turismoasturias.es is the relevant publisher, shows it is willing, and shows that its condition is the absence of an economic purpose.
- **What the repository records.**

| Material | What the repository records | What it does not record |
| --- | --- | --- |
| 37 tourism guides under `content/pdfs` | Described as official Asturias guides (`README.md:262`) | Where they were downloaded and under what terms |
| 103 story photographs under `public/images/stories` | Origins for 20 stories: 13 Unsplash, 7 extracted from the guides; an attribution column | The origin of the rest |
| Imagery and any music in the video | Nothing yet | The source of each item shown or heard |

Two things follow. The restriction in the notice is on commercial use, and this proposal adds paid bookings to a site that already sells voice passes, so the free, non-commercial character the owner's position relies on is weaker after this change than before it. And the publisher is a public body whose purpose is promoting Asturias, which makes a complaint unlikely and a written authorization plausible.

One optional step fits the lean decision: a single message to the publisher asking for authorization to use the guides and their images with attribution. The owner asked for it on October 2. It was sent on October 2, 2026 as a reply on the February thread, after the owner reviewed the text; it discloses the paid voice pass, the planned bookings and the public repository. No answer had arrived when this revision was written. A positive reply would settle the question and would also serve as impact evidence. It is not required by decision 13. For the video, preferring imagery from Unsplash or the owner's own photographs costs nothing.

### Contingency: planning for a refusal

On October 3 the owner asked to plan as if the publisher's answer were no, and to start executing. The reasoning is recorded first because it rules out the obvious shortcut.

Mixing the guides' text with other sources would not help. Copyright attaches to the guides' wording wherever it is reproduced, not to the proportion of sources. The exposure is concrete: the `chunks` table and the local `content/processed/chunks.json` hold 3,212 chunks, about 1.32 million characters, copied verbatim from the 37 guides, and every chat prompt injects them as “Fuente N” (`src/lib/claude.ts:582`). The story descriptions are already original prose. Images are mostly from Unsplash: 18 of 25 in the seed data, 13 of 20 in the mapping file, with 7 mapped images extracted from the guides and 7 local files of unrecorded origin.

| Step | Issue | Status | When |
| --- | --- | --- | --- |
| Stop distributing the PDFs: untrack, ignore, document how to obtain them, MIT covers code only | #984 | **Done**, pushed to `develop` on October 3 as `fef5694c`; CI pending at the time of writing | Now |
| Purge the PDFs from git history (history rewrite; `main` force-push protection lifted for one push; every checkout re-synced) | #985 | **Done on October 3** with owner authorization. `develop` is now `b283f4ca`, `main` `90befd3c`, 7 tags rewritten; protection restored; production redeployed and healthy. Record in the issue. | Done |
| Re-author the knowledge base from facts with openly licensed sources, no-copy check, re-embed, reseed locally then production | #986 | Approach written; needs an RPI plan | After the submission, unless the answer forces it earlier |
| Replace the remaining images that came from the guides; record every image source | #987 | Written | After the submission |

The hackathon does not depend on the guides' text: the booking flow uses the fixture merchant's own content. A refusal in October changes nothing about the November deadline. If the publisher answers yes, #985 to #987 close as not needed and #984 stays, because the repository does not need to carry 188 MB of someone else's guides.

One incident is recorded for honesty. The merge of #984 removed the tracked PDFs from the main checkout's working tree, and the worktree that still held untracked copies was then deleted. The 37 files were restored to `content/pdfs/` from history in the same session, untracked and ignored, and the pipeline is unaffected. The same loss recurred on the rebase before the push, because checking out any commit that still tracks the PDFs re-creates and then deletes them. A backup now lives outside the repository at `/Users/juan/code/paisaxe-local-assets/pdfs`, and the pushed commit is `fef5694c`. The history purge in #985 was executed on October 3 after the owner's explicit go-ahead; the owner ran the force push and the protection change, because the project's guard blocks agents from both. A first attempt used a stale mirror and briefly overwrote `develop` with newer commits that were also in `main`; the redo used a fresh mirror and a lease. Every commit cited in this document by its old SHA now has a rewritten equivalent; the mapping is in `paisaxe-local-assets/purge-2026-10-03/paisaxe-mirror.git/filter-repo/commit-map`. The research baseline `28c3aea7` is `d368b2b3` after the rewrite.

If AG Studio is adopted, keep its license key out of the repository and document how a judge sees that view without one.

No public visibility change, license choice, credential activation, deployment or submission is performed by this assessment. Each is a later action within the project's normal authorization and verification workflow.

## 13. Alternatives, counterevidence and open decisions

| Decision | Current disposition | Evidence that could change it |
| --- | --- | --- |
| Extend Paisaxe into paid local experiences | **Approved by Juan**, including superseding the historical charter restriction | New owner direction, not a repeated request to approve the same decision. |
| Lean operation; no separate demo stack; voucher access | **Decided by Juan** | New owner direction. |
| Guest booking by signed link; seeded demo operator | **Decided by Juan** | New owner direction. |
| Publish the existing repository after a light cleanup | **Decided by Juan**, with the history risk accepted | A live secret found in history, which would need handling before the change. |
| Keep Stripe; add direct PayPal | Accepted boundary for existing voice passes and new bookings | A verified technical/account constraint in the selected PayPal flow. |
| Capture, then refund; authorize and void only in the stretch | Accepted | The phone-confirmation flow becomes the core journey. |
| The agent drives the PayPal operations | Accepted | The sandbox spike shows no workable route from the model to the PayPal tools. |
| One merchant, EUR, deposit now and balance later | Accepted minimum scope | A real provider's process requires a simpler full-payment model. |
| APIMatic and Postman | Accepted support tools | Integration workflow overhead exceeds their demonstrated benefit. |
| Native operator view; AG Studio on a successful half-day trial | Accepted | The trial fails, or the license cannot cover judging. |
| Bryntum | **Not selected** | None expected. It adds licensing risk and no prize ceiling beyond APIMatic. |
| Zapier | Optional third extension | A participating provider relies on a supported calendar/sheet and wants synchronization. |
| The release pull request's Preview is the standing exception | **Decided by Juan** | New owner direction. |
| Production verification as a separate authorized step; probes stay read-only | **Decided by Juan** | New owner direction. |
| Content published with existing attribution; rights risk accepted | **Decided by Juan** | A complaint from a rights holder, or the publisher's reply to an authorization request. |
| First real webhook through a development tunnel in Phase 0 | Default chosen in revision 3 | The owner prefers to defer that evidence to production after the release. |
| Scheduled reconciliation is required, hosted on the existing scheduled routes | Accepted from the second review | A measured duration or reliability gap in the existing runtime. |
| Elastic, KERNEL, Render, Astropods, Channel3 | Not used | A measured retrieval/runtime gap, a specific browser-only merchant, or a deliberate product expansion. |

Planning inputs that are still open, none of which reopens a decision above:

- The participating provider, or the fixture catalog that stands in for one, and who owns its accuracy.
- Offer and hold semantics.
- How the PayPal tools reach the model (section 6), settled by the first spike.
- How a voucher establishes a guest session. Supabase anonymous sign-in is a candidate; it is not used today and was not evaluated.
- How the demo operator signs in, given that Google OAuth is the only method today.
- The metering limits and the worst-case cost of one voucher.
- How fixture availability is kept bookable through December 15.
- The audit contract for voucher grants.
- Whether AG Grid's event license covers the judging period.
- The regulatory position for a later production launch.

Actual demand, conversion improvement, production payment readiness and prize competitiveness remain unverified.

The main counterargument is that this extends Paisaxe into a more operationally demanding product. Inventory, payment recovery and merchant participation require work beyond a tourism assistant. The narrow merchant/catalog scope and separate operator view are intended to make that manageable. If a provider cannot supply reliable availability or a hold, the system must not take a deposit while promising an immediate confirmed reservation; select a compatible provider, use the phone-confirmation flow with an authorization instead of a capture, or revise that promise explicitly.

A second counterargument concerns running the submission on the live site. Sandbox payments, fixture data and a demo operator will sit beside real users and live Stripe purchases. The voucher gate, the separate operator role and the exclusion of fixtures from revenue reporting are the controls, and each has an acceptance item in section 10.

## 14. Durable handoff

**Objective and authority:** Produce this complete proposal inside Paisaxe and assess all ten named sponsors. The owner approved the new product direction and intent to publish, then reviewed revision 1 and made the decisions in section 1. This task creates local documentation; it does not start implementation, publish the repository, activate services, contact providers or spend money.

**Identity:** Research baseline is `28c3aea736d0b0f5e192527597e959fad18443ac` on `develop`. Revision 1 was drafted in a worktree and branch, `chore/paypal-hackathon-proposal`, that no longer exist. This document lives at `docs/research/2026-10-02-paypal-ai-hackathon-proposal-assessment.md` in the main checkout and was **untracked** when revision 2 was written. While revision 2 was being written, a separate triage session advanced `develop` to `af73811f`. Among the files this document cites, only `package.json` changed between the two commits, and its reference was rechecked at `af73811f`. Recheck the actual branch, commit, worktree status and changed source before reusing this assessment.

**Evidence and limits, revision 1:** Repository-root Graphify orientation was followed by source reads. Source observations and official product/event documentation were checked on October 2, 2026. Two bounded read-only investigations covered AG Grid/Bryntum/Elastic/Channel3 and APIMatic/Astropods/KERNEL/Zapier; both completed with source links and limitations. The parent covered event/PayPal requirements, Postman/Render, repository evidence and synthesis.

**Evidence and limits, revision 2:** A second session on October 2 reread the document, spot-checked its file references against source and reread the rules, the event page, the AG Grid, Bryntum and APIMatic sponsor pages, the PayPal agent tool reference, the agent toolkit repository and the PayPal authorization guide. Section 3's gap table lists what was verified and how. Three items rest on earlier notes and were not rechecked: that Preview deployments share production data and live Stripe keys, that an AI credit exhaustion caused an outage in July 2026, and that `check-env` is not part of the ordinary local test run. External pages were read through a summarizing fetch, so quoted figures should be rechecked against the pages before they are relied on for a submission. No integration was installed, payment or phone call attempted, application test run, deployment made or account activated in either revision.

**Evidence and limits, revision 3:** The second review's eight points were each checked on October 2. Verified: the required checks on `main` through the GitHub API; the Preview rule at `.rpi/rules/deployment-safety.md:28`; the read-only probe rule at `docs/runbooks/release-checklist.md:123`; the grant function's write to `stripe_webhook_events`; the Channel3 prize; and the rules' wording on third-party data, video material and submitted content, read through a summarizing fetch. The search for content permissions covered `docs/project`, `docs/operations`, the README and the image mapping file only. The turismoasturias.es legal notice was downloaded directly and its intellectual property clause read in full; the quotations in section 12 are verbatim.

**Corrections to revision 2:** AG Grid is not the only sponsor whose prize exceeds APIMatic's; Channel3 offers $1,500. The day-pass grant function is not a candidate hook for vouchers, because it writes to the Stripe audit table. “Cannot be done by an agent” conflated authorization with execution and is replaced by the table in section 11. The first-week spike required a real webhook while the open decisions allowed it only after the release; a development tunnel is now the default. The background worker was optional; scheduled reconciliation is now required and only its hosting is optional. A content notice was treated as sufficient for publication; it is not.

**Corrections to revision 1:** The APIMatic plugin supports Claude Code, Cursor, VS Code and Codex, not Codex alone. The text chat has no tool calling, so “reuse grounded conversation” understated the orchestration work. Prize amounts and the five honorable mentions were missing. The sponsor recommendation changed from Bryntum to a native view with AG Studio conditional. The delivery outline gained the tool-calling work, the access gate, the cleanup and the production release.

**Findings:** The historical charter conflict is resolved by the owner's explicit approval and must be reconciled in the charter itself first. Sponsor breadth is narrowed by product value, the single-sponsor-prize limit and the lean decision. Provider availability, PayPal sandbox behavior and the route from the model to the PayPal tools are unresolved implementation inputs. No gaps are represented as passed checks.

**Preservation:** Revision 1 recorded uncommitted changes to six reports under `docs/agents/`: coverage, documentation, performance, QA, security and shared context. The triage session has since committed them, and the working tree held no other changes when revision 2 was finished. This document is the only task-owned repository addition.

**Next action:** As documentation work, write the decision record, reconcile the charter and write the two release rulings into the release checklist. Then start a Paisaxe RPI planning session from this document and current repository instructions: revalidate changed source, choose the initial provider/fixture contract, and produce the implementation plan with the sandbox spike as Phase 0 under its own acceptance gate. The planning session does not run the spike. Stop at the plan's normal acceptance gate. The decisions recorded in section 1 persist; the production release and the visibility change remain separate, owner-authorized actions.

All external links above identify the actual sources used, with retrieval date October 2, 2026. Undated product documentation is cited as observed on that date; the Bryntum EULA version is identified explicitly. Sponsor priorities, example amounts, proposed architecture, delivery windows and acceptance targets are this assessment's recommendations.
