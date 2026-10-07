import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPERIENCE_PHOTOS, FALLBACK_PHOTO, experiencePhoto } from "./experience-photos";

describe("experiencePhoto", () => {
  it("maps the three fixture experiences to their story photos (plan D2)", () => {
    expect(experiencePhoto("descenso-canoa")).toBe("/images/stories/descenso-del-sella.webp");
    expect(experiencePhoto("paseo-senda-costera")).toBe("/images/stories/cabo-vidio.webp");
    expect(experiencePhoto("ruta-miradores-4x4")).toBe("/images/stories/lagos-de-covadonga.webp");
  });

  it("falls back for an unknown or missing slug", () => {
    expect(experiencePhoto("otra-experiencia")).toBe(FALLBACK_PHOTO);
    expect(experiencePhoto(null)).toBe(FALLBACK_PHOTO);
  });

  it("only points at photos that ship in public/", () => {
    for (const path of [...Object.values(EXPERIENCE_PHOTOS), FALLBACK_PHOTO]) {
      expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true);
    }
  });
});
