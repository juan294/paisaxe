# LCP Optimization Guide

Comprehensive documentation of all Largest Contentful Paint (LCP) optimizations implemented in Paisaxe. This guide covers image optimization, caching strategies, network optimizations, and best practices for maintaining fast page loads.

---

## Table of Contents

- [Overview](#overview)
- [Image Optimization](#image-optimization)
  - [Sharp Integration](#sharp-integration)
  - [Format Settings](#format-settings)
  - [Blur Placeholders](#blur-placeholders)
  - [Responsive Sizes](#responsive-sizes)
- [Data Fetching Optimizations](#data-fetching-optimizations)
  - [Stories Cache (localStorage)](#stories-cache-localstorage)
  - [Deferred Feature Flags](#deferred-feature-flags)
  - [Cache Invalidation](#cache-invalidation)
- [Network Optimizations](#network-optimizations)
  - [Preconnect Hints](#preconnect-hints)
  - [Image CDN Configuration](#image-cdn-configuration)
- [Database Schema](#database-schema)
- [Admin Workflow](#admin-workflow)
- [Monitoring & Debugging](#monitoring--debugging)
- [Performance Targets](#performance-targets)

---

## Overview

LCP measures the time from when a page starts loading to when the largest content element (typically the hero image) is rendered. For Paisaxe, the LCP element is the full-screen story image on `/immersive`.

**Before optimization:** ~4 seconds LCP
**Target:** <2.5 seconds (Good threshold per Core Web Vitals)

Key optimization strategies:
1. **Image optimization** — Serve modern formats (AVIF) at appropriate sizes
2. **Blur placeholders** — Show instant low-quality previews while images load
3. **Aggressive caching** — Cache stories in localStorage to eliminate fetch waterfalls
4. **Network hints** — Preconnect to required domains before they're needed
5. **Deferred loading** — Don't block rendering on non-critical data

---

## Image Optimization

### Sharp Integration

All images uploaded through the admin panel are automatically optimized using Sharp, a high-performance Node.js image processing library.

**Location:** `src/lib/image-optimization.ts`

**Key functions:**

| Function | Purpose |
|----------|---------|
| `optimizeSingleImage(buffer, maxWidth)` | Optimizes a single image to AVIF format |
| `optimizeImage(buffer)` | Generates multiple size variants |
| `generateBlurPlaceholder(buffer)` | Creates 32x32 blur preview |
| `validateImageBuffer(buffer)` | Validates image format before processing |
| `selectVariantForWidth(width, format)` | Selects optimal variant for viewport |

**Usage example:**

```typescript
import { optimizeSingleImage, generateBlurPlaceholder } from "@/lib/image-optimization";

// In API route handler
const arrayBuffer = await file.arrayBuffer();
const inputBuffer = Buffer.from(arrayBuffer);

const { buffer: optimizedBuffer, blurDataUrl } = await optimizeSingleImage(inputBuffer, 2048);

// Upload optimizedBuffer to storage
// Save blurDataUrl to database
```

### Format Settings

Quality settings are tuned for photography while maintaining good compression:

| Format | Quality | Effort | Notes |
|--------|---------|--------|-------|
| **AVIF** | 68 | 4 | Primary format, best compression |
| **WebP** | 80 | 4 | Fallback for older browsers |
| **JPEG** | 82 | - | Progressive, MozJPEG encoder |

**Why these values?**

- AVIF 68 provides excellent quality for photographs with ~60-70% size reduction vs JPEG
- Effort level 4 balances compression ratio with encoding speed
- MozJPEG produces smaller files than standard JPEG at equivalent quality

**Configuration in code:**

```typescript
export const FORMAT_SETTINGS = {
  avif: { quality: 68, effort: 4 },
  webp: { quality: 80, effort: 4 },
  jpeg: { quality: 82, mozjpeg: true, progressive: true },
};
```

### Blur Placeholders

Every story image has an associated blur placeholder — a tiny (32x32) highly-compressed WebP image encoded as a base64 data URL. This displays instantly while the full image loads, preventing layout shift and providing visual feedback.

**How it works:**

1. On image upload, Sharp generates a 32x32 thumbnail
2. Applies Gaussian blur (radius 5)
3. Encodes as WebP at quality 20
4. Converts to base64 data URL
5. Stores in `stories.blur_data_url` column

**Size:** ~200-400 bytes per placeholder

**Example output:**
```
data:image/webp;base64,UklGRlYAAABXRUJQVlA4IEoAAADwAQCd...
```

**Usage in components:**

```tsx
// In StoryViewer
<Image
  src={story.image}
  placeholder="blur"
  blurDataURL={story.blurDataUrl || darkPlaceholder}
  // ...
/>
```

### Responsive Sizes

Images are generated at multiple widths to serve appropriate sizes for different devices:

| Width | Use Case |
|-------|----------|
| 640px | Mobile phones |
| 1200px | Tablets, small laptops |
| 2048px | Desktops, large displays |

**Next.js configuration (`next.config.ts`):**

```typescript
images: {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],
  minimumCacheTTL: 2592000, // 30 days
}
```

**Variant selection logic:**

```typescript
export function selectVariantForWidth(
  viewportWidth: number,
  format: "avif" | "webp" | "jpeg" = "avif"
): string {
  for (const size of IMAGE_SIZES) {
    if (viewportWidth <= size) {
      return `${format}-${size}`;
    }
  }
  return `${format}-${IMAGE_SIZES[IMAGE_SIZES.length - 1]}`;
}
```

---

## Data Fetching Optimizations

### Stories Cache (localStorage)

Stories are cached in localStorage to eliminate the fetch waterfall on repeat visits. This is the single biggest LCP improvement for returning visitors.

**Location:** `src/hooks/use-stories.ts`

**Cache configuration:**

| Setting | Value | Purpose |
|---------|-------|---------|
| `STORAGE_KEY` | `paisaxe_stories_cache` | localStorage key |
| `STORAGE_VERSION` | `1` | Bump to invalidate all caches |
| `MAX_AGE_MS` | 24 hours | Maximum cache validity |

**How it works:**

1. On mount, check localStorage for cached stories
2. If cache exists and is <24h old, use it immediately
3. Fetch fresh data in background (stale-while-revalidate)
4. Update cache and state when fresh data arrives
5. If no cache or cache expired, fetch and wait

**Cache structure:**

```typescript
interface StoriesCache {
  version: number;
  timestamp: number;
  stories: Story[];
}
```

**Manual cache clearing:**

```typescript
import { clearStoriesCache } from "@/hooks/use-stories";

// Clear cache (e.g., after admin updates)
clearStoriesCache();
```

**localStorage entry example:**

```json
{
  "version": 1,
  "timestamp": 1706620800000,
  "stories": [
    {
      "id": "lagos-covadonga",
      "title": "Lagos de Covadonga",
      "blurDataUrl": "data:image/webp;base64,..."
    }
  ]
}
```

### Deferred Feature Flags

Feature flags now use a deferred loading pattern that doesn't block initial render.

**Location:** `src/hooks/use-feature-flags.ts`

**Old pattern (blocking):**

```typescript
// ❌ Blocks render until flags load
const { flags, isLoading } = useFeatureFlags();
if (isLoading) return <Spinner />;
```

**New pattern (deferred):**

```typescript
// ✅ Render immediately with defaults
const { flags, isReady, isEnabled, isEnabledWithDefault } = useFeatureFlags();

// Use optimistic default while loading
const showFeature = isEnabledWithDefault("my_feature", false);
```

**Key changes:**

| Old API | New API | Behavior |
|---------|---------|----------|
| `isLoading: boolean` | `isReady: boolean` | Inverted semantics |
| `isEnabled(key)` | `isEnabled(key)` | Returns false while loading |
| - | `isEnabledWithDefault(key, default)` | Returns default while loading |

**When to use each:**

- `isEnabled(key)` — When feature should be hidden until flags load
- `isEnabledWithDefault(key, true)` — When feature should show by default
- `isEnabledWithDefault(key, false)` — When feature should hide by default

### Cache Invalidation

**Automatic invalidation:**

- `STORAGE_VERSION` bump invalidates all client caches
- Database webhooks trigger revalidation (see `src/app/api/webhooks/supabase`)
- Supabase Realtime notifies clients of changes

**Manual invalidation:**

```typescript
// In admin panel after story update
import { clearStoriesCache } from "@/hooks/use-stories";
clearStoriesCache();
```

**Version bump checklist:**

When to bump `STORAGE_VERSION` in `use-stories.ts`:
- [ ] Adding new required fields to Story type
- [ ] Changing cache structure
- [ ] After schema migrations that affect story data

---

## Network Optimizations

### Preconnect Hints

DNS resolution and TLS handshakes are done early using resource hints in `src/app/layout.tsx`:

```tsx
<head>
  {/* Supabase - critical for image loading */}
  <link rel="dns-prefetch" href="https://axoishtlumlswzhegseq.supabase.co" />
  <link rel="preconnect" href="https://axoishtlumlswzhegseq.supabase.co" crossOrigin="anonymous" />

  {/* Unsplash - external images */}
  <link rel="dns-prefetch" href="https://images.unsplash.com" />
  <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
</head>
```

**Why both dns-prefetch and preconnect?**

- `dns-prefetch` — Resolves DNS only (faster, broader support)
- `preconnect` — DNS + TCP + TLS (more aggressive, may be ignored if unused)

Using both provides fallback for browsers that don't support preconnect.

### Image CDN Configuration

Next.js Image optimization settings (`next.config.ts`):

```typescript
images: {
  remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "*.supabase.co" },
  ],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],
  minimumCacheTTL: 2592000, // 30 days
},
serverExternalPackages: ["sharp"],
```

**Device sizes explained:**

| Size | Target |
|------|--------|
| 640 | Small phones |
| 750 | iPhone Plus/Max |
| 828 | iPhone Pro |
| 1080 | Large phones, small tablets |
| 1200 | Tablets, laptops |
| 1920 | Full HD monitors |
| 2048 | QHD monitors |
| 2560 | 2K monitors |
| 3840 | 4K displays |

---

## Database Schema

**Migration:** `supabase/migrations/027_blur_placeholder.sql`

```sql
-- Add blur placeholder column for LCP optimization
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS blur_data_url TEXT;

COMMENT ON COLUMN public.stories.blur_data_url IS
  'Base64 WebP blur placeholder for instant image preview (LCP optimization)';
```

**Stories table structure (relevant columns):**

| Column | Type | Purpose |
|--------|------|---------|
| `image_path` | TEXT | Full URL to optimized image |
| `blur_data_url` | TEXT | Base64 blur placeholder |
| `image_source` | TEXT | Attribution/credit |

---

## Admin Workflow

When adding images through the admin panel:

1. **Upload** — Select image (up to 10MB, JPEG/PNG/WebP/GIF/AVIF)
2. **Validation** — Sharp validates image format and dimensions
3. **Optimization** — Converts to AVIF, generates blur placeholder
4. **Storage** — Uploads optimized image to Supabase Storage
5. **Database** — Saves image URL and blur placeholder

**Supported input formats:**
- JPEG (recommended for photographs)
- PNG (for graphics with transparency)
- WebP
- GIF (converted to static)
- AVIF

**Output:** Always AVIF at configured quality (68)

**File size limits:**

| Stage | Limit |
|-------|-------|
| Upload | 10 MB |
| After optimization | Typically 200KB-2MB |

---

## Monitoring & Debugging

### Vercel Speed Insights

Real User Monitoring is enabled via `@vercel/speed-insights`. Check the Vercel dashboard for:
- LCP distribution
- FCP (First Contentful Paint)
- CLS (Cumulative Layout Shift)

### Debug localStorage cache

```javascript
// In browser console
const cache = JSON.parse(localStorage.getItem('paisaxe_stories_cache'));
console.log('Cache age:', Date.now() - cache.timestamp, 'ms');
console.log('Stories count:', cache.stories.length);
console.log('Version:', cache.version);
```

### Force cache refresh

```javascript
// Clear and reload
localStorage.removeItem('paisaxe_stories_cache');
location.reload();
```

### Check image optimization

```javascript
// In browser console, check if AVIF is being served
document.querySelectorAll('img').forEach(img => {
  console.log(img.src, img.currentSrc);
});
```

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| LCP | <2.5s | Monitoring |
| FCP | <1.8s | Monitoring |
| CLS | <0.1 | Monitoring |
| Time to Interactive | <3.9s | Monitoring |

**LCP breakdown targets:**

| Phase | Target |
|-------|--------|
| DNS + Connect | <100ms (preconnect) |
| TTFB | <200ms |
| Resource load | <1s |
| Render | <200ms |

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/image-optimization.ts` | Sharp-based image processing |
| `src/lib/image-optimization.test.ts` | Image optimization tests |
| `src/hooks/use-stories.ts` | Stories fetching with localStorage cache |
| `src/hooks/use-stories.test.ts` | Stories cache tests |
| `src/hooks/use-feature-flags.ts` | Deferred feature flag loading |
| `src/app/layout.tsx` | Preconnect hints |
| `src/app/api/admin/stories/[id]/image/route.ts` | Image upload API |
| `next.config.ts` | Image CDN configuration |
| `supabase/migrations/027_blur_placeholder.sql` | Blur column migration |

---

## Changelog

**2025-01-30** — Initial implementation
- Sharp integration for AVIF optimization
- Blur placeholder generation
- localStorage stories cache with stale-while-revalidate
- Deferred feature flag loading
- Preconnect hints for Supabase and Unsplash
- Extended image cache TTL to 30 days
