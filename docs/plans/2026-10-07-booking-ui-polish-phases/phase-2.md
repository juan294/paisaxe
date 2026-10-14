# Phase 2: Booking and return pages

**Worktree:** `../paisaxe-booking-ui-polish` (same branch, after Phase 1 accepted)
**Depends on:** Phase 1 accepted
**Findings:** U01, U03, U04, U05, U06, U07, U09, U10, U11, U14, U16
**Batch-eligible units:** none (`booking-status.tsx` is the hub; one owner)
**Files:** `src/app/booking/[capability]/booking-status.tsx` (+ test),
`src/app/booking/[capability]/journey.ts` (new, + test),
`src/app/booking/[capability]/return/return-status.tsx` (+ test),
`src/components/booking/cancellation-confirm.tsx` (+ test),
`src/components/booking/balance-invoice.tsx`, `src/components/booking/payment-receipt.tsx` (new, + test)

## Goal

The booking page is the ticket from the plan's design direction in every phase
(`pay | confirming | confirmed | expired | attention | refundFailed | refunding |
refunded | cancelled`), and the return page never leaves the visitor without progress or
a way out. Booking logic (`phaseOf`, `nextPollDelay`, `pay`, `refresh`) is unchanged.

## Journey steps (signature, U05) — `journey.ts`

```
@ journeySteps(view, phase) -> [{key: "offer"|"deposit"|"balance", state}]
pre: state ∈ done | current | upcoming | stopped
do:
  1. offer: done (a booking exists only after acceptance)
  2. deposit: done if payment.status ∈ {captured, refund_pending, refunded, refund_failed} or phase = confirmed; current if phase ∈ {pay, confirming}; stopped if phase = expired
  3. balance: done if invoice.status = paid; current if phase = confirmed and invoice.status ∈ {sent, partially_paid, payment_pending}; stopped if phase ∈ {cancelled, refunding, refunded, expired}; else upcoming
risk: authorized deposits (phone confirmation, Phase 8b) are "current" under confirming — correct, money not captured yet
```

`journey.test.ts`: one table-driven case per phase, plus authorized and refund_failed.

Rendering: an `<ol aria-label={t("booking.page.steps.label")}>` of three items joined by
a hairline; done = filled `paisaxe-green-400` dot + check icon, current = ring dot
(`motion-safe:animate-pulse` only while confirming), upcoming = hollow white/40,
stopped = white/30 with line-through label. Each item carries a visually hidden state
word so the order is readable without colour.

## Page composition (`booking-status.tsx`)

```
@ BookingStatus render (ready)
ctx: TravellerShell(photo = experiencePhoto(view.experienceSlug)), TicketCard
do:
  1. header: eyebrow t("booking.page.title") + status chip (statusKey below); h1 title; when-line via booking.page.when with slotDay + slotTime + partySize; reference in mono, small
  2. journey steps
  3. money rows (tabular-nums): Total; deposit row label = depositPaid once deposit step is done, else depositNow; balance row label = balancePaid if balance done, else balanceLater
  4. action zone per phase (table below)
  5. PaymentReceipt when any of orderId/captureId/refundId exists and phase ≠ pay
  6. invoice section (balance-invoice restyled) then CancelSection last
br: statusKey = phase confirming -> booking.page.statusConfirming; else booking.cards.status.<status>
```

| Phase | Action zone |
| --- | --- |
| pay (live hold) | `payIntro`; countdown `holdCountdown` (`useCountdown`, `role="timer"`, `aria-live="off"`, plus the existing `payBefore` sentence as `sr-only`); full-width `paypal` button with `PayPalLabel` and `aria-label={t("booking.cards.pay")}`, "Abriendo PayPal…" while paying; sandbox sentence; cancelled-at-PayPal and pay errors in `text-amber-200` |
| pay (lapsed, incl. countdown reaching 0) | `holdExpired` + back-to-chat as `glass` link-button (U14) |
| confirming | spinner (`Loader2`, `motion-safe:animate-spin`) + `confirming` + `confirmingHint`; `glass` "Actualizar" (U07). After the poll window ends the spinner is replaced by the hint and the button only |
| confirmed | success header: check icon + `confirmedTitle` in `text-emerald-300`; when `?paid=1`, the `returnConfirmed` sentence above it (D7) |
| refunding | spinner + `refundPending` + `glass` "Actualizar" |
| expired | `expiredBody` + back-to-chat `glass` link-button |
| attention / refundFailed / refunded / cancelled | the existing `PHASE_MESSAGE` sentence, no spinner |

Cancel section (U04): heading stays; the opener becomes a quiet text button
(`text-white/70 underline-offset-4 hover:underline`, glass focus ring) placed last on the
ticket. `CancellationConfirm`'s confirm button uses `glassDestructive` (not solid red),
still full width inside the opened section. Roles and names unchanged
(`booking.cancel.open`, `booking.cancel.confirmRefund`).

Not-ready states (loading, notFound, failed) render inside `TravellerShell` with no
photo, `glass` "Actualizar" for failed.

### Focus on status change (U16)

```
@ useFocusOnPhaseChange(phase) -> ref for the status region
do:
  1. remember the first phase seen (no focus on initial load)
  2. on a later phase change, focus the status region (tabIndex -1, outline none, ring via focus-visible)
risk: never steal focus while the visitor is typing — the page has no inputs, so safe
```

Test: initial render does not move focus; a poll that changes confirming → confirmed
moves focus to the region containing `confirmedTitle`.

## Receipt (U10) — `payment-receipt.tsx`

A `<dl>` titled `receiptTitle` with rows `orderId`, `captureId`, `refundId` (existing
labels), each value in mono with a small `glass` copy button
(`aria-label="Copiar <label>"`). `navigator.clipboard.writeText`; on success the button
reads `copied` for 2 s; on rejection show `copyFailed` next to the value.
Tests: renders only present ids; copy success label; rejected clipboard shows
`copyFailed` (stuck-state disclosure); ids still found as text (existing
`booking-status.test.tsx:170-171` "ORDER-1"/"CAP-1" keep passing).

## Invoice (U11, U03) — `balance-invoice.tsx` and the page section

The pay link becomes `<a className={buttonVariants({ variant: "paypal" })}>` whose
visible text is `t("booking.invoice.pay")` ("Pagar el resto con PayPal") with no
wordmark: the PayPal gold carries the brand, no new key is needed, and the role and name
stay as asserted (`booking-cards.test.tsx:182-191`, `booking-status.test.tsx:185-193`).
Target/rel unchanged. `dueOn` takes `slotDay(view.slotDate, locale)` on the page and
`slotDay(card.dueDate, locale)` in the chat card (Phase 3A).

## Return page (U06, D7) — `return-status.tsx`

```
@ ReturnStatus
ctx: TravellerShell (no photo), TicketCard, router.replace
do:
  1. capturing: spinner + returnConfirming; start a 20 s timer
  2. outcome confirmed -> replace(`/booking/${capability}?paid=1`)
  3. outcome pending | awaiting_approval -> replace(`/booking/${capability}`)
  4. other outcomes -> message + "Ver la reserva" as a brand link-button (name booking.cards.viewBooking)
  5. timer fires before an outcome -> show returnSlow + the same link-button (stuck state)
br: no token -> returnError + link-button (as today)
```

Tests (`return-status.test.tsx`): confirmed calls `replace` with `?paid=1`; pending
replaces without it; slot_gone/problem/failed/error render message + link (existing
`:41/76` href assertion kept); never-resolving fetch + 20 s → `returnSlow` and link.
Booking-page test: `?paid=1` with a confirmed view shows `returnConfirmed`; with a
confirming view it does not, and does once the next poll returns confirmed.

## Tests to keep green unchanged in intent

`booking-status.test.tsx` role/name cases (`:86-172`, `:153`, `:254`, `:278-316`) and
`cancellation-confirm.test.tsx` all pass with only fixture edits (`experienceSlug`) and
the new cases above. If a case must change, the plan's D5 contract is broken: stop and
report.

## Verification

Phase gates (test, typecheck, lint, knip). Start `next dev`, run the screenshot harness
(Phase 4 describes it; re-create in scratch) for the booking and return states at 390 and
1280, compare against the design direction, revert `AGENTS.md` if `next dev` touched it.

## Acceptance gate

Owner reviews the screenshot set for this phase. Stop.

## Handoff

Commits, test counts, screenshot paths, any deviation (e.g. a role that had to change)
with its reason.
