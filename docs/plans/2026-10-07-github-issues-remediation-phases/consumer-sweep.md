# Consumer and writer inventory

Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`, 2026-10-07. Each entry lists the actual search and every matching path, including fixtures/tests/scripts. A matching path is assigned to the named phase for migration or compatibility verification, not necessarily a code rewrite. Re-run at implementation HEAD, classify new matches and inspect actual imports/writers. Names inside function bodies are not enough to prove symbol identity.

Cross-phase exclusions: browser auth-provider's local getSupabaseClient is not the server helper; Stripe RPC_TIMEOUT is not an AbortError classifier; chat-copy/suggest-place/navigation-hint timers retain distinct lifecycles; server Sentry imports remain server imports; compliant admin wrappers stay regression consumers; SQL applied migrations are evidence and are never rewritten. Historical PDF extractors cannot become a bypass into publishable corpus. Production asset and DB catalogs need runtime inventories in addition to source sweeps.

## contracts: Phase 3 (shared Playwright reporter compatibility in1)

All selected DB suites/helpers and native cadence consumers; no required skip can pass.

Search: `rg --files src scripts | rg "postgrest.*test|local-supabase|playwright-report|ci-cadence.*(projection|native|fixture)"`. 27 matching paths.

- `scripts/ci-cadence-native-workflows.mjs:1`
- `scripts/ci-cadence-native-workflows.test.mjs:1`
- `scripts/ci-cadence-native.mjs:1`
- `scripts/ci-cadence-native.test.mjs:1`
- `scripts/ci-cadence-projection.mjs:1`
- `scripts/ci-cadence-projection.test.mjs:1`
- `scripts/lib/playwright-report.test.ts:1`
- `scripts/lib/playwright-report.ts:1`
- `scripts/validate-ci-cadence-fixtures.mjs:1`
- `scripts/validate-ci-cadence-fixtures.test.mjs:1`
- `src/app/api/feature-flags/route.postgrest-rls.test.ts:1`
- `src/app/api/webhooks/stripe/route.postgrest-integration.test.ts:1`
- `src/lib/booking/booking.postgrest-integration.test.ts:1`
- `src/lib/booking/cancel.postgrest-integration.test.ts:1`
- `src/lib/booking/capture.postgrest-integration.test.ts:1`
- `src/lib/booking/invoice.postgrest-integration.test.ts:1`
- `src/lib/booking/operator.postgrest-integration.test.ts:1`
- `src/lib/booking/phone-confirmation.postgrest-integration.test.ts:1`
- `src/lib/booking/reconcile.postgrest-integration.test.ts:1`
- `src/lib/booking/tools.postgrest-integration.test.ts:1`
- `src/lib/booking/vouchers.postgrest-integration.test.ts:1`
- `src/lib/definer-function-privileges.postgrest-rls.test.ts:1`
- `src/lib/match-chunks.postgrest-rls.test.ts:1`
- `src/lib/proxy/maintenance.postgrest-integration.test.ts:1`
- `src/lib/stories-rls.postgrest-rls.test.ts:1`
- `src/test/local-supabase-locks.ts:1`
- `src/test/local-supabase.ts:1`

## journey: Phase 1

QA reporting and all shared reporter callers; preserve live-provider runner semantics without invoking them.

Search: `rg -l "JOURNEY_(PASSED|FAILED|EXIT_CODE|OUTPUT)|qa-journey-metrics|assertTestsExecuted|PLAYWRIGHT_JSON_OUTPUT_NAME" scripts .github e2e`. 11 matching paths.

- `.github/workflows/e2e-stripe-integration.yml:1`
- `scripts/check-verification-coverage.ts:1`
- `scripts/lib/playwright-report.test.ts:1`
- `scripts/lib/playwright-report.ts:1`
- `scripts/qa-agent.sh:1`
- `scripts/run-prelaunch-e2e.test.ts:1`
- `scripts/run-prelaunch-e2e.ts:1`
- `scripts/run-prelaunch-gate.test.ts:1`
- `scripts/run-prelaunch-gate.ts:1`
- `scripts/run-stripe-e2e.ts:1`
- `scripts/verification-config.test.ts:1`

## env: Phase 10

Both CLI consumers, tests and invokers; credential filtering remains consumer-specific.

Search: `rg -l "getEnvExampleKeys|extractCredentialKeysFromEnvExample|check-env|check-secret-inventory" scripts .github package.json`. 7 matching paths.

- `.github/workflows/ci.yml:1`
- `package.json:1`
- `scripts/check-env.ts:1`
- `scripts/check-secret-inventory.test.ts:1`
- `scripts/check-secret-inventory.ts:1`
- `scripts/run-prelaunch-gate.test.ts:1`
- `scripts/run-prelaunch-gate.ts:1`

## voice: Phase 13

Canary, probe, observability and runbook compatibility; no traffic/privacy changes.

Search: `rg -l "probeElevenLabsVoiceAgents|ELEVENLABS_CREDENTIAL_REJECTED|elevenlabs-voice-canary|captureCheckIn" src scripts docs/operations docs/runbooks`. 13 matching paths.

- `docs/operations/alerting-runbook.md:1`
- `docs/operations/operations.md:1`
- `docs/runbooks/elevenlabs-credential-rotation.md:1`
- `src/app/api/admin/costs-analytics/route.test.ts:1`
- `src/app/api/admin/elevenlabs-analytics/route.test.ts:1`
- `src/app/api/cron/elevenlabs-voice-canary/route.test.ts:1`
- `src/app/api/cron/elevenlabs-voice-canary/route.ts:1`
- `src/app/api/health/voice/route.test.ts:1`
- `src/app/api/health/voice/route.ts:1`
- `src/lib/elevenlabs-observability.test.ts:1`
- `src/lib/elevenlabs-observability.ts:1`
- `src/lib/elevenlabs-signed-session.test.ts:1`
- `src/lib/elevenlabs-signed-session.ts:1`

## corpus: Phase 12

All provenance writers/readers/fixtures; PDF extractors may remain restricted reference tools but cannot publish old text.

Search: `rg -l "source_pdf|sourcePdf|page_number|pageNumber|image_refs|imageRefs" src scripts e2e --glob "*.ts" --glob "*.tsx"`. 88 matching paths.

- `e2e/fixtures/mock-data.ts:1`
- `scripts/extract-images.ts:1`
- `scripts/generate-stories.test.ts:1`
- `scripts/generate-stories.ts:1`
- `scripts/map-story-images.ts:1`
- `scripts/process-pdfs.test.ts:1`
- `scripts/process-pdfs.ts:1`
- `scripts/seed-cycling-stories.ts:1`
- `scripts/seed-database.test.ts:1`
- `scripts/seed-database.ts:1`
- `scripts/seed-images.test.ts:1`
- `scripts/seed-images.ts:1`
- `src/app/api/admin/stories/[id]/content-images/route.test.ts:1`
- `src/app/api/admin/stories/[id]/content-images/route.ts:1`
- `src/app/api/admin/stories/[id]/route.test.ts:1`
- `src/app/api/admin/stories/[id]/route.ts:1`
- `src/app/api/admin/stories/route.test.ts:1`
- `src/app/api/admin/stories/route.ts:1`
- `src/app/api/booking/chat/stream/route.test.ts:1`
- `src/app/api/chat/stream/route.test.ts:1`
- `src/app/api/stories/route.test.ts:1`
- `src/app/favorites/page.test.tsx:1`
- `src/app/immersive/immersive-page-content.test.tsx:1`
- `src/app/immersive/page.test.tsx:1`
- `src/app/story/[slug]/opengraph-image.test.tsx:1`
- `src/app/story/[slug]/page.test.tsx:1`
- `src/components/admin/create-story-dialog.test.tsx:1`
- `src/components/admin/create-story-dialog.tsx:1`
- `src/components/admin/image-editor-dialog.test.tsx:1`
- `src/components/admin/image-editor-dialog.tsx:1`
- `src/components/admin/story-editor-dialog/details-tab.test.tsx:1`
- `src/components/admin/story-editor-dialog/details-tab.tsx:1`
- `src/components/admin/story-editor-dialog/image-tab.test.tsx:1`
- `src/components/admin/story-editor-dialog/image-tab.tsx:1`
- `src/components/admin/story-editor-dialog/index.tsx:1`
- `src/components/admin/story-editor-dialog/story-editor-dialog.test.tsx:1`
- `src/components/admin/story-editor-dialog/story-editor-fullscreen.test.tsx:1`
- `src/components/admin/story-editor-dialog/use-image-editor.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-save.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-save.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-state.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-state.ts:1`
- `src/components/immersive/accessibility.test.tsx:1`
- `src/components/immersive/question-prompts.test.tsx:1`
- `src/components/immersive/related-stories.test.tsx:1`
- `src/components/immersive/share-button.test.tsx:1`
- `src/components/immersive/story-info-panel.test.tsx:1`
- `src/components/immersive/story-viewer.test.tsx:1`
- `src/components/immersive/ux-fixes.test.tsx:1`
- `src/components/immersive/voice-chat-elevenlabs.test.tsx:1`
- `src/components/immersive/voice-chat.test.tsx:1`
- `src/components/immersive/voice-chat.tsx:1`
- `src/components/immersive/voice-chat/chat-message-list.test.tsx:1`
- `src/components/immersive/voice-chat/chat-message-list.tsx:1`
- `src/components/seo/json-ld.test.tsx:1`
- `src/hooks/use-share-story.test.ts:1`
- `src/hooks/use-stories.cache-hit.test.ts:1`
- `src/hooks/use-stories.hydration.test.ts:1`
- `src/hooks/use-stories.provider.test.tsx:1`
- `src/hooks/use-stories.test.ts:1`
- `src/hooks/use-story-filters.test.ts:1`
- `src/hooks/use-stream-chat.test.ts:1`
- `src/lib/claude.test.ts:1`
- `src/lib/claude.ts:1`
- `src/lib/content-discovery.test.ts:1`
- `src/lib/content-discovery.ts:1`
- `src/lib/embedding-cache.test.ts:1`
- `src/lib/fallback-stories-fixture.test.ts:1`
- `src/lib/localize-story.test.ts:1`
- `src/lib/match-chunks.postgrest-rls.test.ts:1`
- `src/lib/mood-mapping.test.ts:1`
- `src/lib/related-stories.test.ts:1`
- `src/lib/rerank.test.ts:1`
- `src/lib/schemas.ts:1`
- `src/lib/search.test.ts:1`
- `src/lib/search.ts:1`
- `src/lib/seasonal-weighting.test.ts:1`
- `src/lib/stories-data.ssr.test.ts:1`
- `src/lib/stories-data.test.ts:1`
- `src/lib/stories-data.ts:1`
- `src/lib/stories-server.test.ts:1`
- `src/types/admin.test.ts:1`
- `src/types/admin.ts:1`
- `src/types/immersive.test.ts:1`
- `src/types/immersive.ts:1`
- `src/types/index.test.ts:1`
- `src/types/index.ts:1`
- `src/types/sse.test.ts:1`

## image: Phase 12

All image writers/renderers/fixtures; public and storage assets additionally require manifest inventory.

Search: `rg -l "story-image-mappings|image_source|imageSource|images/stories" src scripts e2e content --glob "!content/processed/**" --glob "!content/pdfs/**" --glob "!content/images/**" --glob "!*.svg"`. 56 matching paths.

- `content/fallback-stories.json:1`
- `content/story-image-mappings.json:1`
- `e2e/fixtures/mock-data.ts:1`
- `scripts/compress-images.ts:1`
- `scripts/map-story-images.ts:1`
- `scripts/seed-cycling-stories.ts:1`
- `scripts/seed-database.test.ts:1`
- `scripts/seed-database.ts:1`
- `src/app/api/admin/stories/[id]/image-source/route.test.ts:1`
- `src/app/api/admin/stories/[id]/image-source/route.ts:1`
- `src/app/api/admin/stories/[id]/image/route.test.ts:1`
- `src/app/api/admin/stories/[id]/image/route.ts:1`
- `src/app/immersive/layout.tsx:1`
- `src/app/layout.tsx:1`
- `src/app/story/[slug]/opengraph-image.test.tsx:1`
- `src/components/admin/image-editor-dialog.test.tsx:1`
- `src/components/admin/image-editor-dialog.tsx:1`
- `src/components/admin/story-card.test.tsx:1`
- `src/components/admin/story-editor-dialog/image-editor-context.test.tsx:1`
- `src/components/admin/story-editor-dialog/image-tab.test.tsx:1`
- `src/components/admin/story-editor-dialog/image-tab.tsx:1`
- `src/components/admin/story-editor-dialog/index.tsx:1`
- `src/components/admin/story-editor-dialog/story-editor-dialog.test.tsx:1`
- `src/components/admin/story-editor-dialog/story-editor-fullscreen.test.tsx:1`
- `src/components/admin/story-editor-dialog/use-image-editor.test.ts:1`
- `src/components/admin/story-editor-dialog/use-image-editor.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-save.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-save.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-state.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-state.ts:1`
- `src/components/immersive/story-info-panel.test.tsx:1`
- `src/components/immersive/story-info-panel.tsx:1`
- `src/components/immersive/story-viewer.test.tsx:1`
- `src/components/seo/json-ld.test.tsx:1`
- `src/lib/admin-api.test.ts:1`
- `src/lib/admin-api/stories.test.ts:1`
- `src/lib/admin-api/stories.ts:1`
- `src/lib/content-discovery.test.ts:1`
- `src/lib/content-discovery.ts:1`
- `src/lib/i18n/ast.ts:1`
- `src/lib/i18n/de.ts:1`
- `src/lib/i18n/en.ts:1`
- `src/lib/i18n/es.ts:1`
- `src/lib/i18n/fr.ts:1`
- `src/lib/i18n/pt.ts:1`
- `src/lib/stories-data.test.ts:1`
- `src/lib/stories-data.ts:1`
- `src/lib/stories-server.test.ts:1`
- `src/lib/unsplash-placeholders.test.ts:1`
- `src/lib/unsplash-placeholders.ts:1`
- `src/proxy.test.ts:1`
- `src/types/admin.test.ts:1`
- `src/types/admin.ts:1`
- `src/types/immersive.test.ts:1`
- `src/types/immersive.ts:1`
- `src/types/marketing.test.ts:1`

## cache-consumer: Phase 9

All hook/context/provider callers and fixture writers; server seeds remain compatible, private scope is mandatory.

Search: `rg -n 'useStories|StoriesProvider|useFeatureFlags|FeatureFlagsProvider|useFavorites|useVoiceAccess|AnalyticsCacheProvider|useAnalyticsData|paisaxe_favorites|paisaxe-stories-cache' src e2e scripts`. 61 matching paths.

- `e2e/favorites-real.spec.ts:1`
- `e2e/qa-journey.spec.ts:1`
- `e2e/voice-agents.spec.ts:1`
- `src/app/favorites/layout.tsx:1`
- `src/app/favorites/page.anon.test.tsx:1`
- `src/app/favorites/page.test.tsx:1`
- `src/app/favorites/page.tsx:1`
- `src/app/immersive/immersive-flags-context.fe-h1.test.tsx:1`
- `src/app/immersive/immersive-page-content.test.tsx:1`
- `src/app/immersive/immersive-page-content.tsx:1`
- `src/app/immersive/page.test.tsx:1`
- `src/app/pricing/checkout/return/page.test.tsx:1`
- `src/app/pricing/checkout/return/page.tsx:1`
- `src/app/pricing/page.test.tsx:1`
- `src/app/pricing/page.tsx:1`
- `src/app/providers.test.tsx:1`
- `src/app/providers.tsx:1`
- `src/components/admin/a11y-heading-focus.test.tsx:1`
- `src/components/admin/agents-dashboard/index.tsx:1`
- `src/components/admin/analytics-cache-context.test.tsx:1`
- `src/components/admin/analytics-cache-context.tsx:1`
- `src/components/admin/analytics-dashboard.test.tsx:1`
- `src/components/admin/analytics-dashboard.tsx:1`
- `src/components/admin/costs-analytics-panel.test.tsx:1`
- `src/components/admin/costs-analytics-panel/costs-analytics-panel.test.tsx:1`
- `src/components/admin/costs-analytics-panel/index.tsx:1`
- `src/components/admin/date-input-focus.test.tsx:1`
- `src/components/admin/elevenlabs-analytics-panel.test.tsx:1`
- `src/components/admin/elevenlabs-analytics-panel.tsx:1`
- `src/components/admin/github-analytics-panel.test.tsx:1`
- `src/components/admin/github-analytics-panel.tsx:1`
- `src/components/admin/stripe-analytics-panel/index.tsx:1`
- `src/components/admin/stripe-analytics-panel/stripe-analytics-panel.test.tsx:1`
- `src/components/admin/visitors-analytics-panel/index.tsx:1`
- `src/components/admin/visitors-analytics-panel/visitors-analytics-panel.test.tsx:1`
- `src/components/immersive/accessibility.test.tsx:1`
- `src/components/immersive/story-viewer.test.tsx:1`
- `src/components/immersive/story-viewer.tsx:1`
- `src/components/immersive/suggest-place-button.test.tsx:1`
- `src/components/immersive/suggest-place-button.tsx:1`
- `src/components/immersive/suggest-place-button.ux-h1.test.tsx:1`
- `src/components/immersive/ux-fixes.test.tsx:1`
- `src/components/immersive/voice-chat.test.tsx:1`
- `src/components/immersive/voice-chat.tsx:1`
- `src/hooks/use-favorites.anonymous.test.ts:1`
- `src/hooks/use-favorites.test.ts:1`
- `src/hooks/use-favorites.ts:1`
- `src/hooks/use-feature-flags-integration.test.ts:1`
- `src/hooks/use-feature-flags.provider.test.tsx:1`
- `src/hooks/use-feature-flags.test.ts:1`
- `src/hooks/use-feature-flags.ts:1`
- `src/hooks/use-stories.cache-hit.test.ts:1`
- `src/hooks/use-stories.hydration.test.ts:1`
- `src/hooks/use-stories.provider.test.tsx:1`
- `src/hooks/use-stories.test.ts:1`
- `src/hooks/use-stories.ts:1`
- `src/hooks/use-visitor-voice-access.test.ts:1`
- `src/hooks/use-visitor-voice-access.ts:1`
- `src/hooks/use-voice-access.test.ts:1`
- `src/hooks/use-voice-access.ts:1`
- `src/lib/feature-flags-server.ts:1`

## keyboard_timer-consumer: Phase 6

All matched callers/tests; bookmark timer and pricing/progress are additionally explicitly owned. Other timer domains are excluded below.

Search: `rg -n 'useStoryKeyboardNav|useShareStory|undoTimeoutRef|handleTabKeyDown|handlePageKeyDown' src e2e scripts`. 9 matching paths.

- `src/app/favorites/page.tsx:1`
- `src/components/immersive/share-button.test.tsx:1`
- `src/components/immersive/share-button.tsx:1`
- `src/components/immersive/story-viewer.test.tsx:1`
- `src/components/immersive/story-viewer.tsx:1`
- `src/hooks/use-share-story.test.ts:1`
- `src/hooks/use-share-story.ts:1`
- `src/hooks/use-story-keyboard-nav.test.ts:1`
- `src/hooks/use-story-keyboard-nav.ts:1`

## i18n-consumer: Phase 7

All interpolation/locale/story/admin writer callers and fixtures; non-interpolation replacements are excluded.

Search: `rg -n 'replace\("\{|paisaxe-locale|initialLocale|question_prompts|asturianu_touches|SUPPORTED_LOCALES' src e2e scripts`. 51 matching paths.

- `e2e/fixtures/mock-data.ts:1`
- `e2e/pre-launch.spec.ts:1`
- `scripts/verification-config.test.ts:1`
- `src/app/about/about-page.test.tsx:1`
- `src/app/admin/error.test.tsx:1`
- `src/app/api/chat/stream/route.test.ts:1`
- `src/app/api/chat/stream/route.ts:1`
- `src/app/booking/[capability]/booking-status.tsx:1`
- `src/app/error.test.tsx:1`
- `src/app/favorites/error.test.tsx:1`
- `src/app/immersive/error.test.tsx:1`
- `src/app/immersive/loading.test.tsx:1`
- `src/app/not-found.test.tsx:1`
- `src/app/pricing/page.tsx:1`
- `src/app/privacy/page.test.tsx:1`
- `src/app/terms/page.test.tsx:1`
- `src/components/a11y/skip-link.test.tsx:1`
- `src/components/admin/feature-toggles-panel.tsx:1`
- `src/components/admin/story-editor-dialog/use-story-editor-save.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-save.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-state.test.ts:1`
- `src/components/admin/story-editor-dialog/use-story-editor-state.ts:1`
- `src/components/booking/cancellation-confirm.tsx:1`
- `src/components/immersive/question-prompts.test.tsx:1`
- `src/components/immersive/question-prompts.tsx:1`
- `src/components/immersive/skeleton-chat-message.test.tsx:1`
- `src/components/immersive/skeleton-story-card.test.tsx:1`
- `src/components/immersive/story-info-panel.tsx:1`
- `src/components/immersive/story-progress-bar.tsx:1`
- `src/components/immersive/story-viewer.test.tsx:1`
- `src/components/immersive/story-viewer.tsx:1`
- `src/components/immersive/voice-chat-elevenlabs.tsx:1`
- `src/components/immersive/voice-chat.tsx:1`
- `src/components/immersive/voice-chat/booking-cards.tsx:1`
- `src/components/seo/json-ld.test.tsx:1`
- `src/components/ui/component-error-boundary.test.tsx:1`
- `src/hooks/use-feature-flags-integration.test.ts:1`
- `src/hooks/use-stories.test.ts:1`
- `src/lib/asturianu.ts:1`
- `src/lib/booking/agent.ts:1`
- `src/lib/i18n/detect-language.test.ts:1`
- `src/lib/i18n/detect-language.ts:1`
- `src/lib/i18n/provider.initiallocale.test.tsx:1`
- `src/lib/i18n/provider.test.tsx:1`
- `src/lib/i18n/provider.tsx:1`
- `src/lib/localize-story.test.ts:1`
- `src/lib/stories-data.test.ts:1`
- `src/lib/stories-server.test.ts:1`
- `src/types/feature-flags.ts:1`
- `src/types/immersive.test.ts:1`
- `src/types/immersive.ts:1`

## admin_auth-consumer: Phase 10

All direct-validator routes/tests; already compliant wrappers are regression consumers.

Search: `rg -n 'validateAdminAuth|withAdminRead|withAdmin' src/app/api/admin src/lib/admin-auth.ts`. 63 matching paths.

- `src/app/api/admin/agent-config/route.test.ts:1`
- `src/app/api/admin/agent-config/route.ts:1`
- `src/app/api/admin/agent-reports/route.test.ts:1`
- `src/app/api/admin/agent-reports/route.ts:1`
- `src/app/api/admin/agents-summary/route.test.ts:1`
- `src/app/api/admin/agents-summary/route.ts:1`
- `src/app/api/admin/agents/run/route.test.ts:1`
- `src/app/api/admin/agents/run/route.ts:1`
- `src/app/api/admin/analytics/route.test.ts:1`
- `src/app/api/admin/analytics/route.ts:1`
- `src/app/api/admin/costs-analytics/[id]/route.test.ts:1`
- `src/app/api/admin/costs-analytics/[id]/route.ts:1`
- `src/app/api/admin/costs-analytics/route.test.ts:1`
- `src/app/api/admin/costs-analytics/route.ts:1`
- `src/app/api/admin/elevenlabs-analytics/route.test.ts:1`
- `src/app/api/admin/elevenlabs-analytics/route.ts:1`
- `src/app/api/admin/feature-flags/[key]/route.test.ts:1`
- `src/app/api/admin/feature-flags/[key]/route.ts:1`
- `src/app/api/admin/github-analytics/route.test.ts:1`
- `src/app/api/admin/github-analytics/route.ts:1`
- `src/app/api/admin/marketing/accounts/route.test.ts:1`
- `src/app/api/admin/marketing/accounts/route.ts:1`
- `src/app/api/admin/marketing/agent-logs/route.test.ts:1`
- `src/app/api/admin/marketing/agent-logs/route.ts:1`
- `src/app/api/admin/marketing/agent/route.test.ts:1`
- `src/app/api/admin/marketing/agent/route.ts:1`
- `src/app/api/admin/marketing/dashboard/route.test.ts:1`
- `src/app/api/admin/marketing/dashboard/route.ts:1`
- `src/app/api/admin/marketing/posts/route.test.ts:1`
- `src/app/api/admin/marketing/posts/route.ts:1`
- `src/app/api/admin/marketing/schedule/route.test.ts:1`
- `src/app/api/admin/marketing/schedule/route.ts:1`
- `src/app/api/admin/stories/[id]/content-images/route.test.ts:1`
- `src/app/api/admin/stories/[id]/content-images/route.ts:1`
- `src/app/api/admin/stories/[id]/image-source/route.test.ts:1`
- `src/app/api/admin/stories/[id]/image-source/route.ts:1`
- `src/app/api/admin/stories/[id]/image/route.test.ts:1`
- `src/app/api/admin/stories/[id]/image/route.ts:1`
- `src/app/api/admin/stories/[id]/route.test.ts:1`
- `src/app/api/admin/stories/[id]/route.ts:1`
- `src/app/api/admin/stories/[id]/status/route.test.ts:1`
- `src/app/api/admin/stories/[id]/status/route.ts:1`
- `src/app/api/admin/stories/[id]/translations/route.test.ts:1`
- `src/app/api/admin/stories/[id]/translations/route.ts:1`
- `src/app/api/admin/stories/approve-all/route.test.ts:1`
- `src/app/api/admin/stories/approve-all/route.ts:1`
- `src/app/api/admin/stories/bulk-delete/route.test.ts:1`
- `src/app/api/admin/stories/bulk-delete/route.ts:1`
- `src/app/api/admin/stories/bulk-status/route.test.ts:1`
- `src/app/api/admin/stories/bulk-status/route.ts:1`
- `src/app/api/admin/stories/route.test.ts:1`
- `src/app/api/admin/stories/route.ts:1`
- `src/app/api/admin/stripe-analytics/route.test.ts:1`
- `src/app/api/admin/stripe-analytics/route.ts:1`
- `src/app/api/admin/suggestions/[id]/route.test.ts:1`
- `src/app/api/admin/suggestions/[id]/route.ts:1`
- `src/app/api/admin/suggestions/route.test.ts:1`
- `src/app/api/admin/suggestions/route.ts:1`
- `src/app/api/admin/tunnel/route.test.ts:1`
- `src/app/api/admin/tunnel/route.ts:1`
- `src/app/api/admin/voice-session/route.test.ts:1`
- `src/app/api/admin/voice-session/route.ts:1`
- `src/lib/admin-auth.ts:1`

## sentry-consumer: Phase 8

Five client boundaries/loader/tests covered; server cron/webhook/instrumentation retain server SDK imports.

Search: `rg -n '@sentry/nextjs|loadSentryIfConfigured|initSentryClient' src`. 19 matching paths.

- `src/app/admin/error.test.tsx:1`
- `src/app/admin/error.tsx:1`
- `src/app/api/cron/elevenlabs-voice-canary/route.test.ts:1`
- `src/app/api/cron/elevenlabs-voice-canary/route.ts:1`
- `src/app/api/webhooks/stripe/route.test.ts:1`
- `src/app/api/webhooks/stripe/route.ts:1`
- `src/app/error.test.tsx:1`
- `src/app/error.tsx:1`
- `src/app/favorites/error.test.tsx:1`
- `src/app/favorites/error.tsx:1`
- `src/app/global-error.test.tsx:1`
- `src/app/global-error.tsx:1`
- `src/app/immersive/error.test.tsx:1`
- `src/app/immersive/error.tsx:1`
- `src/instrumentation.test.ts:1`
- `src/instrumentation.ts:1`
- `src/lib/sentry-client-config.test.ts:1`
- `src/lib/sentry-client-init.test.ts:1`
- `src/lib/sentry-client-init.ts:1`

## design-consumer: Phase 6 and 8

Focus/footer in6; palette/config and every matched surface/test in8; no visual rebrand.

Search: `rg -n 'paisaxe-green|bg-background|text-foreground|SiteFooter|from.*ui/card|ThemeProvider' src tailwind.config.ts`. 31 matching paths.

- `src/app/admin/admin-page-lazy-mount.test.tsx:1`
- `src/app/admin/admin-page-suspense.test.tsx:1`
- `src/app/admin/page.test.tsx:1`
- `src/app/admin/page.tsx:1`
- `src/app/base.css:1`
- `src/app/layout.test.tsx:1`
- `src/app/layout.tsx:1`
- `src/app/operator/[capability]/operator-dashboard.tsx:1`
- `src/app/pricing/checkout/page.tsx:1`
- `src/app/pricing/checkout/return/page.test.tsx:1`
- `src/app/pricing/checkout/return/page.tsx:1`
- `src/app/pricing/loading.tsx:1`
- `src/app/pricing/page.test.tsx:1`
- `src/app/pricing/page.tsx:1`
- `src/components/admin/theme-provider.test.tsx:1`
- `src/components/admin/theme-provider.tsx:1`
- `src/components/immersive/chat-upsell-cta.test.tsx:1`
- `src/components/immersive/chat-upsell-cta.tsx:1`
- `src/components/immersive/voice-chat/chat-header.tsx:1`
- `src/components/premium/voice-purchase-cta.test.tsx:1`
- `src/components/premium/voice-purchase-cta.tsx:1`
- `src/components/site-footer.test.tsx:1`
- `src/components/site-footer.tsx:1`
- `src/components/ui/button.tsx:1`
- `src/components/ui/dialog.tsx:1`
- `src/components/ui/input.tsx:1`
- `src/components/ui/select.tsx:1`
- `src/components/ui/textarea.tsx:1`
- `src/lib/brand-colors.test.ts:1`
- `src/lib/pricing.ts:1`
- `tailwind.config.ts:1`

## Server auth: Phase 2

Server helper/all callers and mocks; browser same-name callback is a different-symbol exclusion.

Search: `rg -l 'getSupabaseClient\(' src scripts e2e`. 10 matching paths.

- `src/app/api/checkout/embedded/route.ts:1`
- `src/app/api/favorites/route.ts:1`
- `src/app/api/suggestions/route.ts:1`
- `src/app/api/voice-access/route.test.ts:1`
- `src/app/api/voice-access/route.ts:1`
- `src/app/api/voice-session/route.test.ts:1`
- `src/app/api/voice-session/route.ts:1`
- `src/components/auth/auth-provider.tsx:1`
- `src/lib/supabase-auth.test.ts:1`
- `src/lib/supabase-auth.ts:1`

## Rate limits: Phase 2

All limits and health probe consumers/mocks; preserve live probe contract.

Search: `rg -l 'getRateLimitBackendStatus|isRateLimitDegraded|probeRateLimitBackend|normalizeIpForRateLimit|checkRateLimit' src scripts e2e`. 29 matching paths.

- `src/app/api/booking/chat/stream/route.test.ts:1`
- `src/app/api/booking/chat/stream/route.ts:1`
- `src/app/api/booking/quotes/[id]/accept/route.test.ts:1`
- `src/app/api/booking/quotes/[id]/accept/route.ts:1`
- `src/app/api/booking/voucher/redeem/route.test.ts:1`
- `src/app/api/booking/voucher/redeem/route.ts:1`
- `src/app/api/chat/stream/route.test.ts:1`
- `src/app/api/chat/stream/route.ts:1`
- `src/app/api/health/route.docs-consistency.test.ts:1`
- `src/app/api/health/route.test.ts:1`
- `src/app/api/health/route.ts:1`
- `src/app/api/mcp/make-booking/route.test.ts:1`
- `src/app/api/mcp/make-booking/route.ts:1`
- `src/app/api/mcp/places/route.test.ts:1`
- `src/app/api/mcp/places/route.ts:1`
- `src/app/api/mcp/weather/route.test.ts:1`
- `src/app/api/mcp/weather/route.ts:1`
- `src/app/api/suggestions/route.test.ts:1`
- `src/app/api/suggestions/route.ts:1`
- `src/app/api/voice-session/route.test.ts:1`
- `src/app/api/voice-session/route.ts:1`
- `src/app/api/webhooks/paypal/route.test.ts:1`
- `src/app/api/webhooks/paypal/route.ts:1`
- `src/lib/booking/operator.test.ts:1`
- `src/lib/booking/view.ts:1`
- `src/lib/rate-limit.test.ts:1`
- `src/lib/rate-limit.ts:1`
- `src/lib/services/booking-service.ts:1`
- `src/test/booking-capability-route.ts:1`

## Retrieval and timers: Phase 5

Both chat routes and all related fixtures/tests; unrelated same-name search symbols are inspected and excluded from replacement.

Search: `rg -l '\bsearch\(|searchChunks\(|rerankChunks\(|SearchResultCache|withChatStreamStageTiming|isChatStreamStageTimeout|CHAT_STREAM_STAGE_TIMEOUTS_MS' src scripts e2e`. 11 matching paths.

- `src/app/api/booking/chat/stream/route.ts:1`
- `src/app/api/chat/stream/route.test.ts:1`
- `src/app/api/chat/stream/route.ts:1`
- `src/lib/chat-stream-timeouts.test.ts:1`
- `src/lib/chat-stream-timeouts.ts:1`
- `src/lib/embedding-cache.test.ts:1`
- `src/lib/embedding-cache.ts:1`
- `src/lib/rerank.test.ts:1`
- `src/lib/rerank.ts:1`
- `src/lib/search.test.ts:1`
- `src/lib/search.ts:1`

## Public feature flags: Phase 3

All public and privileged consumers/writers/fixtures; private backend/admin config stays functional.

Search: `rg -l 'feature_flags_public|feature_flags' src scripts e2e supabase`. 59 matching paths.

- `e2e/fixtures/booking-local.ts:1`
- `scripts/booking/postman-local.ts:1`
- `scripts/check-migrations.ts:1`
- `src/app/api/admin/feature-flags/[key]/route.test.ts:1`
- `src/app/api/admin/feature-flags/[key]/route.ts:1`
- `src/app/api/feature-flags/route.postgrest-rls.test.ts:1`
- `src/app/api/feature-flags/route.test.ts:1`
- `src/app/api/feature-flags/route.ts:1`
- `src/app/api/health/db/route.ts:1`
- `src/app/api/webhooks/supabase/route.test.ts:1`
- `src/app/api/webhooks/supabase/route.ts:1`
- `src/app/coming-soon/page.tsx:1`
- `src/config/agent-prompts.ts:1`
- `src/hooks/use-feature-flags-integration.test.ts:1`
- `src/lib/booking/booking.postgrest-integration.test.ts:1`
- `src/lib/feature-flags-server.ts:1`
- `src/lib/proxy/maintenance.postgrest-integration.test.ts:1`
- `src/lib/proxy/maintenance.ts:1`
- `src/types/agent-config.ts:1`
- `supabase/migrations/008_feature_flags.sql:1`
- `supabase/migrations/013_database_webhooks.sql:1`
- `supabase/migrations/015_security_advisor_fixes.sql:1`
- `supabase/migrations/020_autoplay_button_flag.sql:1`
- `supabase/migrations/022_visitor_voice_feature.sql:1`
- `supabase/migrations/026_maintenance_mode_flag.sql:1`
- `supabase/migrations/028_story_suggestions.sql:1`
- `supabase/migrations/030_environment_feature_flags.sql:1`
- `supabase/migrations/031_automated_agents_flags.sql:1`
- `supabase/migrations/032_agent_default_configs.sql:1`
- `supabase/migrations/033_maintenance_mode_config.sql:1`
- `supabase/migrations/034_agent_output_paths.sql:1`
- `supabase/migrations/035_qa_agent_flag.sql:1`
- `supabase/migrations/036_docs_freshness_autonomous.sql:1`
- `supabase/migrations/037_performance_agent_analysis.sql:1`
- `supabase/migrations/038_security_agent_analysis.sql:1`
- `supabase/migrations/039_qa_agent_analysis.sql:1`
- `supabase/migrations/041_localization_agent_flag.sql:1`
- `supabase/migrations/042_fullscreen_button_flag.sql:1`
- `supabase/migrations/043_coverage_agent_typecheck.sql:1`
- `supabase/migrations/044_localization_agent_asturian.sql:1`
- `supabase/migrations/046_qa_agent_enhanced_config.sql:1`
- `supabase/migrations/048_rename_docs_freshness_to_documentation_agent.sql:1`
- `supabase/migrations/051_add_foreign_key_indexes.sql:1`
- `supabase/migrations/052_booking_feature_flag.sql:1`
- `supabase/migrations/054_sms_confirmation_flag.sql:1`
- `supabase/migrations/059_anonymous_suggestions.sql:1`
- `supabase/migrations/060_cost_analyst_agent_flag.sql:1`
- `supabase/migrations/063_content_discovery_agent.sql:1`
- `supabase/migrations/064_subscription_optimizer_flag.sql:1`
- `supabase/migrations/065_subscription_optimizer_dev_flag.sql:1`
- `supabase/migrations/068_remove_agent_flags_from_db.sql:1`
- `supabase/migrations/069_fix_anon_table_grants.sql:1`
- `supabase/migrations/071_fix_rls_linter_warnings.sql:1`
- `supabase/migrations/073_cleanup_unused_indexes.sql:1`
- `supabase/migrations/074_grant_user_profiles_authenticated.sql:1`
- `supabase/migrations/075_grant_missing_table_permissions.sql:1`
- `supabase/migrations/101_restrict_feature_flags_config_anon.sql:1`
- `supabase/migrations/103_revoke_anon_default_privileges.sql:1`
- `supabase/migrations/117_feature_flag_experience_booking.sql:1`

## Entitlements: Phase 4

All grants/access/session/health/fixture cleanup; non-Stripe vouchers excluded from revocation with coexistence tests.

Search: `rg -l 'voice_purchases|grant_day_pass_idempotent' src scripts e2e supabase`. 30 matching paths.

- `e2e/stripe-real-checkout.spec.ts:1`
- `e2e/voice-agents.spec.ts:1`
- `src/app/api/health/route.test.ts:1`
- `src/app/api/health/route.ts:1`
- `src/app/api/voice-access/route.test.ts:1`
- `src/app/api/voice-access/route.ts:1`
- `src/app/api/voice-session/route.test.ts:1`
- `src/app/api/voice-session/route.ts:1`
- `src/app/api/webhooks/stripe/route.postgrest-integration.test.ts:1`
- `src/app/api/webhooks/stripe/route.test.ts:1`
- `src/app/api/webhooks/stripe/route.ts:1`
- `src/lib/booking/booking.postgrest-integration.test.ts:1`
- `src/lib/booking/vouchers.postgrest-integration.test.ts:1`
- `src/lib/definer-function-privileges.postgrest-rls.test.ts:1`
- `src/lib/health-timeouts.ts:1`
- `src/test/local-supabase.ts:1`
- `supabase/migrations/040_voice_purchases.sql:1`
- `supabase/migrations/049_rls_performance_optimizations.sql:1`
- `supabase/migrations/055_stripe_payment_provider.sql:1`
- `supabase/migrations/071_fix_rls_linter_warnings.sql:1`
- `supabase/migrations/075_grant_missing_table_permissions.sql:1`
- `supabase/migrations/078_grant_day_pass_idempotent.sql:1`
- `supabase/migrations/084_fix_grant_day_pass_atomicity.sql:1`
- `supabase/migrations/091_revoke_internal_function_access.sql:1`
- `supabase/migrations/092_revoke_internal_function_access_fix.sql:1`
- `supabase/migrations/095_stripe_webhook_audit_shape.sql:1`
- `supabase/migrations/099_grant_day_pass_purchase_type.sql:1`
- `supabase/migrations/110_revoke_definer_function_exec_from_anon.sql:1`
- `supabase/migrations/114_vouchers.sql:1`
- `supabase/migrations/118_voucher_redemption.sql:1`

## Booking retention: Phase 3

All PII/SMS/replay/reconciliation writers and fixtures; preserve payments.phone_call_id link and orphan recovery.

Search: `rg -l 'pending_bookings|booking_sms_jobs|elevenlabs_webhook_events' src scripts e2e supabase`. 33 matching paths.

- `scripts/check-migrations.test.ts:1`
- `scripts/check-migrations.ts:1`
- `src/app/api/cron/fail-stale-bookings/route.ts:1`
- `src/app/api/cron/retry-booking-sms/route.test.ts:1`
- `src/app/api/cron/retry-booking-sms/route.ts:1`
- `src/app/api/mcp/make-booking/route.test.ts:1`
- `src/app/api/mcp/make-booking/route.ts:1`
- `src/app/api/webhooks/elevenlabs/route.phone-confirmation.test.ts:1`
- `src/app/api/webhooks/elevenlabs/route.test.ts:1`
- `src/app/api/webhooks/elevenlabs/route.ts:1`
- `src/lib/booking/phone-config.test.ts:1`
- `src/lib/booking/phone-config.ts:1`
- `src/lib/booking/phone-confirmation.postgrest-integration.test.ts:1`
- `src/lib/booking/phone-confirmation.test.ts:1`
- `src/lib/booking/phone-confirmation.ts:1`
- `src/lib/services/booking-service.ts:1`
- `src/lib/services/elevenlabs-call-service.test.ts:1`
- `src/lib/services/elevenlabs-call-service.ts:1`
- `supabase/migrations/053_pending_bookings.sql:1`
- `supabase/migrations/073_cleanup_unused_indexes.sql:1`
- `supabase/migrations/079_webhook_idempotency_rpcs.sql:1`
- `supabase/migrations/083_sms_outbox_atomic_enqueue.sql:1`
- `supabase/migrations/085_atomic_outcome_message_and_stale_booking_cleanup.sql:1`
- `supabase/migrations/087_restrict_operational_table_access.sql:1`
- `supabase/migrations/088_voice_booking_durability.sql:1`
- `supabase/migrations/090_fix_rls_operational_tables.sql:1`
- `supabase/migrations/100_reconcile_recorded_voice_durability.sql:1`
- `supabase/migrations/103_revoke_anon_default_privileges.sql:1`
- `supabase/migrations/104_translation_queue_attempts_cap.sql:1`
- `supabase/migrations/106_booking_orphaned_reconciliation.sql:1`
- `supabase/migrations/107_pending_bookings_rls_posture.sql:1`
- `supabase/migrations/109_booking_sms_dead_letter.sql:1`
- `supabase/migrations/126_phone_confirmation.sql:1`

## Translation queue and pg_net: Phase 3 and conditional5

Active wakeup repairs in3; all HTTP/admin/manual/cron callers compatible, conditional worker contract in5; applied migrations are evidence only.

Search: `rg -l 'net.http_post|notify_webhook|enqueue_translate_webhook_event|claim_next_translate_webhook_event|complete_translate_webhook_event|fail_translate_webhook_event|translateStory\(|/api/webhooks/translate|fail_stale_story_translations|generateStoryTranslations|approveAllStories|/stories/approve-all' src scripts e2e supabase`. 39 matching paths.

- `e2e/api.spec.ts:1`
- `e2e/webhooks.spec.ts:1`
- `scripts/check-migrations.test.ts:1`
- `src/app/api/admin/stories/[id]/translations/route.ts:1`
- `src/app/api/admin/stories/approve-all/route.test.ts:1`
- `src/app/api/admin/stories/approve-all/route.ts:1`
- `src/app/api/cron/fail-stale-translations/route.test.ts:1`
- `src/app/api/cron/fail-stale-translations/route.ts:1`
- `src/app/api/webhooks/elevenlabs/route.ts:1`
- `src/app/api/webhooks/supabase/route.ts:1`
- `src/app/api/webhooks/translate/route.test.ts:1`
- `src/app/api/webhooks/translate/route.ts:1`
- `src/components/admin/story-translations-tab.test.tsx:1`
- `src/components/admin/story-translations-tab.tsx:1`
- `src/lib/admin-api.test.ts:1`
- `src/lib/admin-api/index.ts:1`
- `src/lib/admin-api/stories.test.ts:1`
- `src/lib/admin-api/stories.ts:1`
- `src/lib/translate-story.test.ts:1`
- `src/lib/translate-story.ts:1`
- `src/lib/webhook-schema-utils.ts:1`
- `supabase/migrations/013_database_webhooks.sql:1`
- `supabase/migrations/014_edge_function_schedules.sql:1`
- `supabase/migrations/015_security_advisor_fixes.sql:1`
- `supabase/migrations/025_webhook_config_table.sql:1`
- `supabase/migrations/047_story_translation_trigger.sql:1`
- `supabase/migrations/050_fix_translation_trigger.sql:1`
- `supabase/migrations/061_github_traffic.sql:1`
- `supabase/migrations/062_fix_github_traffic_cron.sql:1`
- `supabase/migrations/066_restrict_webhook_config_rls.sql:1`
- `supabase/migrations/079_webhook_idempotency_rpcs.sql:1`
- `supabase/migrations/080_fail_stale_translations_support.sql:1`
- `supabase/migrations/081_fail_stale_story_translations_locked.sql:1`
- `supabase/migrations/082_translation_lease_10min.sql:1`
- `supabase/migrations/091_revoke_internal_function_access.sql:1`
- `supabase/migrations/092_revoke_internal_function_access_fix.sql:1`
- `supabase/migrations/104_translation_queue_attempts_cap.sql:1`
- `supabase/migrations/108_restore_notify_webhook_search_path.sql:1`
- `supabase/migrations/110_revoke_definer_function_exec_from_anon.sql:1`

## Local admin operations: Phase 2

Production inert/local development capability and dashboard callers; summary read APIs retained.

Search: `rg -l 'agents/run|/api/admin/tunnel|triggerAgentRun|fetchRunningAgents|fetchAgentLogs|stopAgent' src scripts e2e`. 14 matching paths.

- `e2e/api.spec.ts:1`
- `src/app/api/admin/agents/run/route.test.ts:1`
- `src/app/api/admin/tunnel/route.test.ts:1`
- `src/app/api/admin/tunnel/route.ts:1`
- `src/components/admin/agents-dashboard/use-agent-runner.test.ts:1`
- `src/components/admin/agents-dashboard/use-agent-runner.ts:1`
- `src/components/admin/agents-dashboard/use-agent-terminal.test.ts:1`
- `src/components/admin/agents-dashboard/use-agent-terminal.ts:1`
- `src/components/admin/tunnel-control-panel.test.tsx:1`
- `src/components/admin/tunnel-control-panel.tsx:1`
- `src/lib/admin-api.test.ts:1`
- `src/lib/admin-api/agents.test.ts:1`
- `src/lib/admin-api/agents.ts:1`
- `src/lib/admin-api/index.ts:1`

## Timeout classifier: Phase 5

Three intended duplicates/tests; retain distinct unrelated timeout semantics.

Search: `rg -l 'AbortError|TimeoutError|errorName' src/app/api/admin src/lib/services`. 7 matching paths.

- `src/app/api/admin/costs-analytics/route.test.ts:1`
- `src/app/api/admin/costs-analytics/route.ts:1`
- `src/app/api/admin/elevenlabs-analytics/route.test.ts:1`
- `src/app/api/admin/elevenlabs-analytics/route.ts:1`
- `src/app/api/admin/stories/[id]/image/route.test.ts:1`
- `src/lib/services/elevenlabs-call-service.test.ts:1`
- `src/lib/services/elevenlabs-call-service.ts:1`

## Presentation provider seed: Phase 7

One root provider ownership/seed relocation, all layouts and fixtures; dictionary and user seed belong to same stable instance. No additional provider owner.

Search: `rg -l 'Providers|LanguageProvider|AuthProvider|LangSync|initialLocale' src/app src/components src/lib/i18n e2e`. 31 matching paths.

- `e2e/admin-agents-gating.spec.ts:1`
- `e2e/voice-agents.spec.ts:1`
- `src/app/about/about-page.test.tsx:1`
- `src/app/admin/error.test.tsx:1`
- `src/app/error.test.tsx:1`
- `src/app/favorites/error.test.tsx:1`
- `src/app/immersive/error.test.tsx:1`
- `src/app/immersive/loading.test.tsx:1`
- `src/app/immersive/page.test.tsx:1`
- `src/app/layout.tsx:1`
- `src/app/not-found.test.tsx:1`
- `src/app/privacy/page.test.tsx:1`
- `src/app/providers.test.tsx:1`
- `src/app/providers.tsx:1`
- `src/app/terms/page.test.tsx:1`
- `src/components/a11y/lang-sync.test.tsx:1`
- `src/components/a11y/lang-sync.tsx:1`
- `src/components/a11y/skip-link.test.tsx:1`
- `src/components/auth/auth-provider.memostability.test.tsx:1`
- `src/components/auth/auth-provider.test.tsx:1`
- `src/components/auth/auth-provider.tsx:1`
- `src/components/immersive/accessibility.test.tsx:1`
- `src/components/immersive/skeleton-chat-message.test.tsx:1`
- `src/components/immersive/skeleton-story-card.test.tsx:1`
- `src/components/immersive/story-viewer.test.tsx:1`
- `src/components/ui/component-error-boundary.test.tsx:1`
- `src/lib/i18n/index.ts:1`
- `src/lib/i18n/provider.initiallocale.test.tsx:1`
- `src/lib/i18n/provider.test.tsx:1`
- `src/lib/i18n/provider.tsx:1`
- `src/lib/i18n/use-translation.ts:1`
