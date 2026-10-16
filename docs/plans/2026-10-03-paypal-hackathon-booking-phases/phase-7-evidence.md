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

## Step 3: production acceptance (owner-authorized 2026-10-16)

Run on https://paisaxe.es (deployment `dpl_7o1EFNyTqpZDYSUWz4as2afiTbxh`) with the owner
voucher, the fixture merchant `demo-rutas-del-sella` and the PayPal sandbox. The owner approved
every payment as the sandbox buyer. The browser was already signed in to the owner's account, so
these bookings belong to it; the anonymous guest path is step 4. All times UTC. Before the run,
production had 0 bookings, and the 3 webhook events it held (2026-10-08) were signature-verified
but unmatched (orders from another environment).

### acceptance

| Case | Booking | PayPal ids | Result |
| --- | --- | --- | --- |
| Redeem, chat, accept, order, approve, return | RS-37C8D0 (coastal walk, 2026-10-20 10:00, 2 people, deposit 3000) | order `2DL13265GU484820K`, capture `3RM00667KJ567863M` | Accepted 05:11:58; captured 05:14:01.29 by the return path; return page showed "¡Pago recibido! Tu reserva está confirmada."; booking `confirmed`, payment `captured` |
| Approve, browser never returns | RS-0E38B5 (2026-10-22 10:00, 1 person) | order `06L82992WD466511B`, capture `1CV20688XS4400052` | JavaScript blocked on paisaxe.es, so the return page (client-side capture only, `return-status.tsx`) could not capture. `CHECKOUT.ORDER.APPROVED` received 05:31:13.49 → captured 05:31:16.18 → processed 05:31:16.29, log outcome `confirmed`; booking `confirmed` |
| Cancel and refund | RS-2AD278 (2026-10-21 10:00, 1 person) | order `8BR57237VE3836346`, capture `93885909M82609508`, refund `147639525L233502V` | Preview "te devolvemos 30,00 €"; confirmed 05:27:05; refunded 05:27:06.88; booking and payment `refunded`; page shows "Hemos devuelto la señal en PayPal." |

Webhook events (all signature `SUCCESS`, all with `processed_at` set):

| Event | Type | Received | Processed |
| --- | --- | --- | --- |
| `WH-3K592331007914640-0KE09405RS9186237` | CHECKOUT.ORDER.APPROVED (RS-37C8D0) | 05:14:01.32 | 05:14:01.88 |
| `WH-6LG85772AX854635D-67H50929AW568204N` | PAYMENT.CAPTURE.COMPLETED (RS-37C8D0) | 05:14:28.67 | 05:14:29.80 |
| `WH-2M531038CE5268115-00X11189UM373200R` | PAYMENT.CAPTURE.REFUNDED (RS-2AD278) | 05:27:29.93 | 05:27:30.15 |
| `WH-82C66852BF9675649-5H702318EG401553N` | CHECKOUT.ORDER.APPROVED (RS-0E38B5) | 05:31:13.49 | 05:31:16.29 |
| `WH-1B350449FU442292K-62K23759N2919913H` | PAYMENT.CAPTURE.COMPLETED (RS-0E38B5) | 05:31:28.60 | 05:31:28.91 |

RS-2AD278 was first meant as the closed-browser case. The DevTools request block did not
match the return navigation ("0 affected"), and the return path captured it at 05:25:05.91,
8 seconds before its first webhook. Its events (`CHECKOUT.ORDER.APPROVED` 05:25:14,
`PAYMENT.CAPTURE.COMPLETED` 05:25:16) were processed as idempotent late arrivals. RS-0E38B5
repeated the case with JavaScript blocked.

The reconciliation cron ran at 05:25:32 with all counters 0 and no errors.

Findings filed during the run:
[#1037](https://github.com/juan294/paisaxe/issues/1037) (the first chat reply showed the
model's date-resolution note) and [#1038](https://github.com/juan294/paisaxe/issues/1038)
(the refunded event for the app's own refund logs `[PAYPAL_WEBHOOK_OUT_OF_ORDER]` at warn).

Not covered: the PostHog debug view check deferred from the 2026-10-07 local session.

RS-37C8D0 and RS-0E38B5 stay confirmed as fixture rows for 2026-10-20 and 2026-10-22.

## Remaining steps

4. Repeatability rehearsal with the judge voucher.
5. Video ([#1019](https://github.com/juan294/paisaxe/issues/1019)).
7. Submission.
8. Judging continuity checks on Nov 30 and Dec 8.
