import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { imageProvenanceFixture } from "@/test/image-provenance-fixture";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "@/lib/image-provenance";
import { PUT } from "./route";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin-auth", async () => {
  const { mockAdminBoundary } = await import("@/test/mock-admin-boundary");
  return mockAdminBoundary(vi.fn());
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

const assetUrl = "https://example.com/synthetic-photo.jpg";
const proof = imageProvenanceFixture(assetUrl);
function request(imageSource: unknown) {
  return new NextRequest("http://localhost:3000/api/admin/stories/story-123/image-source", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageSource }),
  });
}
function setup(options: {
  current?: { image_path: string; image_source: string } | null;
  readError?: { message: string } | null;
  updated?: { id: string; image_source: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const readSingle = vi.fn().mockResolvedValue({
    data: options.current === undefined ? { image_path: assetUrl, image_source: proof } : options.current,
    error: options.readError ?? null,
  });
  const readEq = vi.fn().mockReturnValue({ single: readSingle });
  const select = vi.fn().mockReturnValue({ eq: readEq });
  const updateSingle = vi.fn().mockResolvedValue({
    data: options.updated === undefined ? { id: "story-123", image_source: proof } : options.updated,
    error: options.updateError ?? null,
  });
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ select, update });
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { from, select, update, updateEq };
}

describe("PUT /api/admin/stories/[id]/image-source", () => {
  const params = { params: Promise.resolve({ id: "story-123" }) };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
  });
  it("returns 401 without reading the story when authentication fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: false, error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never });
    const { from } = setup();
    expect((await PUT(request(proof), params)).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it("requires a story ID", async () => {
    const { from } = setup();
    const response = await PUT(request(proof), { params: Promise.resolve({ id: "" }) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Story ID is required");
    expect(from).not.toHaveBeenCalled();
  });
  it.each([undefined, 123, null])("requires a string source: %s", async (source) => {
    const { update } = setup();
    const response = await PUT(request(source), params);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("imageSource is required and must be a string");
    expect(update).not.toHaveBeenCalled();
  });
  it("updates complete attribution for the same reviewed asset and bytes", async () => {
    const nextProof = imageProvenanceFixture(assetUrl, "image fixture", "image fixture", { credit: "Revised synthetic credit" });
    const { select, update, updateEq } = setup({ updated: { id: "story-123", image_source: nextProof } });
    const response = await PUT(request(nextProof), params);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ id: "story-123", imageSource: nextProof });
    expect(select).toHaveBeenCalledWith("image_path, image_source");
    expect(update).toHaveBeenCalledWith({ image_source: nextProof });
    expect(updateEq).toHaveBeenCalledWith("id", "story-123");
    expect(revalidatePath).toHaveBeenCalledWith("/immersive");
  });
  it.each(["", "Turismo Asturias", "{}", NEUTRAL_CREDIT])("rejects free or neutral credit on an existing photo: %s", async (source) => {
    const { update } = setup();
    const response = await PUT(request(source), params);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("A complete review of this photo is required; a credit alone cannot approve it");
    expect(update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it.each([
    { name: "another asset", source: imageProvenanceFixture("https://example.com/other.jpg") },
    { name: "different replacement bytes", source: imageProvenanceFixture(assetUrl, "image fixture", "different bytes") },
    { name: "a rejected review", source: JSON.stringify({ ...JSON.parse(proof), status: "rejected" }) },
    { name: "missing crop review", source: JSON.stringify({ ...JSON.parse(proof), crop: {} }) },
  ])("rejects $name without updating", async ({ source }) => {
    const { update } = setup();
    expect((await PUT(request(source), params)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("cannot approve an unreviewed existing image by posting a new proof", async () => {
    const { update } = setup({ current: { image_path: assetUrl, image_source: "Legacy free credit" } });
    expect((await PUT(request(proof), params)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("allows neutral credit only on the neutral illustration", async () => {
    const { update } = setup({ current: { image_path: NEUTRAL_IMAGE, image_source: "" }, updated: { id: "story-123", image_source: NEUTRAL_CREDIT } });
    const response = await PUT(request(NEUTRAL_CREDIT), params);
    expect(response.status).toBe(200);
    expect((await response.json()).data.imageSource).toBe(NEUTRAL_CREDIT);
    expect(update).toHaveBeenCalledWith({ image_source: NEUTRAL_CREDIT });
  });
  it.each([{ current: null }, { readError: { message: "Read failed" } }])("returns 404 on missing/inaccessible current story", async (options) => {
    const { update } = setup(options);
    const response = await PUT(request(proof), params);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Story not found");
    expect(update).not.toHaveBeenCalled();
  });
  it("preserves 404 when an otherwise valid update finds no story", async () => {
    setup({ updated: null });
    const response = await PUT(request(proof), params);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Story not found");
  });
  it("preserves database update failures", async () => {
    setup({ updateError: { message: "Database error" } });
    const response = await PUT(request(proof), params);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Failed to update image source");
  });
  it.each([new Error("Unexpected DB failure"), "a plain string failure"])("logs unexpected thrown values without console.error", async (failure) => {
    vi.mocked(createAdminClient).mockImplementation(() => { throw failure; });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await PUT(request(proof), params);
    consoleSpy.mockRestore();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Internal server error");
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Admin image source API error:", { error: failure instanceof Error ? failure.message : failure });
  });
});
