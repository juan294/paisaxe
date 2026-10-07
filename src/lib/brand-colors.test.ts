import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../../tailwind.config";

/**
 * #1011: the brand accent is one set of tokens (`paisaxe-green-*`), not raw
 * Tailwind greens scattered across the conversion surfaces.
 */

const ROOT = process.cwd();
const SHADES = ["200", "300", "400", "500"] as const;

type Colors = Record<string, unknown>;
const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Colors;
const paisaxe = colors.paisaxe as Record<string, Record<string, string>>;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("brand colors (#1011)", () => {
  it("defines the paisaxe green scale and nothing unused", () => {
    expect(Object.keys(paisaxe)).toEqual(["green"]);
    expect(Object.keys(paisaxe.green).sort()).toEqual([...SHADES]);
  });

  it("keeps each shade identical to the Tailwind green it replaced", () => {
    // Pixel-identical swap: Tailwind v4 defines its palette in oklch.
    const theme = fs.readFileSync(path.join(ROOT, "node_modules/tailwindcss/theme.css"), "utf-8");
    for (const shade of SHADES) {
      const match = theme.match(new RegExp(`--color-green-${shade}:\\s*([^;]+);`));
      expect(match, `green-${shade} in tailwindcss/theme.css`).not.toBeNull();
      expect(paisaxe.green[shade]).toBe(match![1].trim());
    }
  });

  it("uses no raw Tailwind green utilities in app code", () => {
    const offenders = sourceFiles(path.join(ROOT, "src")).flatMap((file) => {
      const text = fs.readFileSync(file, "utf-8");
      const hits = text.match(/(?<![\w-])(?:[a-z]+:)*[a-z]+-green-\d{2,3}\b/g) ?? [];
      return hits.filter((hit) => !hit.includes("paisaxe-green")).map((hit) => `${path.relative(ROOT, file)}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });
});
