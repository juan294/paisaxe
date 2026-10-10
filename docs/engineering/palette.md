# Palette roles and equivalent substitutions

Phase 8 freezes these values against entry commit `0d6f8c96fb1e79f78540e21089e74712b9ebfa2d`. This is a consolidation contract, not a visual rebrand. The new `admin` and `scene` Tailwind namespaces contain invariant colors. Keep every existing explicit `dark:`, hover, focus, disabled, gradient-stop and opacity modifier when changing a class name. Source-value equality alone does not prove rendered contrast or focus; production browser comparisons remain required.

## Existing semantic and conversion roles

Preserve all `:root` and `.dark` HSL values in `src/app/base.css:5` and `src/app/base.css:28`, and their existing `hsl(var(--...))` mappings in `tailwind.config.ts:13`. These are the shared semantic background/foreground, card, popover, primary, secondary, muted, accent, destructive, border, input and ring roles. Admin's warm colors are different values; substituting `background`, `foreground` or `primary` for them changes the palette.

The existing `paisaxe.green` scale remains unchanged (`tailwind.config.ts:76`): 200 = `oklch(92.5% 0.084 155.995)`, 300 = `oklch(87.1% 0.15 154.449)`, 400 = `oklch(79.2% 0.209 151.711)`, 500 = `oklch(72.3% 0.219 149.579)`. These are the conversion accents, hover colors and focus shades already used by pricing/checkout. They are distinct from approval, agent health and chart-series greens. Retain the installed-Tailwind equivalence guard in `src/lib/brand-colors.test.ts:33`.

## Invariant admin swatches

The class suffix is `admin-<key>` (`tailwind.config.ts:47`). These fixed values do not invert automatically. A single physical swatch can serve several roles, including an inverse foreground; names are not instructions to replace existing light/dark pairings.

| Key | Exact value | Existing role and representative source |
| --- | --- | --- |
| `ink` | `#2d2a26` | Light primary text/strong action; inverse dark text, `src/components/admin/admin-shell.tsx:168` |
| `paper` | `#f5f3ee` | Light canvas; dark primary text/strong action, `src/components/admin/admin-shell.tsx:223` |
| `muted` | `#6b6560` | Secondary light text and intentional fixed terminal/inverse text, `src/components/ui/stat-card.tsx:17` |
| `subtle` | `#a39e98` | Secondary dark text, quiet labels and placeholders, `src/components/ui/stat-card.tsx:18` |
| `line` | `#e5e3de` | Light borders/skeletons; dark strong-action hover, `src/components/admin/stories-tab-panel.tsx:368` |
| `depth` | `#3d3a36` | Dark borders/muted surface; light strong-action hover, same line |
| `panel` | `#252320` | Dark card/panel, `src/components/admin/admin-shell.tsx:167` |
| `secondary` | `#4d4944` | Secondary table text and darker input borders, `src/components/admin/voice-agent-chat.tsx:274` |
| `canvas-dark` | `#1a1917` | Dark admin canvas/header, `src/components/admin/admin-shell.tsx:223` |
| `approve` | `#5a7a5a` | Approval action, selection and focus, `src/components/admin/story-card.tsx:202` |
| `approve-hover` | `#4a6a4a` | Approval hover, `src/components/admin/selection-toolbar.tsx:49` |
| `health-success` | `#7a9e7a` | Agent health and success indicator, `src/components/admin/agents-dashboard/constants.ts:47` |
| `warning` | `#c9a55c` | Pending action, warning and warm input focus, `src/components/admin/selection-toolbar.tsx:66` |
| `warning-hover` | `#b89545` | Pending-action hover, same line |
| `health-error` | `#c97a7a` | Failed health/status and stderr, `src/components/admin/agents-dashboard/terminal-display.tsx:104` |
| `delete` | `#a85454` | Delete action, `src/components/admin/selection-toolbar.tsx:83` |
| `delete-hover` | `#8b4444` | Delete hover, same line |
| `skeleton-dot` | `#d5d3ce` | Neutral loading dot, `src/components/admin/elevenlabs-analytics-panel.tsx:429` |

Preserve the actual role pairs: canvas `paper`/`canvas-dark`; panel white/`panel`; primary text `ink`/`paper`; secondary text `muted`/`subtle`; border `line`/`depth`; muted surface `paper`/`depth`; strong action `ink`/`paper` with inverse foreground and `depth`/`line` hover. Quiet text with no dark modifier must remain invariant. For example, `text-[#2d2a26] dark:text-[#f5f3ee]` becomes `text-admin-ink dark:text-admin-paper`, and `bg-[#f5f3ee]/80 dark:bg-[#1a1917]/80` becomes `bg-admin-paper/80 dark:bg-admin-canvas-dark/80`.

## Invariant visitor scene

The fixed `scene` namespace is declared in `tailwind.config.ts:67`.

| Key | Exact value | Current primitive and role |
| --- | --- | --- |
| `black` | `#000` | Installed Tailwind black; photo overlays, scene background, CTA foreground, `src/components/immersive/story-viewer.tsx:271` |
| `white` | `#fff` | Installed Tailwind white; photo text/controls and focus, `src/components/immersive/story-viewer.tsx:446` |
| `canvas` | `oklch(14.5% 0 none)` | Installed Tailwind neutral-950; fixed pricing/checkout canvas and focus offset, `src/app/pricing/page.tsx:101`, `src/app/pricing/checkout/page.tsx:99` |

Replace only these three primitive names on the scoped visitor surfaces; other neutral shades and existing semantic status colors retain their roles. Examples: `bg-black/90` → `bg-scene-black/90`, `from-black/80` → `from-scene-black/80`, `focus-visible:ring-white/70` → `focus-visible:ring-scene-white/70`, `bg-neutral-950/80` → `bg-scene-canvas/80`. Preserve the alpha and variant. Do not rewrite literal `#0a0a0a` to OKLCH on an assumption about eight-bit equivalence.

## Consumer sweep and remaining exceptions

The raw warm-value guard scans all production `.ts`, `.tsx` and `.css` under `src`, excluding test/spec files and test fixture directories. It includes shared `src/components/ui/stat-card.tsx` and `src/app/operator/[capability]/operator-dashboard.tsx`, not only admin paths. Token declarations live in `tailwind.config.ts`; no production consumer may retain one of the 18 mapped raw values. The scene utility guard covers `src/components/immersive/story-viewer.tsx`, `src/app/pricing/page.tsx`, `src/app/pricing/loading.tsx`, `src/app/pricing/checkout/page.tsx` and `src/app/pricing/checkout/return/page.tsx`. It includes gradient, ring/offset and opacity-bearing utilities. Admin theme remains class-based, default dark and system-disabled (`src/components/admin/theme-provider.tsx:8`).

Remaining raw values are permitted only in these exact file/value pairs. Sharing a file with an exception does not exempt its other colors. A new exception requires a specific role and review; the list is not permission to spread these colors.

| Exact source | Allowed values and reason |
| --- | --- |
| `src/components/booking/paypal-label.tsx:12` | `#003087`, `#0070e0`, `#001c64`: provider logo identity |
| `src/components/ui/button.tsx:29` | `#ffc439`, `#111111`, `#f2ba36`: PayPal button identity and hover |
| `src/components/admin/github-analytics-panel.tsx:322`; `src/components/admin/visitors-analytics-panel/chart.tsx:83` | `#3b82f6`, `#10b981`: fixed distinct chart series; not assumed equal to Tailwind v4 OKLCH blue/emerald |
| `src/components/admin/agents-dashboard/terminal-display.tsx:111` | `#1a1a1a`, `#111`, `#4a4540`, `#d4d0ca`: fixed terminal header/body/time/output; no theme inversion |
| `src/components/admin/agents-dashboard/cross-agent-insights.tsx:44` | `#4a4540`: explicit dark hover surface |
| `src/components/ui/stat-card.tsx:26` | `#8b7355`, `#d4c4a8`, `#a8c9a8`, `#c4d9c4`, `#6b5a8a`, `#9b7ac9`, `#c9b7e8`, `#d4c9e8`: selected warning/success/purple variants |
| `src/app/operator/[capability]/operator-dashboard.tsx:200` | `#8b7355`: operator demo-badge text and selected warning-card background |
| `src/components/admin/stories-tab-panel.tsx:377` | `#8b6c2e`, `#d4b876`: distinct light/dark warning text |
| `src/components/admin/agents-dashboard/agent-card.tsx:53` | `#fafaf8`, `#2a2724`: distinct light/dark card hover |
| `src/components/admin/costs-analytics-panel/index.tsx:180` | `#4d4a44`: dark hover; intentionally different from `#4d4944` |
| `src/components/immersive/voice-chat-elevenlabs.tsx:63` | `#fbbf24`, `#fde047`, `#f59e0b`: decorative amber conic gradients |
| `src/app/immersive/page.module.css:12` | `rgb(0 0 0 / 90%)`: static pre-hydration recovery overlay |
| `src/app/layout.tsx:30` | `#0a0a0a`: literal theme metadata and static root background |
| `src/app/coming-soon/page.tsx:56`; `src/components/admin/maintenance-config-panel.tsx:176` | `#030303`: maintenance scene and matching admin preview |
| `src/lib/og-image-helpers.ts:5` | `#0a0f1a`, `#0d1b2a`, `#ffffff`, `#94a3b8`, `#38bdf8`, `#22c55e`, `#a78bfa`, `#f97316`, `#eab308`, `#06b6d4`: existing centralized server image palette/category roles; CSS tokens are not renderer inputs |

The encoded SVG placeholder `#1a1a1a` in `src/components/immersive/story-viewer.tsx:67` remains a separate image-data value; the raw CSS-color sweep does not decode image URLs. Existing named Tailwind error/warning/category colors, white/black utilities outside the scoped scene sweep, and HSL semantic declarations remain intentional. This document does not establish native-language, provider, hosted or deployed evidence.

The implementation substitutes 1,997 warm utility suffixes across 55 production consumers and 41 scene utilities across the five scoped visitor files. A private per-file inventory binds the original, modified and exact reversed bytes; all 60 consumer reversals matched, including the separately reviewed viewer image-priority changes present before the palette sweep. The palette test remains frozen from its pre-implementation RED capture. Normal builds pass. Ninety compiled utility cases render the same physical colors, and 16 final same-platform canonical desktop/mobile snapshots match the fresh baseline without rewriting checked-in Linux snapshots. Four actual admin desktop/mobile light/dark cases preserve native keyboard focus, editor opening and Escape recovery; all eight focus/editor captures were visually reviewed. Canonical admin UI separately verifies touch. This is representative equivalence evidence, not an exhaustive numerical contrast audit or a mobile-layout repair. The Phase 8 implementation record and private handoff preserve exact candidate/build identities and all earlier invalid helper attempts.
