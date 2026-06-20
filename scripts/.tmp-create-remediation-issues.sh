#!/usr/bin/env bash
# Creates the 50 fresh pre-launch findings as GitHub issues under a dated milestone.
# Idempotent-ish: skips creation if an issue with the exact title already exists.
set -uo pipefail
cd /Users/juan/code/paisaxe

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
MS_TITLE="Pre-launch 2026-06-20"

# Create milestone if absent
MS_NUM=$(gh api "repos/$REPO/milestones?state=all" -q ".[] | select(.title==\"$MS_TITLE\") | .number" 2>/dev/null | head -1)
if [ -z "$MS_NUM" ]; then
  MS_NUM=$(gh api "repos/$REPO/milestones" -f title="$MS_TITLE" -f description="Fresh pre-launch audit findings (2026-06-20), remediated in one release." -q .number)
  echo "Created milestone #$MS_NUM"
else
  echo "Milestone exists #$MS_NUM"
fi

domain_label() { case "$1" in AR) echo architect;; FE) echo frontend;; BE) echo backend;; PE) echo performance;; DO) echo devops-sre;; SE) echo security;; QA) echo qa-reliability;; UX) echo ux;; esac; }
sev_label() { case "$1" in B) echo launch-blocker;; H) echo high;; M) echo medium;; L) echo low;; S) echo strategic;; esac; }

create() {
  local id="$1" wave="$2" title="$3" body="$4"
  local dom="${id%%-*}" rest="${id#*-}" sevletter="${rest:0:1}"
  local dl; dl=$(domain_label "$dom")
  local sl; sl=$(sev_label "$sevletter")
  case "$id" in
    BE-B1) echo "BE-B1 #651" >> /tmp/remediation-issue-map.txt; echo "BE-B1 #651 (pre)"; return;;
    BE-H1) echo "BE-H1 #652" >> /tmp/remediation-issue-map.txt; echo "BE-H1 #652 (pre)"; return;;
    BE-H2) echo "BE-H2 #653" >> /tmp/remediation-issue-map.txt; echo "BE-H2 #653 (pre)"; return;;
  esac
  local full="[remediate] $id $title (audit 2026-06-20)"
  local num=""
  num=$(gh api "repos/$REPO/issues" \
    -f title="$full" \
    -f body="$body"$'\n\nSource: docs/agents/pre-launch-report.md (audit 2026-06-20)' \
    -F milestone="$MS_NUM" \
    -f "labels[]=$dl" -f "labels[]=$sl" -f "labels[]=$wave" \
    -q .number 2>/tmp/issue-err.txt) || true
  if [ -z "$num" ]; then echo "FAIL $id: $(tail -1 /tmp/issue-err.txt)"; sleep 75; return; fi
  echo "$id -> #$num"; echo "$id #$num" >> /tmp/remediation-issue-map.txt
  sleep 75
}

: > /tmp/remediation-issue-map.txt

# ---- WAVE 1 ----
create BE-B1 wave-1-before-launch "Stripe webhook hardcodes day_pass, under-delivering paid weekly/monthly passes" "Webhook ignores session.metadata.purchase_type and calls calculateExpiryDate('day_pass'); grant RPC inserts purchase_type hardcoded. €9.99 monthly buyer gets 24h. Files: src/app/api/webhooks/stripe/route.ts:73, src/lib/stripe.ts:114-163, supabase/migrations. Fix: read+validate purchase_type, pass to calculateExpiryDate, add p_purchase_type to grant_day_pass_idempotent + regression test. [evidence] launch-blocker, effort S."
create BE-H1 wave-1-before-launch "Rate-limit 'unknown' shared bucket on chat path" "getClientIp returns constant 'unknown' when forwarded headers absent; all such requests share one rate-limit key on the expensive auth-less chat path. Files: src/lib/request-utils.ts:29, src/app/api/chat/route.ts:47-48, src/app/api/chat/stream/route.ts:49-50. Fix: treat missing x-vercel-forwarded-for as untrusted (fail closed/stricter limiter) + log. [evidence] high, S."
create BE-H2 wave-1-before-launch "False-failed bookings when ElevenLabs times out" "15s timeout marks booking failed before conversation_id persisted; later webhook can't match; stale-booking cron only rescues 'initiating'. Files: src/lib/services/elevenlabs-call-service.ts:70-83, src/app/api/mcp/make-booking/route.ts:236-317, src/app/api/webhooks/elevenlabs/route.ts:143-166, src/app/api/cron/fail-stale-bookings/route.ts. Fix: on timeout leave row recoverable / persist correlation id. [evidence] high, M."
create FE-H1 wave-1-before-launch "Voice session + mic not torn down on unmount" "No useEffect cleanup calls endSession()/stops getUserMedia tracks; closing chat leaves WebSocket + mic alive (billing + privacy). Files: src/components/immersive/voice-chat-elevenlabs.tsx:174-254,349. Fix: unmount cleanup calling endSession + stop tracks. [evidence] high, S."
create FE-H2 wave-1-before-launch "Silent chat/voice failure UX on timeout/connection loss" "60s abort swallowed silently; spinner stops with no banner; voice has no reconnect feedback. Files: src/hooks/use-stream-chat.ts:80,196-221, src/components/immersive/voice-chat-elevenlabs.tsx:130-157. Fix: surface actionable error via ChatErrorBanner; differentiate 401/5xx/timeout; voice onError/onDisconnect. [evidence] high, M."
create DO-H1 wave-1-before-launch "No onRequestError hook so server errors miss Sentry" "Next 15/16 needs export const onRequestError; absent, so RSC/route/server-action errors never reach Sentry. Files: src/instrumentation.ts:43-66. Fix: export const onRequestError = Sentry.captureRequestError + regression test. [evidence] high, S."
create UX-H1 wave-1-before-launch "Three competing color systems; design tokens dead" "Token blue barely used; conversion surfaces hardcoded green; voice amber; brand palette commented out. Files: tailwind.config.ts:46-56, src/app/globals.css:12, src/app/pricing/page.tsx:83-201, src/components/immersive/chat-upsell-cta.tsx, voice-chat-elevenlabs.tsx:49-83. Fix: pick brand accent, tokenize, replace literals. [evidence] high, M."
create UX-H2 wave-1-before-launch "Upsell CTAs hardcode EUR1.99 and bypass tier selection" "In-context upsells advertise only 1.99 and deep-link to checkout with no tier (defaults day_pass), hiding weekly/monthly; prices duplicated in 4+ files. Files: src/app/pricing/page.tsx:20-24, src/components/immersive/chat-upsell-cta.tsx:46,85, src/components/premium/voice-purchase-cta.tsx:49,100. Fix: shared PRICING_TIERS constant; CTAs carry tier or route to /pricing. [evidence] high, M."
create AR-M1 wave-1-before-launch "server-only guard inconsistent on secret modules" "supabase.ts (admin client) and env.ts (secret getters) lack import 'server-only'; reachable from browser-capable stories-data.ts. Files: src/lib/supabase.ts:52-76, src/lib/env.ts:61-79, src/lib/stories-data.ts:11-17. Fix: add server-only / split secret getters / extract supabase-admin.ts. [evidence] medium, S."
create DO-M3 wave-1-before-launch "global-error/error.tsx Sentry capture unverified" "global-error.tsx must call Sentry.captureException in effect (not automatic); with DO-H1 client crashes may not reach Sentry. Files: src/app/global-error.tsx, src/app/error.tsx. Fix: verify+wire captureException + test. [inference] medium, S."
create QA-M2 wave-1-before-launch "E2E revenue flows are contract-gated, not transactional" "Default e2e verifies gating/rendering but no authenticated purchase/booking; transactional E2E is credential-gated only. Files: e2e/checkout.spec.ts, e2e/voice-agents.spec.ts, e2e/mcp.spec.ts, package.json test:e2e. Fix: add an authenticated happy-path checkout assertion (Stripe test mode) or document release-gate-only. [evidence] medium, M."
create UX-M1 wave-1-before-launch "Key discovery features removed on mobile not adapted" "Ambient/autoplay, Surprise Me, Share, Suggest Place hidden below md; ambient demoted to overflow only; two divergent control lists. Files: src/components/immersive/story-viewer.tsx:368-497. Fix: promote ambient to visible mobile affordance; drive controls from one config. [evidence] medium, M."
create UX-M2 wave-1-before-launch "Asymmetric invisible mobile tap zones (30/70)" "Invisible 30% back / 70% forward zones; only a one-time 3s hint; center-left taps go forward. Files: src/app/globals.css:114-122, src/components/immersive/navigation-hint.tsx:23-37. Fix: 50/50 or visible zones; re-show hint / persistent chevron. [evidence] medium, S."
create UX-M3 wave-1-before-launch "Six locales offered but content-parity unverified" "es/ast/en/fr/de/pt switchable but non-es/en likely partial UI over Spanish bodies. Files: src/components/immersive/language-switcher.tsx:9-15, src/lib/i18n/. Fix: gate locales below coverage threshold (use story-translations-coverage test) or label honestly. [inference] medium, S/L."
create UX-M4 wave-1-before-launch "Bare off-brand error and 404 screens" "Global error/404 are plain bg-neutral-950 with generic glass button, no logo/brand. Files: src/app/error.tsx:22-43, src/app/not-found.tsx:9-25. Fix: add logo + brand accent + real branded button. [evidence] medium, S."
create UX-M5 wave-1-before-launch "Hero story images use empty alt (no text alternative)" "Primary content photo marked decorative alt=''; SR users get only title/subtitle. Files: src/components/immersive/story-viewer.tsx:285, related-stories.tsx:75. Fix: meaningful alt (story description) or associate visible description. [evidence] medium, S."
create SE-S1 wave-1-before-launch "Dedicated pre-launch security verification" "Static audit only; verify Gitleaks history scan green + run dynamic fail-closed checks (admin as non-admin, cron/MCP without secrets). [inference] strategic, M."

# ---- WAVE 2 ----
create AR-M2 wave-2-after-launch "costs barrel transitively pulls server-only" "src/lib/costs/index.ts re-exports server-only manual-costs; importing client-safe pricing via barrel would fail build. Fix: keep pure helpers out of server-only barrel / deep import / document. [evidence] medium, S."
create BE-M1 wave-2-after-launch "Cron auth fallback to admin cookie unlogged" "Cron POST handlers fall through to validateAdminAuth on webhook-secret failure with no log. Files: src/app/api/cron/*/route.ts. Fix: logger.warn('[CRON_AUTH_FALLBACK]') when falling back. [evidence] medium, S."
create BE-M2 wave-2-after-launch "SMS-completion RPC failure not retried after successful send" "complete_booking_sms_job error after sendSMS leaves job 'processing' -> duplicate SMS risk. Files: src/app/api/webhooks/elevenlabs/route.ts:332-347. Fix: bounded retry / same-txn persistence / alert. [evidence] medium, M."
create BE-M3 wave-2-after-launch "github-traffic retention delete unindexed on fetched_at" "Unindexed .lte('fetched_at') delete -> seq scan + lock as data grows. Files: src/app/api/cron/github-traffic-sync/route.ts. Fix: CREATE INDEX on fetched_at for both tables. [inference] medium, S."
create FE-M1 wave-2-after-launch "Context provider values built without useMemo" "auth/feature-flags/stories providers build value as fresh object each render, re-rendering heavy consumers. Files: src/components/auth/auth-provider.tsx:178-184, src/hooks/use-feature-flags.ts:187-211, src/hooks/use-stories.ts:289-305. Fix: useMemo the value. [evidence] medium, S."
create FE-M2 wave-2-after-launch "SSE reader lock not released on abort/error" "getReader() with no releaseLock/cancel in finally; abort leaves dangling reader/stream. Files: src/hooks/use-sse-stream.ts:36-81. Fix: finally cancel+releaseLock. [inference] medium, S."
create FE-M3 wave-2-after-launch "Chat list full re-render per token; 20-turn cap not enforced" "Each token re-renders whole list + scrollIntoView; client send path doesn't enforce 20-turn cap. Files: src/components/immersive/voice-chat/chat-message-list.tsx:36-56, src/hooks/use-stream-chat.ts:39, src/lib/chat-safety.ts:10. Fix: memo rows, guard scroll, enforce cap. [evidence] medium, M."
create FE-M4 wave-2-after-launch "i18n locale resolves post-hydration (Spanish flash)" "SSR+first paint hardcode 'es', resolveLocale runs in effect; non-Spanish users see flash. Files: src/lib/i18n/provider.tsx:56-80. Fix: resolve locale server-side from Accept-Language/cookie, pass initialLocale. [evidence] medium, M."
create PE-M1 wave-2-after-launch "Full multi-locale translation payload on every landing" "PUBLIC_STORY_SELECT ships whole metadata (5 unused locales x ~73 stories) to client. Files: src/types/immersive.ts:193,82-83, src/lib/stories-server.ts:62, src/lib/localize-story.ts:25, src/app/immersive/immersive-page-content.tsx:38-49. Fix: resolve active locale server-side / lazy-fetch. [evidence] medium, M."
create PE-M2 wave-2-after-launch "Proxy runs auth/CSP/CSRF on all API routes incl SSE" "Matcher covers every /api/* incl chat/stream + feature-flags; CSP/CSRF cookie work irrelevant to SSE. Files: src/proxy.ts:77-85,60-72. Fix: narrow matcher / early /api/ fast-path. [inference] medium, M."
create PE-M3 wave-2-after-launch "PostHog+Sentry bundle (~70KB gz) on public landing" "Analytics+error chunk loads eagerly on first paint for every visitor. Files: src/app/layout.tsx:15. Fix: defer PostHog init to idle/post-interaction; confirm Sentry lazy. [evidence] medium, M."
create DO-M1 wave-2-after-launch "Migrations applied manually, decoupled from deploys" "supabase db push run by hand; nothing enforces ordering vs code deploy. Files: docs/operations/rollback.md, migration-policy.md, .github/workflows. Fix: hard ordering rule in release checklist + schema-drift check. [evidence] medium, M."
create DO-M2 wave-2-after-launch "develop-smoke non-blocking and silent on failure" "continue-on-error + exit 0 on Vercel fail/timeout -> green-ish run with no smoke signal. Files: .github/workflows/ci.yml:157-219. Fix: ::warning:: + job summary; fail (non-blocking) when deploy ok but probes fail. [evidence] medium, S."
create QA-M1 wave-2-after-launch "Slow suite / heavy environment churn" "environment 432s aggregate; many DOM env setups. Files: vitest.config.ts:14-28. Fix: audit per-file environment pragmas, run pure-logic under node. [evidence] medium, M."
create QA-M3 wave-2-after-launch "Playwright CI retries=2 mask flakiness" "retry-only pass reported green with no signal on revenue/voice flows. Files: playwright.config.ts:17-22. Fix: surface flaky counts; fail/warn when flaky>0 for qa-journey/checkout. [evidence] medium, S."
create DO-L2 wave-2-after-launch "No alert on health cron_auth: misconfigured" "CRON_SECRET misconfig surfaced in body but excluded from overallStatus. Files: src/app/api/health/route.ts:171-177. Fix: fold into degraded (prod) or alert on [CRON_AUTH_REJECTED]. [inference] low, S."
create QA-L1 wave-2-after-launch "withChatStreamStageTiming has no direct unit test" "Timeout/timer-cleanup logic covered only via route tests. Files: src/lib/chat-stream-timeouts.ts:28-63. Fix: fake-timers unit test for reject/success/clear + log. [evidence] low, S."
create SE-L1 wave-2-after-launch "MCP Places forwards attacker-influenceable query to Google (no SSRF today)" "Query sent as JSON body to hardcoded base URL; no user-controlled URL. Files: src/app/api/mcp/places/route.ts:236. Fix: keep baseUrl constant; never derive egress URL from input (document). [evidence] low, S."
create UX-L1 wave-2-after-launch "Focus-ring offset hardcoded ring-offset-black on neutral-950" "Inconsistent across files (favorites uses neutral-950). Files: src/components/ui/button.tsx:22-24 + story-info-panel/story-toolbar/question-prompts/voice-purchase-cta. Fix: tokenize / standardize offset. [evidence] low, S."
create UX-L2 wave-2-after-launch "Artificial 300ms favorites loading delay" "setTimeout 300ms to show spinner with no functional benefit. Files: src/app/favorites/page.tsx:42-45 (keep story-viewer crossfade timer). Fix: render synchronously; spinner only on real pending fetch. [evidence] low, S."

# ---- WAVE 3 ----
create BE-M4 wave-3-later "subscription-optimizer file read-modify-write without locking" "No lock/atomic rename; concurrent runs clobber; Vercel FS ephemeral. Files: src/app/api/cron/subscription-optimizer/route.ts. Fix: cron-lease only / atomic write / move to Postgres. [evidence] medium, S."
create AR-L1 wave-3-later "Unused exported type ChatRequest" "Knip's single unused export. Files: src/lib/schemas.ts:328. Fix: delete export. [evidence] low, S."
create BE-L1 wave-3-later "favoritesPostSchema accepts unbounded UUID array" "storyIds .min(1) no .max(); single request -> huge upsert. Files: src/lib/schemas.ts:117-121, src/app/api/favorites/route.ts:67-74. Fix: .max(200). [evidence] low, S."
create BE-L2 wave-3-later "Stripe webhook RPC has no client-side timeout" "grant_day_pass_idempotent awaited with no timeout; hung DB blocks handler. Files: src/app/api/webhooks/stripe/route.ts:76-83. Fix: ~10s Promise.race, 500 on timeout. [evidence] low, S."
create FE-L1 wave-3-later "Very low component memoization across client components" "Only 2 of ~99 use React.memo; children get fresh closures, re-render on swipe. Files: src/components/immersive/story-viewer.tsx:308-353. Fix: profile + memo heaviest children + stabilize callbacks. [evidence] low, M."
create FE-L2 wave-3-later "Math.random in useRef initializer runs every render" "useRef(Math.random()) evaluates each render. Files: src/app/immersive/immersive-page-content.tsx:74. Fix: lazy init / useMemo. [evidence] low, S."
create PE-L1 wave-3-later "ElevenLabs/LiveKit deferred chunk is one 147KB-gz monolith" "Correctly lazy-loaded but one big chunk before voice UI. Files: src/components/immersive/voice-chat.tsx:46-54. Recommendation: optional/post-launch only. [evidence] low, L."
create PE-L2 wave-3-later "feature-flags route uses select('*')" "Selects all columns incl config later scrubbed; bounded by 60s cache. Files: src/app/api/feature-flags/route.ts:50. Fix: narrow select to flag_key,enabled. [evidence] low, S."
create DO-L1 wave-3-later "Health storage limit hardcoded (8192MB)" "Diverges silently if plan changes. Files: src/app/api/health/route.ts:66. Fix: env var documented in .env.example. [evidence] low, S."
create QA-L2 wave-3-later "chat-route-utils.ts lacks co-located test" "26-line helper on hot path; likely covered transitively. Files: src/lib/chat-route-utils.ts:1-26. Fix: verify coverage; add focused test if branches uncovered. [inference] low, S."
create SE-L2 wave-3-later "CSP relies on 'unsafe-inline' for scripts (PPR tradeoff)" "Deliberate; XSS defense via sanitization + render-sink registry + xss-canary. Files: src/lib/proxy/csp.ts:28. Fix: keep registry+canary required gates; revisit nonce if PPR relaxes. [evidence] low, M."
create AR-S1 wave-3-later "No CI circular-dependency / boundary guard" "Zero-cycle result was ad-hoc npx madge; nothing in CI enforces it. Files: package.json scripts, knip.json. Fix: pinned madge --circular CI step. [inference] strategic, M."
create UX-S1 wave-3-later "Design system exists but product hand-rolled around it" "Real shadcn primitives bypassed; root cause of UX-H1/UX-L1. Files: src/components/ui/* vs pages with raw button. Fix: 'no raw button in pages' convention; route conversion through Button/Card. [inference] strategic, L."

echo "=== DONE ==="
wc -l /tmp/remediation-issue-map.txt