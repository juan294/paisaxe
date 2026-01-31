import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/environment", () => ({
  getEnvironment: vi.fn(() => "development"),
}));

import { supabase } from "@/lib/supabase";
import { getEnvironment } from "@/lib/environment";

describe("GET /api/feature-flags", () => {
  const mockFlagRows = [
    {
      id: "flag-1",
      flag_key: "contextual_prompts",
      enabled: true,
      label: "Contextual Prompts",
      description: "Enable contextual prompts",
      config: {},
      environment: "development",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "flag-2",
      flag_key: "related_stories",
      enabled: false,
      label: "Related Stories",
      description: null,
      config: { maxResults: 5 },
      environment: "development",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all feature flags for current environment", async () => {
    vi.mocked(getEnvironment).mockReturnValue("development");

    const mockOrder = vi.fn().mockResolvedValue({ data: mockFlagRows, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].flagKey).toBe("contextual_prompts");
    expect(data.data[0].enabled).toBe(true);
    expect(data.data[0].label).toBe("Contextual Prompts");
    expect(data.data[0].environment).toBe("development");
    expect(data.data[1].flagKey).toBe("related_stories");
    expect(data.data[1].enabled).toBe(false);
    expect(data.data[1].config).toEqual({ maxResults: 5 });
    expect(mockFrom).toHaveBeenCalledWith("feature_flags");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("environment", "development");
    expect(mockOrder).toHaveBeenCalledWith("flag_key", { ascending: true });
  });

  it("should filter by production environment when in production", async () => {
    vi.mocked(getEnvironment).mockReturnValue("production");

    const productionFlags = mockFlagRows.map((f) => ({ ...f, environment: "production" }));
    const mockOrder = vi.fn().mockResolvedValue({ data: productionFlags, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("environment", "production");
    expect(data.data[0].environment).toBe("production");
  });

  it("should return 500 on database error", async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch feature flags");
  });

  it("should include Cache-Control header on success", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=120"
    );
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should return empty array when no flags exist", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
  });
});
