# Jev typed judgments

The server adapter pins `@typesafe-ai/sdk` 0.7.0 (MIT, Node >=22) and model
`jev-1.14.0`. The application requires Node >=24. Jev supplies bounded semantic
judgments; deterministic application code retains authority over access, dates,
amounts, provider facts and booking/payment actions. No database schema or
Anthropic usage accounting is changed.

## Configuration and disabled operation

`TYPESAFE_API_KEY` is optional and server-only. It is read lazily through `getEnv`
and trimmed; never expose it with a `NEXT_PUBLIC_` variable or send it to a browser.
This implementation does not create or provision a credential.

`JEV_ENABLED_TASKS` defaults to an empty allowlist. Its only accepted values are
`booking_intake` and `experience_match`, separated by commas. Unknown entries make
configuration invalid and disable all Jev work. A missing key also disables Jev.
Correct the named variable in the authorized environment and issue a new explicit
request; there is no sticky error cache. Existing application paths remain usable.
Runtime qualification and owner authorization are required before activation;
local fixture acceptance does not establish model quality or measured improvement.

Offline evaluation uses a separate explicit evaluation context and cannot enable
runtime tasks. Live evaluation requires separate authorization naming data scope,
request count and dollar cap. No paid model call is part of deterministic checks.

## Request and failure contract

The adapter uses one SDK request with retries disabled, a fixed
`https://api.typesafe.ai` origin, SDK logging off, no long-context/image opt-in and
caller cancellation. Ambient SDK origin/model/log settings do not change it.
Interactive requests have a 1,200 ms total deadline; evaluations have 10,000 ms.
A caller may shorten that deadline. State and questions together must fit 32,768
UTF-8 bytes; empty, non-JSON or oversized state is rejected before HTTP. Reduce
explicit input rather than truncating it. Domain modules apply their own smaller
candidate/claim bounds.

`answered` carries validated Noul/Choice answers, the exact pinned returned model,
question version, elapsed time, request ID, nullable usage and estimated dollar
cost. Unknown usage is `null`, never zero cost. The price policy is $0.042 per
million input tokens, with no output charge, as documented on 2026-10-28 at
[TypeSafe models](https://docs.typesafe.ai/models). A future price/model change
requires a new evaluation identity and accounting policy.

`unavailable` has one of `disabled`, `not_configured`, `invalid_config`, `deadline`,
`aborted`, `rate_limited`, `provider_error`, or `invalid_response`. An error never
means semantic false. The adapter validates exact answer keys/types, selected IDs,
finite probabilities in [0,1], distribution sums within 0.001, model and usage.
Domain uncertainty remains separate from transport failure. The initial shared
policy uses Noul >=0.90/<=0.10 and Choice top >=0.90 with margin >=0.20; these are
conservative pilot settings, not demonstrated calibration.

After timeout, 429 or malformed data, retain the existing runtime path. A later
explicit request can succeed without restarting. Cancellation aborts new work and
prevents a late success; it does not authorize a retry or prove a remote attempt
was unbilled. Offline accounting must retain unknown-completion reservations.

## Logs and local evidence

`[JEV_DECISION]` records only task/version/model, generated request ID, latency,
outcome/reason, nullable token counts and estimated cost. Raw state, responses,
errors, headers, transcripts, credentials and capability URLs are excluded.
Synthetic fixture traces belong only under ignored `test-results/jev/`; curated
summaries must omit raw user data. Ordinary tests inject HTTP and never read a
real provider key.

Run `npx vitest run src/lib/jev` for deterministic adapter tests. These exercise the
real SDK with injected HTTP and prove the actual Next client/server import
boundary. Server adapters must not be imported by client components; shared
`contracts.ts` is safe for type/constant imports. A server-side CLI needs the
React server condition (`tsx --conditions=react-server`).

The developer inspector/evaluation commands are added in Phase 2. Their later
registered domain suites remain separate from runtime activation and paid
qualification. No inspector command may create approval receipts or authorize a
booking or settlement.

## Developer inspector and evaluation commands

`npm run eval:jev -- --list` lists registered suites. The initial
`provider-contract` suite checks Spanish confirmation/cancellation plumbing only;
it cannot qualify a runtime feature. The CLI imports run no inference or setup.

- `npm run eval:jev -- fixture --suite provider-contract` runs synthetic HTTP
  fixtures through the actual SDK, with a temporary dummy key and no network.
- `npm run eval:jev -- inspect --input 'test-results/jev/<run>/run.json'` validates
  and renders a supplied record. The result is labelled imported, with provider
  authenticity unverified; it cannot be resumed as live evidence.
- `npm run eval:jev -- live --suite provider-contract --max-requests 1 --max-spend-usd 0.003`
  is a live invocation template, requiring separate prior owner authorization for
  the synthetic data and named caps. Flags express limits, never permission.

Live mode refuses CI/Vercel processes, absent keys and missing/nonpositive caps
before dispatch. Request and dollar caps are cumulative ceilings across a resume
chain: they must cover prior attempts plus every new attempt. `--case <id>` limits
new execution to one frozen case while preserving all cases in the denominator.
No customer transcript importer, database fetch, upload or extra-provider
benchmark is provided by this CLI.

Each run creates a new ignored directory containing `run.json`, `attempts.jsonl`,
`cases.jsonl` and `report.html`. The append-only attempt log is fsynced before each
HTTP dispatch. Every request reserves $0.002752512 (65,536 input tokens at the
pinned price); validated response/model/answers/usage may settle a lower charge.
Unknown usage, malformed responses and missing completion keep the reservation.
A timeout/abort never implies zero cost. Multiple requests in one case are charged
individually; aggregate case tokens can exceed one request's context ceiling.
The report separates prior/new requests, settled costs and retained reservations.

A partial run exits nonzero and keeps failed, unavailable and missing cases.
`--resume '<run-directory>'` creates another directory, validates source, model,
price policy, question/case/input hashes and durable logs, copies completed cases
with replay provenance and executes unresolved cases only. Live resume needs
explicit cumulative `--max-requests` and `--max-spend-usd`. An attempt without a
durable response is unknown completion and is never silently resent: inspect it
and explicitly select `--retry-unknown '<attempt-id,...>'` within authorized caps.
A changed identity or corrupt checkpoint requires a new run. Earlier failures
remain in their original directories and inherited request traces.

The escaped static HTML report uses native expandable details, contains no
scripts or external assets, and shows exact synthetic inputs, judgments, expected
labels (separate from provider requests), baseline values, missing cases and
bounded recovery commands. Fixture/imported/replayed timing is explicitly
separate from fresh live latency. Curated summaries omit raw inputs and provider
bodies. Comparison results are only meaningful for identical case IDs/input
hashes. No automatic enablement or approval receipt is generated.

## Booking intake and controlled comparisons

The `booking-intake` inspector suite contains independently authored 40 tuning
and 120 held-out cases (60 eligible/60 must-fallback), plus 30 frozen complete
route scenarios in `scripts/eval/fixtures/jev/booking-intake.json`. Expected labels
and invariant rubrics stay outside model state. Run
`npm run eval:jev -- fixture --suite booking-intake` for synthetic HTTP plumbing;
this does not qualify live semantics, cost or latency. Live use of this suite
still requires its own explicit Jev caps and data authorization.

Runtime intake is limited to pristine first-turn Spanish discovery. It selects
original party/date/inclusive-budget and supported constraint spans, then uses
one existing read-only search tool. Existing draft identity/initialization and
quota consumption remain the route's responsibility. The fast path creates no
interpretation-driven draft/quote/payment write. Replay, history, existing
criteria/bookings, other locales, named experiences, booking actions, uncertain
judgments and unsupported requirements retain ordinary chat. Search failure
falls back without partial fast-path events. Cancellation prevents new work and
late events; already-started legacy database HTTP may still finish.

`booking-eval-harness.ts` is side-effect-free on import. The legacy eight-scenario
agent runner loads keys, starts mocks and accesses the local stack only in its
explicit CLI main. It now requires
`npm run eval:booking -- --mode baseline --max-requests N --max-spend-usd USD`
after separate Claude authorization. Its timing is labelled agent-only; Spanish
is explicit by default and the existing English regression retains locale `en`.
A successful outcome with unknown usage remains incomplete/nonpassing.

`compareBookingRouteScenarios` accepts all 30 frozen scenarios and prebound
baseline/deterministic/Jev loopback route arms. `startBookingEvalServer` binds the
real booking handler, access, quota, retrieval and tools to each local arm using
server-only dependencies. No arm selector or fake provider origin is accepted
from visitor requests or product environment configuration. The normal Next
handler uses default implementations. The local adapter's timings include the
HTTP request and route prework; Next proxy is outside this measured scope.
The deterministic first-discovery arm calls code directly without Jev or Claude.

Route records separate first-card, full-turn/scenario and time-to-quote timing,
clarification counts, exact catalog/retrieval/input identity, provider-fact and
commercial invariants. Per-scenario costs use accounting deltas. Fixture timing
is deterministic integration evidence; live performance and improvements remain
unmeasured until a separately authorized comparison completes. Required local
E2E uses synthetic HTTP responses at the real fixed provider URLs and cold
retrieval caches (no Redis configuration); production caching is unchanged.

Every Claude HTTP attempt, including SDK and outer-loop retries, passes through
its separate durable reservation cap before dispatch. The policy pins current
`claude-sonnet-5-5`, conservatively reserves 1,048,576 context tokens plus the
requested maximum output, accounts for cache-write prices, and retains unknown
completion. The model/context and prices were checked against
[Anthropic model documentation](https://platform.claude.com/docs/en/models/overview)
and [pricing](https://platform.claude.com/docs/en/about-claude/pricing) on
2026-10-28: $2 input/$10 output per million tokens; cache writes $2.50 (5m) or $4
(1h), reads $0.10. Policy changes require a new comparison identity. No paid
comparison or live retrieval is part of implementation acceptance.

## Offline telephone-outcome advisory

`npm run eval:jev -- fixture --suite call-outcome` runs 40 tuning and 120 held-out
independently authored synthetic cases through the real SDK with canned HTTP
responses. Judgments and evidence selections are fixture data outside request
state. This checks plumbing and domain safeguards, not live model reliability.
Use separately authorized caps for any later `live --suite call-outcome` run.

The advisor accepts requested ISO date, HH:MM time and party size; ordered
utterances with finite IDs, explicit merchant/agent/system speaker mappings,
original roles and mapping provenance; and separately identified status/summary.
Missing roles, requested fields or transcript produce visible uncertainty with
repair reasons before HTTP. The advisor never fetches customer calls or imports
provider dashboards. Merchant evidence must match the requested criteria in code;
an acknowledgment can bind to the immediately preceding exact agent request.
Alternative offers, later corrections, summary conflicts, multiple unresolved
bookings and contradictory/weak judgments remain uncertain. A summary or an
agent's "perfecto" cannot establish merchant acceptance.

Labels are `merchant_accepted`, `merchant_declined`, `no_contact` and `uncertain`;
transport failure remains `unavailable`. Every result is explicitly advisory,
with supporting utterance IDs, reasons and model/question identity. The unchanged
pure legacy classifier is shown only for comparison. No advisor output is
converted into a settlement outcome or wired into webhooks, SMS, calls, database
writes or payments. It never generates capture/void instructions or approval
receipts.

The report separates tuning from the frozen held-out denominators: 120 cases,
30 per label; false acceptance over all 90 nonaccepted references; and at least
72 correct nonuncertain labels among 90 fully evidenced accepted/declined/no-contact
references. It also displays missed acceptance, abstention, confusion counts,
per-label recall, baseline disagreement and Wilson 95% sample intervals. These
small synthetic samples do not establish population error rates. Qualification
is limited to developer assistance and never settlement.

## Evaluation records v2: execution versus semantic targets

Portable `run.json` records now use schema version 2. Old v1 records remain
preserved evidence but are rejected by current inspect/resume with a new-run
instruction; their previous completeness semantics are not silently reinterpreted.
Attempt ledger events keep their original version and accounting rules.

`complete` means every supplied case executed without missing/unknown-completion
attempts or provider unavailability. Semantic abstentions and mislabels still
appear as failed comparisons and remain in all relevant denominators. The
versioned suite assessment independently sets `targetsMet`; `pass` requires both
execution completeness and the predefined targets. Provider plumbing retains its
all-cases-match target. A call advisor run can therefore be complete and meet its
80% useful-label target without pretending that every label was correct.

Fixture/imported records are always unqualified. A live record can qualify only
when the suite explicitly permits qualification, execution is complete and its
predefined target assessment passes. No report enables runtime settings or grants
transaction authority. Unknown usage retains conservative reservations and is
never reported as zero cost.

### Supplied-evidence claim checks

`npm run eval:jev -- fixture --suite evidence` inspects six tuning and 24 independently authored heldout claims (eight per supported/contradicted/not-established reference). Fixtures exercise real SDK request/response handling with canned judgments; they remain unqualified and do not measure live model quality. Paid live evaluation requires separate explicit request/spend authorization and the existing capped `live` command.

The snapshot contains query, answer, reviewer-provided claim spans (`start` inclusive, `end` exclusive, UTF16 code units), nonempty cited passage IDs, exact passage bodies/citations, generator identity and capture time. Every claim declares `temporalScope: general | current_availability`. A declared quotation must match an exact substring of a cited body. All claims and bodies pass structural validation before any HTTP request. Missing bodies, wrong hashes/IDs/spans or quotation mismatches return structural unavailability naming the field to repair. Submit a new corrected snapshot; prior records remain unchanged.

`hashEvidenceBody(body)` hashes exact UTF8 bytes with SHA256. `hashEvidenceManifest(version, passages)` hashes `JSON.stringify({version, passages})` after sorting by passage ID and selecting each passage's `{id, contentHash, citation: {title, url}, sourceDate}` in that order. This identifies **only the supplied snapshot passage manifest**, never the full retrieval corpus or an owner acceptance receipt. `sourceDate` is an ISO calendar date or null; a capture timestamp is not a source date. Current capacity/slot availability requires same-day source evidence plus a positive independent explicit-availability judgment; undated general descriptions and stale availability cannot support it.

Only each claim's exact answer slice and its cited passage subset enter its request. The checker never fetches citation URLs or imports retrieval caches, corpus validators or receipt writers. Independent support/contradiction judgments yield supported, contradicted or not-established; conflicting/intermediate judgments yield semantic unavailability (`ambiguous_evidence`). Change conflicting evidence or the explicit claim to repair that result; repeating the same evidence is not presented as a repair. Provider/configuration/timeout failures are separate unavailable results requiring a new authorized capped retry.

Every report states `coverage: provided_claims_only`, supplied/checked/unavailable claim counts, model/question identity and passage hashes. Adding another claim unit creates explicit additional coverage. The report does not verify the whole answer or authorize corpus acceptance. Semantic abstention stays in recall/F1 denominators while counting as executed; missing inputs or provider failures make execution partial. Qualification requires complete heldout execution, zero false support, at least 90% supported recall and 90% macro F1. Tuning is reported separately. Wilson 95% sample intervals, sample limits, confusion counts and worst cases remain visible; fixtures/imports never qualify live model behavior.

## Explicit experience preference matching

The Spanish booking text view includes “Buscar a mi medida”. Opening it checks the authenticated capability; mounting, typing and swiping do not make inference requests or consume allowance. Each explicit search consumes one `chat_turns` unit. The form discloses that a submitted search may use its turn even when cancelled or unavailable. Retry is another explicit, charged request.

`GET /api/booking/match?locale=es` returns only `{ available: boolean }` after the existing booking access gate. Disabled configuration is concealed on POST; access denials remain 404. Responses are private/no-store. POST validates the strict Spanish request and injection checks, shares the booking-chat per-user 20/minute bucket, and attempts atomic allowance consumption once. It creates no draft, quote, booking, hold, payment or persistent preference.

Date, party, group-budget cents and the existing provider-fact constraints are code-owned. Style text never supplies a verified accessibility, language, pets, transport or age requirement. Existing `searchExperiences` remains authoritative for catalog facts and suitability. At most ten nonrejected candidates enter the semantic request; at most three suggestions return. Confident positive style judgments sort within each suitability partition. Unknown and rejected facts cannot become confirmed, and the response preserves the complete catalog's verdicts, reasons and alternative dates. Public responses contain fixed estimated style wording and exact catalog facts, with no confidence percentages or generated factual explanations. “Usar en el chat” only prefills and focuses the composer.

Only the new `createAbortableAdminClient(signal)` binds request cancellation to Supabase fetch; both existing admin factories remain unchanged. Its PostgREST retry policy is explicitly disabled. The new metering/catalog/matching stage has a ten-second deadline after the unchanged access gate; Jev gets at most the smaller of its remaining budget and 1,200 ms. Cancellation reaches in-flight HTTP and prevents subsequent dispatch. An interrupted allowance RPC may already have committed, so it is never automatically retried or refunded. Semantic failure after successful catalog retrieval returns deterministic catalog suggestions; catalog failure returns unavailable with explicit retry/chat guidance.

`npm run eval:jev -- fixture --suite experience-match` uses forty independently authored Spanish preferences and explicit hard-filtered catalog snapshots. The actual SDK processes canned responses; the evaluator separately checks exact facts, unknowns, rejections, ordering partitions, counts and caps. Its qualification is always disabled: blind preference wins, ties and added live p95 latency remain unmeasured. These transport results cannot demonstrate the required >=60% blind preference wins or <=1,200 ms added live p95 latency. Any paid comparison and runtime activation require the separate authorization described above.
