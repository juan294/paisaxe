import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Use vi.hoisted so mock fns are available inside hoisted vi.mock factories
const { mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

// Mock dependencies before importing the route
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...actual.promises,
        readFile: mockReadFile,
        writeFile: mockWriteFile,
      },
    },
    promises: {
      ...actual.promises,
      readFile: mockReadFile,
      writeFile: mockWriteFile,
    },
  };
});

import { GET, PUT } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

const sampleConfig = {
  master_enabled: true,
  agents: {
    coverage_agent_enabled: {
      enabled: true,
      config: { schedule: "daily" },
    },
    security_agent_enabled: {
      enabled: false,
      config: {},
    },
  },
};

const sampleDefaults = {
  master_enabled: false,
  agents: {
    coverage_agent_enabled: {
      enabled: false,
      config: {},
    },
  },
};

describe("GET /api/admin/agent-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns 403 when not in development", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Agent config is only available in development");
  });

  it("returns auth error when auth fails", async () => {
    const { NextResponse: NR } = await import("next/server");
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: NR.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns config data when authenticated in dev mode", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(sampleConfig);
  });

  it("auto-creates config from defaults when config file is missing", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile
      .mockRejectedValueOnce(new Error("ENOENT")) // readConfig first try
      .mockResolvedValueOnce(JSON.stringify(sampleDefaults)); // read defaults
    mockWriteFile.mockResolvedValue(undefined);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(sampleDefaults);
    expect(mockWriteFile).toHaveBeenCalledOnce();
  });

  it("returns 500 when reading config throws unexpected error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    // Both readFile calls fail (config and defaults)
    mockReadFile.mockRejectedValue(new Error("Permission denied"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to read agent config");
  });
});

describe("PUT /api/admin/agent-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
  });

  function makeRequest(body: unknown): NextRequest {
    return new NextRequest(
      "http://localhost:3000/api/admin/agent-config",
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
  }

  it("returns 403 when not in development", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = makeRequest({ master_enabled: true });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Agent config is only available in development");
  });

  it("returns auth error when auth fails", async () => {
    const { NextResponse: NR } = await import("next/server");
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: NR.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const request = makeRequest({ master_enabled: true });
    const response = await PUT(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("updates master_enabled to true", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    const config = {
      ...sampleConfig,
      master_enabled: false,
    };
    mockReadFile.mockResolvedValue(JSON.stringify(config));
    mockWriteFile.mockResolvedValue(undefined);

    const request = makeRequest({ master_enabled: true });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.master_enabled).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledOnce();
    // Verify the written config has master_enabled=true
    const writtenConfig = JSON.parse(
      mockWriteFile.mock.calls[0][1] as string,
    );
    expect(writtenConfig.master_enabled).toBe(true);
  });

  it("updates master_enabled to false", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));
    mockWriteFile.mockResolvedValue(undefined);

    const request = makeRequest({ master_enabled: false });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.master_enabled).toBe(false);
  });

  it("updates agent enabled state", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));
    mockWriteFile.mockResolvedValue(undefined);

    const request = makeRequest({
      key: "coverage_agent_enabled",
      enabled: false,
    });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.agents.coverage_agent_enabled.enabled).toBe(false);
  });

  it("updates agent config value", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));
    mockWriteFile.mockResolvedValue(undefined);

    const request = makeRequest({
      key: "coverage_agent_enabled",
      config_key: "schedule",
      value: "weekly",
    });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.agents.coverage_agent_enabled.config.schedule).toBe(
      "weekly",
    );
  });

  it("updates agent config with a new key", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));
    mockWriteFile.mockResolvedValue(undefined);

    const request = makeRequest({
      key: "coverage_agent_enabled",
      config_key: "max_retries",
      value: 5,
    });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.agents.coverage_agent_enabled.config.max_retries).toBe(
      5,
    );
  });

  it("returns 400 for unknown agent key", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));

    const request = makeRequest({
      key: "nonexistent_agent",
      enabled: true,
    });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Unknown agent key: nonexistent_agent");
  });

  it("returns 400 for invalid request body (no recognized fields)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));

    const request = makeRequest({ foo: "bar" });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request body");
  });

  it("returns 400 when master_enabled is not a boolean", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));

    const request = makeRequest({ master_enabled: "yes" });
    const response = await PUT(request);
    const data = await response.json();

    // master_enabled exists but is not boolean, so falls through to the
    // "key" check, then to invalid body
    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request body");
  });

  it("returns 500 when writeConfig fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));
    mockWriteFile.mockRejectedValue(new Error("Disk full"));

    const request = makeRequest({ master_enabled: true });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update agent config");
  });

  it("returns 500 when readConfig fails completely", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    // Both readFile calls fail
    mockReadFile.mockRejectedValue(new Error("Permission denied"));

    const request = makeRequest({ master_enabled: true });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update agent config");
  });

  describe("Zod validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

      const request = new NextRequest(
        "http://localhost:3000/api/admin/agent-config",
        { method: "PUT", body: "not-json" }
      );
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request body");
    });

    it("returns 400 for empty object body", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
      mockReadFile.mockResolvedValue(JSON.stringify(sampleConfig));

      const request = makeRequest({});
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request body");
    });
  });
});
