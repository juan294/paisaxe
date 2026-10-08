# Phase 7: Locale coverage and request-dependent first paint

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #910, #911, #773. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

The owner selected complete support for all six existing locales. Sources: `src/lib/i18n/types.ts:1`, `src/lib/i18n/provider.tsx:52`, `src/lib/i18n/provider.tsx:58`, `src/lib/i18n/provider.tsx:71`, `src/components/immersive/story-viewer.tsx:238`, `src/lib/booking/agent.ts:214`, `src/app/layout.tsx:116`, `src/app/immersive/page.tsx:12`, `src/app/providers.tsx:15`. Installed Next guidance: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md:1`; use supported installed APIs, not a wholesale framework migration.

## Design and ownership

One locale/provider owner controls server preference, proxy hints, segment islands, provider identity and dictionary/story contract; interpolation consumers are serial with viewer/pricing changes. Accepted scope: all six advertised locales, including visible UI, accessibility labels, story text and question prompts. Generated/dictionary coverage and native-language quality are separate evidence. Existing independent Asturianu overlay must agree with selected locale rather than mix languages accidentally.

Add one pure client/server interpolation function replacing all occurrences with literal replacement values (including $). Preserve caller Intl number/date formatting. Missing variables remain visible with development diagnostics, never crash the visitor. Sweep pricing/viewer/progress/voice, booking status/cancellation/cards and server booking agent, not just original examples. Verify placeholder sets across every dictionary.

Locale precedence: explicit current user selection persisted to validated server-readable cookie; otherwise supported browser preference; otherwise Spanish. Migrate legacy localStorage on the first client visit and test the one-time reconciliation: a server cannot know localStorage alone before hydration. Store selected locale consistently and ignore stale translation responses after later selection. Dictionary failure has retry plus explicit fallback; do not advertise translated story completeness until data is verified.

#773: retain static root/PPR output with one concrete server seed island inside a Suspense boundary; no request read occurs at the root layout top level. Replace the current root Providers placement (`src/app/layout.tsx:151`) with `Suspense(fallback = neutral non-personal readiness UI) → RequestPresentationProviderShell(server) → Providers(client, initialPresentation) → existing route children`. The server shell performs bounded request-dependent reads inside that boundary; this is not a descendant-to-ancestor bridge. One Providers instance still spans immersive/pricing/favorites and all current root consumers; never mount an additional competing LanguageProvider/AuthProvider. Root PostHog shell can stay outside only if its existing context contract is preserved. Own new server shell, root/provider wiring and all matching layout tests in this phase. InitialPresentation contains validated locale, the complete active dictionary/resource and narrow verified-user presentation (no tokens/secrets); add explicit initial-user support to AuthProvider and initial dictionary support to LanguageProvider, reconcile through normal auth events without overwriting a newer client state. A locale prop alone cannot prevent Spanish fallback before lazy dictionary effects. Render streamed content inside a server-set `lang=locale` region before hydration; static root html lang remains Spanish, and LangSync synchronizes the document after hydration (`src/components/a11y/lang-sync.tsx:9`). Tests inspect the active translated dictionary and region lang, not a seed field. Request timeout yields an explicit neutral/error or anonymous-safe state with retry, never personal static caching. Validated proxy/cookie hints may improve presentation but never authorize access. No top-level root headers()/cookies(), public caching of private data or pathname-dependent mount/unmount of AuthProvider. Use a stable provider tree; server mutation/session routes remain authoritative. This resolves request-state first paint without requiring #820's conditional route-group split or experimental private-cache adoption.

```text
@ resolveInitialPresentation(request, supportedLocales) -> seed
ctx: validated preference cookie, browser language, verified session
pre: request reads occur in the server seed shell inside Suspense
do:
  1. validate explicit locale or select supported browser fallback
  2. lookup verified user independent of presentation hint
  3. emit active dictionary and narrow user seed to the one stable provider
br: missing dictionary -> disclosed Spanish fallback and retry
fail: auth unavailable -> visible bounded pending/error state
```

## Automated criteria

Complete locale/key/placeholder matrix; all migrated labels have no unresolved placeholders under valid inputs. Complete six-locale story/question-prompt coverage report; selected Asturian behavior agrees in chat and story. Translation load failure then successful retry, rapid locale changes, legacy storage, invalid cookies, browser preference and reload tests.

Production-artifact Playwright inspects non-Spanish initial streamed paint with active dictionary before hydration, explicit region lang and later html synchronization and personal UI. Forged/expired hint, anonymous, login/logout, back/forward and immersive → pricing → favorites preserve real auth and form state. Slow/failing auth exposes retry rather than leaving purchase controls indefinitely pending. Phase 4's paid voice seam remains green. Build confirms root request-independent PPR and no private data in static output.

## Manual and external criteria

Native-language review of representative UI, safety/booking copy and story prompts per offered locale. Full provider translation/data rollout has separate budget and production authority; deterministic fixture completeness alone cannot close a production content gap.

## Stuck states and recovery

Visitor sees explicit missing-language fallback and can retry/switch locale; the next successful load restores selected language without stale overwrite. Auth timeout shows a bounded retry/sign-in path. First legacy-localStorage visit reconciles visibly once; subsequent requests use cookie. Tests prove fallback disclosure, retry and route continuity.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
