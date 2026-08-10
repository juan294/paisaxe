# Phase 2: Consent, GA4, Clarity, Events, and Legal Disclosure

## Goal

Add privacy-gated GA4 and Clarity instrumentation while keeping PostHog's existing
cookieless behavior intact.

## Files

- `src/components/analytics/consent-provider.tsx`
- `src/components/analytics/cookie-banner.tsx`
- `src/components/analytics/google-analytics.tsx`
- `src/components/analytics/microsoft-clarity.tsx`
- `src/components/analytics/events.ts`
- `src/components/analytics.test.tsx`
- `src/app/providers.tsx`
- `src/app/layout.tsx`
- `src/components/posthog-provider.tsx`
- `src/lib/env.ts`
- `.env.example`
- `src/app/privacy/page.tsx`
- `src/lib/i18n/{es,en,fr,de,pt,ast}.ts`
- `src/lib/proxy/csp.ts`
- relevant component tests

## Steps

1. Write RED tests for:
   - consent defaulting to necessary-only;
   - GA and Clarity absent before consent;
   - persisted accept/reject behavior;
   - consent revocation;
   - Clarity route allowlisting;
   - analytics parameter allowlisting;
   - PostHog's existing cookieless options remaining unchanged.
2. Add one consent state shared by GA4, Clarity, and the banner.
3. Bootstrap GA Consent Mode as denied before the GA configuration call.
4. On stored or newly granted analytics consent:
   - update GA consent;
   - set `content_locale` before the first page view;
   - configure the Phase 1 measurement ID;
   - emit route pageviews.
5. Add Clarity only when:
   - consent is granted; and
   - the route is public and allowlisted.
6. Initial Clarity allowlist:
   - `/`
   - `/immersive`
   - `/story/*`
   - `/guides`
   - `/guides/*`
   - `/about`
7. Exclude:
   - `/admin`
   - `/auth`
   - `/favorites`
   - `/pricing/checkout`
   - `/pricing/success`
   - `/pricing/checkout/return`
   - all API routes.
8. Add `data-clarity-mask="true"` to components rendering user-authored chat,
   booking, account, or form content, plus a ratchet test over the sensitive list.
9. Implement the typed events/dimensions from the main plan. Do not send message
   text, transcripts, names, email, phone, query text, or booking details.
10. Add legal disclosures for GA4, Clarity, PostHog, Vercel Analytics, consent
    choices, retention, masking, and opt-out/revocation across all six catalogs.
11. Add documented env variables:
    - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
    - `NEXT_PUBLIC_CLARITY_PROJECT_ID`
12. Add the values to Preview only after code is merged; Production values wait
    for release authorization.
13. Update CSP for official GA and Clarity origins using the narrowest directives.

## Pseudocode

```text
consent = load_consent() ?? NECESSARY_ONLY

if consent.analytics:
  ga.set_context(content_locale)
  ga.configure(measurement_id)
  clarity.load(project_id) only_if route_is_allowlisted
else:
  ga.update_consent(DENIED)
  clarity.do_not_load()

emit(name, params):
  assert name in EVENT_CONTRACT
  assert params.keys subset of SAFE_PARAMETER_CONTRACT[name]
  send_to_ga4(name, params) only_if consent.analytics
  send_to_posthog(name, params) using existing cookieless client
```

## Automated Success Criteria

- Consent, GA, Clarity, CSP, legal, analytics-contract, and PostHog regression tests
  pass.
- Mutation tests prove GA/Clarity load guards fail when consent checks are removed.
- Source guard proves each registered GA dimension is emitted under the same name.
- Build contains no server-side reference to secret analytics credentials.
- Sequential typecheck, lint, test, and build pass.

## Manual Success Criteria

- Fresh browser session shows the consent choice before GA/Clarity requests.
- Rejecting analytics produces no GA or Clarity network request.
- Accepting analytics starts both and persists the choice.
- Revoking consent stops later analytics and updates GA/Clarity consent state.
- Clarity never loads on excluded routes.
- Privacy text names all active analytics vendors and explains the choices.

## Stop Gate

Stop after preview verification. Do not configure GA key events/dimensions or
release to production in this phase.
