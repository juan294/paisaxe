# Phase 1: Foundations

**Worktree:** `../paisaxe-booking-ui-polish` on `feature/booking-ui-polish` from `develop` (`fe184371` or later; revalidate)
**Depends on:** plan accepted
**Findings:** U01, U03, U05, U07, U09, U12 (copy), U16 (focus ring)
**Batch-eligible units:** `[primitives]` (button, PayPal label, wordmark, backdrop) and `[data]` (formatter, countdown, photo map, view field, copy). No file overlap; one integration owner. Small enough to run sequentially in one worktree; split only if useful.

## Goal

Everything Phases 2 and 3 compose exists, is tested, and changes nothing visible yet
(no screen imports the new pieces until Phase 2).

## Unit [primitives]

### Button variants (U01, U07, U16) — `src/components/ui/button.tsx`

Add three variants to `buttonVariants`; existing variants untouched (light surfaces and
the admin use them).

| Variant | Classes (from conventions + D1) |
| --- | --- |
| `brand` | `bg-gradient-to-r from-paisaxe-green-500 to-paisaxe-green-400 text-black font-semibold hover:from-paisaxe-green-400 hover:to-paisaxe-green-300` + dark focus ring |
| `paypal` | `bg-[#FFC439] text-[#111111] font-semibold hover:bg-[#F2BA36]` + dark focus ring |
| `glassDestructive` | `border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20` + dark focus ring |

Dark focus ring = the exact string `glass` uses today (`button.tsx:22`):
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950`.
Extract it to one const used by `glass`, `glassIcon` and the three new variants.

Tests (`src/components/ui/button.test.tsx`): each new variant renders its key classes;
`buttonVariants({ variant: "paypal" })` returns a string usable on an `<a>`; `glass`
output unchanged (snapshot of the class string before/after the const extraction).

### PayPal wordmark and label (U01, D1, D5)

- `public/images/paypal-wordmark.svg`: vendored byte-for-byte from the D1 URL. Record
  the source URL and the sha256 in the commit message.
- `src/components/booking/paypal-label.tsx`:

```
@ PayPalLabel({ prefix }) -> inline content for a paypal button or link
ctx: next/image not needed (static svg, fixed size)
do:
  1. render prefix text (t("booking.cards.payWith") = "Pagar con")
  2. render <img src="/images/paypal-wordmark.svg" alt="PayPal" height=18>
br: callers set aria-label={t("booking.cards.pay")} so the name stays "Pagar con PayPal"
risk: an <img> lint rule may prefer next/image; disable per line with the reason (static svg)
```

Tests: renders the prefix and an img with alt "PayPal"; a `<button aria-label=…>`
wrapping it has accessible name "booking.cards.pay" (the test i18n returns keys).

### Traveller backdrop (U07, U12, D2) — `src/components/booking/traveller-shell.tsx`

```
@ TravellerShell({ photo, children }) -> <main>
ctx: next/image (fill, sizes="100vw", alt="", as story-viewer.tsx:287), Logo (src/components/ui/logo.tsx)
do:
  1. render bg-neutral-950 min-h-dvh main with the photo layer (absolute, object-cover)
  2. render gradient overlay from conventions (from-black/80 via-black/20 to-black/40)
  3. render top bar: Logo h-6 + "Paisaxe", link to "/", glass focus ring
  4. render children in a centered max-w-md column, px-4 py-12, text-white
br: photo undefined -> no image layer (plain neutral-950)
```

Plus `TicketCard({ children })`: the frosted panel
`rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 space-y-5`.

Tests: renders children inside `main`; with no photo renders no img; logo link points
to `/`.

## Unit [data]

### Slot day formatter (U03) — `src/lib/booking-format.ts`

```
@ slotDay(date: "YYYY-MM-DD", locale) -> "sáb, 24 oct"
do:
  1. parse as `${date}T00:00:00Z` (a calendar date, not an instant; as operator dayLabel)
  2. format Intl.DateTimeFormat(toIntlLocale(locale), {weekday:"short", day:"numeric", month:"short", timeZone:"UTC"})
fail: invalid date string -> return the input unchanged (never "Invalid Date")
```

New `src/lib/booking-format.test.ts`: es `2026-10-24` → contains "24" and "oct" and the
weekday; en → "Sat, Oct 24"; a date near a DST change does not shift the day; invalid
input returned as is. Existing functions get one regression case each.

### Countdown hook (U09) — `src/hooks/use-countdown.ts`

```
@ useCountdown(expiresAt: string | null) -> { remainingMs, label "m:ss", expired }
ctx: setInterval 1 s, cleared on unmount and when expired
do:
  1. compute remaining = max(0, Date.parse(expiresAt) - Date.now())
  2. tick every second; stop at 0 and set expired
br: expiresAt null -> {remainingMs: null, expired: false}, no timer
```

Tests with fake timers: label decreases each second; reaches `0:00` and `expired`;
interval cleared after expiry and on unmount; null input starts no timer.

### Experience photo map (D2) — `src/lib/booking/experience-photos.ts`

`experiencePhoto(slug: string | null): string` using the D2 table and fallback.
Test: every mapped path and the fallback exist under `public/` (fs check, like
`brand-colors.test.ts` reads files); unknown and null slugs → fallback.

### Booking view field (D2) — `view.ts`, `types/booking-page.ts`

`src/lib/booking/view.ts:73` → `select("title, slug")`; `:96` area adds
`experienceSlug: (experience.data?.slug as string | undefined) ?? null`.
`BookingView` gains `experienceSlug: string | null`. Update `view.test.ts`,
`route.test.ts` and `booking-status.test.tsx` fixtures (typecheck lists any missed).
Test: the view returns the slug; a missing experience row returns `null`.

### Copy (U05, U09, U10, U12, D3, D7) — `src/lib/i18n/{es,ast,en,fr,de,pt}.ts`

New keys (Spanish is the reviewed source; the other five translated in the same tone):

| Key | es |
| --- | --- |
| `booking.cards.payWith` | Pagar con |
| `booking.cards.demoSandbox` | Demo · sandbox |
| `booking.cards.depositPaid` | Señal pagada |
| `booking.cards.balancePaid` | Resto pagado |
| `booking.page.statusConfirming` | Confirmando el pago |
| `booking.page.holdCountdown` | Te guardamos la plaza {time} |
| `booking.page.steps.offer` | Oferta aceptada |
| `booking.page.steps.deposit` | Señal pagada |
| `booking.page.steps.balance` | Resto pagado |
| `booking.page.steps.label` | Estado de la reserva |
| `booking.page.receiptTitle` | Comprobante PayPal |
| `booking.page.copy` | Copiar |
| `booking.page.copied` | Copiado |
| `booking.page.copyFailed` | No se pudo copiar; selecciona el código |
| `booking.page.returnSlow` | Está tardando más de lo normal. Puedes ver el estado en tu reserva. |
| `booking.page.when` | {day} · {time} · {people} personas |

Changed value: `booking.access.welcome` → "Te damos la bienvenida. Abriendo el asistente
de reservas…" (U12; ungendered). Every locale gets the equivalent change.

Then `npm run generate-locale-coverage`. Gates: `translations.test.ts:56-91` parity,
`locale-coverage.test.ts:21-24` freshness.

## Verification

- All unit tests above written first and failing, then passing.
- `npm run test`, `npm run typecheck`, `npm run lint`, `npx knip` (new exports are used
  only from Phase 2 onward: if knip flags them, add them to Phase 2's first commit
  instead of suppressing — record which).
- No screen changed: `git diff --stat` touches only the files named here.

## Acceptance gate

Owner reviews the variants (a static page is not needed; class strings and tests are the
artifact) and the Spanish copy table. Stop.

## Handoff

Record: commit(s) on `feature/booking-ui-polish`, test counts, whether knip forced any
export to move to Phase 2, and the wordmark sha256.
