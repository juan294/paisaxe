import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { logger } from "@/lib/logger";

// Mock withAdmin so tests control auth + client injection independently.
// When withAdmin resolves as unauthorized, return a 401 response directly.
// When withAdmin resolves as authorized, call the handler with a mock supabase client.
vi.mock("@/lib/admin-auth", () => ({
  withAdmin: vi.fn(),
}));

import { withAdmin } from "@/lib/admin-auth";

// Helper: make withAdmin call through to the real handler with a mock supabase client.
function mockWithAdminAuthorized(mockSupabase: unknown) {
  vi.mocked(withAdmin).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (handler: (client: any) => Promise<unknown>) => handler(mockSupabase)
  );
}

// Helper: make withAdmin return a 401 without calling the handler.
function mockWithAdminUnauthorized(status = 401) {
  vi.mocked(withAdmin).mockResolvedValue(
    new Response(JSON.stringify({ error: "Unauthorized" }), { status }) as never
  );
}

describe("GET /api/admin/stories", () => {
  const mockStories = [
    {
      id: "story-1",
      title: "Test Story 1",
      subtitle: "Subtitle 1",
      category: "nature",
      image_path: "/images/test1.jpg",
      display_order: 1,
      curation_status: "needs_curation",
    },
    {
      id: "story-2",
      title: "Test Story 2",
      subtitle: "Subtitle 2",
      category: "culture",
      image_path: "/images/test2.jpg",
      display_order: 2,
      curation_status: "approved",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    mockWithAdminUnauthorized();

    const request = new NextRequest("http://localhost:3000/api/admin/stories");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return stories when auth is valid", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockStories, error: null }),
      }),
    });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].id).toBe("story-1");
    expect(data.data[0].curationStatus).toBe("needs_curation");
  });

  it("should filter by needs_curation status", async () => {
    const filteredStories = mockStories.filter(s => s.curation_status === "needs_curation");

    const mockEq = vi.fn().mockResolvedValue({ data: filteredStories, error: null });
    const mockOrder = vi.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories?filter=needs_curation");
    await GET(request);

    expect(mockEq).toHaveBeenCalledWith("curation_status", "needs_curation");
  });

  it("should filter by approved status", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories?filter=approved");
    await GET(request);

    expect(mockEq).toHaveBeenCalledWith("curation_status", "approved");
  });

  it("should return 500 when database query fails", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch stories");
  });

  it("should return 500 on unexpected error", async () => {
    // withAdmin calls through but the handler throws due to bad mock
    mockWithAdminAuthorized({
      from: vi.fn().mockImplementation(() => { throw new Error("Unexpected error"); }),
    });

    const request = new NextRequest("http://localhost:3000/api/admin/stories");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("POST /api/admin/stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    mockWithAdminUnauthorized();

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test", category: "nature" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 400 when title is missing", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ category: "nature" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    // Zod returns field-level errors
    expect(data.errors).toBeDefined();
  });

  it("should return 400 when category is missing", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("should return 400 when category is invalid", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "invalid" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("should auto-generate slug from title", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-id",
            slug: "test-story",
            title: "Test Story",
            category: "nature",
            display_order: 1,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      // maybeSingle: no row → {data: null, error: null} (no PGRST116 needed)
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "stories") {
        return { select: mockSelect, insert: mockInsert };
      }
      return { select: mockSelect };
    });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "nature" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.slug).toBe("test-story");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("should handle Spanish diacritics in slug generation", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-id",
            slug: "covadonga-asturias",
            title: "Covadonga Ñ Asturias",
            category: "nature",
            display_order: 1,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "stories") {
        return { select: mockSelect, insert: mockInsert };
      }
      return { select: mockSelect };
    });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Covadonga Ñ Asturias", category: "nature" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    // Verify insert was called with normalized slug
    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.slug).toBe("covadonga-n-asturias");
  });

  it("should return 409 when slug already exists", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "existing-id", slug: "test-story" },
          error: null,
        }),
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "nature" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("A story with this slug already exists");
  });

  it("should use provided displayOrder when specified", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-id",
            slug: "test-story",
            title: "Test Story",
            category: "nature",
            display_order: 42,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "nature", displayOrder: 42 }),
    });
    await POST(request);

    const insertCall = mockInsert.mock.calls[0][0];
    // Should use the provided displayOrder, not auto-calculate
    expect(insertCall.display_order).toBe(42);
  });

  it("should auto-calculate next display_order", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-id",
            slug: "test-story",
            title: "Test Story",
            category: "nature",
            display_order: 6,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { display_order: 5 },
            error: null,
          }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "stories") {
        return { select: mockSelect, insert: mockInsert };
      }
      return { select: mockSelect };
    });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "nature" }),
    });
    await POST(request);

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.display_order).toBe(6);
  });

  it("should update suggestion status when converting", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-story-id",
            slug: "suggested-place",
            title: "Suggested Place",
            category: "nature",
            display_order: 1,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "story_suggestions") {
        return { update: mockUpdate };
      }
      return { select: mockSelect, insert: mockInsert };
    });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({
        title: "Suggested Place",
        category: "nature",
        suggestionId: "550e8400-e29b-41d4-a716-446655440000",
        sourceType: "user-suggested",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "converted",
      converted_story_id: "new-story-id",
      updated_at: expect.any(String),
    });
  });

  it("should create story with all optional fields", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-id",
            slug: "complete-story",
            title: "Complete Story",
            category: "culture",
            display_order: 1,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({
        title: "Complete Story",
        category: "culture",
        subtitle: "A complete story",
        description: "Full description",
        location: "central",
        duration: "weekend",
        sourcePdf: "guide.pdf",
        bestMonths: [6, 7, 8],
        metadata: { tags: ["cultural"] },
      }),
    });
    await POST(request);

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.subtitle).toBe("A complete story");
    expect(insertCall.description).toBe("Full description");
    expect(insertCall.location).toBe("central");
    expect(insertCall.duration).toBe("weekend");
    expect(insertCall.source_pdf).toBe("guide.pdf");
    expect(insertCall.best_months).toEqual([6, 7, 8]);
    expect(insertCall.metadata).toEqual({ tags: ["cultural"] });
  });

  it("should log error but succeed when suggestion status update fails", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Suggestion update failed" } }),
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-story-id",
            slug: "suggested-place",
            title: "Suggested Place",
            category: "nature",
            display_order: 1,
            curation_status: "needs_curation",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "story_suggestions") {
        return { update: mockUpdate };
      }
      return { select: mockSelect, insert: mockInsert };
    });
    mockWithAdminAuthorized({ from: mockFrom });

    const loggerSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({
        title: "Suggested Place",
        category: "nature",
        suggestionId: "550e8400-e29b-41d4-a716-446655440000",
        sourceType: "user-suggested",
      }),
    });
    const response = await POST(request);

    // Story creation should still succeed even though suggestion update failed
    expect(response.status).toBe(201);
    expect(loggerSpy).toHaveBeenCalledWith(
      "[ADMIN_STORIES_SUGGESTION_UPDATE_FAILED]",
      expect.objectContaining({
        suggestion_id: "550e8400-e29b-41d4-a716-446655440000",
        error: expect.objectContaining({ message: "Suggestion update failed" }),
      })
    );

    loggerSpy.mockRestore();
  });

  it("should return 500 on unexpected POST error (catch block)", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    // Make request.json() throw to trigger the outer catch block
    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: "not valid json",
    });
    // Override .json() to throw
    vi.spyOn(request, "json").mockRejectedValue(new Error("Unexpected parse error"));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should return 500 when slug check maybeSingle returns an error", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        // maybeSingle returns any non-null error as a real DB error
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "UNEXPECTED_ERROR", message: "Something went wrong" },
        }),
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "nature" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to validate slug");
  });

  it("should return 500 when insert fails", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Insert failed" },
        }),
      }),
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockWithAdminAuthorized({ from: mockFrom });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "Test Story", category: "nature" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create story");
  });

  // -----------------------------------------------------------------------
  // Zod validation tests (issue #270)
  // -----------------------------------------------------------------------

  it("should return 400 with Zod errors when title exceeds 300 characters", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({ title: "A".repeat(301), category: "nature" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("should return 400 with Zod errors when description exceeds 5000 characters", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({
        title: "Valid Title",
        category: "nature",
        description: "D".repeat(5001),
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("should return 400 with Zod errors when metadata contains deeply nested arbitrary values", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    // metadata must be Record<string, unknown> — non-object top-level value should fail
    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({
        title: "Valid Title",
        category: "nature",
        metadata: "not-an-object",
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("should return 400 with Zod errors when bestMonths contains out-of-range values", async () => {
    mockWithAdminAuthorized({ from: vi.fn() });

    const request = new NextRequest("http://localhost:3000/api/admin/stories", {
      method: "POST",
      body: JSON.stringify({
        title: "Valid Title",
        category: "nature",
        bestMonths: [0, 5, 13],
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });
});
