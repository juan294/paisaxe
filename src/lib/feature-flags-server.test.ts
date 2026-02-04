import { describe, it, expect, vi, beforeEach } from "vitest";
import { isFeatureFlagEnabled } from "./feature-flags-server";

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
    }),
  },
}));

vi.mock("@/lib/environment", () => ({
  getEnvironment: () => "production",
}));

describe("isFeatureFlagEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default chain
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
  });

  it("returns true when flag is enabled", async () => {
    mockSingle.mockResolvedValue({
      data: { enabled: true },
      error: null,
    });

    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(true);
  });

  it("returns false when flag is disabled", async () => {
    mockSingle.mockResolvedValue({
      data: { enabled: false },
      error: null,
    });

    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });

  it("returns false when flag doesn't exist", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "No rows found" },
    });

    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });

  it("returns false on database error", async () => {
    mockSingle.mockRejectedValue(new Error("Connection failed"));

    const result = await isFeatureFlagEnabled("randomized_order");
    expect(result).toBe(false);
  });
});
