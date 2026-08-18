import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

// PE-H3: enforces a per-route client JS budget measured from the ACTUAL Turbopack
// production build (the bundler this project ships with — `next build` uses Turbopack
// by default; only the unused `analyze`/`build:analyze` scripts force webpack).
//
// How it works: Next's prerendered HTML for each route (`.next/server/app/**/*.html`)
// references its client chunks via `<script src="/_next/static/chunks/...">` and
// `<link rel="preload" as="script" href="...">` tags. We resolve each unique chunk
// referenced by a route to its file in `.next/static/chunks/`, gzip it, and sum the
// bytes. That total is compared against a committed budget per route.
//
// Gzip vs. reality: Vercel serves brotli, not gzip, so these numbers are not the exact
// bytes a visitor downloads — gzip is a stable, dependency-free proxy for TRACKING
// DELTAS over time (did this PR add 40KB to /immersive?), not an assertion about
// absolute production payload size.
//
// Fragility: this parser depends on Next-internal output shapes (`.next/server/app/*.html`
// file layout, `/_next/static/chunks/...` reference format) that can change across a
// Next.js major upgrade. If that happens, this script must fail LOUDLY (see
// `NO_CHUNKS_FOUND_ERROR`) rather than silently reporting 0KB and passing.

export interface RouteBundleResult {
  /** Route path derived from the HTML file location, e.g. "/", "/immersive". */
  route: string;
  /** Sum of gzip bytes across every unique chunk referenced by this route. */
  gzipBytes: number;
  /** Number of unique chunk files referenced. */
  chunkCount: number;
}

export interface BudgetViolation {
  route: string;
  gzipBytes: number;
  budgetBytes: number;
}

export interface BundleBudgetReport {
  routes: RouteBundleResult[];
  violations: BudgetViolation[];
  /** Total unique chunk references found across all routes combined. */
  totalChunksFound: number;
  /** Set when the expected build output structure is missing/empty — a signal the
   * parser needs updating for a new Next.js version, not that the budget passed. */
  structuralError?: string;
}

export interface RouteBudgetRule {
  name: string;
  matches: (route: string) => boolean;
  maxGzipBytes: number;
}

/**
 * Per-route budgets, seeded from real Turbopack production build measurements taken
 * 2026-08-18 (see docs/agents/pre-launch-report.md, finding PE-H3), with ~15% headroom
 * added so ordinary variance doesn't cause false failures. Update the measured value in
 * the comment (not just the budget) whenever you deliberately raise a budget, so the
 * next person can tell "current measurement" from "headroom."
 *
 * Order matters: the first matching rule wins, so put more specific routes first.
 */
export const ROUTE_BUDGET_RULES: RouteBudgetRule[] = [
  // Measured: 336,102 B gzip (20 chunks)
  { name: "admin", matches: (r) => r === "/admin", maxGzipBytes: 387_000 },
  // Measured: 305,035 B gzip (23 chunks) — the immersive map experience, the app's heaviest visitor-facing route.
  { name: "immersive", matches: (r) => r === "/immersive", maxGzipBytes: 351_000 },
  // Measured: 267,810 B gzip (17 chunks)
  { name: "favorites", matches: (r) => r === "/favorites", maxGzipBytes: 308_000 },
  // Measured: 251,807 B gzip (16 chunks) — largest of the /pricing* family (checkout).
  { name: "pricing", matches: (r) => r === "/pricing" || r.startsWith("/pricing/"), maxGzipBytes: 290_000 },
  // Fallback for every other static route (index, story/*, about, privacy, terms,
  // coming-soon, _not-found, _global-error, and any new static route added later).
  // Measured max: 244,324 B gzip (about/privacy/terms, 15 chunks).
  { name: "default", matches: () => true, maxGzipBytes: 281_000 },
];

const NO_CHUNKS_FOUND_ERROR =
  "Bundle budget check found zero JS chunks referenced by any route in .next/server/app/**/*.html. " +
  "This almost always means the parser is out of sync with a Next.js build-output format change " +
  "(expected `/_next/static/chunks/*.js` references inside prerendered HTML), NOT that the app " +
  "shipped 0KB of JS. Budget check cannot run — update the parser in scripts/check-bundle-budget.ts " +
  "rather than let this silently report a passing 0KB budget.";

interface ParsedHtmlRoute {
  route: string;
  chunkFiles: string[];
}

function walkHtmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // `.next/server/app/foo.segments/` holds PPR streaming data, not a route's own HTML.
      if (entry.name.endsWith(".segments")) continue;
      out.push(...walkHtmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

function htmlPathToRoute(appDir: string, htmlPath: string): string {
  const rel = relative(appDir, htmlPath).replace(/\.html$/, "");
  return rel === "index" ? "/" : `/${rel}`;
}

const CHUNK_REF_PATTERN = /\/_next\/static\/chunks\/([^"'\s>]+\.js)/g;

function parseHtmlFile(appDir: string, htmlPath: string): ParsedHtmlRoute | null {
  // Dynamic route templates (e.g. app/story/[slug]/page.tsx's own placeholder HTML)
  // are written out as empty files — nothing to measure, and not a real page.
  if (statSync(htmlPath).size === 0) return null;

  const html = readFileSync(htmlPath, "utf8");
  const chunkFiles = [...new Set([...html.matchAll(CHUNK_REF_PATTERN)].map((m) => m[1]))];
  return { route: htmlPathToRoute(appDir, htmlPath), chunkFiles };
}

function budgetForRoute(route: string): RouteBudgetRule {
  const rule = ROUTE_BUDGET_RULES.find((r) => r.matches(route));
  if (!rule) throw new Error(`No budget rule matched route "${route}" — the default rule should always match.`);
  return rule;
}

export interface CheckBundleBudgetOptions {
  /** Path to the Next.js build output directory. Defaults to "<cwd>/.next". */
  buildDir?: string;
}

export function checkBundleBudget(options: CheckBundleBudgetOptions = {}): BundleBudgetReport {
  const buildDir = options.buildDir ?? join(process.cwd(), ".next");
  const appDir = join(buildDir, "server", "app");
  const chunksDir = join(buildDir, "static", "chunks");

  const gzipSizeCache = new Map<string, number>();
  function gzipSizeOf(chunkFile: string): number {
    const cached = gzipSizeCache.get(chunkFile);
    if (cached !== undefined) return cached;
    const chunkPath = join(chunksDir, chunkFile);
    const size = existsSync(chunkPath) ? gzipSync(readFileSync(chunkPath), { level: 9 }).length : 0;
    gzipSizeCache.set(chunkFile, size);
    return size;
  }

  const htmlFiles = walkHtmlFiles(appDir);
  const parsedRoutes = htmlFiles
    .map((f) => parseHtmlFile(appDir, f))
    .filter((r): r is ParsedHtmlRoute => r !== null && r.chunkFiles.length > 0);

  const totalChunksFound = new Set(parsedRoutes.flatMap((r) => r.chunkFiles)).size;

  if (totalChunksFound === 0) {
    return { routes: [], violations: [], totalChunksFound: 0, structuralError: NO_CHUNKS_FOUND_ERROR };
  }

  const routes: RouteBundleResult[] = parsedRoutes
    .map(({ route, chunkFiles }) => ({
      route,
      gzipBytes: chunkFiles.reduce((sum, chunk) => sum + gzipSizeOf(chunk), 0),
      chunkCount: chunkFiles.length,
    }))
    .sort((a, b) => b.gzipBytes - a.gzipBytes);

  const violations: BudgetViolation[] = [];
  for (const r of routes) {
    const budget = budgetForRoute(r.route);
    if (r.gzipBytes > budget.maxGzipBytes) {
      violations.push({ route: r.route, gzipBytes: r.gzipBytes, budgetBytes: budget.maxGzipBytes });
    }
  }

  return { routes, violations, totalChunksFound };
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function runCli(): void {
  const report = checkBundleBudget();

  if (report.structuralError) {
    console.error(`✗ ${report.structuralError}`);
    process.exit(1);
  }

  console.log("Bundle budget report (gzip, per route, Turbopack build):\n");
  for (const r of report.routes) {
    const budget = budgetForRoute(r.route);
    const status = r.gzipBytes > budget.maxGzipBytes ? "OVER" : "ok";
    console.log(
      `  ${status === "OVER" ? "✗" : "✓"} ${r.route.padEnd(28)} ${formatKb(r.gzipBytes).padStart(9)} / ${formatKb(budget.maxGzipBytes).padStart(9)} budget (${r.chunkCount} chunks) [${budget.name}]`
    );
  }

  if (report.violations.length > 0) {
    console.error(`\n✗ ${report.violations.length} route(s) exceeded their bundle budget:\n`);
    for (const v of report.violations) {
      console.error(`  ${v.route}: ${formatKb(v.gzipBytes)} > ${formatKb(v.budgetBytes)} budget`);
    }
    console.error(
      "\nIf this growth is intentional, update the relevant budget (and its 'Measured:' comment) in scripts/check-bundle-budget.ts."
    );
    process.exit(1);
  }

  console.log(`\n✓ All ${report.routes.length} routes within budget.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
