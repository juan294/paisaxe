# Testing Guide

> Complete reference for Paisaxe's testing infrastructure.
> Last updated: 2026-01-27

---

## Overview

Paisaxe uses a two-layer testing strategy:

| Layer | Tool | Scope | Files | Tests |
|-------|------|-------|-------|-------|
| **Unit & Component** | Vitest + React Testing Library | Functions, components, hooks, API routes | 86 | 1,054 |
| **End-to-End** | Playwright | Full browser journeys across pages | 6 | 50 (25 desktop + 25 mobile) |

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
```

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

**86 files, 1,054 tests** organized by area:

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

#### API Routes (13 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `api/chat/route.test.ts` | — | Input validation, embedding generation, Claude response, rate limiting |
| `api/health/route.test.ts` | 9 | Status JSON, Supabase connectivity, degraded state, version |
| `api/favorites/route.test.ts` | — | GET/POST/DELETE with auth, 401 without auth |
| `api/feature-flags/route.test.ts` | 5 | Flag listing, error handling |
| `api/analytics/route.test.ts` | — | Event ingestion |
| `api/admin/stories/route.test.ts` | — | Story listing with admin auth |
| `api/admin/stories/[id]/status/route.test.ts` | — | Curation status updates |
| `api/admin/stories/[id]/image/route.test.ts` | — | Image URL and file uploads |
| `api/admin/feature-flags/[key]/route.test.ts` | — | Feature flag toggle |
| `api/admin/analytics/route.test.ts` | — | Analytics dashboard data |
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

#### Libraries & Utilities (22 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `validation.test.ts` | 19 | Chat input sanitization, length limits, XSS prevention |
| `i18n/translations.test.ts` | 72 | All translation keys resolve for all locales |
| `i18n/detect-language.test.ts` | 23 | Browser language detection, Accept-Language parsing |
| `i18n/resolve.test.ts` | 12 | Translation key resolution, fallback chains |
| `claude.test.ts` | — | Chat response generation, source extraction |
| `search.test.ts` | 8 | Vector similarity search, hybrid keyword matching |
| `embeddings.test.ts` | — | Voyage AI embedding generation, batching |
| `embedding-cache.test.ts` | 9 | LRU cache, TTL expiration |
| `rate-limit.test.ts` | — | Sliding window rate limiting |
| `admin-auth.test.ts` | — | Bearer token validation, timing-safe comparison |
| `shuffle.test.ts` | 7 | Fisher-Yates shuffle determinism with seeds |
| `seasonal-weighting.test.ts` | 6 | Season-aware story boosting |
| `mood-mapping.test.ts` | 6 | Mood-to-category mapping and filtering |
| `freshness.test.ts` | 6 | Story age calculation for freshness badge |
| `related-stories.test.ts` | — | Category and location matching |
| `asturianu.test.ts` | 6 | Asturian language label lookups |
| `stories-data.test.ts` | — | DB fetch, fallback stories on error |
| `supabase.test.ts` | — | Client initialization |
| `admin-api.test.ts` | — | Admin API client functions |
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

Every test file runs twice — once per project — giving 50 total tests from 25 test cases.

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

#### `smoke.spec.ts` — App Basics (4 tests)

| Test | What it verifies |
|------|-----------------|
| `/` redirects to `/immersive` | Server-side redirect works (waits for URL change) |
| `/immersive` loads successfully | HTTP 200, non-empty page body |
| Non-existent page returns 404 | Next.js 404 handling |
| Health endpoint responds with JSON | `/api/health` returns `status`, `version`, `timestamp` |

No mocking needed — these tests exercise the raw app behavior.

#### `immersive.spec.ts` — Story Viewer (5 tests)

| Test | What it verifies |
|------|-----------------|
| Renders a story with title and description | Fallback stories load, `h1` is visible |
| Shows navigation arrows | Left arrow disabled on first story, right arrow enabled |
| Navigates to next story via arrow click | Title changes after clicking the right arrow |
| Navigates via keyboard arrow keys | `ArrowRight` key changes the story |
| Toggles info overlay with 'i' key | Bottom panel's CSS opacity transitions to 0 |

**Mocking:** Feature flags mocked to disable mood overlay and feature-gated UI.

#### `chat.spec.ts` — Chat Panel (3 tests)

| Test | What it verifies |
|------|-----------------|
| Opens chat panel when Ask button is clicked | Clicking the ask button opens the chat overlay (`z-50`) |
| Sends a message and receives a mocked response | Types a question, submits, sees user message, sees mocked assistant response |
| Closes chat panel via close button | X button dismisses the overlay |

**Mocking:** Feature flags (to avoid overlays) + chat API (returns `MOCK_CHAT_RESPONSE`). The privacy notice is dismissed if it appears.

#### `favorites.spec.ts` — Favorites Page (3 tests)

| Test | What it verifies |
|------|-----------------|
| Shows empty state when no favorites saved | The "explore" link is visible (empty state CTA) |
| Has a back link to immersive | Header contains a link to `/immersive` |
| Shows header with title | `<header>` element is present |

No mocking needed — the page renders with empty localStorage.

#### `admin.spec.ts` — Admin Dashboard (4 tests)

| Test | What it verifies |
|------|-----------------|
| Shows login form | "Paisaxe Admin" heading, password input, Continue button |
| Shows error for empty key submission | Submitting without a key shows "Please enter the admin key" |
| Rejects invalid admin key | Mocked 403 response shows "Invalid admin key" error |
| Logs in with correct key and shows dashboard | Mocked 200 response transitions to dashboard with logout button |

**Mocking:** Admin stories API mocked to accept `TEST_ADMIN_KEY` and reject anything else.

#### `api.spec.ts` — API Route Smoke Tests (6 tests)

| Test | What it verifies |
|------|-----------------|
| `GET /api/health` returns valid JSON | Version, timestamp, supabase service status |
| `GET /api/feature-flags` returns data or error | Valid JSON regardless of Supabase connectivity |
| `POST /api/chat` rejects empty body | 400 status with error message |
| `GET /api/favorites` returns 401 without auth | Unauthorized access blocked |
| `POST /api/favorites` returns 401 without auth | Same for POST |
| `DELETE /api/favorites` returns 401 without auth | Same for DELETE |

**No page navigation** — these use Playwright's `request` API to call endpoints directly.

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
│   └── mock-data.ts      # Shared mock responses
├── smoke.spec.ts
├── immersive.spec.ts
├── chat.spec.ts
├── favorites.spec.ts
├── admin.spec.ts
├── api.spec.ts
└── tsconfig.json          # Isolated from app TypeScript
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
┌──────────────────┐   ┌──────────┐   ┌──────────┐
│ Lint & Typecheck  │   │   Test   │   │  Build   │
│ tsc --noEmit      │   │ vitest   │   │ next     │
│ eslint src/       │   │ run      │   │ build    │
└──────────────────┘   └──────────┘   └──────────┘
         All three must pass to merge
```

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
3. npm run test         → Full Vitest suite (1,054 tests)
```

If any step fails, the commit is rejected. This ensures no broken code reaches the repository.

Note: E2E tests do not run in pre-commit hooks (they require a running server and take longer). They run in CI instead.

---

## Architecture Decisions

### Why Vitest (not Jest)

- Native TypeScript support without transpilation
- ESM-first (matches Next.js App Router)
- Compatible with Vite's plugin ecosystem (`@vitejs/plugin-react`)
- Faster than Jest for this project size (~10 seconds for 1,054 tests)
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
