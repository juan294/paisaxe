import { describe, it, expect } from "vitest";
import { selectStoryCatalog } from "./admin-story-catalog";
import type { AdminStory } from "@/types/admin";
import { TRANSLATION_LOCALES } from "./admin-formatters";
const complete = { translations: Object.fromEntries(TRANSLATION_LOCALES.map(l => [l, { title: "Translated" }])), translation_status: Object.fromEntries(TRANSLATION_LOCALES.map(l => [l, { status: "complete" }])) };
const stories: AdminStory[] = Array.from({ length: 45 }, (_, i) => ({ id: `s-${i}`, slug: `s-${i}`, title: i === 35 ? "Hidden Oviedo cathedral" : `Story ${i}`, subtitle: "", description: "", image: "", category: "nature", displayOrder: i, curationStatus: i < 30 ? "approved" : "needs_curation", metadata: i < 40 ? complete : {}, createdAt: "", updatedAt: "" }));
describe("admin story catalog selection", () => {
  it("counts the complete catalog while paginating only pending stories", () => {
    const result = selectStoryCatalog(stories, { filter: "needs_curation", page: 1, pageSize: 10 });
    expect(result.stats).toEqual({ total: 45, approved: 30, pending: 15, missingTranslations: 5 });
    expect(result.total).toBe(15); expect(result.stories.map(s => s.id)).toEqual(stories.slice(30, 40).map(s => s.id));
    expect(result.pendingApprovalIds).toEqual(stories.slice(30).map(s => s.id));
  });
  it("searches beyond the first page without narrowing summary counts", () => {
    const result = selectStoryCatalog(stories, { filter: "all", search: "  OVIEDO  ", page: 1, pageSize: 20 });
    expect(result.stories.map(s => s.id)).toEqual(["s-35"]); expect(result.total).toBe(1); expect(result.stats.approved).toBe(30);
  });
  it("paginates missing translations across the entire catalog", () => {
    const result = selectStoryCatalog(stories, { filter: "missing_translations", page: 2, pageSize: 3 });
    expect(result.total).toBe(5); expect(result.stories.map(s => s.id)).toEqual(["s-43", "s-44"]);
  });
  it("clamps an obsolete page after deletion and handles an empty catalog", () => {
    expect(selectStoryCatalog(stories, { filter: "approved", page: 99, pageSize: 20 }).page).toBe(2);
    expect(selectStoryCatalog([], { filter: "all", page: 3, pageSize: 20 })).toMatchObject({ page: 1, total: 0, stories: [], pendingApprovalIds: [], stats: { total: 0, approved: 0, pending: 0, missingTranslations: 0 } });
  });
  it("treats PostgREST punctuation and wildcards as literal search text", () => {
    expect(selectStoryCatalog(stories, { filter: "all", search: "%,title.ilike.*", page: 1, pageSize: 20 }).total).toBe(0);
  });
});

import { createClient } from "@supabase/supabase-js";
import { loadStoryCatalog } from "./admin-story-catalog";
function backend(rows: Record<string, unknown>[], options: { cap?: number; missingCount?: boolean; duplicate?: boolean; error?: boolean; changeCount?: boolean; empty?: boolean } = {}) {
  const offsets: number[] = [];
  const client = createClient("https://fixture.example.test", "synthetic-key", { auth: { persistSession: false, autoRefreshToken: false, storageKey: `catalog-${crypto.randomUUID()}` }, global: { fetch: async input => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const offset = Number(url.searchParams.get("offset")); offsets.push(offset);
    if (options.error) return new Response(JSON.stringify({ message: "Unavailable", code: "TEST" }), { status: 400 });
    const batch = options.empty ? [] : rows.slice(options.duplicate ? 0 : offset, (options.duplicate ? 0 : offset) + Math.min(options.cap ?? 1000, Number(url.searchParams.get("limit"))));
    const count = rows.length + (options.changeCount && offset > 0 ? 1 : 0);
    return new Response(JSON.stringify(batch), { headers: { "Content-Type": "application/json", "Content-Range": `0-${batch.length}/${options.missingCount ? "*" : count}` } });
  } } });
  return { client, offsets };
}
const rows = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, slug: `slug-${i}`, title: `Story ${i}`, category: "nature", display_order: i, curation_status: "approved" }));
describe("complete catalog fetch through the real Supabase client", () => {
  it("continues across provider response caps instead of counting one batch", async () => {
    const { client, offsets } = backend(rows, { cap: 2 });
    expect((await loadStoryCatalog(client)).map(s => s.id)).toEqual(rows.map(s => s.id)); expect(offsets).toEqual([0, 2, 4]);
  });
  it("supports an empty catalog", async () => { const { client } = backend([]); expect(await loadStoryCatalog(client)).toEqual([]); });
  it.each([{ missingCount: true }, { duplicate: true, cap: 2 }, { changeCount: true, cap: 2 }, { empty: true }, { error: true }])("fails closed for incomplete or failed catalog evidence: %j", async options => {
    const { client } = backend(rows, options); await expect(loadStoryCatalog(client)).rejects.toThrow();
  });
});
