import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock the supabase client
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

function mockSupabaseSuccess() {
  const mockLimit = vi.fn().mockResolvedValue({ error: null });
  const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  vi.mocked(supabase.from).mockImplementation(mockFrom);
}

function mockSupabaseError(message: string) {
  const mockLimit = vi.fn().mockResolvedValue({ error: { message } });
  const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  vi.mocked(supabase.from).mockImplementation(mockFrom);
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  });

  it("should return 200 status", async () => {
    mockSupabaseSuccess();

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('should include status: "healthy" field', async () => {
    mockSupabaseSuccess();

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("healthy");
  });

  it("should include timestamp field as ISO string", async () => {
    mockSupabaseSuccess();

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    // Verify it's a valid ISO date string
    const parsed = new Date(data.timestamp);
    expect(parsed.toISOString()).toBe(data.timestamp);
  });

  it("should include version field from package.json", async () => {
    mockSupabaseSuccess();

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe("0.1.0");
  });

  it("should include services.supabase field with status", async () => {
    mockSupabaseSuccess();

    const response = await GET();
    const data = await response.json();

    expect(data.services).toBeDefined();
    expect(data.services.supabase).toBeDefined();
    expect(data.services.supabase.status).toBe("connected");
    expect(typeof data.services.supabase.latency_ms).toBe("number");
  });

  it("should set Cache-Control: no-store header", async () => {
    mockSupabaseSuccess();

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("should include uptime field as a number", async () => {
    mockSupabaseSuccess();

    const response = await GET();
    const data = await response.json();

    expect(typeof data.uptime).toBe("number");
  });

  it('should return status "degraded" when supabase check fails', async () => {
    mockSupabaseError("Connection refused");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
    expect(data.services.supabase.error).toBe("Connection refused");
  });

  it("should still return 200 even when supabase throws an exception", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.services.supabase.status).toBe("error");
  });
});
