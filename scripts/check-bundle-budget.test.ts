import { gzipSync } from "zlib";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { checkBundleBudget } from "./check-bundle-budget";

/**
 * Builds a fixture that mirrors the REAL shape of a Turbopack `.next` production build,
 * confirmed against an actual `npm run build` output on 2026-08-18:
 *
 *   .next/server/app/index.html                  — references chunks via <script src>/<link preload>
 *   .next/server/app/immersive.html
 *   .next/server/app/story/[slug].html            — empty (0 bytes) dynamic route template
 *   .next/server/app/immersive.segments/...       — PPR segment data, NOT a route's own HTML
 *   .next/static/chunks/<hash>.js                 — the actual chunk files referenced above
 */
function createBuildFixture(routes: Record<string, string[] /* chunk file names referenced */>): string {
  const buildDir = mkdtempSync(join(tmpdir(), "paisaxe-bundle-budget-"));
  const appDir = join(buildDir, "server", "app");
  const chunksDir = join(buildDir, "static", "chunks");
  mkdirSync(appDir, { recursive: true });
  mkdirSync(chunksDir, { recursive: true });

  const allChunks = new Set(Object.values(routes).flat());
  for (const chunk of allChunks) {
    // Distinct, non-trivial content per chunk so gzip sizes differ meaningfully.
    writeFileSync(join(chunksDir, chunk), `/* chunk ${chunk} */\n` + "console.log('x');\n".repeat(50));
  }

  for (const [routeFile, chunks] of Object.entries(routes)) {
    const htmlPath = join(appDir, routeFile);
    mkdirSync(join(htmlPath, ".."), { recursive: true });
    const scripts = chunks
      .map((c, i) =>
        i % 2 === 0
          ? `<script src="/_next/static/chunks/${c}" async=""></script>`
          : `<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/${c}"/>`
      )
      .join("\n");
    writeFileSync(htmlPath, `<!doctype html><html><head>${scripts}</head><body></body></html>`);
  }

  // Dynamic route template placeholder: 0 bytes, no chunk refs, must be skipped silently.
  mkdirSync(join(appDir, "story"), { recursive: true });
  writeFileSync(join(appDir, "story", "[slug].html"), "");

  // PPR segments directory must not be walked as if it contained a route's HTML.
  const segmentsDir = join(appDir, "immersive.segments", "immersive");
  mkdirSync(segmentsDir, { recursive: true });
  writeFileSync(join(segmentsDir, "not-a-route.html"), "<script src=\"/_next/static/chunks/should-not-count.js\"></script>");

  return buildDir;
}

describe("checkBundleBudget", () => {
  it("sums gzip bytes per route from real-shaped Turbopack HTML + chunk references", () => {
    const buildDir = createBuildFixture({
      "index.html": ["shared-a.js", "shared-b.js"],
      "immersive.html": ["shared-a.js", "shared-b.js", "immersive-only.js"],
    });

    const report = checkBundleBudget({ buildDir });

    expect(report.structuralError).toBeUndefined();
    const index = report.routes.find((r) => r.route === "/")!;
    const immersive = report.routes.find((r) => r.route === "/immersive")!;

    expect(index.chunkCount).toBe(2);
    expect(immersive.chunkCount).toBe(3);

    const sharedA = gzipSync(`/* chunk shared-a.js */\n` + "console.log('x');\n".repeat(50), { level: 9 }).length;
    const sharedB = gzipSync(`/* chunk shared-b.js */\n` + "console.log('x');\n".repeat(50), { level: 9 }).length;
    const immersiveOnly = gzipSync(`/* chunk immersive-only.js */\n` + "console.log('x');\n".repeat(50), {
      level: 9,
    }).length;

    expect(index.gzipBytes).toBe(sharedA + sharedB);
    expect(immersive.gzipBytes).toBe(sharedA + sharedB + immersiveOnly);
  });

  it("does not count chunk references found inside a *.segments directory", () => {
    const buildDir = createBuildFixture({ "index.html": ["shared-a.js"] });

    const report = checkBundleBudget({ buildDir });

    expect(report.routes.some((r) => r.route.includes("segments"))).toBe(false);
    expect(report.routes.some((r) => r.route.includes("not-a-route"))).toBe(false);
  });

  it("skips empty dynamic-route template HTML instead of treating it as a 0KB violation", () => {
    const buildDir = createBuildFixture({ "index.html": ["shared-a.js"] });

    const report = checkBundleBudget({ buildDir });

    expect(report.routes.some((r) => r.route === "/story/[slug]")).toBe(false);
  });

  it("passes when every route is within its budget", () => {
    const buildDir = createBuildFixture({ "index.html": ["shared-a.js"] });

    const report = checkBundleBudget({ buildDir });

    expect(report.violations).toEqual([]);
  });

  it("fails when a route exceeds its budget", () => {
    const buildDir = mkdtempSync(join(tmpdir(), "paisaxe-bundle-budget-over-"));
    const appDir = join(buildDir, "server", "app");
    const chunksDir = join(buildDir, "static", "chunks");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(chunksDir, { recursive: true });

    // One oversized, low-entropy-resistant chunk (random bytes so gzip can't shrink it
    // away), well beyond any route budget defined in check-bundle-budget.ts.
    const bigContent = Buffer.from(
      Array.from({ length: 1_000_000 }, () => Math.floor(Math.random() * 256))
    );
    writeFileSync(join(chunksDir, "huge.js"), bigContent);
    writeFileSync(join(appDir, "index.html"), '<script src="/_next/static/chunks/huge.js"></script>');

    const report = checkBundleBudget({ buildDir });

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].route).toBe("/");
    expect(report.violations[0].gzipBytes).toBeGreaterThan(report.violations[0].budgetBytes);
  });

  it("fails loudly with a structural error instead of silently reporting 0KB when the expected build shape is missing", () => {
    const buildDir = mkdtempSync(join(tmpdir(), "paisaxe-bundle-budget-empty-"));
    // No .next/server/app directory at all — simulates a build that didn't run, or a
    // Next.js version that changed the output layout.

    const report = checkBundleBudget({ buildDir });

    expect(report.structuralError).toBeDefined();
    expect(report.structuralError).toMatch(/zero JS chunks/i);
    expect(report.violations).toEqual([]);
    expect(report.routes).toEqual([]);
  });

  it("fails loudly when HTML exists but references no chunks at all (broken parser regex)", () => {
    const buildDir = mkdtempSync(join(tmpdir(), "paisaxe-bundle-budget-nochunks-"));
    const appDir = join(buildDir, "server", "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "index.html"), "<!doctype html><html><body>no chunk refs here</body></html>");

    const report = checkBundleBudget({ buildDir });

    expect(report.structuralError).toBeDefined();
  });
});
