/**
 * Shared className constants for the "glass" (dark, full-bleed backdrop)
 * variant of Paisaxe's page-level error boundaries.
 *
 * The root (`src/app/error.tsx`) and not-found (`src/app/not-found.tsx`)
 * boundaries use a solid `bg-neutral-950` treatment with a primary-accent
 * button — that variant is simple enough to stay inline in each file.
 *
 * The favorites (`src/app/favorites/error.tsx`) and immersive
 * (`src/app/immersive/error.tsx`) boundaries render over a dark, translucent
 * backdrop and intentionally use a glass/blur treatment instead (see
 * GitHub issue #897 / UX-M4 — unifying them onto the solid treatment would be
 * a visual regression). These two constants are the single source of truth
 * for that glass treatment so the two files can't silently drift apart
 * again. They match the equivalent styling already shipped in
 * `src/app/global-error.tsx`.
 */
export const GLASS_RETRY_BUTTON_CLASS =
  "bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

export const GLASS_HOME_LINK_CLASS =
  "text-white/60 hover:text-white transition-colors text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
