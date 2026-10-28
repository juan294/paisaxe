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
