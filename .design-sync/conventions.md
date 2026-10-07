# Building with Paisaxe

Paisaxe is an immersive tourism site for Asturias: full-bleed landscape photos, white text,
frosted-glass controls, and a chat guide (Pelayo) that can quote and book experiences. All
visitor-facing copy is **Spanish** (es-ES, informal "tú"): confident and warm, never pitying.

## Setup

Wrap every design in `PaisaxeRoot`. It provides the i18n context (`locale`, default `"es"`;
also `"ast" | "en" | "fr" | "de" | "pt"`) that every chat, booking and story component reads
for its labels, and it applies the production body styles (`font-sans antialiased
bg-neutral-950`). Without it the components fall back to Spanish only (the `locale` prop
does nothing) and the screen loses the dark page background and font.

```jsx
<PaisaxeRoot locale="es">{/* screen */}</PaisaxeRoot>
```

The font is the system stack (`font-sans`), on purpose. Do not load a web font.

## Two surfaces

| Surface | Where | Vocabulary |
|---|---|---|
| **Immersive (default)** | stories, chat, booking cards | `bg-neutral-950` page; photo + `bg-gradient-to-t from-black/80 via-black/20 to-black/40`; frosted panels `bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl`; chips `bg-white/10 border-white/10 rounded-full`; text `text-white`, `text-white/80`, `text-white/60`; status `text-emerald-300`, `bg-amber-500/20 text-amber-200`, `bg-red-500/10 text-red-200` |
| **Light / operator** | forms, admin | `bg-white` or the cream `bg-[#f5f3ee]` (admin), shadcn tokens `bg-primary` (green), `text-primary-foreground`, `text-muted-foreground`, `bg-card`; ink `text-[#2d2a26]`, `text-[#6b6560]` |

`Button` has both families: `default | secondary | outline | destructive | ghost | link` for
light surfaces, `glass | glassIcon` for the immersive one. `Skeleton` is `bg-white/10`: it is
only visible on a dark surface. `StatCard` cards are white: put them on `bg-[#f5f3ee]`.

## Styling rule that matters

Styling is Tailwind utilities, but **only utilities the app already uses exist** in the
shipped stylesheet (`styles.css` → `_ds_bundle.css`). A class that the app never wrote
silently does nothing. Before using a utility, check `_ds_bundle.css`. Known gaps: there is no
`bg-white/30`, `text-7xl`, `bg-[#252320]`, `bg-muted` or `border-border`, and no
`paisaxe-*` brand color classes. Use `style={{…}}` for anything not in the stylesheet
(exact sizes, custom gradients). `dark:` variants never apply: no `.dark` class is set.

## Where the truth lives

- `styles.css` and `_ds_bundle.css`: every class and CSS variable (`--primary`, `--radius`…).
- `components/<group>/<Name>/<Name>.prompt.md` and `.d.ts`: each component's props and examples.
- `guidelines/`: the project charter (voice, design principles).

## Example: a chat panel with a booking quote

```jsx
<PaisaxeRoot locale="es">
  <div className="p-6">
    <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden" style={{ width: 460 }}>
      <div className="p-4 space-y-4">
        <div className="ml-auto max-w-[85%] p-3 rounded-2xl bg-white text-gray-900">¿Puedo reservar para 4?</div>
        <BookingCards quoteStates={{}} onAccept={() => {}} onRequote={() => {}} cards={[/* kind: "quote" … */]} />
      </div>
      <ChatComposer value="" isLoading={false} onChange={() => {}} onSubmit={(e) => e?.preventDefault()} />
    </div>
  </div>
</PaisaxeRoot>
```

Prices are integer cents with a currency (`priceCents: 12000, currency: "EUR"` → 120,00 €);
dates are ISO (`"2026-10-09"`) and times `"10:00"`.
