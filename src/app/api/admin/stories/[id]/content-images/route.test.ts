import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin-auth", async () => {
  const { mockAdminBoundary } = await import("@/test/mock-admin-boundary");
  return mockAdminBoundary(vi.fn());
});
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";

type Story = { id: string; title: string; source_pdf: string | null };
function setup(story: Story | null, error: { message: string } | null = null) {
  const single = vi.fn().mockResolvedValue({ data: story, error });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn((table: string) => {
    if (table !== "stories") throw new Error(`Retired guide image selector accessed ${table}`);
    return { select };
  });
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { from, eq, single };
}
const request = () => new NextRequest("http://localhost:3000/api/admin/stories/story-123/content-images");
const story = { id: "story-123", title: "Synthetic story", source_pdf: "synthetic.pdf" };

describe("GET /api/admin/stories/[id]/content-images", () => {
  const params = { params: Promise.resolve({ id: "story-123" }) };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
  });
  it("retains 401 and performs no lookup for an unauthenticated request", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: false, error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never });
    const { from } = setup(story);
    expect((await GET(request(), params)).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it("requires a story ID before querying", async () => {
    const { from } = setup(story);
    const response = await GET(request(), { params: Promise.resolve({ id: "" }) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Story ID is required");
    expect(from).not.toHaveBeenCalled();
  });
  it.each([
    { title: "Synthetic place", source_pdf: "synthetic.pdf" },
    { title: "Unreviewed extracted image", source_pdf: "legacy-guide.pdf" },
    { title: "", source_pdf: "legacy-guide.pdf" },
    { title: "Synthetic place", source_pdf: null },
    { title: "Synthetic place", source_pdf: "" },
  ])("offers no guide images regardless of legacy metadata $source_pdf/$title", async (metadata) => {
    const { from, eq } = setup({ id: "story-123", ...metadata });
    const response = await GET(request(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { images: [], total: 0 }, reviewRequired: true });
    expect(from.mock.calls).toEqual([["stories"]]);
    expect(eq).toHaveBeenCalledWith("id", "story-123");
  });
  it("cannot reenter guide chunks/images even when their queries would fail", async () => {
    const { from } = setup(story);
    const response = await GET(request(), params);
    expect(response.status).toBe(200);
    expect((await response.json()).reviewRequired).toBe(true);
    expect(from).not.toHaveBeenCalledWith("chunks");
    expect(from).not.toHaveBeenCalledWith("images");
  });
  it("preserves story read failures without attempting guide fallback", async () => {
    const { from } = setup(null, { message: "Database error" });
    const response = await GET(request(), params);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Failed to fetch story");
    expect(from.mock.calls).toEqual([["stories"]]);
  });
  it("preserves 404 for a missing story", async () => {
    const { from } = setup(null);
    const response = await GET(request(), params);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Story not found");
    expect(from.mock.calls).toEqual([["stories"]]);
  });
  it.each([new Error("Unexpected DB failure"), "plain failure"])("logs unexpected errors without console.error", async (failure) => {
    vi.mocked(createAdminClient).mockImplementation(() => { throw failure; });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request(), params);
    consoleSpy.mockRestore();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Internal server error");
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Content images API error:", { error: failure instanceof Error ? failure.message : failure });
  });
});
