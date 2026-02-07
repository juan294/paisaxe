# Performance Report

> Updated on 2026-02-07

## Health Status: GREEN (with caveats)

**Total JS: 2,455 KB — within 2,500 KB budget (45 KB headroom).** This is a significant improvement from the previous report (2,889 KB on 2026-02-06), reflecting a **-434 KB reduction (-15.0%)** — the ElevenLabs duplication issue from the previous report appears resolved.

**Caveats:** Budget headroom is thin (1.8%). One new dependency or unoptimized import could push back over. The remaining optimization opportunities below would create a comfortable buffer.

## Key Metrics

| Metric | Current (2026-02-07) | Previous (2026-02-06) | Change | Budget | Status |
|--------|---------------------|----------------------|--------|--------|--------|
| Total JS | 2,455 KB | 2,889 KB | **-434 KB (-15.0%)** | 2,500 KB | Within budget |
| Total CSS | 130 KB | 132 KB | -2 KB | - | Stable |
| Production deps | 27 | 27 | 0 | 40 | Good |
| node_modules | 856 MB | 850 MB | +6 MB | - | Stable |
| .next build | 2,102 MB | 2,129 MB | -27 MB | - | Stable |

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| Total JS | 2,500 KB | 2,455 KB | **45 KB (1.8%)** | Within budget |
| Production deps | 40 | 27 | 13 | Comfortable |

## Largest Bundles (Top 10)

| Chunk | Size | Contents | Lazy? | Optimization |
|-------|------|----------|-------|-------------|
| c9dd1f17b9fef791.js | **482 KB** | ElevenLabs SDK (protobuf, LiveKit WebRTC) | Yes (via VoiceChat dynamic import) | See #1 below |
| 4af27f77bd5de33b.js | 224 KB | Next.js client runtime | No (required) | None possible |
| 29caf01f750f57fe.js | 183 KB | Cookie/session libraries (Supabase Auth) | No (required for auth) | None practical |
| 6009f44925f0d98a.js | **173 KB** | PostHog analytics | Yes (lazy-loaded in useEffect) | Already optimized |
| 1cadbebe7f77139c.js | **152 KB** | react-markdown + CSS parser | Yes (via VoiceChat) | Already optimized |
| a6dad97d9634a72d.js | 112 KB | Unknown | - | Needs investigation |
| 2375e3fd2a9b8844.js | 111 KB | Unknown | - | Needs investigation |
| f03c14a7bd65a02e.js | 103 KB | Unknown | - | Needs investigation |
| 8ce0c6b6d103b3c8.js | 72 KB | Unknown | - | Low priority |
| fcf4e9656d2eb87f.js | 64 KB | Unknown | - | Low priority |

**Key improvement:** Previous report showed TWO 476 KB ElevenLabs chunks (likely duplication). Now there's only ONE 482 KB chunk — the duplication was resolved, saving ~476 KB.

## Previous Optimizations (Still Active)

| Optimization | Date | Savings | Status |
|-------------|------|---------|--------|
| framer-motion removed | 2026-02-02 | -177 KB | Permanent |
| PostHog lazy-loaded | 2026-02-02 | ~560 KB deferred | Active |
| PDF deps moved to devDependencies | 2026-02-02 | Variable | Active |
| ElevenLabs duplication resolved | 2026-02-07 | ~476 KB | Active |
| Admin tab panels lazy-loaded | Pre-existing | Variable | Active |
| VoiceChat dynamic import | Pre-existing | ~500 KB+ deferred | Active |

## Top Optimization Opportunities

### 1. HIGH: Add `optimizePackageImports` for lucide-react (~50-100 KB)

**Issue:** 54 files import from `lucide-react`. While named imports enable tree-shaking, Next.js's `optimizePackageImports` is more aggressive — it rewrites barrel imports to direct file imports, avoiding loading the full module graph.

**Current state:** `next.config.ts` has no `experimental.optimizePackageImports`.

**Heaviest import sites:**
- `src/components/admin/story-editor-dialog.tsx` — 28 icons
- `src/app/admin/page.tsx` — 14 icons
- `src/components/admin/costs-analytics-panel.tsx` — 13 icons

**Fix:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // ... rest of config
};
```

**Effort:** 1 line change. **Estimated savings:** 50-100 KB. **Risk:** None.

---

### 2. HIGH: Lazy-load StoryEditorDialog and CreateStoryDialog (~70 KB)

**Issue:** `src/app/admin/page.tsx` statically imports two large dialog components:
```typescript
// Line 8 - static import, loaded with admin page
import { StoryEditorDialog } from "@/components/admin/story-editor-dialog";
// Line 9 - static import
import { CreateStoryDialog } from "@/components/admin/create-story-dialog";
```

These dialogs are only rendered when the user clicks "Edit Story" or "Create Story" — not on initial page load. Yet they're bundled into the initial admin chunk.

**Fix:**
```typescript
// Replace static imports with dynamic imports
const StoryEditorDialog = dynamic(
  () => import("@/components/admin/story-editor-dialog").then(m => ({ default: m.StoryEditorDialog })),
  { ssr: false }
);

const CreateStoryDialog = dynamic(
  () => import("@/components/admin/create-story-dialog").then(m => ({ default: m.CreateStoryDialog })),
  { ssr: false }
);
```

**Effort:** Low. **Estimated savings:** 50-70 KB from admin initial bundle. **Risk:** Minimal (dialogs show a frame later on first open).

---

### 3. MEDIUM: Confirm ElevenLabs chunk is fully lazy-loaded

**Current state:** `voice-chat-elevenlabs.tsx` imports `useConversation` from `@elevenlabs/react` statically (line 4). However, this file is imported by `voice-chat.tsx`, which is dynamically imported by `immersive-page-content.tsx`:

```
immersive-page-content.tsx → dynamic import → voice-chat.tsx → voice-chat-elevenlabs.tsx → @elevenlabs/react
```

The 482 KB ElevenLabs chunk should NOT load until the user opens voice chat. **Verify this with Lighthouse or DevTools Network tab** — if the chunk loads on page load, the dynamic import chain is broken somewhere.

**Admin side concern:** `voice-agent-chat.tsx` also imports `@elevenlabs/react` directly (line 4). This component is used inside `marketing-dashboard.tsx`. Since `MarketingDashboard` is already dynamically imported in `admin/page.tsx`, this should be properly deferred. But it means the 482 KB chunk loads whenever an admin opens the Marketing tab, even before starting a voice session.

**Potential fix for admin:**
```typescript
// In marketing-dashboard.tsx, lazy-load voice-agent-chat
const VoiceAgentChat = dynamic(
  () => import("@/components/admin/voice-agent-chat").then(m => ({ default: m.VoiceAgentChat })),
  { ssr: false }
);
```

**Effort:** Low. **Estimated savings:** 482 KB deferred from Marketing tab load. **Risk:** None.

---

### 4. LOW: Run `build:analyze` for definitive chunk identification

**Issue:** Chunks `a6dad97d`, `2375e3fd`, and `f03c14a7` (combined 326 KB) have unknown contents. Minified chunk filenames change between builds, so reading them directly is unreliable.

**Action:**
```bash
npm run build:analyze
```

This generates interactive treemap visualizations showing exactly what's in each chunk. Use this to identify any unexpected dependencies or duplication.

---

### 5. LOW: Consider lighter markdown renderer

**Issue:** `react-markdown` + its CSS parser dependency contributes ~152 KB. This only runs inside VoiceChat (already lazy-loaded), so it doesn't affect initial load.

**Alternative:** A custom lightweight markdown renderer for the subset of markdown used in chat responses (bold, italic, links, lists, code blocks) could save ~100 KB. However, `react-markdown` is well-tested and the chunk is already deferred.

**Verdict:** Not worth the maintenance cost. Leave as-is.

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 270 MB | Framework (required) | No action |
| pdfjs-dist | 63 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 45 MB | ~100-150 KB (tree-shaken) | Optimize (#1) |
| @opentelemetry | 40 MB | 0 KB (server-only) | No action |
| posthog-js | 30 MB | ~173 KB (lazy-loaded) | Optimized |
| @napi-rs | 24 MB | 0 KB (native, server-only) | No action |
| core-js | 15 MB | Polyfills (minimal) | No action |
| @elevenlabs/react | ~5 MB | ~482 KB (lazy-loaded) | Verify (#3) |

**Production deps: 27 of 40 budget (68% utilized).** No concern.

## Comparison: 3-Run Trend

| Metric | 2026-02-02 | 2026-02-06 | 2026-02-07 | Trend |
|--------|-----------|-----------|-----------|-------|
| Total JS | 2,660 KB | 2,889 KB | **2,455 KB** | Recovered |
| Total CSS | 98 KB | 132 KB | **130 KB** | Stable (above Feb 2) |
| Prod deps | 30 | 27 | **27** | Improved |
| ElevenLabs chunks | 1 × 476 KB | 2 × 476 KB | **1 × 482 KB** | Fixed |

**Analysis:**
- JS bundle spiked on Feb 6 due to ElevenLabs duplication, now resolved
- CSS increased between Feb 2 and Feb 6 (+34 KB) and stabilized — likely new styles from features added that week, not a regression
- The -434 KB drop from Feb 6 is almost exactly the size of one ElevenLabs chunk (476 KB), confirming the duplication fix

## Action Plan

| Priority | Action | Estimated Savings | Effort | Blocked By |
|----------|--------|-------------------|--------|-----------|
| P1 | Add `optimizePackageImports: ['lucide-react']` | 50-100 KB | Trivial | Nothing |
| P1 | Lazy-load StoryEditorDialog + CreateStoryDialog | 50-70 KB | Low | Nothing |
| P2 | Lazy-load VoiceAgentChat in MarketingDashboard | 482 KB deferred | Low | Nothing |
| P2 | Run `build:analyze` to identify unknown chunks | 0 KB (diagnostic) | Low | Nothing |
| P3 | Verify ElevenLabs chunk is fully deferred on public pages | 0-482 KB | Low | DevTools |

**Total potential savings from P1 actions: 100-170 KB** — would bring Total JS to ~2,285-2,355 KB, creating a comfortable 145-215 KB buffer under budget.

## Disk Usage

| Directory | Size | Notes |
|-----------|------|-------|
| node_modules | 856 MB | Stable (pdfjs-dist + pdf-parse account for 120 MB as devDeps — expected) |
| .next | 2,102 MB | High but stable. Clear with `rm -rf .next && npm run build` if it grows |

---

## Cross-Agent Context

**For Security Agent:** No new production dependencies added. Bundle is within budget.

**For Code Quality Agent:** `story-editor-dialog.tsx` (1,154 lines) and `costs-analytics-panel.tsx` (1,498 lines) are the largest client components. Both candidates for splitting if they continue growing.

**For Dependencies Agent:** All heavy packages (`pdfjs-dist`, `pdf-parse`) correctly in devDependencies. No duplicate package versions detected in `package-lock.json` for `@elevenlabs/react`.

---

*Report generated by Performance Agent — Last updated: 2026-02-07*
*Based on production build metrics*
