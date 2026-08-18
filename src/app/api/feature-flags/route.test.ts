import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

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
  // Real Supabase anon keys are JWTs starting with 'eyJ' — use a fake JWT
  // so the route doesn't skip the Supabase call in these tests
  const FAKE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test";
  let originalKey: string | undefined;

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
    originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_JWT_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
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
    // SE-H1/BE-M9: reads through the DB-layer masking view, not the base table —
    // anon no longer has column-level SELECT on feature_flags.config directly.
    expect(mockFrom).toHaveBeenCalledWith("feature_flags_public");
    // PE-L2: narrow select — only the columns actually used after scrubSensitiveConfig
    expect(mockSelect).toHaveBeenCalledWith(
      "id, flag_key, enabled, label, description, config, environment, created_at, updated_at"
    );
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

  // ─── BE-M4: Vary: Host header ─────────────────────────────────────────────
  it("should include Vary: Host header on success to prevent CDN cross-subdomain poisoning", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toContain("Host");
  });

  it("should include Vary: Host header even with dummy credentials (CI/E2E)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

    const response = await GET();

    expect(response.headers.get("vary")).toContain("Host");
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

  it("should return 500 and stringify a non-Error thrown value", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
       
      throw "a string failure, not an Error instance";
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(logger.error).toHaveBeenCalledWith(
      "Feature flags API error:",
      { error: "a string failure, not an Error instance" }
    );
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

  describe("with dummy Supabase credentials (CI/E2E)", () => {
    it("should return empty flags when anon key is not a valid JWT", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      // Should NOT have called supabase.from — skipped entirely
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should return empty flags when anon key is undefined", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should include Cache-Control header even with dummy credentials", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=60, stale-while-revalidate=120"
      );
    });
  });

  // ─── PE-L2: narrow select ────────────────────────────────────────────────────
  // ─── SE-H1: scrub sensitive config fields ─────────────────────────────────
  describe("SE-H1: scrubSensitiveConfig", () => {
    it("strips whitelisted_emails and agent_id from visitor_voice_agent config before returning", async () => {
      const voiceAgentFlagRow = {
        id: "flag-voice",
        flag_key: "visitor_voice_agent",
        enabled: true,
        label: "Visitor Voice Agent",
        description: "Voice agent for visitors",
        config: {
          whitelisted_emails: ["someone@example.com"],
          agent_id: "agent_secret_123",
          otherSetting: "keepMe",
        },
        environment: "development",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      const mockOrder = vi.fn().mockResolvedValue({ data: [voiceAgentFlagRow], error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      const flag = data.data[0];
      expect(flag.flagKey).toBe("visitor_voice_agent");
      expect(flag.config).not.toHaveProperty("whitelisted_emails");
      expect(flag.config).not.toHaveProperty("agent_id");
      expect(flag.config).toEqual({ otherSetting: "keepMe" });
    });
  });

  describe("PE-L2: narrow select — only fetch columns actually returned", () => {
    it("passes the explicit column list to .select() instead of wildcard '*'", async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await GET();

      // Must NOT use the wildcard — every column that reaches scrubSensitiveConfig
      // and rowToFeatureFlag must be listed explicitly here.
      expect(mockSelect).not.toHaveBeenCalledWith("*");
      expect(mockSelect).toHaveBeenCalledWith(
        "id, flag_key, enabled, label, description, config, environment, created_at, updated_at"
      );
    });

    it("still returns all FeatureFlag fields after narrow select", async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: mockFlagRows, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      const flag = data.data[0];
      // All FeatureFlag fields must be present
      expect(flag).toHaveProperty("id");
      expect(flag).toHaveProperty("flagKey");
      expect(flag).toHaveProperty("enabled");
      expect(flag).toHaveProperty("label");
      expect(flag).toHaveProperty("description");
      expect(flag).toHaveProperty("config");
      expect(flag).toHaveProperty("environment");
      expect(flag).toHaveProperty("createdAt");
      expect(flag).toHaveProperty("updatedAt");
    });
  });
});
