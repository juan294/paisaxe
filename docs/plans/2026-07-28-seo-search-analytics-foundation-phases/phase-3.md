# Phase 3: Canonical Story Pages and Technical SEO

## Goal

Give every indexable item one stable 200 URL and align sitemap, metadata,
structured data, redirects, and visible content with that model.

## Files

- `src/lib/site-url.ts`
- `src/lib/site-url.test.ts`
- `src/app/layout.tsx`
- `src/app/immersive/layout.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/story/[slug]/page.tsx`
- `src/app/story/[slug]/page.test.tsx`
- `src/lib/proxy/story-rewrite.ts`
- `src/proxy.ts`
- `src/components/seo/json-ld.tsx`
- `src/components/seo/json-ld.test.tsx`
- `src/components/story-landing/*`
- associated tests

## Steps

1. Write RED tests for:
   - whitespace-safe canonical URLs across metadata, robots, sitemap, and JSON-LD;
   - sitemap excluding redirects and `noindex` routes;
   - stable story `lastModified`;
   - `/story/[slug]` rendering 200 content rather than redirecting;
   - story canonical, Open Graph image, JSON-LD, breadcrumb, and CTA.
2. Centralize canonical URL construction:

```text
site_url = trim(NEXT_PUBLIC_SITE_URL) or "https://paisaxe.es"
assert site_url is HTTPS
assert hostname == "paisaxe.es"
return site_url without trailing slash
```

3. Remove `/story/:slug` proxy interception while preserving canonical-host and
   root redirects.
4. Turn `/story/[slug]` into a server-rendered landing page with:
   - one H1;
   - visible description and practical metadata;
   - licensed/attributed image and descriptive alt text;
   - visible source attribution;
   - related-story links;
   - CTA to `/immersive?story=[slug]`;
   - not-found behavior for inactive/missing stories.
5. Extend story metadata with canonical URL, Open Graph URL/image, Twitter image,
   locale, and alternates appropriate to the Spanish canonical.
6. Mount story `Restaurant` or `TouristAttraction` JSON-LD plus breadcrumbs.
7. Change sitemap entries to:
   - `/immersive`
   - `/about`
   - `/story/[slug]` for active, approved stories
   - later guide routes supplied by Phase 4
8. Exclude `/` because it redirects, `/favorites` because it is `noindex`, and all
   immersive query-state URLs.
9. Use a real story update timestamp where available; use a stable fallback for
   bundled stories. Do not assign the current request time to unchanged content.
10. Keep `/immersive?story=` canonicalized to `/immersive`.
11. Reconcile robots sitemap output through the shared canonical URL helper.

## Automated Success Criteria

- Each active story test renders a 200 page contract and stable canonical.
- Sitemap tests prove every entry is indexable, non-redirecting, and on-host.
- RED mutation of URL trimming reproduces malformed whitespace and fails.
- JSON-LD tests prove all schema URLs are absolute, same-host, and whitespace-free.
- Proxy tests prove canonical-domain and root redirects still work.
- Sequential typecheck, lint, test, build, E2E, and prelaunch pass.

## Manual Success Criteria

- A story share URL opens the story landing page.
- The CTA opens the corresponding immersive story.
- View Source shows visible story HTML, canonical, social metadata, and JSON-LD.
- Rich Results Test validates the applicable story and breadcrumb schema.
- Direct production-style HTTP checks distinguish 200 story pages from the
  intentional root and alternate-host 308s.

## Stop Gate

Stop after preview verification of at least one attraction and one restaurant
story. Do not add guide content or submit sitemaps externally in this phase.
