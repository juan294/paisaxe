# Phase 1: Remove `headers()` from Layouts

> **Goal**: Eliminate the dynamic rendering trigger from root and immersive layouts, unlocking static/ISR for the entire site.

## Context

`headers()` in the root layout forces every page to be dynamically rendered. The only reason `headers()` is called is to read the CSP nonce (`x-csp-nonce`) for JSON-LD `<script type="application/ld+json">` tags. Since JSON-LD is a data block (not executable JavaScript), modern browsers exempt it from CSP `script-src` — the nonce is unnecessary.

## Files Changed

| File | Action |
|------|--------|
| `src/app/layout.tsx` | Remove `headers()` import/call, remove nonce, make layout synchronous |
| `src/app/immersive/layout.tsx` | Remove `headers()` import/call, remove nonce, make layout synchronous |
| `src/components/seo/json-ld.tsx` | Remove `nonce` prop from `JsonLdProps` interface and all component signatures |
| `src/app/layout.test.tsx` | Remove `headers` mock, update render calls (no longer async) |
| `src/app/immersive/layout.test.tsx` | Remove `headers` mock, update render calls (no longer async) |
| `src/components/seo/json-ld.test.tsx` | Remove nonce-related test assertions |

## TDD: Tests First

### 1. Update `src/app/layout.test.tsx`

```pseudo
REMOVE: vi.mock("next/headers") block (lines 15-18)

CHANGE: rendering tests — RootLayout is no longer async
  - "should render children"
    BEFORE: const Component = await RootLayout({ children: ... });
    AFTER:  const Component = RootLayout({ children: ... });
            // No await — layout is synchronous

  - Same for "should set html lang to es", "should apply font classes", "should render JsonLd"

CHANGE: "should render JsonLd WebSite component"
  - REMOVE assertion on nonce attribute
  - KEEP assertion that script[type="application/ld+json"] exists with @type=WebSite
```

### 2. Update `src/app/immersive/layout.test.tsx`

```pseudo
REMOVE: vi.mock("next/headers") block (lines 5-8)

CHANGE: all tests — ImmersiveLayout is no longer async
  - "renders children"
    BEFORE: const Component = await ImmersiveLayout({ children: ... });
    AFTER:  const Component = ImmersiveLayout({ children: ... });

  - Same for "renders JsonLd TouristDestination component"
```

### 3. Update `src/components/seo/json-ld.test.tsx`

```pseudo
REMOVE: any tests asserting nonce attribute on script tags
KEEP: all tests asserting JSON-LD content (schema type, data structure)
```

## Implementation

### 1. `src/components/seo/json-ld.tsx`

```pseudo
CHANGE JsonLdProps interface:
  REMOVE: nonce?: string

CHANGE JsonLd function signature:
  BEFORE: export function JsonLd({ type, nonce }: JsonLdProps)
  AFTER:  export function JsonLd({ type }: JsonLdProps)

CHANGE <script> tag in JsonLd:
  REMOVE: nonce={nonce}

CHANGE StoryJsonLdProps interface:
  REMOVE: nonce?: string

CHANGE StoryJsonLd function:
  REMOVE: nonce from destructuring and all <script> tags

CHANGE BreadcrumbJsonLdProps interface:
  REMOVE: nonce?: string

CHANGE BreadcrumbJsonLd function:
  REMOVE: nonce from destructuring and <script> tag

CHANGE FAQJsonLdProps interface:
  REMOVE: nonce?: string

CHANGE FAQJsonLd function:
  REMOVE: nonce from destructuring and both <script> tags
```

### 2. `src/app/layout.tsx`

```pseudo
REMOVE: import { headers } from "next/headers"   (line 11)

CHANGE function signature:
  BEFORE: export default async function RootLayout({ children })
  AFTER:  export default function RootLayout({ children })

REMOVE: const nonce = (await headers()).get("x-csp-nonce") ?? undefined   (line 122)

CHANGE JsonLd call:
  BEFORE: <JsonLd type="website" nonce={nonce} />
  AFTER:  <JsonLd type="website" />
```

### 3. `src/app/immersive/layout.tsx`

```pseudo
REMOVE: import { headers } from "next/headers"   (line 10)

CHANGE function signature:
  BEFORE: export default async function ImmersiveLayout({ children })
  AFTER:  export default function ImmersiveLayout({ children })

REMOVE: const nonce = (await headers()).get("x-csp-nonce") ?? undefined   (line 57)

CHANGE JsonLd call:
  BEFORE: <JsonLd type="tourist-destination" nonce={nonce} />
  AFTER:  <JsonLd type="tourist-destination" />
```

## Verification

### Automated
```bash
# Tests pass
npm run test

# Type check passes
npm run typecheck

# Lint passes
npm run lint

# Build should now show /about, /privacy, /terms as static or ISR
npm run build 2>&1 | grep -E '/(about|privacy|terms)'
# Expected: circle symbol (static) instead of f (dynamic)
```

### Manual
```bash
# After deploy: Verify JSON-LD still renders in page source
curl -s https://paisaxe.es/immersive | grep -c 'application/ld+json'
# Expected: 2 (one from root layout, one from immersive layout)

# Verify CSP header still present (nonce still generated in proxy.ts)
curl -sI https://paisaxe.es/immersive | grep 'content-security-policy'
# Expected: header present with nonce and strict-dynamic

# Verify no CSP violations in browser console
# Open paisaxe.es/immersive in Chrome, check Console for CSP errors
# Expected: none (JSON-LD data blocks exempt from script-src)
```

## Rollback

If JSON-LD is blocked by CSP in any browser:
1. Re-add `nonce` prop to `JsonLd` component
2. Re-add `headers()` calls to layouts
3. This is a clean revert — no other code depends on these changes
