# Phase 7 evidence

Started 2026-10-15. Phase plan: [phase-7.md](phase-7.md). Ids and timestamps only: voucher
codes, the operator link and credentials are never recorded in this repository. The owner holds
them for the Devpost testing instructions.

Step 1 (release) is covered by the v1.8.0 and v1.9.0 releases, which shipped the booking code
behind the `experience_booking` flag. Step 6 (repository public) was done on 2026-10-08.

## Step 2: flag and fixtures (owner-authorized 2026-10-15)

| Item | Result | Evidence |
| --- | --- | --- |
| Precondition: PayPal environment | Production `PAYPAL_API_BASE` is `https://api-m.sandbox.paypal.com`; `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` and `BOOKING_LINK_SECRET` are set | Vercel production environment, read 2026-10-15 |
| Precondition: anonymous sign-in | Enabled on Supabase project `asturias` before 11:03 UTC (it was off) | Management API `external_anonymous_users_enabled` false → true; public `/auth/v1/settings` reports `anonymous_users: true` |
| Fixture merchants | Two fictitious merchants and four active experiences already seeded | `merchants`, `experiences` |
| Judge voucher | `devpost-judges`, row `e261f49b`, max 50 redemptions, expires 2026-12-16, 24-hour renewable voice pass | `vouchers`, created 11:03:52 UTC |
| Owner voucher | `owner-2026`, row `02f4de71`, max 50, expires 2026-12-16 | `vouchers`, created 11:07:49 UTC |
| Operator link | Merchant `demo-rutas-del-sella`, `operator_access` row `1e595310`, valid through 2026-12-16; the page and its API return 200 | created 11:07:50 UTC |
| Flag | `experience_booking` on in production | `feature_flags.updated_at` 11:16:24 UTC |
| Gate probe | `booking-gate-closed` passes against https://paisaxe.es with the flag on: `/acceso` 200 with the voucher form; unknown booking and operator capabilities 404 | `release-required` project, 2026-10-15 ~11:17 UTC |

The admin Features tab could not switch the flag on, because `experience_booking` had no
category there ([#1036](https://github.com/juan294/paisaxe/issues/1036)). It was switched
through the same admin API the tab uses (`PUT /api/admin/feature-flags/experience_booking`).
The fix reaches production with the next release.

The operator link was shown in an owner chat session, not in this repository. If that is not
acceptable, expire row `1e595310` and issue a new link.

## Remaining steps

3. Production acceptance booking (sandbox, owner approves the payment).
4. Repeatability rehearsal with the judge voucher.
5. Video ([#1019](https://github.com/juan294/paisaxe/issues/1019)).
7. Submission.
8. Judging continuity checks on Nov 30 and Dec 8.
