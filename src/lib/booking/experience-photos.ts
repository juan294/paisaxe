/**
 * The photo behind a booking's ticket, by experience slug
 * (docs/plans/2026-10-07-booking-ui-polish.md, D2). Experiences have no image
 * column; the fixture's three slugs (migration 116) borrow story photos.
 *
 * Chosen by what each photo shows, not by its file name: many files in
 * public/images/stories do not show the place they are named after.
 */
export const EXPERIENCE_PHOTOS: Readonly<Record<string, string>> = {
  // Small boats on calm water at dusk.
  "descenso-canoa": "/images/stories/camino-camara-santa-de-oviedo.webp",
  // A coastal boardwalk at sunset.
  "paseo-senda-costera": "/images/stories/camino-camino-del-norte.webp",
  // A green mountain valley seen from above.
  "ruta-miradores-4x4": "/images/stories/quesos-asturianos.webp",
};

/** A walker by a river and waterfall. */
export const FALLBACK_PHOTO = "/images/stories/aventura-en-los-picos.webp";

export function experiencePhoto(slug: string | null): string {
  return (slug && EXPERIENCE_PHOTOS[slug]) || FALLBACK_PHOTO;
}
