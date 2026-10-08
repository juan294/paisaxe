# /design-sync notes (Paisaxe)

Paisaxe is a Next.js app, not a published component package. These notes record how the
sync works around that, and what a re-sync should watch.

## How the build is wired

- **Curated entry** `.design-sync/entry/index.tsx`: re-exports exactly the agreed scope from
  `src/` and defines `PaisaxeRoot` (LanguageProvider + the `<body>` classes from
  `src/app/layout.tsx`: `font-sans antialiased bg-neutral-950`). The converter's synth mode
  would re-export every file under `src/` (pages, server-only modules) and break the bundle,
  so the build always passes `--entry ./.design-sync/entry/index.tsx`.
- **CSS**: compiled by the Tailwind v4 CLI from `.design-sync/tailwind.css` into
  `.design-sync/.cache/paisaxe.css` (gitignored; `cfg.buildCmd` regenerates it). That entry
  imports the app's `src/app/base.css` and `tailwind.config.ts`, so it is the app CSS plus
  the classes only the previews use. Tailwind v4 scans every committed file, so the app's
  `globals.css` has `@source not "../../.design-sync"` (without it, preview classes and the
  "gap" classes named in conventions.md leaked into production CSS), and the sync entry
  excludes `conventions.md` and `NOTES.md` for the same reason. Never point the sync at
  `globals.css`: the exclusion is inherited through `@import` and the previews lose their
  classes. Otherwise only utilities the app already uses exist.
- **Types**: no `.d.ts` tree exists, so `cfg.buildCmd` also runs
  `tsc -p .design-sync/tsconfig.dts.json`, emitting declarations into `build/ts/`
  (gitignored), which the converter finds first. Without it every contract degrades to
  `[key: string]: unknown`.
- **`dtsPropsFor`**: shadcn primitives (Card, Dialog, Input, Label, Select, Skeleton,
  Textarea, Tooltip) only extend DOM props, which the extractor filters out by design; their
  useful props are hand-written in the config. `BalanceInvoiceStatusView` declares inline
  props the extractor misses. The skeletons and LanguageSwitcher genuinely take no props.
- **Guidelines**: only `docs/project/project-charter.md` (voice, design principles). The
  default glob picked up an old health report and a QA-agent guide; both excluded.
- **Fonts**: none shipped, correctly. Production `font-sans` is the system stack
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto…`). The unused Inter load was
  removed (#1010), so the app ships no web font either.
- **Scope left out** (need the Next.js runtime: next/link, next/image, router): StoryViewer,
  RelatedStories, BookmarkButton, ChatHeader, ChatMessageList, ChatUpsellCTA; and all admin
  components.

## Build command (from the repo root)

Stage the converter first (it is gitignored): copy the skill's scripts into `.ds-sync/`, then
`echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json && (cd .ds-sync && npm i esbuild ts-morph @types/react)`.
Without those deps the driver dies on `Cannot find package 'ts-morph'`.

```bash
npx --yes @tailwindcss/cli@4.3.3 -i .design-sync/tailwind.css -o .design-sync/.cache/paisaxe.css \
  && rm -rf build/ts && npx tsc -p .design-sync/tsconfig.dts.json
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./.design-sync/entry/index.tsx --out ./ds-bundle
NODE_PATH=$PWD/node_modules node .ds-sync/package-validate.mjs ./ds-bundle
```

`tsc` prints nothing on success; the repo's own playwright (1.63, chromium 1243 cached) serves
the render check via `NODE_PATH`.

## Upload

- The upload service times out at 60 s intermittently. `_vendor/react.js` is 1.2 MB (the
  converter builds a development React on purpose, `lib/emit.mjs`, not forkable) and needed
  three attempts on the first push; at the 2026-10-07 close-out three more attempts all timed
  out. It is esbuilt from `node_modules/react` (React 19 has no UMD), so it only changes when
  React is bumped: if it times out and React did not change, the remote copy is already
  current. Send it alone; chunk the rest small (~75 files per call worked); `list_files`
  after any timeout, because a timed-out write can still land. On 2026-10-07 (booking
  polish) `_ds_bundle.js` (748 KB) also timed out three times and reset once before landing
  on the fifth attempt, sent alone; the other 150 files went in two batches of ~75.

## Known render warns

- None open. `[GRID_OVERFLOW]` flagged 11 wide previews; resolved with
  `overrides.<Name>.cardMode: "column"` (CancellationConfirm, Card, Input, Skeleton,
  StatCard, Textarea, CategoryFilterBadge, StoryInfoPanel, StoryProgressBar, BookingCards,
  ChatComposer; Button and PaymentReceipt since the 2026-10-07 booking polish). A warn not
  listed here is new.

## Authoring previews (what cost a debugging cycle)

- `PaisaxeRoot` paints the page `bg-neutral-950`. A light preview needs a FULL-width
  wrapper (`<div className="bg-white p-6"><div style={{width: N}}>…`), or the dark root
  shows beside it.
- `Skeleton` is `bg-white/10`: invisible on white. Preview it on the dark root.
- `StatCard` cards are `bg-white`: invisible on white. Admin puts them on `bg-[#f5f3ee]`.
- Immersive components (StoryInfoPanel, StoryProgressBar, CategoryFilterBadge) are
  `absolute`: give them a `relative` frame with explicit size and a stand-in photo gradient
  via `style`. Keep frames <= ~760 px wide: a 960 px frame was clipped by the card and hid
  the panel's top-right hide button.
- Chat/booking components are previewed inside the chat panel's frosted surface
  (`rounded-2xl border border-white/20 bg-white/10`), and booking ones inside the
  CardShell look (`rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white`).
- `FreshnessBadge` renders nothing unless `createdAt` is within the freshness window:
  previews pass `new Date().toISOString()`.
- Re-run the Tailwind CLI after editing previews: it scans `.design-sync/previews/`, so a
  class used only there exists only after recompiling `.design-sync/.cache/paisaxe.css`.

## Booking polish (2026-10-07)

- `PaymentReceipt` joined the scope. `TravellerShell`/`TicketCard` stay out (their file
  imports next/image and next/link); conventions.md spells out the smoked ticket panel instead.
- The PayPal logo in `PayPalLabel` is inline SVG on purpose: an app-relative `<img>` rendered
  as a broken image in the preview cards (and would in every design).

## Findings for the app (not sync issues)

- Both findings from the first sync are fixed: Inter removed (#1010); the brand accent is
  the `paisaxe-green-200..500` scale, adopted on every conversion surface, with blue and sand
  dropped (#1011).

## Re-sync risks

- `.design-sync/entry/index.tsx` and `componentSrcMap` enumerate the scope by hand: a
  renamed or moved component file breaks the build loudly; a NEW component is silently not
  synced until added to both.
- `dtsPropsFor` bodies are hand-written: they go stale silently if a primitive's real API
  changes.
- Contracts that reference app types (e.g. `ShareButton.story: Story`) name the type without
  defining it; the previews are where the agent learns the shape.
- `.design-sync/conventions.md` (README header) names classes that must exist in the
  compiled CSS, and lists known gaps (`bg-white/30`, `text-7xl`, `bg-[#252320]`, `bg-muted`,
  `border-border`) and the `paisaxe-green-*` utilities it recommends. The app changing its class usage can make either list
  stale: re-validate against `_ds_bundle.css` on every sync.
- The Tailwind CLI version is pinned in `buildCmd` (4.3.3, matching the app); bump both
  together.
