# Phase 6: IndexNow and Search-Console Activation

## Goal

After the new public surface is released, notify participating engines and
establish the operational baseline in Google and Bing.

## Authorization Gate

This phase requires:

- explicit release authorization for the `develop` -> `main` workflow;
- separate merge authorization under `CLAUDE.md`; and
- authorization for external sitemap, inspection, IndexNow, and scan mutations.

## Files

- `public/[generated-indexnow-key].txt`
- `scripts/submit-indexnow.ts`
- `scripts/submit-indexnow.test.ts`
- `.github/workflows/indexnow.yml`
- `package.json`
- operations documentation

## Steps

1. Generate one Paisaxe-only IndexNow key and serve it as a root text file whose
   body exactly matches the key.
2. Implement submission that:
   - fetches the live production sitemap;
   - extracts only `<loc>` values;
   - rejects empty, duplicate, off-host, non-HTTPS, and over-limit payloads;
   - submits only to `api.indexnow.org`;
   - accepts 200 and 202;
   - logs no credentials or user data.
3. Add tests for:
   - `<loc>`-only parsing;
   - key-file drift;
   - host rejection;
   - malformed XML;
   - 200/202 success;
   - 4xx/5xx failure.
4. Add a `main`-only and manual-dispatch workflow that:
   - waits for the exact production SHA to become live;
   - probes the sitemap and key file;
   - submits the live URLs;
   - stores a non-secret result artifact.
5. Release through the repository's full production workflow.
6. Google Search Console:
   - submit `https://paisaxe.es/sitemap.xml`;
   - inspect `/immersive`, one story, and one guide;
   - record coverage/canonical results.
7. Bing:
   - submit the same sitemap;
   - run URL Inspection on the same sample;
   - configure Site Scan to cover the complete sitemap;
   - trigger the initial scan.
8. Record the delayed-data expectation and schedule first reviews at 48 hours,
   2 weeks, and 6 weeks.

## Pseudocode

```text
live_sha = resolve_production_sha()
assert live_sha == released_sha

xml = GET https://paisaxe.es/sitemap.xml
urls = parse_loc_elements(xml)
assert urls.all(host == "paisaxe.es" && scheme == "https")
assert GET key_location == key

response = POST https://api.indexnow.org/indexnow {
  host, key, keyLocation, urlList: urls
}
assert response.status in [200, 202]
```

## Automated Success Criteria

- Unit tests and the main-only workflow pass.
- Exact-SHA production readback succeeds before submission.
- IndexNow returns 200 or 202.
- Search Console and Bing report the sitemap as accepted.
- Site Scan page limit is at least the production sitemap count.

## Manual Success Criteria

- URL Inspection selects the declared canonical for the sampled pages.
- Search Console and Bing selectors remain scoped to Paisaxe throughout.
- No other project's sitemap, scan, or URL inventory changes.

## Stop Gate

Stop with production SHA, workflow run ID, sitemap readbacks, IndexNow response,
and Google/Bing acceptance evidence.
