# Phase 7: Release, production acceptance, video, publication, submission

**Window:** 2026-11-04 to 11-11. **Hard deadline: Nov 12 at 12:00 Pacific, 21:00 Madrid** (revision 1 said 23:00; corrected, F09). Submit on Nov 11
**Revision 2:** deadline (F09), production webhook precondition (F11), judging continuity checks (F13), video content (F07), validation evidence in the submission (F08)
**Worktree:** none for the release itself; the main checkout on `develop`
**Depends on:** Phase 6 accepted; Supabase production anonymous sign-in enabled (Phase 2); PayPal env vars, `BOOKING_LINK_SECRET` and the production webhook listener in place (Phase 6)
**Authorization:** every step below that touches production, the repository's visibility, or an external service needs explicit authorization in the conversation where it runs. Nothing carries over.

## Steps

1. **Release** (owner says "go ahead" and later "merge it"): follow
   `docs/runbooks/release-checklist.md` sections 1 to 8 as amended in Phase 0,
   including the Preview exception (R11). Use the `deploy` skill. Identity verified by
   tree hash; read-only probes; `npm run analyze-release`; tag last.
2. **Flag and fixtures.** With authorization: toggle `experience_booking` on in the
   production Features tab; run `scripts/booking/create-voucher.ts` against production
   for one judge voucher (label "devpost-judges", max 50, expires 2026-12-16, 24-hour
   renewable voice pass) and one owner voucher; run `create-operator-link.ts` for the
   fixture merchant. Record nothing secret in the repository; the owner keeps the
   codes for the submission form.
3. **Production acceptance step** (R12; authorization required): one voucher-gated
   sandbox booking on paisaxe.es against the fixture merchant: redeem, chat, accept,
   agent creates the order, approve as the sandbox buyer, return, confirmed; verify a
   real webhook arrived and was processed (`paypal_webhook_events.processed_at` set);
   run one more booking in which the browser is closed after approval and confirm it
   is captured without a return; cancel and see the refund. Record
   order, capture, refund and event ids in the evidence manifest under `acceptance`.
   Fixture rows only.
4. **Repeatability rehearsal.** From a fresh browser, redeem the judge voucher again
   and complete a second booking. Confirm the first voucher use did not consume it.
   This proves same-day repeatability only. Continuity through judging (Dec 1 to 15) is
   covered by the date-advanced tests and by step 8.
5. **Video** (R10, research section 9): record on production; 2:40 target; open on the
   transaction; show one unsuitable option rejected with its reason and one constraint
   reported as not confirmed by the provider (F07); label fixtures and sandbox; English
   captions; upload to YouTube as public; link recorded. Only after the evaluation set
   passes on the shipped build.
6. **Repository public** (R5; authorization required): confirm the latest `Security
   Scan` run on `develop` is green; `gh repo edit juan294/paisaxe --visibility public
   --accept-visibility-change-consequences`; verify GitHub shows the MIT license in
   About; verify no `docs/agents` files are tracked.
7. **Submission:** Devpost form with the public repository, the video, the English
   description, the change summary since baseline, the validation results with their
   stated limits (Phase 5b), and the private testing
   instructions from `docs/hackathon/testing-instructions.md` filled with the voucher,
   sandbox buyer credentials and operator link. APIMatic form if required. Submit
   with margin; record the receipt.

8. **Judging continuity (F13).** On Nov 30 and Dec 8, from a fresh browser: redeem the
   judge voucher, confirm a bookable slot is offered and the approval link appears,
   and check `needs_attention` is empty in the operator view. If the voucher is at its
   cap or misbehaves, replace it with `create-voucher.ts --replace devpost-judges` and
   update the Devpost testing instructions. Schedule both checks when this phase is
   accepted.

## Acceptance gate

Automated: release analyzer exit 0 for the shipped tree; CI green on the merge.

Manual: items 3 to 7 recorded with ids, URLs and timestamps in
`docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-7-evidence.md`
(no secrets).

## Stuck states specific to this phase

| State | Recovery |
| --- | --- |
| Release PR check `Smoke test Vercel preview` fails | Fix on `develop`, push, let the PR update (checklist rule); never bypass |
| Production acceptance booking fails | Roll back first per `docs/operations/rollback.md` if the site is affected; otherwise the flag stays off and the failure is fixed on `develop` with a corrective release |
| Anonymous sign-in still off in production | Owner enables it; the acceptance step cannot pass without it, so this is checked before step 1 |
| Vercel env vars missing | The `not_configured` path shows in the acceptance step; the owner adds the vars, and a redeploy is required because Vercel applies environment variables at deploy time |
