# Phase 3: Chat cards · voucher page · operator panel

**Worktrees:** one per unit, from `feature/booking-ui-polish` after Phase 2 accepted:
`../paisaxe-booking-ui-cards` (`feature/booking-ui-cards`), `../paisaxe-booking-ui-voucher`
(`feature/booking-ui-voucher`), `../paisaxe-booking-ui-operator` (`feature/booking-ui-operator`).
Background agents use `.worktrees/<unit>` instead (CLAUDE.md worktree rule 8).
**Integration owner:** the main session merges each unit into `feature/booking-ui-polish`
in the order cards → voucher → operator, re-runs the gates after each merge, removes the
unit worktree and branch. Nothing is pushed; no PR.
**Depends on:** Phase 2 accepted (`[cards]` renders the restyled `CancellationConfirm`
and `BalanceInvoiceStatusView`)
**Batch-eligible units:** `[cards]`, `[voucher]`, `[operator]` — disjoint files below.

## Unit [cards] — `src/components/immersive/voice-chat/booking-cards.tsx` (+ test)

Findings U01, U02, U03, U08.

- `CardShell`: chip becomes neutral `rounded-full bg-white/10 px-2 py-0.5 text-[10px]
  uppercase tracking-wide text-white/70`. New prop `chip: "demo" | "demoSandbox"`
  (default `demo`). Card panel unchanged (`rounded-xl border-white/20 bg-white/10`).
- `PaymentCardView` (U02): chip `demoSandbox`; drop the sandbox paragraph (D3); the pay
  control stays an `<a href={card.approvalUrl}>` (E2E `:138` selects a link) styled
  `buttonVariants({ variant: "paypal" })` + `w-full mt-3`, content `PayPalLabel`,
  `aria-label={t("booking.cards.pay")}`; amount in `text-lg font-semibold tabular-nums`.
- `InvoiceCardView`: chip `demoSandbox`; drop the sandbox paragraph; `dueOn` with
  `slotDay(card.dueDate, locale)`.
- `QuoteCardView` (U01, U03): when-row `slotDay(card.slotDate, locale) · card.slotTime`;
  the `<dl>` gets `tabular-nums`; accept button `variant="brand"`; requote
  `variant="glass"` with `rounded-md` (keep full width). Names unchanged.
- `BookingCardView`: "Ver la reserva" link styled `buttonVariants({ variant: "glass" })`,
  `target`/`rel` unchanged (`booking-cards.test.tsx:157-159`).
- `OfferCardView`: prices `tabular-nums`; no other change.

Tests: `booking.cards.demo` still present on non-payment cards (`:46`); payment and
invoice cards show `booking.cards.demoSandbox` and no `booking.cards.sandbox` paragraph
(replace `:136/:181` accordingly — the D3 decision, not a D5 break: those are text
assertions on removed copy, not selectors the E2E uses); pay link keeps name
`booking.cards.pay` and href; quote when-row contains the formatted day.

## Unit [voucher] — `src/app/acceso/voucher-form.tsx` (+ test)

Findings U01, U07, U12.

- Wrap in `TravellerShell` with photo `experiencePhoto(null)` (the fallback landscape) and
  `TicketCard` around the form.
- `Input` (U07): `className` override `border-white/20 bg-white/10 text-white
  placeholder:text-white/50 font-mono uppercase tracking-widest
  focus-visible:ring-white/70 focus-visible:ring-offset-neutral-950`. The `id`
  (`#voucher-code`), `method="post"`, no `name`, `autoComplete="off"` stay (E2E
  `:117`, `release-required.spec.ts:140-144`, test `:117`). Uppercasing is visual only;
  the submitted value is what was typed (the server already compares as it does today).
- `Label`: `text-white/80`.
- Submit (U01): `variant="brand"`, still `type="submit"` and full width.
- Error text stays `text-red-300` (≥ 4.5:1 on the ticket — Phase 4 contrast script).
- Welcome copy changed in Phase 1.

Tests: existing cases pass unchanged; the dynamic-import source test (`:136-142`) still
passes (TravellerShell must not import the Supabase client). Bundle: `/acceso` stays
under 281,000 gzip bytes (checked in Phase 4; `next/image` and the Logo are small).

## Unit [operator] — `src/app/operator/[capability]/operator-dashboard.tsx` (+ test)

Findings U03, U13, U15.

- U15: delete every `dark:` class (`:139, :179, :239, :354, :369, :374`).
- U03: booking table date cell and hold line use `slotDay(date, "es")` + time.
- U13 tiles: `MoneyTile` gains an icon slot (`Wallet` for deposits, `Hourglass` for the
  balance) and copies `StatCard`'s non-interactive container and type classes from
  `src/components/ui/stat-card.tsx` so the four tiles share height, radius, border and
  shadow. `data-testid`s unchanged (test `:122-123`).
- U13 phone layout (D8): below `md` each `<tr>` becomes a block card
  (`max-md:block max-md:rounded-xl max-md:border max-md:p-3`), each `<td>` a row with a
  caption from `data-label` (`max-md:before:content-[attr(data-label)]
  max-md:before:font-mono max-md:before:text-[10px] max-md:before:uppercase`), the
  `<thead>` visually hidden below `md`. Add explicit `role="table" | "rowgroup" | "row" |
  "columnheader" | "cell"` so table semantics survive the display change. Same for the
  capacity table: it stays a scrollable grid (it is a matrix), but gets a sticky first
  column.
- U13 reissue dialog: replace `window.confirm` (`:98`) with `Dialog` from
  `src/components/ui/dialog.tsx`: title "Reemitir enlace de <ref>", body "El enlace
  anterior dejará de funcionar.", buttons "Cancelar" (outline) and "Reemitir"
  (default; "Reemitiendo…" and disabled while `busy`). The row button keeps its
  `aria-label` "Reemitir enlace <ref>" (test `:195`).

Tests: update the reissue cases (`:195-225`) to open the dialog and press "Reemitir"
instead of stubbing `window.confirm`; add: Cancelar closes without a request; confirm is
disabled while in flight; failure closes the dialog and shows `ACTION_FAILED` (existing
`:225` text). All other cases unchanged, including `getByRole("table")` (`:100`) and the
capacity row assertion (`:234-235`). E2E `:148` (row filtered by reference containing
"Confirmada") is the D8 contract.

## Verification

Per unit in its worktree: `npm install`, test, typecheck, lint. After each merge into
`feature/booking-ui-polish`: the full gates again. Screenshots of the chat cards (via the
design-sync previews or the harness), voucher and operator at 390/1280.

## Acceptance gate

Owner reviews the three units' screenshots. Stop.

## Handoff

Per unit: worktree, branch, merge commit, test counts, removal of worktree and branch
confirmed (`git worktree list`).
