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
