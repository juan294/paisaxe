import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToAdminStory, type AdminStory, type AdminStoryRow, type AdminStoriesPage, type StoryCatalogFilter } from "@/types/admin";
import { hasMissingTranslations } from "./admin-formatters";

interface CatalogOptions {
  filter: StoryCatalogFilter;
  search?: string;
  page: number;
  pageSize: number;
}

/** Select from a complete catalog, never from an already paginated subset. */
export function selectStoryCatalog(stories: AdminStory[], options: CatalogOptions): AdminStoriesPage {
  const pendingApprovalIds = stories.filter(s => s.curationStatus === "needs_curation").map(s => s.id);
  const missing = new Set(stories.filter(hasMissingTranslations).map(s => s.id));
  const stats = { total: stories.length, approved: stories.filter(s => s.curationStatus === "approved").length, pending: pendingApprovalIds.length, missingTranslations: missing.size };
  const search = options.search?.trim().toLowerCase();
  const matches = stories.filter(story => {
    if (options.filter === "missing_translations" && !missing.has(story.id)) return false;
    if (options.filter !== "all" && options.filter !== "missing_translations" && story.curationStatus !== options.filter) return false;
    return !search || [story.title, story.subtitle, story.description, story.category].some(text => text.toLowerCase().includes(search));
  });
  const page = Math.min(options.page, Math.max(1, Math.ceil(matches.length / options.pageSize)));
  const offset = (page - 1) * options.pageSize;
  return { stories: matches.slice(offset, offset + options.pageSize), total: matches.length, page, pageSize: options.pageSize, stats, pendingApprovalIds };
}

/** PostgREST caps rows per response. Scan every batch before deriving totals. */
export async function loadStoryCatalog(client: SupabaseClient): Promise<AdminStory[]> {
  const rows: AdminStoryRow[] = [];
  let expectedTotal: number | undefined;
  do {
    const { data, error, count } = await client.from("stories").select("*", { count: "exact" })
      .order("display_order", { ascending: true }).order("id", { ascending: true }).range(rows.length, rows.length + 999);
    if (error) throw new Error(error.message);
    if (count === null || (expectedTotal !== undefined && expectedTotal !== count)) throw new Error("Story catalog changed; refresh and try again");
    expectedTotal = count;
    if (!data || (data.length === 0 && rows.length < count)) throw new Error("Incomplete story catalog response");
    rows.push(...data as AdminStoryRow[]);
  } while (rows.length < expectedTotal);
  if (rows.length !== expectedTotal || new Set(rows.map(row => row.id)).size !== expectedTotal) throw new Error("Inconsistent story catalog response");
  return rows.map(rowToAdminStory);
}
