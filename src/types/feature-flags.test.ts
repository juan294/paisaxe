import { describe, it, expect } from "vitest";
import { rowToFeatureFlag, type FeatureFlagRow } from "./feature-flags";

describe("rowToFeatureFlag", () => {
  const sampleRow: FeatureFlagRow = {
    id: "abc-123",
    flag_key: "seasonal_surfacing",
    enabled: true,
    label: "Seasonal Surfacing",
    description: "Boost stories based on current season",
    config: { weight: 1.5 },
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-10T12:00:00.000Z",
  };

  it("converts snake_case row to camelCase FeatureFlag", () => {
    const flag = rowToFeatureFlag(sampleRow);

    expect(flag).toHaveProperty("flagKey");
    expect(flag).toHaveProperty("createdAt");
    expect(flag).toHaveProperty("updatedAt");
    // Should not have snake_case keys
    expect(flag).not.toHaveProperty("flag_key");
    expect(flag).not.toHaveProperty("created_at");
    expect(flag).not.toHaveProperty("updated_at");
  });

  it("maps all fields correctly", () => {
    const flag = rowToFeatureFlag(sampleRow);

    expect(flag.id).toBe("abc-123");
    expect(flag.flagKey).toBe("seasonal_surfacing");
    expect(flag.enabled).toBe(true);
    expect(flag.label).toBe("Seasonal Surfacing");
    expect(flag.description).toBe("Boost stories based on current season");
    expect(flag.config).toEqual({ weight: 1.5 });
    expect(flag.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(flag.updatedAt).toBe("2025-01-10T12:00:00.000Z");
  });

  it("handles empty config as {}", () => {
    const rowWithNullConfig: FeatureFlagRow = {
      ...sampleRow,
      config: null as unknown as Record<string, unknown>,
    };

    const flag = rowToFeatureFlag(rowWithNullConfig);
    expect(flag.config).toEqual({});
  });

  it("handles null description", () => {
    const rowWithNullDesc: FeatureFlagRow = {
      ...sampleRow,
      description: null,
    };

    const flag = rowToFeatureFlag(rowWithNullDesc);
    expect(flag.description).toBeNull();
  });
});
