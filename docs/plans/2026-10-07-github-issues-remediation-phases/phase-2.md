# Phase 2: Request security and local-only operations

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #942, #937, #935, #837, #849, #801, #914. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: implemented, independently reviewed and locally qualified on 2026-10-08; normal commit/local integration identity is recorded in the implementation notes and handoff. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Close request identity, authenticated caching, SSRF and production process-launch boundaries. Sources: `src/lib/supabase-auth.ts:52`, `src/app/api/suggestions/route.ts:28`, `src/app/api/checkout/embedded/route.ts:65`, `src/app/api/mcp/weather/route.ts:286`, `src/app/api/mcp/weather/route.ts:346`, `src/lib/rate-limit.ts:335`, `src/app/api/admin/stories/[id]/image/route.ts:105`, `src/app/api/admin/stories/[id]/image/route.ts:331`, `src/app/api/admin/agents/run/route.ts:3`, `src/app/api/admin/tunnel/route.ts:2`, `next.config.ts:13`.

## Design and ownership

One request-boundary owner handles auth/rate/environment consumers because their routes overlap. Require NextRequest in the server Supabase helper and forward it from getUserFromRequest. Embedded checkout resolves bearer/cookie auth through the shared helper. Remove no longer existing day-pass callsites from the issue scope. Browser auth-provider's same-name local callback is a different symbol.

Weather GET and POST use private cache control with existing TTL. Trim-aware getEnv guards and values are paired in weather/places/make-booking; preserve the stronger ElevenLabs credential fingerprint resolver. Shared request-limit response helper preserves route messages, headers and distributed fail-closed behavior. Normalize IPv6 /64 in weather/places/suggestions and keep route namespaces separate. Do not relocate normalization for style.

Write a per-method route budget/exemption registry covering favorites, feature-flags, voice-access, embedded checkout, MCP save-favorite, make-booking/status and stories, plus all existing chat/MCP/voice-session limits. Keep current limits for existing protected paths. New mutation limits derive from measured legitimate UI burst/poll fixtures and existing cost caps; approve exact constants in the phase review before integration. Cheap cached stories/flags reads and constant no-I/O booking status acknowledgement may be explicitly exempt; auth alone is not a cost analysis. Paid voice-minute policy follows the parent's accepted deferral of metered voice caps; partial request-limit work cannot close that entire requirement.

Remove unused degraded-state getter/flag APIs only after consumer sweep. Preserve RateLimitBackendStatus and the real probeRateLimitBackend health contract; update health mocks, not the live probe. No failure mode becomes fail-open.

SSRF unit [batch-eligible] owns image import transport/helper/tests only. Use node:https with a controlled lookup bound to validated public A/AAAA addresses; retain original hostname/Host/SNI and ordinary certificate validation. Revalidate each connection/retry, reject mixed private results and IP edge cases, disallow redirects, preserve 8-second/10MB/content caps and manual upload recovery. Do not rely on a transitive Undici API or allow-all DNS fallback. Node runtime compatibility must match the project's supported runtime, not newer documentation-only APIs.

Local-operations unit [batch-eligible] owns process handlers, their local implementation modules, production stubs, build config and dashboard capability UI. Extract process execution behind a build-resolved module: development selects authenticated allowlisted local operations; production selects an inert local-only response module. Configure both actual build engines, with no process execution implementation reachable in the production route bundle/trace. Route existence is acceptable only if inert; absence of child_process from the whole Next runtime is not the oracle. A runtime guard alone is interim protection and does not complete #801. Dashboard treats 403/404/local-only as a visible unavailable capability and stops polling while summary APIs remain functional.

## Automated criteria

Real auth helper with fake transport: bearer and cookie users access only their own rows, invalid tokens reject with no side effects; whitespace config performs zero upstream calls and later corrected config works. Both authenticated weather verbs have private responses.

Rate tests: IPv6 aliases share /64 budget, distinct users/prefixes stay independent, rejected auth is not charged, global caps remain, unavailable Redis fails closed, restored backend and expired window recover. UI/API reports retry timing. Remove obsolete getter references without deleting live health contracts.

SSRF resolver/TLS fixtures: DNS public-to-private change never connects privately, mixed A/AAAA and mapped IPv6 reject, valid hostname uses correct SNI, invalid certificates reject, timeout/size/redirect paths are bounded, later valid import succeeds. No external provider calls.

Production build fixture serves inert process routes with NODE_ENV/VERCEL_ENV combinations and inspects reachable per-route bundle/trace for local execution modules. Local development fixture verifies auth/CSRF, start/status/logs/stop and tunnel lifecycle. Stub tests alone cannot establish bundle exclusion.

## Manual and external criteria

No new manual local step. Verify runtime headers and inert process capability after separately authorized production release; build proof alone does not establish deployed identity. A new metered cap is prohibited until the owner resolves its product policy.

## Stuck states and recovery

Caller sees 401/403 with sign-in recovery; rate-limited caller sees Retry-After and can retry after the window/backend recovers. Missing configuration has an explicit not-configured error and operator runbook. Image editor shows invalid-host/TLS/timeout/size error with retry or upload. Production admin sees local-only controls and a visible local development instruction without endless polling. Every denial has recovery or disclosure assertions, including next valid request succeeding.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
