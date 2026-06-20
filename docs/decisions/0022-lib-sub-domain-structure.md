# ADR-0022: Sub-Domain Folder Structure for `src/lib/` (Deferred Move) + Safe TypeScript Strict Flags

**Status:** Accepted (structure deferred; tsconfig flags applied)
**Date:** 2026-06-20
**Deciders:** Juan Gonzalez
**Context:** Issues #526 (AR-S1) and #527 (AR-S2) — Wave 3 pre-launch audit

## Decision

1. **Adopt the target sub-domain grouping below** as the agreed destination for
   the flat `src/lib/` directory (62 top-level source files), following the
   barrel-`index.ts` pattern already used by `lib/admin-api/`, `lib/costs/`,
   `lib/i18n/`, `lib/proxy/`, and `lib/platforms/`.
2. **Defer the actual file move** to a dedicated cycle. The move touches imports
   across the whole codebase and would collide with concurrent work; doing it
   piecemeal here would create broad, risky import churn for no functional gain.
3. **Enable the three safe TypeScript strict flags now** (this was the
   actionable, low-churn half of #527): `noUnusedLocals`, `noUnusedParameters`,
   `noFallthroughCasesInSwitch`. **Defer `noUncheckedIndexedAccess`** (too noisy
   — documented below as future work).

## Context

### `src/lib/` is flat (#526 / AR-S1)

`src/lib/` holds **62 source `.ts` files** (plus 60 colocated `.test.ts`) at the
top level. Five sub-domains already exist and demonstrate the house pattern —
a folder per domain with an `index.ts` barrel:

- `lib/admin-api/` — `agents`, `analytics`, `costs`, `feature-flags`,
  `optimizer`, `stories`, `suggestions`, `index.ts`
- `lib/costs/` — per-vendor cost modules + `forecast`, `tier-alerts`, `index.ts`
- `lib/i18n/` — locale tables (`es`, `en`, `fr`, `de`, `pt`, `ast`), `resolve`,
  `provider.tsx`, `index.ts`
- `lib/proxy/` — `auth-refresh`, `cors`, `csp`, `csrf-proxy`, `maintenance`, …
- `lib/platforms/` — `x-client`, `types`, `index.ts`

The flat top level mixes unrelated concerns (retrieval, payments, security,
observability, admin auth, content) with no visual grouping.

### TypeScript strict flags (#527 / AR-S2)

`tsconfig.json` had `strict: true` but none of the optional strictness flags.
The audit recommended enabling, in order: `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch`, then
`noUncheckedIndexedAccess`.

## Proposed Sub-Domain Grouping (deferred move)

Group the flat files into these sub-domains, each with an `index.ts` barrel,
mirroring the existing pattern. Representative members (not exhaustive):

| Target folder | Members (current flat files) |
|---------------|------------------------------|
| `lib/retrieval/` | `embeddings`, `embedding-cache`, `rerank`, `search`, `related-stories`, `seasonal-weighting`, `content-discovery`, `mood-mapping` |
| `lib/chat/` | `chat-config`, `chat-route-utils`, `chat-safety`, `chat-action-detection`, `chat-upsell-detection`, `chat-upsell-throttle`, `chat-stream-timeouts`, `claude`, `models` |
| `lib/payments/` | `stripe`, `subscription-optimizer` |
| `lib/admin/` | `admin-auth`, `admin-formatters`, `analytics-filter`, `posthog-query` |
| `lib/security/` | `csrf`, `csrf-client`, `cron-auth`, `cron-job-lock`, `mcp-auth`, `encryption`, `credentials`, `security-headers`, `rate-limit`, `validation`, `supabase-auth` |
| `lib/observability/` | `logger`, `logger-sanitize`, `sentry-before-send`, `request-context`, `freshness`, `health-timeouts` |
| `lib/clients/` | `supabase`, `supabase-browser`, `stripe` (client), `twilio-sms`, `email`, `realtime`, `elevenlabs-call-status`, `unsplash-placeholders` |
| `lib/content/` | `stories-data`, `stories-server`, `translate-story`, `localize-story`, `translation-locales`, `asturianu`, `image-optimization`, `og-image-helpers` |
| `lib/env/` | `env`, `environment` |
| (root) | small generic utilities — `utils`, `shuffle`, `schemas`, `request-utils` |

Existing folders (`admin-api`, `costs`, `i18n`, `proxy`, `platforms`) stay.

### Migration strategy (when executed in its own cycle)

1. One sub-domain per commit/PR — never all at once.
2. `git mv` files into the folder; add an `index.ts` barrel that re-exports the
   public surface.
3. Update imports via the `@/lib/...` alias; prefer importing from the barrel.
4. Run `npm run typecheck && npm run lint && npm run test` after each
   sub-domain; Knip (CLAUDE.md guardrail #4) catches newly-unused exports.
5. Do the move during a quiet window with no large concurrent feature branches,
   to minimize merge conflicts on import lines.

The move is **deferred** because its only payoff is organizational, while its
cost — rewriting import paths across ~120 files and risking conflicts with
in-flight work — is real and immediate. Captured here so it can be executed
deliberately.

## TypeScript Strict Flags — Applied vs Deferred

### Applied now (this change)

```jsonc
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true
```

Fallout was small and mechanical — **14 `TS6133` (unused declaration) errors
across 6 files**, all resolved by prefixing genuinely-unused parameters with
`_` (the convention these flags ignore):

- 4 Next.js route handlers (`GET`/`DELETE` that don't read `request`)
- 2 cron-route test mocks (unused `url` in a `MockNextRequest` constructor)
- 8 `mockFetch` implementations in `use-favorites.test.ts` (unused `url`)

`noFallthroughCasesInSwitch` produced **zero** errors — no fallthrough bugs
existed. `npm run typecheck` (app, scripts, e2e, edge sub-projects) is green
with all three flags on.

### Deferred: `noUncheckedIndexedAccess` (future work)

Not enabled. It makes every indexed access (`arr[i]`, `record[key]`) return
`T | undefined`, which is technically safer but produces a large, noisy fallout
across array/record access throughout retrieval, i18n locale tables, and
analytics code — far beyond the ~25-error practicality bar. Enabling it well
means adding genuine guards/non-null assertions case-by-case, which is its own
focused effort.

**Recommendation:** enable `noUncheckedIndexedAccess` as a dedicated follow-up,
ideally *after* the `src/lib/` sub-domain move so the changes land in
well-scoped modules rather than one flat directory. Track as future work under
#527.

## Consequences

- `src/lib/` stays flat today; the target structure and a per-sub-domain
  migration plan are agreed and recorded.
- Three strict flags are live, raising the floor on unused-code and switch-
  fallthrough bugs at ~zero ongoing cost (the `_`-prefix convention).
- `noUncheckedIndexedAccess` remains explicitly deferred with a rationale, so
  it is a conscious backlog item rather than an oversight.
- Revisit the move and the remaining flag together in a dedicated cleanup cycle.
