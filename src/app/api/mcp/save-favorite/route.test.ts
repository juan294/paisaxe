import { resetRateLimit } from "@/lib/rate-limit";
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockValidateMcpSecret, mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
  return {
    mockValidateMcpSecret: vi.fn(() => true),
    mockUpsert,
    mockFrom,
  };
});

vi.mock("@/lib/mcp-auth", () => ({
  validateMcpSecret: mockValidateMcpSecret,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { POST, GET } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/mcp/save-favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mcp-secret": "test" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp/save-favorite", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.clearAllMocks();
    mockValidateMcpSecret.mockReturnValue(true);
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("rejects unauthenticated requests", async () => {
    mockValidateMcpSecret.mockReturnValue(false);
    const res = await POST(makeRequest({ place_name: "Casa Marcial", conversation_id: "c1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when place_name is missing", async () => {
    const res = await POST(makeRequest({ conversation_id: "c1" }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("persists a bookmark and confirms success", async () => {
    const res = await POST(
      makeRequest({
        place_name: "Casa Marcial",
        place_address: "La Salgar, Arriondas",
        place_id: "gpid-123",
        conversation_id: "conv-abc",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockFrom).toHaveBeenCalledWith("voice_saved_places");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const row = mockUpsert.mock.calls[0][0];
    expect(row.place_name).toBe("Casa Marcial");
    expect(row.place_address).toBe("La Salgar, Arriondas");
    expect(row.place_id).toBe("gpid-123");
    expect(row.conversation_id).toBe("conv-abc");
  });

  it("returns 500 when persistence fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "db down" } });
    const res = await POST(
      makeRequest({ place_name: "Casa Marcial", conversation_id: "conv-abc" })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("still works when conversation_id is absent (anonymous bookmark)", async () => {
    const res = await POST(makeRequest({ place_name: "Casa Marcial" }));
    expect(res.status).toBe(200);
    const row = mockUpsert.mock.calls[0][0];
    expect(row.conversation_id).toBe("unknown");
  });

  it("accepts camelCase body keys (ElevenLabs camelCases tool params on push)", async () => {
    const res = await POST(
      makeRequest({
        placeName: "Casa Marcial",
        placeAddress: "La Salgar, Arriondas",
        placeId: "gpid-123",
        notes: "great cider",
        conversationId: "conv-camel",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const row = mockUpsert.mock.calls[0][0];
    expect(row.place_name).toBe("Casa Marcial");
    expect(row.place_address).toBe("La Salgar, Arriondas");
    expect(row.place_id).toBe("gpid-123");
    expect(row.notes).toBe("great cider");
    expect(row.conversation_id).toBe("conv-camel");
  });

  it("returns 400 when placeName (camelCase) is missing", async () => {
    const res = await POST(makeRequest({ conversationId: "conv-camel" }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when placeName is a whitespace-only string (asString trims to empty — line 45)", async () => {
    const res = await POST(makeRequest({ placeName: "   ", conversationId: "conv-blank" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("placeName is required to save a place.");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("stores null for optional fields that are whitespace-only strings (asString — line 45)", async () => {
    const res = await POST(
      makeRequest({
        placeName: "Casa Marcial",
        placeAddress: "   ",
        notes: "   ",
        conversationId: "conv-optional-blank",
      })
    );
    expect(res.status).toBe(200);
    const row = mockUpsert.mock.calls[0][0];
    expect(row.place_address).toBeNull();
    expect(row.notes).toBeNull();
  });

  it("returns 400 for invalid (non-JSON) body — line 60", async () => {
    const req = new Request("http://localhost/api/mcp/save-favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mcp-secret": "test" },
      body: "not-valid-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Invalid JSON body");
  });

  it("returns 500 when supabase upsert throws synchronously — lines 108-111", async () => {
    mockUpsert.mockImplementation(() => {
      throw new Error("Connection lost");
    });
    const res = await POST(makeRequest({ placeName: "Casa Marcial", conversationId: "conv-abc" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 500 when supabase upsert throws a non-Error value (String(err) fallback — line 109)", async () => {
    mockUpsert.mockImplementation(() => {
       
      throw "db connection string failure";
    });
    const res = await POST(makeRequest({ placeName: "Casa Marcial", conversationId: "conv-abc" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Could not save the place right now. Please try again.");
  });
});

describe("GET /api/mcp/save-favorite — line 128", () => {
  it("returns endpoint documentation", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endpoint).toBe("/api/mcp/save-favorite");
    expect(body.required_fields).toContain("placeName");
  });
});
