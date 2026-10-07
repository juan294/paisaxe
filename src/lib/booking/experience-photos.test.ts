import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPERIENCE_PHOTOS, FALLBACK_PHOTO, experiencePhoto } from "./experience-photos";

describe("experiencePhoto", () => {
  it("gives each of the three fixture experiences its own photo (plan D2)", () => {
    const photos = ["descenso-canoa", "paseo-senda-costera", "ruta-miradores-4x4"].map(experiencePhoto);
    expect(new Set([...photos, FALLBACK_PHOTO]).size).toBe(4);
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
