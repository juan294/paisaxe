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

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/mcp/save-favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mcp-secret": "test" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp/save-favorite", () => {
  beforeEach(() => {
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
});
