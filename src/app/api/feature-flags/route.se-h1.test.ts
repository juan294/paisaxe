/**
 * SE-H1 (#388): Sensitive config fields must be stripped from visitor_voice_agent
 * before the feature flags response reaches the client.
 *
 * The visitor_voice_agent flag may include whitelisted_emails and agent_id in its
 * config field in the database. These must never reach the browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/environment", () => ({
  getEnvironment: vi.fn(() => "development"),
}));

import { supabase } from "@/lib/supabase";

describe("SE-H1: visitor_voice_agent sensitive config scrubbing", () => {
  const FAKE_JWT_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test";

  let originalKey: string | undefined;

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

  const makeMockQuery = (rows: unknown[]) => {
    const mockOrder = vi.fn().mockResolvedValue({ data: rows, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockImplementation(mockFrom);
  };

  it("strips whitelisted_emails and agent_id from visitor_voice_agent config", async () => {
    makeMockQuery([
      {
        id: "vva-1",
        flag_key: "visitor_voice_agent",
        enabled: true,
        label: "Visitor Voice Agent",
        description: "Voice for visitors",
        config: {
          whitelisted_emails: ["secret@example.com", "admin@paisaxe.es"],
          agent_id: "agent_super_secret_id",
        },
        environment: "development",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    const flag = data.data.find(
      (f: { flagKey: string }) => f.flagKey === "visitor_voice_agent"
    );
    expect(flag).toBeDefined();
    expect(flag.enabled).toBe(true);

    // Sensitive fields must be absent from the client-facing response
    expect(flag.config).not.toHaveProperty("whitelisted_emails");
    expect(flag.config).not.toHaveProperty("agent_id");
  });

  it("preserves the enabled boolean but strips all config from visitor_voice_agent", async () => {
    makeMockQuery([
      {
        id: "vva-2",
        flag_key: "visitor_voice_agent",
        enabled: false,
        label: "Visitor Voice Agent",
        description: null,
        config: {
          whitelisted_emails: ["other@example.com"],
          agent_id: "agent_123",
        },
        environment: "development",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);

    const response = await GET();
    const data = await response.json();

    const flag = data.data.find(
      (f: { flagKey: string }) => f.flagKey === "visitor_voice_agent"
    );
    expect(flag.enabled).toBe(false);
    expect(flag.config).not.toHaveProperty("whitelisted_emails");
    expect(flag.config).not.toHaveProperty("agent_id");
  });

  it("does not strip config from other flags", async () => {
    makeMockQuery([
      {
        id: "flag-1",
        flag_key: "maintenance_mode",
        enabled: false,
        label: "Maintenance Mode",
        description: null,
        config: { title: "Mantenimiento", message: "Volvemos pronto", show_tagline: true },
        environment: "development",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "vva-1",
        flag_key: "visitor_voice_agent",
        enabled: true,
        label: "Visitor Voice Agent",
        description: null,
        config: {
          whitelisted_emails: ["secret@example.com"],
          agent_id: "agent_abc",
        },
        environment: "development",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);

    const response = await GET();
    const data = await response.json();

    const maintenanceFlag = data.data.find(
      (f: { flagKey: string }) => f.flagKey === "maintenance_mode"
    );
    // Non-sensitive flag config is preserved unchanged
    expect(maintenanceFlag.config).toEqual({
      title: "Mantenimiento",
      message: "Volvemos pronto",
      show_tagline: true,
    });

    const vvaFlag = data.data.find(
      (f: { flagKey: string }) => f.flagKey === "visitor_voice_agent"
    );
    expect(vvaFlag.config).not.toHaveProperty("whitelisted_emails");
    expect(vvaFlag.config).not.toHaveProperty("agent_id");
  });

  it("handles visitor_voice_agent with empty config without error", async () => {
    makeMockQuery([
      {
        id: "vva-3",
        flag_key: "visitor_voice_agent",
        enabled: true,
        label: "Visitor Voice Agent",
        description: null,
        config: {},
        environment: "development",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    const flag = data.data.find(
      (f: { flagKey: string }) => f.flagKey === "visitor_voice_agent"
    );
    expect(flag).toBeDefined();
    expect(flag.enabled).toBe(true);
    expect(flag.config).toEqual({});
  });
});
