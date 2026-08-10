# Phase 7: Analytics Configuration and SEO Ledger

## Goal

Turn the newly deployed instrumentation and verified search properties into
actionable reports and a durable aggregate-only operating record.

## Authorization Gate

Obtain authorization before creating GA events/dimensions/audiences, product
links, Clarity segments/funnels, API credentials, repository secrets, or scheduled
workflows.

## Files

- `scripts/seo/collect-analytics.ts`
- `scripts/seo/collect-analytics.test.ts`
- `.github/workflows/seo-ledger.yml`
- `docs/analytics/seo/README.md`
- `docs/analytics/seo/ledger/*.json`
- `docs/analytics/seo/ledger/*.md`
- `.env.example` for local read-only collector variables

## Steps

1. GA4:
   - mark the five planned key events;
   - register the six custom dimensions with exact parameter names;
   - create the three audiences from the main plan;
   - create funnel, guide-path, and retention explorations.
2. Link the GA4 web stream to `sc-domain:paisaxe.es`.
3. Publish the Search Console report collection in GA4.
4. Clarity:
   - verify Strict masking and consent behavior on production;
   - create public-story and guide segments;
   - create the guide-to-immersive funnel;
   - link the Paisaxe GA4 property if supported.
5. Bing:
   - capture initial Search Performance, IndexNow, Site Scan, Keyword Research,
     and AI Performance state.
6. Build an aggregate-only collector with independent adapters for:
   - GA4 Data API;
   - Search Console API;
   - Bing Webmaster API;
   - Clarity Data Export API.
7. Each adapter returns:

```text
{
  source,
  status: "ok" | "empty" | "error",
  collected_at,
  period,
  aggregate_metrics,
  error_code?
}
```

8. Never store user IDs, IP addresses, full URLs with sensitive query parameters,
   recordings, chat/voice content, or raw event rows.
9. Add a weekly scheduled workflow and manual dispatch:
   - least-privilege read-only credentials;
   - independent source failure handling;
   - schema validation;
   - deterministic Markdown summary;
   - commit only aggregate ledger changes.
10. Record baselines and follow-up dates. Treat empty new-property reports as
    `empty`, not as a collector failure.

## Automated Success Criteria

- GA4 reports the exact key-event and dimension names from source.
- Search Console link readback points to the Paisaxe stream/property only.
- Collector adapter tests cover success, empty data, auth failure, quota failure,
  timeout, and partial-source completion.
- Schema validation rejects raw or sensitive fields.
- Scheduled workflow succeeds when one source is empty or unavailable and reports
  that status explicitly.
- Sequential typecheck, lint, test, and build pass.

## Manual Success Criteria

- GA4 Realtime shows consented production events and populated dimensions.
- Clarity recordings are limited to allowlisted routes and visibly masked.
- Funnel ordering matches the real visitor flow.
- GA/Search Console organic reports are visible after the documented delay.
- The first ledger entry matches dashboard totals for the same period.

## Stop Gate

Stop with external configuration readbacks, the first aggregate ledger entry,
workflow run ID, and a dated schedule for the 2-week and 6-week reviews.
