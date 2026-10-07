# Booking UI polish: the PayPal screens join the design system

**Date:** 2026-10-07
**Base:** `develop` at `fe184371` (clean apart from the owner's untracked
`docs/research/2026-10-07-paypal-webinar-submission-notes.md`, never touched)
**Worktree:** `../paisaxe-booking-ui-polish` on `feature/booking-ui-polish` from `develop`
**Phases:** [phase-1](2026-10-07-booking-ui-polish-phases/phase-1.md) ·
[phase-2](2026-10-07-booking-ui-polish-phases/phase-2.md) ·
[phase-3](2026-10-07-booking-ui-polish-phases/phase-3.md) ·
[phase-4](2026-10-07-booking-ui-polish-phases/phase-4.md)
**Parent plan:** `docs/plans/2026-10-03-paypal-hackathon-booking.md` (this is the
"UI/UX polish so the demo matches prod" step before the demo script and Phase 7)

## Objective

The voucher page, the booking page, the PayPal return page, the operator panel and the
chat booking cards are the only visitor screens without the Paisaxe look. Bring all 16
findings of the 2026-10-07 audit into the synced design system
(`.design-sync/conventions.md`) without changing any booking, payment or access
behaviour. The booking page becomes a frosted "ticket" over the experience photo with a
three-step journey (offer accepted → deposit paid → balance paid) that makes both PayPal
products (Orders for the deposit, Invoicing for the balance) legible at a glance.

Out of scope: server routes other than the one additive view field (D2), payment and
cancellation logic, migrations, the immersive chat shell, Vercel/production. Pushing
the finished branch needs the owner's authorization at the end of Phase 4.

## Audit findings (IDs kept through every phase)

Evidence: screenshots of every state at 390 and 1280 px against mocked APIs
(2026-10-07 session, scratch harness re-created in Phase 4), code reads, and a computed
contrast check (`hsl(142.1 76.2% 36.3%)` on `hsl(355.7 100% 97.3%)` = 3.0:1; destructive
`hsl(0 84.2% 60.2%)` on `hsl(210 40% 98%)` = 3.59:1, both under WCAG AA 4.5:1 for 14 px).

| ID | Finding | Phase |
| --- | --- | --- |
| U01 | Primary CTAs are shadcn `bg-primary` (3.0:1 text contrast), not the brand; PayPal CTAs are not PayPal-branded | 1 (variants), 2, 3 |
| U02 | Chat payment card's "Pagar con PayPal" is an underlined link | 3A |
| U03 | Dates are raw ISO (`2026-10-24 · 10:00`, `Vence el 2026-10-24`) on page, cards, operator | 1 (formatter), 2, 3A, 3C |
| U04 | Confirmed page leads with a white "Quiero cancelar" and then a solid red full-width cancel; success is one green line | 2 |
| U05 | Wrong tense/state: "Señal ahora" after payment; status "Pendiente de pago" while confirming | 1 (copy), 2 |
| U06 | Return page is one line: no progress, no context, no way out while capturing | 2 |
| U07 | Light-theme `secondary` buttons and white `Input` on dark pages | 1 (variants), 2, 3B |
| U08 | Amber "DEMO" badge on every chat card, plus a separate sandbox paragraph | 3A |
| U09 | Hold shows a clock time, no countdown; confirming has no progress indicator | 1 (hook), 2 |
| U10 | PayPal order/capture/refund ids are raw mono lines | 2 |
| U11 | "Pagar el resto con PayPal" is an underlined link | 2 |
| U12 | Voucher page: gendered "¡Bienvenido!", no Paisaxe identity, plain code field | 1 (copy), 3B |
| U13 | Operator: table clipped on phones (status, payment, actions hidden); tiles inconsistent; reissue uses `window.confirm` | 3C |
| U14 | "Volver al asistente" is an underlined link | 2 |
| U15 | Dead `dark:` classes in the operator panel (no `.dark` is ever set) | 3C |
| U16 | Focus does not move on status change; thin `ring-1` green focus ring on black | 1 (variants), 2 |

## Decisions (owner-confirmed 2026-10-07 unless marked repository-derived)

- **D1 PayPal buttons are PayPal-branded.** Gold `#FFC439` (hover `#F2BA36`), dark text
  `#111111`, the official PayPal wordmark vendored from
  `https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg`
  (HTTP 200, `image/svg+xml`, 2,291 bytes on 2026-10-07) to
  `public/images/paypal-wordmark.svg` (CSP `img-src 'self'` covers it,
  `src/lib/proxy/csp.ts:64`). Every other primary CTA ("Entrar", "Aceptar oferta",
  "Ver la reserva") uses the conventions' brand gradient.
- **D2 Ticket photo per experience.** `src/lib/booking/view.ts:73` selects `slug` too and
  `BookingView` gains `experienceSlug: string | null` (additive). A static map sends the
  three fixture slugs (`supabase/migrations/116_operator_access_and_fixture.sql`) to
  existing story photos: `descenso-canoa` → `descenso-del-sella.webp`,
  `paseo-senda-costera` → `cabo-vidio.webp`, `ruta-miradores-4x4` →
  `lagos-de-covadonga.webp`; anything else → `aventura-en-los-picos.webp`. No migration.
- **D3 Fixture label stays on every card, quieter.** The accepted parent plan requires it
  (`2026-10-03-paypal-hackathon-booking-phases/phase-3.md:99-100`: "Cards show the
  fixture label 'Demo' and the sandbox label on payment cards"). One neutral chip per
  card; payment and invoice cards show "Demo · sandbox" and drop the separate sandbox
  paragraph. The booking page keeps its full sandbox sentence under the pay button.
- **D4 Four phases**, Phase 3 split into three `[batch-eligible]` units.
- **D5 Accessible names do not change** (repository-derived). The E2E roundtrip selects
  by Spanish names (`e2e/booking-roundtrip.spec.ts:118,130,131,138,140,156,157,164`), so
  a PayPal button whose visible content is "Pagar con" + wordmark keeps
  `aria-label={t("booking.cards.pay")}` ("Pagar con PayPal"), and every existing role
  stays the same (the chat pay control stays a link, the page pay control a button).
- **D6 Button variants, not per-call class soup** (repository-derived). `brand`,
  `paypal` and `glassDestructive` join `buttonVariants`
  (`src/components/ui/button.tsx:6-38`) so anchors reuse them via
  `buttonVariants({ variant })`, the design system documents them, and the white
  `ring-2` focus ring of `glass` (`button.tsx:22`) applies to all dark-surface variants
  (U16).
- **D7 The return page hands over to the booking page** (repository-derived).
  `confirmed` → `router.replace("/booking/<cap>?paid=1")`, and the booking page shows the
  existing `booking.page.returnConfirmed` sentence as a success banner while the phase is
  `confirmed` and `paid=1` is present. `pending`/`awaiting_approval` → replace without
  `paid`. The other outcomes stay on the return page with their message and a way out.
  This keeps E2E `:140` (same sentence, now on the booking page) valid.
- **D8 Operator table stacks with CSS, one DOM** (repository-derived). Rendering a
  second card list for phones would duplicate every role the unit tests and E2E select
  (`operator-dashboard.test.tsx:168-223`, `booking-roundtrip.spec.ts:148`). Below `md`
  rows become stacked blocks with `data-label` captions; explicit `role="table|row|cell"`
  attributes keep table semantics in Safari once `display` changes.

## Design direction (applies to every phase)

Tokens come only from `.design-sync/conventions.md` and `tailwind.config.ts`; the font
stays the system stack. One signature element: the journey steps on the ticket. All else
quiet.

```
traveller pages (voucher, booking, return)
┌──────────────────────────────── photo (D2), gradient from-black/80 via-black/20 to-black/40
│ [logo] Paisaxe                                  (link to /, glass focus ring)
│        ┌──────── frosted ticket: bg-white/10 backdrop-blur-xl border-white/20 rounded-2xl
│        │ Tu reserva · [status chip]
│        │ Descenso en canoa                       (h1, text-2xl font-semibold)
│        │ sáb, 24 oct · 10:00 · 4 personas         (text-white/80)
│        │ ● Oferta aceptada ── ◐ Señal pagada ── ○ Resto pagado   (signature)
│        │ Total 160,00 € / Señal 40,00 € / Resto 120,00 €   (tabular-nums)
│        │ [action zone for the phase]
│        │ Comprobante PayPal (ids + copy)          (confirmed and later)
│        │ Resto de la reserva (invoice)            (when present)
│        │ Cancelar la reserva                      (quiet link, last)
│        └────────
```

Operator panel keeps the light/admin surface (`bg-[#f5f3ee]`, ink `#2d2a26`/`#6b6560`).

## Phases

| Phase | Scope | Findings | Depends on |
| --- | --- | --- | --- |
| 1 Foundations | Button variants, PayPal label + wordmark, `slotDay()` formatter, `useCountdown`, photo map + `experienceSlug`, traveller backdrop, all new/changed copy in 6 locales | U01, U03, U05, U07, U09, U12 (copy), U16 (ring) | — |
| 2 Booking and return pages | Ticket layout, journey steps, status/phase labels, confirmed hierarchy, receipt, countdown, confirming spinner, invoice PayPal button, back-to-chat button, return hand-over, focus on status change; `CancellationConfirm` and `BalanceInvoiceStatusView` restyle | U01, U03, U04, U05, U06, U07, U09, U10, U11, U14, U16 | 1 |
| 3 Chat cards · voucher · operator | `[cards]` U02, U03, U08, U01 · `[voucher]` U07, U12, U01 · `[operator]` U03, U13, U15 | see units | 1, 2 (cards render Phase 2's shared components) |
| 4 Verification and design sync | Full gates, local E2E roundtrip, screenshot review against the rubric, Claude Design re-sync, handoff | all | 3 |

Each phase stops for owner acceptance (rpi-details). Phase 3's units run in separate
worktrees under `.worktrees/` or `../paisaxe-booking-ui-<unit>` with the main session as
the single integration owner; no working branch is pushed and no PR is opened.

## Success criteria

### Automated (every phase runs all that apply; Phase 4 runs all)

- `npm run test` (local `--maxWorkers=4`), `npm run typecheck`, `npm run lint`,
  `npx knip` pass.
- `src/lib/i18n/translations.test.ts` (key parity across es/en/fr/de/pt/ast) passes;
  `npm run generate-locale-coverage` re-run and `locale-coverage.test.ts` passes.
- `src/lib/brand-colors.test.ts` passes (no raw `green-*` utilities; brand scale only).
- New tests named in each phase fail before the change and pass after.
- `npm run build` then `npm run check-bundle-budget`: `/acceso` stays under the default
  281,000 gzip bytes (`scripts/check-bundle-budget.ts:78`), `/immersive` under 351,000
  (`:70`).
- Local release probes with Supabase running: `npm run test:e2e:release-artifact`
  (includes `e2e/booking-roundtrip.spec.ts` and `e2e/release-required.spec.ts:140-144`)
  pass unchanged — the selectors are the D5 contract.
- Contrast script (Phase 4) reports ≥ 4.5:1 for every text/background token pair
  introduced (brand gradient ends with black, PayPal gold with `#111`, `text-red-200` on
  the glass destructive, `text-white/70` on the photo gradient's darkest stop).

### Manual (visual-only, owner)

- Screenshot set at 390 and 1280 px of every state (pay, hold countdown, confirming,
  confirmed with invoice, cancel open, refunding, refunded, expired, return capturing,
  return problem, voucher idle/error, operator desktop/phone, each chat card) reviewed
  against the Phase 4 rubric.
- One keyboard-only pass of the booking page: tab order, visible focus on every control,
  focus lands on the status after paying/cancelling.

## Stuck states and recovery

| State | Who sees what | How it ends | Test |
| --- | --- | --- | --- |
| Hold reaches zero while the pay screen is open | Visitor: countdown hits 0:00, pay zone replaced by "La plaza retenida ha caducado…" and a "Volver al asistente" button | Automatic switch (the countdown re-renders; today `holdLapsed` is only computed on unrelated renders, `booking-status.tsx:154`) | Phase 2 `booking-status.test.tsx` fake-timer case: advance past `holdExpiresAt`, expect `holdExpired` and the back-to-chat link |
| Confirming polls stop after 17 min (`nextPollDelay` null) | Visitor: spinner replaced by the hint and the "Actualizar" button | Visitor presses Actualizar; webhook/reconciliation finish server-side | Phase 2 case: advance 17 min, expect spinner gone and refresh button present and working |
| Return page capture request never answers | Visitor: spinner and "Confirmando tu pago con PayPal…" | After 20 s a "Ver la reserva" button and `booking.page.returnSlow` hint appear (today no link ever appears, `return-status.tsx:64`) | Phase 2 `return-status.test.tsx` fake-timer case with a never-resolving fetch |
| Hand-over lands while the booking is not yet confirmed | Visitor: booking page in `confirming` with spinner, no success banner | Polling reaches `confirmed`; banner then shows (paid=1 still present) | Phase 2 case: `?paid=1` + confirming view, then confirmed view on next poll |
| Experience photo missing or slug unknown | Visitor: fallback photo, or plain `bg-neutral-950` if the file fails | Degraded look only; text contrast is computed against `neutral-950` + gradient so it stays readable | Phase 1 photo-map test (every mapped file exists in `public/`, unknown slug → fallback) |
| PayPal wordmark fails to load | Visitor: "Pagar con" + the image's alt text "PayPal" | Degraded look; the accessible name stays "Pagar con PayPal" | Phase 1 test: file exists; Phase 1 label test: alt text and aria-label present |
| Clipboard write refused (permissions, insecure context) | Visitor/judge: "No se pudo copiar; selecciona el código" next to the id | The id text is selectable; message disappears on next copy | Phase 2 receipt test with a rejecting `navigator.clipboard.writeText` |
| Operator reissue fails inside the dialog | Operator: dialog closes, notice "No se pudo completar la acción…" | Operator retries from the row | Existing `operator-dashboard.test.tsx:225` adapted to the dialog flow |
| Operator dialog open while a request is in flight | Operator: confirm button disabled with "Reemitiendo…" | Request settles; dialog closes | Phase 3C dialog test |

## Consumer sweep

Search (2026-10-07, read-only delegated sweep, results checked):
`rg -n -e 'booking-format|BalanceInvoiceStatusView|CancellationConfirm|BookingCards' src scripts e2e .design-sync`,
`rg -n -e 'getBy(Role|Text|TestId)|locator\(|toContainText|goto\(' e2e/`,
`rg -n --glob '*.test.ts*' -e 'toHaveClass|className' src/app/booking src/app/acceso src/app/operator src/components/booking src/components/immersive/voice-chat`,
plus `git grep -ln BookingView -- src`.

| Consumer | Uses | Disposition |
| --- | --- | --- |
| `src/lib/booking/phone-confirmation.ts:46,176` | `money()` | Unchanged function; excluded (no edit). `phone-confirmation.test.ts:218` keeps passing |
| `booking-status.tsx:8`, `booking-cards.tsx:7`, `operator-dashboard.tsx:9`, `cancellation-confirm.tsx:5` | `money`, `clockTime`, `dateTime` | Phases 2, 3A, 3C, 2 add `slotDay`; existing functions unchanged |
| `src/app/api/booking/bookings/[capability]/route.ts`, `src/lib/booking/view.ts`, `src/types/booking-page.ts` | `BookingView` | Phase 1 adds `experienceSlug`; `view.test.ts` and `route.test.ts` fixtures updated |
| `booking-status.test.tsx` fixtures | `BookingView` literals | Phase 1 adds `experienceSlug` to fixtures (typecheck enforces) |
| `voice-chat.tsx:25,277` | `BookingCards` | Props unchanged; excluded |
| `.design-sync/entry/index.tsx:41-43`, previews `BookingCards.tsx`, `BalanceInvoiceStatusView.tsx`, `CancellationConfirm.tsx`, `Button` preview, `config.json:27-29,47,73,100`, `conventions.md:28-36,60` | components and docs | Phase 4 updates previews, conventions (new variants, PayPal rule, chip) and re-syncs |
| `booking-status.test.tsx`, `return-status.test.tsx`, `voucher-form.test.tsx`, `booking-cards.test.tsx`, `cancellation-confirm.test.tsx`, `operator-dashboard.test.tsx` | keys, roles, text | Updated in the phase that owns the component; no class assertions exist |
| `e2e/booking-roundtrip.spec.ts:117-164`, `e2e/release-required.spec.ts:140-144` | Spanish names, `#voucher-code`, `form button[type=submit]` | Contract (D5): no spec edits; Phase 4 runs them |
| `e2e/booking-access-boundary.spec.ts`, `e2e/release-artifact-smoke.spec.ts`, `e2e/fixtures/*` | no UI locators on these screens | Excluded (verified no matches) |
| Page wrappers' tests (`page.test.tsx` ×4) | mock the components | Excluded |
| `lighthouserc*.json:6` | audits `/immersive` only | Excluded; chat cards render only after a voucher, not in the audited page |

## Risks

- **PayPal mark usage.** Using the wordmark on a button that starts a PayPal payment is
  the intended use; we do not alter its colours or proportions. INFERRED from PayPal's
  public brand guidance, not legally reviewed.
- **`backdrop-blur` cost on phones.** Already used across the immersive surface; one
  extra layer per page. Lighthouse does not audit these routes, so Phase 4 checks frame
  smoothness by eye on the 390 px run.
- **`next dev` rewrites `AGENTS.md`** (adds a Next agent-rules block). Any phase that
  starts the dev server reverts it before committing; never commit that block.
- **Copy in five other locales** is machine-authored; Spanish is the reviewed source
  (charter: visitor copy in Spanish first).

## Handoff

- **Approved scope:** this plan, all 16 findings; decisions D1–D3 and the phase structure
  confirmed by the owner on 2026-10-07; D5–D8 derived from the repository.
- **Not authorized yet:** implementation (needs the owner's go for Phase 1), any push,
  any Claude Design upload beyond the Phase 4 re-sync, anything on `main` or production.
- **Base:** `develop` `fe184371`; `origin/develop` equal at planning time. Revalidate with
  `git log -1 develop` and `git status` before Phase 1; reconcile if develop moved.
- **Evidence limits:** screenshots used mocked API responses on `next dev`, not a
  production build; contrast numbers computed from the CSS tokens, not measured on
  rendered pixels; the consumer sweep was a delegated read-only search whose results were
  spot-checked (`booking-status.tsx:154`, `return-status.tsx:64`, `es.ts:458-600`).
- **Next action:** owner accepts this plan → Phase 1 in the worktree above.

## Progress

### Phase 1 — accepted 2026-10-07

- Commit `d24a84ff` on `feature/booking-ui-polish` (worktree `../paisaxe-booking-ui-polish`),
  pre-commit hook green: 504 files / 9,438 tests, lint, knip; `tsc --noEmit` clean.
- Knip did not flag the new exports (their tests import them), so nothing moved to Phase 2.
- **Deviation D1:** vendored PayPal's full-colour logo
  (`paypal-ui/logos/svg/paypal-color.svg`, 3,438 bytes, sha256
  `cda7704463471358975d47c1934b73ae57baea4741abb04c0abfe9e9ebb20659`) as
  `public/images/paypal-logo.svg`; the planned `paypal-wordmark-color.svg` is black only.
- **Copy change:** the countdown reads "Te guardamos la plaza: quedan {time}" (a bare
  time read like a clock time); same in the other five locales.

### Phase 2 — accepted 2026-10-07 (commit `899fb1ac`, hook green: 9,474 tests)

- New: `journey.ts` (+14 table cases), `payment-receipt.tsx`, `balance-invoice.test.tsx`;
  restyled `booking-status.tsx`, `return-status.tsx`, `cancellation-confirm.tsx`,
  `balance-invoice.tsx`. All 30 pre-existing booking-page tests pass with only the
  `experienceSlug` fixture edit; the return-page tests changed where D7 changes behaviour
  (confirmed/pending hand over instead of showing a sentence).
- **Deviation D2:** the planned story photos do not show what their file names say (a
  festival, a cave, Covadonga), and neither do many others in `public/images/stories`
  (issue #1012). Photos chosen by content from a contact sheet: canoe → boats on calm
  water (`camino-camara-santa-de-oviedo.webp`), coastal walk → coastal boardwalk at sunset
  (`camino-camino-del-norte.webp`), 4x4 viewpoints → green valley from above
  (`quesos-asturianos.webp`), fallback → river and waterfall (`aventura-en-los-picos.webp`).
- **Additions from the screenshot review:** straight back from PayPal the confirmed
  headline is the "¡Pago recibido!…" sentence instead of both sentences; the
  free-cancellation line shows only in the pay, confirming and confirmed phases.
- `booking.page.returnPending` is no longer rendered (pending hands over to the booking
  page, which polls); the key stays in the locales.
- Screenshots (scratch, not committed): pay, confirming, confirmed + `?paid=1`, cancel
  open, refunded, expired, balance paid, return slow, return problem at 390 and 1280 px.

### Phase 3 — accepted 2026-10-07 (commit `6fd3bd74`, hook green: 9,483 tests)

- **Execution deviation:** `[operator]` ran as a background agent in
  `.worktrees/booking-ui-operator` (uncommitted, files copied in by the integration owner,
  worktree and branch removed); `[cards]` and `[voucher]` were done by the integration
  owner directly in `../paisaxe-booking-ui-polish`, since their files do not overlap and
  three concurrent pre-commit runs would starve the test runner.
- `[cards]`: neutral chip on every card, "Demo · sandbox" on payment and invoice cards
  with the sandbox sentence dropped (D3); PayPal-gold pay link with the logo, still a link
  named "Pagar con PayPal" (D5); brand accept, glass re-quote and "Ver la reserva"; slot
  and due dates through `slotDay`. Two test assertions on the removed sandbox sentence
  were replaced by the chip assertion, per D3.
- `[voucher]`: traveller frame with the fallback landscape, frosted uppercase mono code
  field (the server uppercases codes, `normalizeVoucherCode`), brand submit; `#voucher-code`,
  `method="post"`, no `name` unchanged.
- `[operator]`: no `dark:` in the operator page; `slotDay` dates; money tiles styled like
  `StatCard` with Wallet/Hourglass icons; stacked rows with explicit table roles below
  `md`; sticky first column in the capacity matrix; reissue through the design-system
  `Dialog`. PayPal ids wrap only below `md` (desktop keeps them whole). Operator tests
  11 → 15.
- **Decision:** `src/components/ui/stat-card.tsx` keeps its `dark:` classes. They are
  live in `/admin`, which uses `next-themes`; "dark: never applies" holds for the booking
  surfaces only. `conventions.md` gets that nuance in Phase 4.
- **Addition from the screenshot review:** `TravellerShell` lays a `bg-black/35` wash
  under the immersive gradient, so the ticket text stays readable on bright photos.
- **Incident, no effect:** one screenshot run submitted the voucher form on the dev server,
  whose `.env.local` points at the hosted Supabase project. The guest sign-in was refused
  ("Anonymous sign-ins are disabled"), so no user or row was created. Later screenshot
  runs must not submit the form against hosted Supabase.

### Phase 4 — verification

Gate log, in order (each on the commit named):

1. `6fd3bd74`: pre-commit hook (full suite 9,483, lint, knip) green; `tsc --noEmit` clean;
   `generate-locale-coverage` no diff.
2. `6fd3bd74`: `npm run build` green; `check-bundle-budget` all 85 routes within budget,
   `/acceso` 249.4 KB of 274.4 KB, `/immersive` 279.8 KB of 342.8 KB.
3. `6fd3bd74`, isolated local Supabase (`paisaxe-uipolish`, ports 573xx, per the release
   checklist's separate-stack procedure, because another session's stack held 543xx):
   `CI=true npm run test:e2e:release-artifact` 3/3 (artifact identity, hydration,
   favorite roundtrip; this mode leaves out the booking probes), then
   `npx playwright test --project=release-required-local` 3/3 including
   `booking-roundtrip` (voucher, chat, accept, PayPal approval, return, confirm, cancel,
   refund) and `booking-access-boundary`, with no spec edits.
4. **Contrast finding and fix.** Measured on rendered pixels (16 visitor states × 2 widths,
   brightest pixel in the ticket's padding): the `bg-white/10` ticket over bright photos
   gave 3.63:1 for pure white text. Fix: smoked ticket `bg-neutral-950/60`; body text on
   the visitor screens at `text-white/70` or brighter; the voucher error at `text-red-200`.
   Re-measured worst backdrop `rgb(82,82,81)`: white 7.82, white/80 5.73, white/70 4.83,
   amber-200 6.28, emerald-300 5.16, red-200 5.40, cancel confirm 5.30, glass button 5.99.
   Token pairs: brand 9.45 / 11.83, PayPal 11.88, operator captions 5.18 / 5.74.
5. **PayPal logo is now inline SVG** (`paypal-label.tsx`; `public/images/paypal-logo.svg`
   removed). The `<img>` rendered broken in the Claude Design previews; inline it renders
   everywhere and can't fail to load. Sized with `h-[18px]! w-16!` because `Button` forces
   every descendant svg to 16 px (`[&_svg]:size-4`).
6. Design sync inputs: `Button` preview gains `BookingActions`; `PaymentReceipt` added with
   a preview; column cards for both; conventions.md documents the dark variants, the PayPal
   rule, the smoked ticket, the Demo chip and the date format; NOTES.md records the
   converter deps and this run. Driver: 30 components, render check 0 bad (full,
   `--render-sample 0`), Button and PaymentReceipt graded good, upload = Button,
   PaymentReceipt, bundle, styling, aux; no deletes.
7. `74687814` (contrast, inline logo, sync inputs): pre-commit hook green (9,482 tests: the
   "logo file exists" test went with the file). `release-required-local` on the isolated
   stack: first run 1 failed / 2 passed in 2.2 min. `booking-roundtrip` timed out waiting
   30 s for "Ver la reserva"; the failure screenshot shows that link rendered with the
   assistant's reply still loading, i.e. a cold `next dev` compile. Second run 3/3 in
   1.0 min, no edits in between. Recorded as a cold-start flake, not a regression.
8. Claude Design: uploaded to project `ddb69a35-917f-49fd-831e-517ad569fe90` (plan
   `plan_ddb69a35917f49fd_1ab441f97e88`, no deletes): sentinel, 150 content files
   (`_vendor/react.js` skipped, hash `45ff7685ac7d2d9f` unchanged), sentinel, `_ds_sync.json`
   last; `list_files` shows `PaymentReceipt`; `report_validate` total 30, bad 0.
9. Isolated Supabase stack stopped; other sessions' stacks untouched.

**Next:** merge `feature/booking-ui-polish` into `develop` locally (fast-forward), remove the
worktree and branch, then the single push of `develop` on the owner's go-ahead, and watch
every workflow for that commit. After that, the parent plan continues with the demo script,
then Phase 7.
