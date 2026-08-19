# Testing Guide

> Complete reference for Paisaxe's testing infrastructure.
> Last updated: 2026-05-03

---

## Overview

Paisaxe uses a two-layer testing strategy:

| Layer | Tool | Scope | Files | Tests |
|-------|------|-------|-------|-------|
| **Unit & Component** | Vitest + React Testing Library | Functions, components, hooks, API routes | 353 | 6,496 |
| **End-to-End** | Playwright | Full browser journeys across pages | 18 | 36 (18 desktop + 18 mobile) |

Both layers run in CI on every push and pull request to `develop` and `main`.

---

## Table of Contents

1. [Commands](#commands)
2. [Unit & Component Tests (Vitest)](#unit--component-tests-vitest)
   - [Configuration](#vitest-configuration)
   - [Global Setup](#global-setup)
   - [Test Helpers](#test-helpers)
   - [File Inventory](#unit-test-file-inventory)
   - [Patterns & Conventions](#unit-test-patterns--conventions)
   - [Coverage](#coverage)
3. [End-to-End Tests (Playwright)](#end-to-end-tests-playwright)
   - [Configuration](#playwright-configuration)
   - [Mock Data](#mock-data)
   - [Test Files](#e2e-test-files)
   - [How Mocking Works](#how-e2e-mocking-works)
   - [Patterns & Conventions](#e2e-patterns--conventions)
4. [CI/CD Integration](#cicd-integration)
5. [Pre-Commit Hooks](#pre-commit-hooks)
6. [Architecture Decisions](#architecture-decisions)

---

## Commands

### Unit & Component Tests

```bash
npm run test             # Run all unit tests (headless, exits on completion)
npm run test:watch       # Watch mode — reruns on file changes
npm run test:coverage    # Run with v8 coverage report (text + json + html)
npm run test:ui          # Open Vitest's interactive browser UI
```

### End-to-End Tests

```bash
npm run test:e2e         # Run all E2E tests headless
npm run test:e2e:headed  # Run with visible browser windows
npm run test:e2e:ui      # Open Playwright's interactive UI mode
npm run test:e2e:debug   # Run with Playwright Inspector for step debugging
npm run test:e2e:dev     # Opt into next dev for interactive debugging
```

`npm run test:e2e` now starts a production-style local server (`build` + `start`) on a dedicated Playwright port by default. This avoids both the Next.js dev overlay intercepting pointer events and port collisions with a normal local dev server on `3000`. Use `npm run test:e2e:dev` only when you specifically want a dev server while debugging Playwright.

### Running Specific Tests

```bash
# Vitest — filter by file name
npx vitest run story-viewer         # Runs story-viewer.test.tsx
npx vitest run src/lib/             # Runs all tests in src/lib/

# Playwright — filter by file or grep
npx playwright test smoke           # Runs smoke.spec.ts
npx playwright test --grep "chat"   # Runs tests matching "chat"
npx playwright test --project=mobile # Run only mobile viewport tests
```

---

## Unit & Component Tests (Vitest)

### Vitest Configuration

**File:** `vitest.config.ts`

```
Environment:     jsdom (browser-like DOM for React components)
Globals:         enabled (describe, test, expect available without imports)
Include:         src/**/*.test.{ts,tsx}
Setup:           src/test/setup.ts
Coverage:        v8 provider, reporters: text + json + html
Path alias:      @ → ./src
```

Key detail: the `src/**/*.test.{ts,tsx}` include pattern means E2E files in `e2e/` are never picked up by Vitest. The two test runners are completely isolated.

### Global Setup

**File:** `src/test/setup.ts`

Runs before every test file. Sets up:

| What | Why |
|------|-----|
| `@testing-library/jest-dom/vitest` | DOM matchers like `toBeInTheDocument()`, `toBeVisible()` |
| Environment variables | Dummy values for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY` |
| `scrollIntoView` mock | jsdom doesn't implement it; components call it during navigation |
| `IntersectionObserver` mock | Immediately triggers callback — components using lazy loading work in tests |
| `SpeechRecognition` disabled | Prevents voice chat from attempting browser speech APIs |

### Test Helpers

**File:** `src/test/i18n-mock.ts`

The app uses a custom i18n system. All component tests import `createMockT()` from this helper to avoid setting up the full i18n provider.

```typescript
import { createMockT } from "@/test/i18n-mock";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: createMockT(), locale: "es" }),
}));
```

The helper provides 115+ Spanish translation strings covering all UI areas: common labels, chat interface, story viewer, navigation, favorites, auth, mood discovery, and share features.

### Unit Test File Inventory

**353 files, 6,496 tests** organized by area (representative sample — the inventory below covers the original core files; the full test suite has grown significantly as new features were added):

#### Pages & Layouts (15 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `app/page.test.tsx` | 2 | Root redirect to `/immersive` |
| `app/immersive/page.test.tsx` | — | Story viewer rendering with hooks |
| `app/favorites/page.test.tsx` | 20 | Empty state, gallery grid, pagination, remove action |
| `app/admin/page.test.tsx` | — | Admin login flow, tab switching |
| `app/*/loading.test.tsx` | — | Loading spinners render |
| `app/*/error.test.tsx` | — | Error boundaries display error UI |
| `app/*/layout.test.tsx` | — | Layouts wrap children correctly |

#### API Routes (representative sample)

| File | Tests | What it covers |
|------|-------|----------------|
| `api/chat/route.test.ts` | — | Input validation, embedding generation, Claude response, rate limiting |
| `api/health/route.test.ts` | — | Status JSON, Supabase connectivity, degraded state, DB sub-check |
| `api/health/db/route.test.ts` | — | Database connectivity sub-endpoint |
| `api/favorites/route.test.ts` | — | GET/POST/DELETE with auth, 401 without auth |
| `api/feature-flags/route.test.ts` | — | Flag listing, error handling |
| `api/admin/stories/route.test.ts` | — | Story listing with admin auth |
| `api/admin/stories/[id]/status/route.test.ts` | — | Curation status updates |
| `api/admin/stories/[id]/translations/route.test.ts` | — | Story translation management |
| `api/admin/feature-flags/[key]/route.test.ts` | — | Feature flag toggle |
| `api/admin/costs-analytics/route.test.ts` | — | Platform cost summary |
| `api/admin/stripe-analytics/route.test.ts` | — | Stripe revenue analytics |
| `api/admin/github-analytics/route.test.ts` | — | GitHub traffic data |
| `api/webhooks/stripe/route.test.ts` | — | Stripe webhook idempotency, grant_day_pass_idempotent |
| `api/webhooks/elevenlabs/route.test.ts` | — | Post-call transcript + SMS dispatch |
| `api/mcp/weather/route.test.ts` | — | Weather endpoint for Pelayo |
| `api/mcp/places/route.test.ts` | — | Places search for Pelayo |
| `api/mcp/make-booking/route.test.ts` | — | Booking initiation via ElevenLabs + Twilio |
| `api/checkout/embedded/route.test.ts` | — | Stripe embedded checkout (day/weekly/monthly passes; day-pass's standalone route was removed as dead code, #898) |
| `api/cron/content-discovery/route.test.ts` | — | Content discovery cron |
| `api/cron/fail-stale-translations/route.test.ts` | — | Stale translation cleanup |
| `api/cron/github-traffic-sync/route.test.ts` | — | GitHub traffic sync |
| `auth/callback/route.test.ts` | — | OAuth callback handling |

#### Components (39 files)

**UI primitives** (4): button, card, dialog (18 tests), input — all at 100% coverage.

**Immersive experience** (12):

| File | Tests | What it covers |
|------|-------|----------------|
| `story-viewer.test.tsx` | 22 | Rendering, navigation arrows, keyboard nav, info toggle, autoplay, filters |
| `voice-chat.test.tsx` | — | Chat open/close, message send, privacy notice, speech recognition |
| `story-filters.test.tsx` | 18 | Category/location/duration filters, clear all |
| `related-stories.test.tsx` | 7 | Related story cards, click handling |
| `category-filter-badge.test.tsx` | — | Badge rendering, active state |
| `bookmark-button.test.tsx` | — | Toggle state, click handler |
| `favorite-button.test.tsx` | — | Favorite toggle |
| `language-switcher.test.tsx` | — | ES/EN language toggle |
| `privacy-notice.test.tsx` | — | Show/dismiss, localStorage persistence |
| `share-button.test.tsx` | — | Share modal, copy link |

**Admin** (6): login form, curation badge, image editor dialog (42 tests), placeholder badge, story card, story grid.

**Auth** (3): auth button, auth provider, sign-in prompt.

**SEO** (1): JSON-LD structured data.

#### Hooks (6 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `use-stories.test.ts` | 20 | Fetch from DB, cache TTL, stale-while-revalidate, fallback stories |
| `use-favorites.test.ts` | 18 | localStorage read/write, cloud sync on login, merge logic |
| `use-feature-flags.test.ts` | 7 | API fetch, caching, `isEnabled()` lookup, default to false |
| `use-story-filters.test.ts` | — | Filter application, clear filters |
| `use-analytics.test.ts` | — | Event tracking with feature flag context |
| `use-viewed-stories.test.ts` | — | Session-based viewed story tracking |

#### Libraries & Utilities (representative sample)

| File | Tests | What it covers |
|------|-------|----------------|
| `validation.test.ts` | — | Chat input sanitization, length limits, XSS prevention |
| `i18n/translations.test.ts` | — | All translation keys resolve for all locales |
| `i18n/detect-language.test.ts` | — | Browser language detection, Accept-Language parsing |
| `i18n/resolve.test.ts` | — | Translation key resolution, fallback chains |
| `claude.test.ts` | — | Chat response generation, source extraction |
| `search.test.ts` | — | Vector similarity search, hybrid keyword matching |
| `csrf.test.ts` | — | CSRF token generation, double-submit cookie validation |
| `request-context.test.ts` | — | Request correlation ID propagation |
| `rate-limit.test.ts` | — | Sliding window rate limiting (Upstash Redis + fallback) |
| `admin-auth.test.ts` | — | `withAdmin` and `withAdminRead` HOFs, session cookie validation, timing-safe comparison, LRU role cache TTL |
| `use-sse-stream.test.ts` | — | `readSseStream` buffer parsing, `onEvent` / `onDone` / `onError` callbacks, partial-chunk handling |
| `logger.test.ts` | — | Structured log output, PII sanitization |
| `env.test.ts` | — | Centralized env validation, `.trim()` enforcement |
| `admin-api/*.test.ts` | — | Modular admin API (stories, costs, agents, optimizer, etc.) |
| `shuffle.test.ts` | — | Fisher-Yates shuffle determinism with seeds |
| `seasonal-weighting.test.ts` | — | Season-aware story boosting |
| `mood-mapping.test.ts` | — | Mood-to-category mapping and filtering |
| `freshness.test.ts` | — | Story age calculation for freshness badge |
| `asturianu.test.ts` | — | Asturian language label lookups |
| `utils.test.ts` | — | `cn()` class merging utility |

#### Types & Metadata (5 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `types/index.test.ts` | 12 | Core type guards, type utilities |
| `types/immersive.test.ts` | 13 | Story type, `rowToStory` conversion |
| `types/feature-flags.test.ts` | 4 | Flag types, `rowToFeatureFlag` |
| `app/robots.test.ts` | 3 | robots.txt generation |
| `app/sitemap.test.ts` | 3 | Sitemap XML generation |

### Unit Test Patterns & Conventions

**File placement:** Tests live next to source files, not in a separate directory tree.

```
src/lib/search.ts
src/lib/search.test.ts      ← right next to it

src/app/api/chat/route.ts
src/app/api/chat/route.test.ts
```

**Naming:** `<source-file-name>.test.ts` or `.test.tsx`.

**Structure:** Tests use `describe` blocks grouped by behavior area:

```typescript
describe("ComponentName", () => {
  describe("rendering", () => {
    it("renders the title", () => { ... });
  });
  describe("interactions", () => {
    it("navigates on arrow click", () => { ... });
  });
  describe("error handling", () => {
    it("shows fallback on API failure", () => { ... });
  });
});
```

**Mocking pattern:** Dependencies are mocked at the module level with `vi.mock()`, then individual mocks are configured per test with `vi.mocked()`:

```typescript
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));
```

**Admin route testing (`withAdmin` / `withAdminRead`):** Admin routes are wrapped by HOFs that handle auth. Tests mock both HOFs simultaneously so GET and POST tests work without per-test setup changes:

```typescript
const mockWithAdmin = vi.fn();
const mockWithAdminRead = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  withAdmin: (...args: Parameters<typeof mockWithAdmin>) => mockWithAdmin(...args),
  withAdminRead: (...args: Parameters<typeof mockWithAdminRead>) => mockWithAdminRead(...args),
}));

// Authorize both HOFs to call through with a mock supabase client
beforeEach(() => {
  mockWithAdmin.mockImplementation(async (handler) => handler(mockSupabase));
  mockWithAdminRead.mockImplementation(async (handler) => handler(mockSupabase));
});

// To simulate unauthorized:
mockWithAdmin.mockResolvedValue(new NextResponse(null, { status: 401 }));
mockWithAdminRead.mockResolvedValue(new NextResponse(null, { status: 401 }));
```

**API route testing:** Routes are tested by importing the handler function directly and passing a `NextRequest`:

```typescript
import { POST } from "./route";

const request = new NextRequest("http://localhost:3000/api/chat", {
  method: "POST",
  body: JSON.stringify({ message: "Hello" }),
});
const response = await POST(request);
expect(response.status).toBe(200);
```

### Coverage

**Tool:** v8 (Node.js native coverage instrumentation via `@vitest/coverage-v8`).

**Run:** `npm run test:coverage` — generates a text summary and HTML report in `coverage/`.

**Auto-generated report:** `docs/coverage-report.md` is updated nightly at 2:00 AM CET by `scripts/coverage-agent.sh` (a Claude CLI agent that analyzes coverage and writes a summary).

**Coverage targets:** No hard thresholds are enforced in CI, but the TDD discipline keeps coverage high. See `docs/coverage-report.md` for current numbers per file.

---

## End-to-End Tests (Playwright)

### Playwright Configuration

**File:** `playwright.config.ts`

| Setting | Local | CI |
|---------|-------|----|
| Web server | `npm run dev` (reuses running server) | `npm run start` (fresh build) |
| Retries | 0 | 2 |
| Workers | Auto (parallel) | 1 (serial — single web server) |
| Reporter | HTML | HTML + GitHub annotations |
| Browser | Chromium | Chromium |

**Projects** (two viewports per test):

| Project | Device | Viewport |
|---------|--------|----------|
| `desktop` | Desktop Chrome | 1280 x 720 |
| `mobile` | Pixel 7 | 393 x 851 |

Every test file runs twice — once per project — giving 36 test configurations from 18 spec files.

**Artifacts on failure:**
- Screenshots (PNG)
- Video recordings (WebM)
- Trace files (on first retry, openable in Playwright Trace Viewer)

**Environment variables:** The web server starts with dummy API keys. External services (Supabase, Claude, Voyage AI) are unreachable, and the app falls back to hardcoded data and graceful error states. Tests that need specific API responses use Playwright route interception to mock them.

### Mock Data

**File:** `e2e/fixtures/mock-data.ts`

Provides shared mock responses used by route interception across test files:

| Export | Used by | Purpose |
|--------|---------|---------|
| `MOCK_CHAT_RESPONSE` | `chat.spec.ts` | Simulates a Claude chat response with sources and images |
| `MOCK_FEATURE_FLAGS` | `immersive.spec.ts`, `chat.spec.ts` | All flags disabled — prevents mood overlay and other feature-gated UI from interfering |
| `MOCK_ADMIN_STORIES` | `admin.spec.ts` | Two sample stories for the admin grid |
| `TEST_ADMIN_KEY` | `admin.spec.ts` | Matches the `ADMIN_SECRET_KEY` env var in `playwright.config.ts` |

### E2E Test Files

The E2E suite has grown to 18 spec files. Key specs:

#### `smoke.spec.ts` — App Basics + CSP Canary

| Test | What it verifies |
|------|-----------------|
| `/` redirects to `/immersive` | Server-side redirect works |
| `/immersive` loads successfully | HTTP 200, non-empty page body |
| Non-existent page returns 404 | Next.js 404 handling |
| Health endpoint responds with JSON | `/api/health` returns `status`, `timestamp` |
| CSP canary | JavaScript actually executes (catches CSP misconfigurations) |

#### `immersive.spec.ts` — Story Viewer

Story rendering, navigation arrows, keyboard arrow keys, info overlay toggle.

#### `chat.spec.ts` — Chat Panel

Open/close chat, send message with mocked Claude response, SSE stream handling.

#### `sse-abort.spec.ts` — SSE Stream Abort

Verifies the chat stream is properly aborted and the Claude API call cancelled when the user closes the panel mid-stream.

#### `xss-canary.spec.ts` — XSS Safety

Verifies that `SafeMarkdown` correctly sanitizes malicious payloads — `<script>` tags, `javascript:` links, `onerror` handlers.

#### `checkout.spec.ts` — Stripe Checkout

Embedded Stripe checkout session flow, return URL after payment.

#### `author-pill.spec.ts` — Author Attribution

Author pill typewriter animation renders correctly in the immersive viewer.

#### `pre-launch.spec.ts` — Pre-Launch Smoke

Exercises feature flags, story suggestions, i18n language switching across the full app.

#### `qa-journey.spec.ts` — Authenticated Journey

Full user journey with Google OAuth (test user), favorites sync, voice access gating.

#### `interactive-controls.spec.ts` — Keyboard & Touch

Arrow-key navigation, mobile tap zones, progress bar keyboard interaction.

#### `visual-regression.spec.ts` — Screenshot Baselines

Playwright screenshots of key UI states compared against committed baselines.

#### `stripe-real-checkout.spec.ts` — Stripe Integration (separate workflow)

End-to-end Stripe test mode checkout. Runs in dedicated `e2e-stripe-integration.yml` workflow with real Stripe test credentials.

#### `voice-agents.spec.ts` — Visitor Voice Paywall Gate

The visitor-facing Pelayo voice flow: with no paid voice access, the chat
header renders the upgrade CTA (not the voice-mode toggle) linking to
`/pricing?returnTo=<slug>`. Mocked — does not cover the authenticated
"access granted" path (voice toggle, `POST /api/voice-session`), which
needs a real Supabase session; see #932.

#### `admin-agents-gating.spec.ts` — Admin Voice/Agents Dashboard Gating

Unauthenticated-access gating for two admin-only components: VoiceAgentChat
(the Xander/Iris/Penny marketing agent chat) and AgentsDashboard. Formerly
misfiled under `voice-agents.spec.ts` — see #878.

#### `mcp.spec.ts` — MCP Tool Endpoints

Exercises the MCP tool endpoints (`/api/mcp/places`, `/api/mcp/make-booking`, `/api/mcp/weather`) used by the ElevenLabs voice agent.

#### Other specs

`admin.spec.ts`, `favorites.spec.ts`, `api.spec.ts`, `suggestions.spec.ts` — cover admin dashboard login, favorites page, API smoke tests, and place suggestions respectively.

### How E2E Mocking Works

The app is designed to degrade gracefully when external services are unavailable:

1. **Stories:** When Supabase is unreachable, `getStoriesFromDB()` returns `FALLBACK_STORIES` — 10+ hardcoded stories with local images. The immersive viewer works normally.

2. **Feature flags:** When the API fails, `useFeatureFlags` returns all flags as `false`. This disables mood overlay, surprise button, related stories, etc. Tests that need consistent behavior mock the flags API to ensure this.

3. **Chat:** The chat API requires Voyage AI + Claude, which are not available in test. Tests mock the `/api/chat` endpoint via Playwright route interception to return a canned response.

4. **Admin:** Admin auth is validated server-side against `ADMIN_SECRET_KEY`. The test config sets this to `test-admin-key-12345`. Tests mock the `/api/admin/stories` endpoint to simulate successful and failed auth.

5. **Favorites:** Uses localStorage as the primary store when the user is not authenticated. No mocking needed — the browser starts with clean localStorage each test.

### E2E Patterns & Conventions

**File placement:** All E2E files live in `e2e/` at the project root, separate from `src/`.

```
e2e/
├── fixtures/
│   └── mock-data.ts          # Shared mock responses
├── smoke.spec.ts             # App basics + CSP canary
├── immersive.spec.ts         # Story viewer
├── chat.spec.ts              # Chat panel
├── sse-abort.spec.ts         # SSE stream abort
├── xss-canary.spec.ts        # XSS safety validation
├── checkout.spec.ts          # Stripe embedded checkout
├── author-pill.spec.ts       # Author attribution
├── pre-launch.spec.ts        # Feature flags + i18n smoke
├── qa-journey.spec.ts        # Authenticated user journey
├── interactive-controls.spec.ts  # Keyboard + touch
├── mcp.spec.ts               # MCP tool endpoints
├── visual-regression.spec.ts # Screenshot baselines
├── voice-agents.spec.ts      # Visitor voice paywall gate (Pelayo)
├── admin-agents-gating.spec.ts   # Admin VoiceAgentChat/AgentsDashboard gating
├── stripe-real-checkout.spec.ts  # Stripe test mode (separate CI)
├── admin.spec.ts
├── favorites.spec.ts
├── api.spec.ts
├── suggestions.spec.ts
└── tsconfig.json             # Isolated from app TypeScript
```

**Naming:** `<feature>.spec.ts` (Playwright convention, distinct from Vitest's `.test.ts`).

**TypeScript isolation:** `e2e/tsconfig.json` is a standalone config. The main `tsconfig.json` excludes `e2e/` so Playwright types don't leak into the Next.js build.

**Route interception pattern:**

```typescript
// In beforeEach — mock before navigating
await page.route("**/api/feature-flags", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(MOCK_FEATURE_FLAGS),
  })
);
await page.goto("/immersive");
```

**Selector strategy:** Tests prefer semantic selectors over CSS class selectors:

```typescript
// Prefer role/text selectors
page.getByRole("button", { name: /continue/i })
page.getByText("Paisaxe Admin")

// Use structural selectors when semantic ones aren't unique
page.locator("button").filter({ has: page.locator("svg.lucide-chevron-right") })
page.locator("header").locator('a[href="/immersive"]')
```

**Mobile considerations:** Some UI elements are hidden on mobile (e.g., "Logout" text is `hidden sm:inline`). Tests that check these use icon-based selectors that work across viewports:

```typescript
// Works on both desktop (text visible) and mobile (icon only)
const logoutButton = page.locator("button").filter({
  has: page.locator("svg.lucide-log-out"),
});
```

---

## CI/CD Integration

### Core CI (`ci.yml`)

Runs on every push and PR to `develop` and `main`:

```
┌──────────────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────┐
│ Lint & Typecheck  │   │   Test   │   │  Build   │   │   E2E    │   │ develop-smoke │
│ tsc --noEmit      │   │ vitest   │   │ next     │   │Playwright│   │ (develop only,│
│ eslint src/       │   │ run      │   │ build    │   │  suite   │   │ continue-on-  │
└──────────────────┘   └──────────┘   └──────────┘   └──────────┘   │  error: true) │
         All five must pass to merge to main              └───────────────┘
```

The `develop-smoke` job runs only on direct pushes to `develop` (not on PRs). It probes `/api/health/live` for liveness, then runs `scripts/check-health-readiness.mjs` against `/api/health` so degraded JSON bodies fail the smoke even though the endpoint returns HTTP 200. It uses `continue-on-error: true` so it never blocks the push, but a failure signals a runtime regression not caught by unit or E2E tests.

### E2E CI (`e2e.yml`)

Runs on every push and PR to `develop` and `main`, as a separate workflow:

```
Install deps → Install Chromium → Build app → Run Playwright → Upload report
```

Key details:
- **Timeout:** 15 minutes
- **Browser:** Chromium only (installed with `--with-deps` for Ubuntu)
- **Build step:** Required because CI uses `npm run start` (production server), not dev server
- **Env vars:** Dummy API keys + `ADMIN_SECRET_KEY=test-admin-key-12345`
- **Artifacts:** `playwright-report/` uploaded on success or failure, retained 14 days

### Why Separate Workflows

E2E tests are separated from `ci.yml` because:
- They require installing Chromium browsers (~250MB)
- They require building the full app before running
- They are slower (browser automation vs. Node.js testing)
- They have different failure characteristics (flaky network, browser timeouts)
- Other workflows (Lighthouse, bundle size) follow the same pattern of separate files

---

## Pre-Commit Hooks

**Tool:** Husky v9.1.7 (configured via `"prepare": "husky"` in `package.json`).

**File:** `.husky/pre-commit`

Every `git commit` runs these checks sequentially:

```
1. npm run typecheck    → TypeScript compilation
2. npm run lint         → ESLint
3. npm run test         → Full Vitest suite (6,496 tests)
```

If any step fails, the commit is rejected. This ensures no broken code reaches the repository.

Note: E2E tests do not run in pre-commit hooks (they require a running server and take longer). They run in CI instead.

---

## Architecture Decisions

### Why Vitest (not Jest)

- Native TypeScript support without transpilation
- ESM-first (matches Next.js App Router)
- Compatible with Vite's plugin ecosystem (`@vitejs/plugin-react`)
- Faster than Jest for this project size
- Built-in UI mode for interactive debugging

### Why Playwright (not Cypress)

- TypeScript-native with first-class types
- Built-in `webServer` config — auto-starts Next.js for tests
- Multi-browser support (Chromium, Firefox, WebKit) if needed later
- Parallel test execution across projects
- Route interception built-in (no separate mock server needed)
- `request` API for direct API testing without a browser

### Why Chromium Only in E2E

- Reduces CI time (one browser instead of three)
- Chromium covers the vast majority of real users
- Desktop + mobile viewports test responsive behavior
- Firefox and WebKit can be added later if cross-browser bugs appear

### Why Mock External APIs (not stub at the app level)

- Tests exercise the real app code, including error handling and fallbacks
- Route interception is transparent — the app doesn't know it's being tested
- No test-specific code paths in production code
- The app already degrades gracefully, so most tests work without any mocking

### Why Separate TypeScript Configs

- `tsconfig.json` (app): Targets Next.js build with path aliases, plugins
- `e2e/tsconfig.json` (E2E): Standalone config for Playwright types
- `tsconfig.json` excludes `e2e/` so Playwright's DOM types don't conflict with React's JSX types and Next.js build
