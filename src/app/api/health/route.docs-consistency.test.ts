import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

// DO-H5: operational runbooks under docs/operations/ contain `jq` expressions
// that read fields off the /api/health response body. When a field is removed
// from PublicHealthResponse (as `.supabase` and `.services.*` were during
// SE-M1's response minimization), a runbook that still names it silently
// returns `null` forever — misdirecting an operator during an incident.
//
// This test does NOT grep runbook prose for expected wording (that would be
// fragile and would false-fail on any unrelated doc edit). Instead it:
//   1. Extracts the literal jq path from any runbook line that pipes
//      `/api/health` output through `jq '<path>'`.
//   2. Resolves that same path against the *actual* runtime response body
//      produced by the real GET(new Request("http://localhost/api/health")) handler (mocked to a healthy state).
// A path that doesn't resolve fails the test — keyed on the live response
// shape (effectively PublicHealthResponse), not on matching doc text.

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  probeRateLimitBackend: vi.fn(() => ({
    backend: "memory",
    configured: false,
    degraded: false,
  })),
}));

import { supabase } from "@/lib/supabase";

function resolved(value: unknown) {
  return { abortSignal: vi.fn().mockReturnValue(Promise.resolve(value)) };
}

function mockHealthySupabase(): void {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const lastEq = vi.fn().mockReturnValue(resolved({ count: 1, error: null }));
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
      return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
    }

    return {
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue(resolved({ error: null })),
      }),
    } as never;
  });

  vi.mocked(supabase.rpc).mockReturnValue(resolved({ data: 129394278, error: null }) as never);
}

interface HealthJqReference {
  file: string;
  line: number;
  path: string;
  raw: string;
}

const OPS_DOCS_DIR = join(process.cwd(), "docs/operations");

/**
 * Scan every markdown file in docs/operations/ for a line that both
 * mentions `/api/health` and pipes through a simple dotted `jq '<path>'`
 * filter (the only form these runbooks use — no jq functions, slices, or
 * pipes-within-the-filter). Bare `jq` with no filter (pretty-print) is
 * intentionally not flagged — it doesn't name a specific field.
 */
function findHealthJqReferences(): HealthJqReference[] {
  const refs: HealthJqReference[] = [];
  const files = readdirSync(OPS_DOCS_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = readFileSync(join(OPS_DOCS_DIR, file), "utf-8");
    content.split("\n").forEach((line, idx) => {
      if (!line.includes("/api/health")) return;
      const match = line.match(/jq\s+'\.([a-zA-Z0-9_.]*)'/);
      if (!match) return;
      refs.push({ file, line: idx + 1, path: match[1], raw: line.trim() });
    });
  }

  return refs;
}

function resolvePath(
  obj: unknown,
  path: string
): { found: boolean; value: unknown } {
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      !(part in (current as Record<string, unknown>))
    ) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[part];
  }
  return { found: true, value: current };
}

describe("docs-vs-code: /api/health jq references in docs/operations", () => {
  let body: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    mockHealthySupabase();
    body = await (await GET(new Request("http://localhost/api/health"))).json();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolvePath detects a known-removed field as not found (guards against a no-op test)", () => {
    // These fields existed before SE-M1's public response minimization and
    // are exactly what the DO-H5 finding says runbooks still referenced.
    expect(resolvePath(body, "supabase").found).toBe(false);
    expect(resolvePath(body, "services.supabase.latency_ms").found).toBe(false);
    expect(resolvePath(body, "services.supabase").found).toBe(false);

    // Sanity: a field that does exist resolves.
    expect(resolvePath(body, "status").found).toBe(true);
  });

  it("every jq path referenced against /api/health in docs/operations resolves on the live response shape", () => {
    const refs = findHealthJqReferences();

    // Sanity: the scan must actually find the references known to exist in
    // the runbooks today (database-backup.md, migration-policy.md,
    // vercel-regions.md all pipe /api/health through `jq '.status'`).
    expect(refs.length).toBeGreaterThan(0);

    const failures = refs
      .map((ref) => ({ ref, ...resolvePath(body, ref.path) }))
      .filter((r) => !r.found)
      .map(
        (r) =>
          `${r.ref.file}:${r.ref.line} references jq path '.${r.ref.path}' ` +
          `which does not exist on the current /api/health response ` +
          `(see PublicHealthResponse in src/app/api/health/route.ts). ` +
          `Line: ${r.ref.raw}`
      );

    expect(failures).toEqual([]);
  });
});
