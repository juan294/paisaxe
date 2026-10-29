import { expect, it } from "vitest";
import {
  buildExperienceMatchCopy,
  formatExperienceMatchPrefill,
} from "./experience-match-copy";
import { es } from "@/lib/i18n/es";
import { en } from "@/lib/i18n/en";
import { ast } from "@/lib/i18n/ast";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { pt } from "@/lib/i18n/pt";
import { resolveTranslation } from "@/lib/i18n/resolve";

it("provides every matching copy key in all six dictionaries", () => {
  const collect = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(collect)
        : Object.values(value as object).flatMap(collect);
  for (const dictionary of [es, en, ast, fr, de, pt]) {
    const copy = buildExperienceMatchCopy((key) =>
      resolveTranslation(key, dictionary),
    );
    expect(
      collect(copy).every(
        (value) => value.trim().length > 0 && !value.startsWith("booking."),
      ),
    ).toBe(true);
    expect(copy.budgetDisclosure).not.toBe(copy.consumptionDisclosure);
  }
});

it("prefills exact title and explicit hard criteria without inventing omitted criteria", () => {
  const t = (key: string) => resolveTranslation(key, es);
  const message = formatExperienceMatchPrefill(
    "Paseo exacto 🛶",
    {
      date: "2026-10-30",
      partySize: 2,
      budgetCents: 4050,
      constraints: { step_free: true, min_age: 0, language: "en" },
    },
    t,
    "es",
  );
  expect(message).toContain("Paseo exacto 🛶");
  expect(message).toContain("2026-10-30");
  expect(message).toContain(". Fecha:");
  expect(message).toContain("Personas: 2");
  expect(message).toMatch(/40,50\s*€/);
  expect(message).toContain("Acceso sin escalones");
  expect(message).toContain("Edad mínima: 0");
  expect(message).toContain("Inglés");
  const minimal = formatExperienceMatchPrefill("Título intacto", {}, t, "es");
  expect(minimal).toBe("Quiero Título intacto.");
});


it("preserves transport, pets, zero budget and an untranslated valid language code without inventing date or party", () => {
  const t = (key: string) => resolveTranslation(key, es);
  const message = formatExperienceMatchPrefill("Título literal", { budgetCents: 0, constraints: { public_transport: true, pets: true, language: "it" } }, t, "es");
  expect(message).toContain("Título literal"); expect(message).toMatch(/0,00\s*€/);
  expect(message).toContain(t("booking.match.publicTransport")); expect(message).toContain(t("booking.match.pets"));
  expect(message).toContain(`${t("booking.match.languageRequirement")}: it`);
  expect(message).not.toContain("booking.match.languageNames.it");
  expect(message).not.toContain("Fecha:"); expect(message).not.toContain("Personas:");
});
