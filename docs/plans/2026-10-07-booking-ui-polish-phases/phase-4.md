# Phase 4: Verification and design sync

**Worktree:** `../paisaxe-booking-ui-polish` (all units merged)
**Depends on:** Phase 3 accepted
**Findings:** all (U01–U16) verified; no new UI work unless a check fails

## Goal

Prove the branch is complete and safe to integrate, put the new variants and screens in
the Claude Design project, and leave a handoff that a fresh session can act on.

## 1. Gates (sequential; record every result, a later pass never erases an earlier failure)

1. `npm run test -- --maxWorkers=4`, `npm run typecheck`, `npm run lint`, `npx knip`.
2. `npm run generate-locale-coverage` produces no diff.
3. `npm run build`, then `npm run check-bundle-budget` (`/acceso` < 281,000 gzip,
   `/immersive` < 351,000; record the measured numbers).
4. `supabase start`, then `npm run test:e2e:release-artifact`: the release-required-local
   probes including `e2e/booking-roundtrip.spec.ts` and `e2e/release-required.spec.ts`,
   with no spec edits (D5/D7/D8 contract). `supabase stop` after.
5. Contrast script (scratch, Node): WCAG ratio for each pair, all ≥ 4.5:1 —
   black on `paisaxe-green-500` and `-400`; `#111111` on `#FFC439`; `text-red-200` on
   `red-500/10` over `neutral-950`; `text-white/70` and `text-red-300` and
   `text-amber-200` on `white/10` over the darkest gradient stop (`black/80` on
   `neutral-950`); `#6b6560` on `#f5f3ee` (operator captions). Oklch values from
   `tailwind.config.ts` and `node_modules/tailwindcss/theme.css`.

## 2. Screenshot review

Re-create the 2026-10-07 harness in the scratchpad (not committed): `next dev -p 3100`,
Playwright with `page.route` mocks for `/api/booking/bookings/<cap>`,
`/cancellation-preview`, `/api/booking/payments/capture`, `/api/operator/<cap>`; states
listed in the plan's manual criteria; 390×844 and 1280×900. Revert `AGENTS.md` if
`next dev` wrote it.

Rubric (each screen passes all):

- Uses only conventions vocabulary: frosted panels, glass/brand/paypal variants, no
  light-theme `secondary`/`Input` on dark, no raw ISO date.
- One primary action per state, and it is the most prominent element; destructive actions
  are never the most prominent on a confirmed booking.
- The journey steps match the phase (cross-check with `journey.test.ts`).
- Demo labelling present per D3; sandbox sentence on the booking page's pay zone.
- No horizontal scroll at 390 px; operator rows readable without scrolling sideways.
- Visible focus on every control in a keyboard pass of the booking page.

## 3. Claude Design re-sync

Read `.design-sync/NOTES.md` first (re-sync risks, `react.js` upload timeout note).

- Update previews: `.design-sync/previews/BookingCards.tsx` (new chip, PayPal link, brand
  accept), `CancellationConfirm.tsx` (glass destructive), `BalanceInvoiceStatusView.tsx`
  (PayPal link); `Button` preview gains `brand`, `paypal`, `glassDestructive`.
- Export and preview `TravellerShell`/`TicketCard` and `PaymentReceipt` only if the entry
  (`.design-sync/entry/index.tsx`) is meant to carry booking building blocks — it already
  exports the booking components (`:41-43`), so add them there.
- `conventions.md`: document the three variants, the PayPal button rule (D1: gold, `#111`
  text, wordmark, aria-label "Pagar con PayPal"), the Demo chip rule (D3), `slotDay` for
  dates.
- Run the resync driver as in the 2026-10-07 sync; upload order sentinel → writes →
  sentinel → `_ds_sync.json`. The `planId` from that session may be gone; a new
  `finalize_plan` needs the owner's one approval.

## 4. Integrate locally

Merge `feature/booking-ui-polish` into `develop` in the main repo (fast-forward if
possible), re-run gate 1 on `develop`, remove the worktree and branch. Do **not** push:
ask the owner for the single push (push-accountability), then monitor every workflow for
that exact commit and report without reruns.

## Acceptance gate

Owner reviews the gate log, the screenshot set and the Claude Design project. Then the
push decision. Stop.

## Handoff

Final state of `develop` (commit), gate results with the commit they ran on, measured
bundle sizes, contrast table, screenshot paths, Claude Design sync result, and the next
step in the parent plan (demo script, then Phase 7).
