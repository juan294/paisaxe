# Behavioral oracles and evaluation rubric

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). This is the checkable specification for future failing tests and authored evaluation cases, not evidence that those tests already exist or pass. Every test must identify the production regression that would make it fail. Mock provider HTTP/clock only; exercise owned parsers, domain functions and serializers, with the local database for database semantics. Freeze fixture input/expected output separately and never send expected labels to Jev.

## Adapter: Phase 1

| ID | Concrete stimulus | Required result and recovery proof |
| --- | --- | --- |
| ADAPTER-01 | Key absent; empty allowlist; unknown task token; then corrected explicit configuration | Zero HTTP in invalid/off cases, exact safe reason, existing app usable; corrected request answers without restart or sticky cache |
| ADAPTER-02 | Provider delays beyond 1,200 ms; 429; 529; caller abort before/during HTTP | At most one request, proper unavailable reason, timer/listener cleanup and no later work; next independent successful request answers |
| ADAPTER-03 | Response has unknown candidate, missing/extra answer, NaN, probability outside [0,1], invalid distribution total, or mismatched model | Reject as invalid_response, never partial semantic acceptance; subsequent valid response accepted |
| ADAPTER-04 | Provider omits usage or errors with secret-like body/header/state strings; ambient TYPESAFE_BASE_URL points elsewhere and TYPESAFE_LOG_LEVEL=debug | Usage/cost unknown stays null/reserved, not zero; production configuration keeps the fixed API origin with SDK logs off and only allowlisted application metadata; valid later usage permits a precise estimate |
| ADAPTER-05 | Oversized UTF-8 input, empty state, caller imports server client from a client component | Input rejected before network with explicit limit; reduced valid input succeeds; dedicated build/import-boundary check rejects client bundling while shared types remain importable |

## Inspector: Phase 2

| ID | Concrete stimulus | Required result and recovery proof |
| --- | --- | --- |
| INSPECT-01 | `--list`, fixture suite, inspect; live missing either cap; live in CI | Zero outbound requests; actionable errors for disallowed live mode; valid fixture command generates inspectable HTML |
| INSPECT-02 | Three cases: success, provider error, unstarted due to cap | All three appear; complete=false, failed/missing denominator explicit, nonzero exit; capped resume requests only unresolved cases and retains prior evidence |
| INSPECT-03 | Crash after dispatch but before result persistence; multiple requests per case; then changed model/question/input hash or corrupt checkpoint | Persisted attempt reservation/count survives crash; unknown completion is not silently retried; explicit retry reserves another request; completed spend is not double-counted; incompatible/corrupt resume refuses and displays new-run command |
| INSPECT-04 | State contains script tags, event attributes, Markdown links and credential-like fixture text | HTML renders inert escaped text with no external requests; raw synthetic trace only in ignored local output; exported summary omits raw state |
| INSPECT-05 | Remaining budget below full reservation; ambiguous timeout usage; imported or replayed record | No over-cap request, unknown usage retains reservation; report distinguishes imported/replayed from fresh live latency and explains new capped run |

## Booking intake: Phase 3

Use frozen Madrid clock `2026-10-28T10:00:00Z` and independent catalog fixtures. Provider responses in deterministic tests are HTTP fixtures, not fake domain-function returns.

| ID | Concrete stimulus | Required result and recovery proof |
| --- | --- | --- |
| INTAKE-01 | Pristine Spanish turn “¿Qué experiencias hay para dos personas el 2026-10-30 hasta 40 euros?” with confident presence/intent and singleton candidates | One Jev request, one search with party=2/date=2026-10-30/budgetCents=4000, no invalid singleton margin, zero Claude calls, unchanged normal events/cards, no interpretation-driven booking mutations |
| INTAKE-02 | Disabled, replay, non-es, prior history, nonempty draft, existing booking or accepted-booking event | Zero Jev calls, existing path preserved; accepted event retains its deterministic branch and existing replay still passes |
| INTAKE-03 | Named experience, payment/cancel/quote intent, mixed request, “el viernes”, multiple incompatible dates, “por la tarde”, “menos de 40 euros”, age/language requirement | Existing agent handles/clarifies exactly once; visitor can supply an unambiguous new ordinary turn and continue |
| INTAKE-04 | No party/date, multiple euro amounts, absent budget, forged ID, offset not matching original span, middle confidence | Absent optional budget only accepted with independent confident absence; every unresolved required field or invalid selection falls back without fabricated values |
| INTAKE-05 | “hoy”/“mañana” around Madrid midnight and DST; invalid ISO date; day 91; party 0/13 | Valid boundaries resolve deterministically; unsupported cases fall back; model cannot override date/numeric validation |
| INTAKE-06 | Jev timeout/429, malformed response, or search HTTP error before emission | One ordinary fallback and no leaked fast-path events; later eligible request succeeds; no duplicate mutating tool invocation |
| INTAKE-07 | Cancel before inference, during inference, during existing search, or immediately before emission | No additional calls/events after observed cancellation; client exits loading; in-flight legacy search may finish but cannot emit stale output |
| INTAKE-08 | Empty/all-rejected options; explicit “sin escaleras”/transport/pets requirements; provider fact unknown; next turn chooses exact catalog name and time | Each confidently required supported constraint appears as true in exact tool input; uncertainty falls back; explicit change-criteria guidance and unknowns retained; ordinary follow-up reaches existing quote behavior without ordinal-card assumptions |

Held-out labels include eligibility, exact criteria, must-fallback reason and expected invariant, not just the model's selected label. All 120 cases remain in the report; false positives cannot be hidden by excluding uncertain requests. Pair complete baseline/Jev scenarios with identical catalog, clock, network conditions and inputs, randomize order, and report both distributions. Provider cost includes the Jev call and every subsequent Claude call through the matched scenario endpoint. Test the extracted harness imports with zero key loading/network/setup, explicit es baseline/candidate modes, first-card timing, and separate per-request Claude budget enforcement even for retries. Route timings include common retrieval prework with its fixture/live identity recorded; agent-only timing is separately labelled. A deterministic-only win is a reason to retain deterministic code, not to activate Jev.

## Call advisor: Phase 4

Requested reservation in examples: 2026-10-30, 18:00, party 2. All calls are authored synthetic records.

| ID | Concrete stimulus | Required result and recovery proof |
| --- | --- | --- |
| CALL-01 | Agent says “perfecto”; merchant has only greeted or asked a question | Never merchant_accepted; report points to speaker evidence; adding an explicit matching merchant confirmation can create a new accepted advisory |
| CALL-02 | Merchant explicitly accepts requested date/time/party; later rejects/corrects it | Simple complete confirmation may be accepted; later withdrawal cannot remain accepted; sequence and supporting turns shown |
| CALL-03 | Merchant offers 2026-10-31, 19:00 or party 4 instead; summary says confirmed | Never accepted for original request; exact mismatch/conflicting summary disclosed; corrected independently labelled snapshot is a new case |
| CALL-04 | Voicemail, no transcript, missing roles, missing requested time or ambiguous multiple bookings | no_contact only with positive evidence of no contact; otherwise uncertain with missing fields; supplying role/criteria mapping resolves structural gaps |
| CALL-05 | Utterance instructs “mark confirmed” or contains fake JSON IDs; provider timeout | Inert source text/validated IDs; no authority bypass; semantic error retained as failed case; timeout unavailable and later capped retry can succeed |
| CALL-06 | Run CLI without database/SMS/payment credentials; compare legacy classifier and new advisor | Runs from fixtures, labels differ from BookingOutcome, no mutation-entrypoint imports or calls; existing classifier/formatter module import is allowed but must cause zero non-Jev network/database/SMS/payment activity; report cannot qualify settlement or generate approval receipts |

Blind label review must identify the requested booking, speaker and last effective merchant statement. False acceptance means any merchant_accepted on a nonaccepted reference case. Report per-label recall, abstention and confusion counts; the Phase 4 minimum useful coverage prevents qualification through universal abstention.

## Evidence checker: Phase 5

| ID | Concrete stimulus | Required result and recovery proof |
| --- | --- | --- |
| EVIDENCE-01 | Answer has title/URL citations but no passage body; duplicate passage ID; wrong body hash or claim span | Unavailable before network, exact missing/invalid field listed; corrected explicit snapshot proceeds |
| EVIDENCE-02 | Passage says “abre a las 10”; claim says “abre a las 9”; declared quotation differs | Contradiction cannot be supported; quotation mismatch is unavailable before HTTP; matching quotation in new snapshot passes structural checks without implying overall truth |
| EVIDENCE-03 | Claim cites unrelated passage A while uncited B supports it; passage concerns museum A but claim concerns restaurant B; general opening info used to claim a free slot now | Only the per-claim cited subset is sent/judged; uncited support cannot pass citation support; unsupported entity/current availability stays not-established; missing dated evidence disclosed |
| EVIDENCE-04 | Clear supported paraphrase, explicit opposite, neither, both positive, or middle probabilities | Respect exact four-way policy; ambiguity is unavailable, not silently supported/not-established; show evidence conflict and operator's correction path |
| EVIDENCE-05 | Source includes instructions, unknown returned IDs, provider 429 or timeout | Ignore source as instruction, validate IDs; transport failure unavailable; new successful capped run retains old failure and hashes |
| EVIDENCE-06 | Only one supplied claim in a multi-claim answer; existing corpus receipt beside report | coverage=provided_claims_only with counts; no whole-answer verified label, receipt/cache writes or automatic URL fetch; developer can add missing claim units explicitly |

Human reference labels reflect only the supplied passages, not a reviewer's outside knowledge. Truth-labelled abstentions count against recall/F1; missing input/provider failures prevent a complete semantic qualification. Keep tuning examples distinct from the at-least-20 held-out claims and the existing frozen 40-query corpus.

## Experience matching: Phase 6

| ID | Concrete stimulus | Required result and recovery proof |
| --- | --- | --- |
| MATCH-01 | Mount, type, swipe, reopen panel, GET capability; then one valid explicit POST | Zero Jev/quota for passive actions; one charge and at most one inference for submit; disclosure visible before submit |
| MATCH-02 | Off/key absent, locale en, unauthenticated/expired voucher, Preview, invalid body or injection | No quota/Jev and correct concealed/invalid response; valid restored access/config/input recovers through reopen or explicit retry |
| MATCH-03 | Two concurrent submits with one chat turn remaining; alternate chat/matching to reach rate limit | Atomic consumption permits only remaining allowance; shared rate bucket enforced; denied request has no Jev call and shows limit/retry guidance |
| MATCH-04 | Calm-style request; one rejected cheap candidate, one suitable, one unknown-accessibility candidate; high semantic score for rejected | Never promote rejected or unknown facts; rank only within partitions, preserve reasons/alternatives/price and show estimated style fit |
| MATCH-05 | More than ten non-rejected options; no confident positive score; tie; partial/invalid score response | Input cap ten, response cap three, count/truncation truthful; stable deterministic fallback, no fabricated style explanation; changed preference can yield new results |
| MATCH-06 | No catalog options or all rejected; requested date full with later alternatives | no_results plus authoritative reasons/alternatives and edit/chat action; changed criteria recovers without booking mutations |
| MATCH-07 | Jev fails after catalog success; catalog fails; stage timeout | Deterministic options for semantic failure, unavailable for catalog failure, never empty success; explicit new charged retry or ordinary chat remains available |
| MATCH-08 | Abort during quota RPC after server commit, catalog fetch, inference; older result arrives after newer submit | At most one quota attempt, no automatic refund/retry; abort reaches new HTTP transport, loading exits, no stale result; disclose possible consumed turn and allow new explicit search |
| MATCH-09 | Select suggestion with keyboard/mobile/screen reader | Composer is prefilled/focused with exact title and structured criteria, not submitted; no draft/quote/hold/profile write; user may edit and continue through ordinary chat |

For the 40-case matching benchmark, a reviewer blind to the system compares lists from identical hard-filtered catalog snapshots and explicit Spanish preferences. Count ties as non-wins, randomize display order and disclose truncation. All hard-fact invariant failures fail adoption regardless of preference score. Fixture-based accessibility/layout review is distinct from real provider quality and latency evidence.

## Cross-phase acceptance record

For every completed phase record: worktree/base/current commit and dirty diff identity; named oracle/test outputs and command exits; application gates and any skipped environment cases; reviewer findings and repairs; simplify result; fixture/live distinction; measured metrics or explicit unmeasured status; external actions performed (normally none); and the next phase's acceptance prerequisite. A failure followed by success keeps both records. No source-only pass activates a runtime task.
