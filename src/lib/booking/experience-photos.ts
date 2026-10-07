/**
 * The photo behind a booking's ticket, by experience slug
 * (docs/plans/2026-10-07-booking-ui-polish.md, D2). Experiences have no image
 * column; the fixture's three slugs (migration 116) borrow story photos.
 */
export const EXPERIENCE_PHOTOS: Readonly<Record<string, string>> = {
  "descenso-canoa": "/images/stories/descenso-del-sella.webp",
  "paseo-senda-costera": "/images/stories/cabo-vidio.webp",
  "ruta-miradores-4x4": "/images/stories/lagos-de-covadonga.webp",
};

export const FALLBACK_PHOTO = "/images/stories/aventura-en-los-picos.webp";

export function experiencePhoto(slug: string | null): string {
  return (slug && EXPERIENCE_PHOTOS[slug]) || FALLBACK_PHOTO;
}
