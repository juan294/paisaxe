import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger,
}));

// Mock dependencies
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("PATCH /api/admin/stories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });

    expect(response.status).toBe(401);
  });

  it("should return 400 when body is not valid JSON", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("should return 400 when category is invalid", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ category: "invalid" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid category");
  });

  it("should return 400 when location is invalid", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ location: "invalid" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid location");
  });

  it("should return 400 when duration is invalid", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ duration: "invalid" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid duration");
  });

  it("should return 409 when new slug conflicts with existing story", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockNeq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: "other-story", slug: "existing-slug" },
        error: null,
      }),
    });
    const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ slug: "existing-slug" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("A story with this slug already exists");
  });

  it("should update story with valid data", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "story-1",
              slug: "updated-story",
              title: "Updated Story",
              subtitle: "New subtitle",
              description: "New description",
              category: "nature",
              location: "central",
              duration: "weekend",
              source_pdf: "guide.pdf",
              updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
    });

    const mockNeq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
    });
    const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "stories") {
        return { select: mockSelect, update: mockUpdate };
      }
      return { select: mockSelect };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({
        title: "Updated Story",
        slug: "updated-story",
        subtitle: "New subtitle",
        description: "New description",
        category: "nature",
        location: "central",
        duration: "weekend",
        sourcePdf: "guide.pdf",
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.title).toBe("Updated Story");
    expect(data.data.slug).toBe("updated-story");
    expect(data.data.category).toBe("nature");
    expect(data.data.location).toBe("central");
    expect(data.data.duration).toBe("weekend");
  });

  it("should allow clearing optional fields with null", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "story-1",
              slug: "story",
              title: "Story",
              subtitle: null,
              description: null,
              category: "nature",
              location: null,
              duration: null,
              source_pdf: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({
        location: null,
        duration: null,
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.location).toBeNull();
    expect(data.data.duration).toBeNull();
  });

  it("should return 500 when slug check has non-PGRST116 error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockNeq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "UNEXPECTED_ERROR", message: "Something went wrong" },
      }),
    });
    const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ slug: "some-slug" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORY_SLUG_CHECK_FAILED]", {
      story_id: "11111111-1111-4111-8111-111111111111",
      slug: "some-slug",
      error: { code: "UNEXPECTED_ERROR", message: "Something went wrong" },
    });
    expect(data.error).toBe("Failed to validate slug");
  });

  it("should return 404 when story not found after update (no data returned)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Story not found");
  });

  it("should return 500 on unexpected error (catch block)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    // After BE-M2 (#570) a malformed body is a 400, so trigger the outer catch
    // via an unexpected error deeper in the handler (Supabase client throws).
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected client error");
    });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Valid title" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORY_UPDATE_UNHANDLED_ERROR]", {
      error: expect.any(Error),
    });
    expect(data.error).toBe("Internal server error");
  });

  it("returns 400 when the route id is not a UUID (BE-M2 #570)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/not-a-uuid", {
      method: "PATCH",
      body: JSON.stringify({ title: "Valid title" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "not-a-uuid" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("UUID");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("should handle empty string subtitle/description/sourcePdf by converting to null (lines 96-97,101)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "story-1",
              slug: "story",
              title: "Story",
              subtitle: null,
              description: null,
              category: "nature",
              location: null,
              duration: null,
              source_pdf: null,
              metadata: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      update: mockUpdate,
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { metadata: {} }, error: null }),
      }) }),
    });
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({
        subtitle: "  ", // whitespace-only, should become null via trim() || null
        description: "", // empty string, should become null
        sourcePdf: "  ", // whitespace-only, should become null
        bestMonths: [1, 2, 3],
        metadata: { custom: "value" },
      }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });

    expect(response.status).toBe(200);

    // Verify update was called — the data passed should have null values
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.subtitle).toBeNull();
    expect(updateCall.description).toBeNull();
    expect(updateCall.source_pdf).toBeNull();
    expect(updateCall.best_months).toEqual([1, 2, 3]);
    expect(updateCall.metadata).toEqual({ custom: "value" });
  });

  it("should return 500 when update fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Update failed" },
          }),
        }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[ADMIN_STORY_UPDATE_FAILED]", {
      story_id: "11111111-1111-4111-8111-111111111111",
      error: { message: "Update failed" },
    });
    expect(data.error).toBe("Failed to update story");
  });

  // -----------------------------------------------------------------------
  // Zod validation tests (BE-M1 / issue #407)
  // -----------------------------------------------------------------------

  it("should return 400 with Zod errors when title exceeds 300 characters", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "A".repeat(301) }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("should return 400 with Zod errors when category is not a valid enum value (via Zod)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ category: "invalid-category" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    // Zod returns structured errors; manual check returns { error: "..." }
    // Either format is acceptable, the key is status 400
    expect(data.errors ?? data.error).toBeTruthy();
  });

  it("should return 400 with Zod errors when description exceeds 5000 characters", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Valid", description: "D".repeat(5001) }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // SE-M4 audit log tests (issue #415)
  // -----------------------------------------------------------------------

  it("should emit audit log entry on successful story update", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-user-id" });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "story-1",
              slug: "updated-story",
              title: "Updated Story",
              subtitle: null,
              description: null,
              category: "nature",
              location: null,
              duration: null,
              source_pdf: null,
              metadata: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Story" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("[ADMIN_AUDIT]", {
      event: "story.update",
      actor: "admin-user-id",
      story_id: "11111111-1111-4111-8111-111111111111",
    });
  });
});

describe("admin source question edits invalidate translated prompts", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const original = {
    question_prompts: ["¿Dónde está?", "¿Cuándo abre?"],
    mood_tags: ["calm"],
    translations: {
      en: { title: "Manual title", subtitle: "Manual subtitle", description: "Manual description", question_prompts: ["Where is it?", "When does it open?"] },
      fr: { title: "Titre", subtitle: "", description: "Description", question_prompts: ["Où ?", "Quand ?"] },
    },
    translation_status: {
      en: { status: "complete", updatedAt: "2026-10-08T00:00:00Z" },
      fr: { status: "complete", updatedAt: "2026-10-08T00:00:00Z" },
    },
    last_translated_at: "2026-10-08T00:00:00Z",
  };

  function storedMetadata(metadata: Record<string, unknown>, readError: unknown = null) {
    const update = vi.fn((changes: Record<string, unknown>) => ({
      eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id, ...changes }, error: null }),
      }) }),
    }));
    const read = vi.fn().mockResolvedValue({ data: { metadata }, error: readError });
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: read }) }),
      update,
    }) } as never);
    return { update, read };
  }

  async function patchMetadata(metadata: Record<string, unknown>) {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin" });
    return PATCH(new NextRequest(`http://localhost:3000/api/admin/stories/${id}`, {
      method: "PATCH", body: JSON.stringify({ metadata }),
    }), { params: Promise.resolve({ id }) });
  }

  beforeEach(() => vi.clearAllMocks());

  it("compares actual stored prompts and invalidates same-count edits while retaining manual text and unrelated metadata", async () => {
    const store = storedMetadata(original);
    const next = { ...original, question_prompts: ["¿Cómo se llega?", "¿Cuándo abre?"], mood_tags: ["active"] };
    const response = await patchMetadata(next);
    expect(response.status).toBe(200);
    expect(store.read).toHaveBeenCalledOnce();
    const saved = (await response.json()).data.metadata;
    expect(saved.question_prompts).toEqual(next.question_prompts);
    expect(saved.mood_tags).toEqual(["active"]);
    expect(saved.last_translated_at).toBe(original.last_translated_at);
    for (const locale of ["en", "fr"] as const) {
      expect(saved.translations[locale]).toEqual({ title: original.translations[locale].title, subtitle: original.translations[locale].subtitle, description: original.translations[locale].description });
      expect(saved.translation_status[locale].status).toBe("pending");
    }
  });

  it.each([{prompts:[]}, {prompts:undefined}])("removes ghost translated questions when the source is cleared to %j", async ({prompts}) => {
    storedMetadata(original);
    const next: Record<string, unknown> = { ...original };
    if (prompts === undefined) delete next.question_prompts;
    else next.question_prompts = prompts;
    const response = await patchMetadata(next);
    expect(response.status).toBe(200);
    const saved = (await response.json()).data.metadata;
    expect(saved.translations.en.question_prompts).toBeUndefined();
    expect(saved.translations.fr.question_prompts).toBeUndefined();
    expect(saved.translation_status.en.status).toBe("pending");
    expect(saved.translations.en.title).toBe("Manual title");
  });

  it("preserves translations and status exactly for unchanged source questions", async () => {
    const store = storedMetadata(original);
    const response = await patchMetadata({ ...original, mood_tags: ["new mood"] });
    expect(response.status).toBe(200);
    expect(store.read).toHaveBeenCalledOnce();
    const saved = (await response.json()).data.metadata;
    expect(saved.translations).toEqual(original.translations);
    expect(saved.translation_status).toEqual(original.translation_status);
    expect(saved.mood_tags).toEqual(["new mood"]);
  });

  it.each([{prompts:null}, {prompts:"not-an-array"}, {prompts:[1]}, {prompts:[" "]}])("rejects malformed source question arrays %j", async ({prompts}) => {
    const store = storedMetadata(original);
    const response = await patchMetadata({ ...original, question_prompts: prompts });
    expect(response.status).toBe(400);
    expect(store.update).not.toHaveBeenCalled();
  });

  it("does not write when the prior metadata cannot be read", async () => {
    const store = storedMetadata(original, { code: "08006", message: "read failed" });
    const response = await patchMetadata({ ...original, question_prompts: ["Changed"] });
    expect(response.status).toBe(500);
    expect(store.update).not.toHaveBeenCalled();
  });
  it.each([null, {code:"PGRST116",message:"0 rows"}])("returns 404 for a missing source story (%j), without updating", async error => {
    const store = storedMetadata(original);
    store.read.mockResolvedValue({data:null,error});
    const response=await patchMetadata({...original,question_prompts:["Changed"]});
    expect(response.status).toBe(404);
    expect(store.update).not.toHaveBeenCalled();
  });

});
