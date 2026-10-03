/**
 * Vector search through the same path the app uses: PostgREST with the public
 * anon key calling match_chunks (migration 111).
 *
 * Why this exists: migration 086 declared a STABLE function that executed
 * `SET LOCAL hnsw.ef_search`, which PostgreSQL rejects when the function is
 * called ("SET is not allowed in a non-volatile function"). Nothing ever called
 * the function against a real database, so the bug (and the IVFFlat index left in
 * production, with ~1% recall) went unnoticed while every chat answer shipped
 * with zero sources.
 *
 * Needs the local Supabase Docker stack (`supabase start`); skipped when it is
 * not reachable, like the other *.postgrest-rls tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOCAL_ANON_KEY as ANON_KEY,
  LOCAL_REST_URL as REST_URL,
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("match-chunks.postgrest-rls.test.ts");
}

const SOURCE = "mc-test.pdf";
const DIMS = 512;

/** A 512-dim unit vector pointing along one axis: orthogonal to every other axis. */
function axis(index: number): number[] {
  return Array.from({ length: DIMS }, (_, i) => (i === index ? 1 : 0));
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function matchChunks(embedding: number[], threshold: number, count = 5) {
  const res = await fetch(`${REST_URL}/rpc/match_chunks`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
    }),
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

describe.skipIf(!dbReachable)("match_chunks (live local Supabase)", () => {
  beforeAll(() => {
    psql(`DELETE FROM public.chunks WHERE source_pdf = '${SOURCE}';`);
    psql(
      `INSERT INTO public.chunks (content, source_pdf, page_number, embedding) VALUES ` +
        `('MC-TEST axis 0', '${SOURCE}', 1, '${vectorLiteral(axis(0))}'::vector), ` +
        `('MC-TEST axis 1', '${SOURCE}', 2, '${vectorLiteral(axis(1))}'::vector), ` +
        `('MC-TEST axis 2', '${SOURCE}', 3, '${vectorLiteral(axis(2))}'::vector);`
    );
  });

  afterAll(() => {
    psql(`DELETE FROM public.chunks WHERE source_pdf = '${SOURCE}';`);
  });

  it("is callable by the anon role and returns the nearest chunk with similarity ~1", async () => {
    const { status, body } = await matchChunks(axis(0), 0.5);

    expect(status).toBe(200);
    const rows = body as Array<{ content: string; similarity: number }>;
    expect(rows.map((r) => r.content)).toEqual(["MC-TEST axis 0"]);
    expect(rows[0].similarity).toBeGreaterThan(0.999);
  });

  it("applies the similarity threshold: orthogonal chunks are not returned", async () => {
    const { body } = await matchChunks(axis(5), 0.5);

    expect(body).toEqual([]);
  });

  it("orders by similarity and honours match_count", async () => {
    const blend = Array.from({ length: DIMS }, (_, i) => (i === 0 ? 0.9 : i === 1 ? 0.4 : 0));
    const { body } = await matchChunks(blend, -1, 2);

    const rows = body as Array<{ content: string }>;
    expect(rows.map((r) => r.content)).toEqual(["MC-TEST axis 0", "MC-TEST axis 1"]);
  });

  it("uses an HNSW index on chunks.embedding", () => {
    const method = psql(
      `SELECT am.amname FROM pg_class c JOIN pg_am am ON am.oid = c.relam ` +
        `WHERE c.oid = 'public.chunks_embedding_idx'::regclass;`
    );

    expect(method).toBe("hnsw");
  });

  it("carries its query-time search width as a function setting", () => {
    const config = psql(
      `SELECT proconfig::text FROM pg_proc ` +
        `WHERE oid = 'public.match_chunks(vector, double precision, integer)'::regprocedure;`
    );

    expect(config).toContain("hnsw.ef_search=100");
  });
});
