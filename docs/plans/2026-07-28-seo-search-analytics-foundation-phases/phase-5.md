# Phase 5: Public-Surface Truthfulness Gate

## Goal

Make SEO correctness a falsifiable repository and CI contract.

## Files

- `scripts/check-public-surface.ts`
- `scripts/lib/public-surface.ts`
- `scripts/lib/public-surface.test.ts`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/lighthouse.yml`
- `scripts/run-prelaunch-gate.ts`
- documentation for check semantics

## Checks

1. Sitemap URL validity:
   - HTTPS;
   - `paisaxe.es`;
   - no whitespace;
   - no fragments;
   - unique.
2. Sitemap semantic validity:
   - no redirects;
   - no `noindex`;
   - no private/auth/transactional routes;
   - canonical equals fetched URL.
3. Metadata:
   - unique non-empty title and description;
   - canonical on every indexable page;
   - Open Graph URL matches canonical.
4. Structured data:
   - parseable JSON;
   - same-host absolute URLs;
   - type matches visible content;
   - FAQ question/answer text visibly exists.
5. Content:
   - one H1;
   - non-empty main content;
   - images have meaningful alt text;
   - internal links resolve.
6. Robots:
   - sitemap directive is exact;
   - intended private prefixes are disallowed;
   - public story/guide paths are not disallowed.
7. Analytics/privacy:
   - sensitive components retain Clarity masking;
   - GA registered parameters have matching emitters.

## Steps

1. Port only the reusable pure/discovery/report architecture from Spoken Letter.
2. Write RED fixtures for every semantic rule, including realistic regressions.
3. Add `npm run check-public-surface`.
4. Run it against a local production build in CI.
5. Add it to the prelaunch gate.
6. Keep Lighthouse's SEO collection and add explicit minimum assertions only after
   measuring the current preview baseline.
7. Emit a concise artifact listing URL, rule, evidence, and failure reason.

## Automated Success Criteria

- Every guard has a fixture that fails before the implementation is restored.
- The command exits nonzero for semantic failures and zero for the known-good
  public surface.
- CI runs the production build once and reuses it for the public-surface check.
- The gate cannot report green through a shell pipe that masks the real exit code.
- Sequential typecheck, lint, test, build, and prelaunch pass.

## Manual Success Criteria

- The report is readable enough to identify the failing URL and contract.
- A preview inspection agrees with the checker for one story and one guide.

## Stop Gate

Stop after the CI contract is green on the exact commit. Do not create the
production release or activate IndexNow in this phase.
