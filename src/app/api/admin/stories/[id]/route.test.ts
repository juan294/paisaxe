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
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
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

    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
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
