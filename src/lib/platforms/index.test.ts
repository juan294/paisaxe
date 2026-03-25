import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlatformClient } from "./index";
import type { MarketingCredentials, MarketingPlatform } from "@/types/marketing";

// Shared mock functions so we can control behavior per-test
const mockMe = vi.fn();
const mockTweet = vi.fn();
const mockDeleteTweet = vi.fn();
const mockSingleTweet = vi.fn();

// Mock twitter-api-v2
vi.mock("twitter-api-v2", () => {
  return {
    TwitterApi: class MockTwitterApi {
      v2 = {
        get me() { return mockMe; },
        get tweet() { return mockTweet; },
        get deleteTweet() { return mockDeleteTweet; },
        get singleTweet() { return mockSingleTweet; },
      };
    },
  };
});

describe("createPlatformClient", () => {
  const validCredentials: MarketingCredentials = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    apiKey: "api-key",
    apiSecret: "api-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMe.mockResolvedValue({
      data: { id: "123", username: "testuser", name: "Test User" },
    });
    mockTweet.mockResolvedValue({ data: { id: "tweet-123" } });
    mockDeleteTweet.mockResolvedValue({});
    mockSingleTweet.mockResolvedValue({
      data: {
        public_metrics: {
          like_count: 10,
          retweet_count: 5,
          reply_count: 2,
          quote_count: 1,
        },
      },
    });
  });

  it("creates X client for x platform", () => {
    const client = createPlatformClient("x", validCredentials);
    expect(client.platform).toBe("x");
  });

  it("throws error for instagram platform (not implemented)", () => {
    expect(() =>
      createPlatformClient("instagram" as MarketingPlatform, validCredentials)
    ).toThrow("Instagram client not yet implemented");
  });

  it("throws error for pinterest platform (not implemented)", () => {
    expect(() =>
      createPlatformClient("pinterest" as MarketingPlatform, validCredentials)
    ).toThrow("Pinterest client not yet implemented");
  });

  it("throws error for unknown platform", () => {
    expect(() =>
      createPlatformClient("unknown" as MarketingPlatform, validCredentials)
    ).toThrow("Unknown platform: unknown");
  });
});

describe("XClientAdapter", () => {
  const validCredentials: MarketingCredentials = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    apiKey: "api-key",
    apiSecret: "api-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMe.mockResolvedValue({
      data: { id: "123", username: "testuser", name: "Test User" },
    });
    mockTweet.mockResolvedValue({ data: { id: "tweet-123" } });
    mockDeleteTweet.mockResolvedValue({});
    mockSingleTweet.mockResolvedValue({
      data: {
        public_metrics: {
          like_count: 10,
          retweet_count: 5,
          reply_count: 2,
          quote_count: 1,
        },
      },
    });
  });

  describe("verifyCredentials", () => {
    it("returns user info from X API", async () => {
      const client = createPlatformClient("x", validCredentials);
      const result = await client.verifyCredentials();

      expect(result).toEqual({
        id: "123",
        username: "testuser",
        displayName: "Test User",
        profileUrl: "https://x.com/testuser",
      });
    });

    it("returns null when underlying client returns null (free tier 403)", async () => {
      // Simulate free tier: v2.me throws 403, XClient.verifyCredentials returns null
      const apiError = Object.assign(new Error("Forbidden"), {
        code: 403,
        data: { title: "Forbidden" },
      });
      mockMe.mockRejectedValueOnce(apiError);

      const client = createPlatformClient("x", validCredentials);
      const result = await client.verifyCredentials();

      expect(result).toBeNull();
    });
  });

  describe("post", () => {
    it("posts content and returns result", async () => {
      const client = createPlatformClient("x", validCredentials);
      const result = await client.post("Hello world!");

      expect(result.success).toBe(true);
      expect(result.postId).toBe("tweet-123");
    });

    it("passes replyToId when provided", async () => {
      const client = createPlatformClient("x", validCredentials);
      const result = await client.post("Reply content", { replyToId: "parent-123" });

      expect(result.success).toBe(true);
    });
  });

  describe("delete", () => {
    it("deletes a post and returns success", async () => {
      const client = createPlatformClient("x", validCredentials);
      const result = await client.delete("tweet-123");

      expect(result.success).toBe(true);
    });
  });

  describe("getEngagement", () => {
    it("returns engagement metrics", async () => {
      const client = createPlatformClient("x", validCredentials);
      const result = await client.getEngagement("tweet-123");

      expect(result).toEqual({
        likes: 10,
        reposts: 5,
        comments: 2,
        impressions: undefined,
      });
    });

    it("returns null when underlying client returns null (no metrics)", async () => {
      // Simulate singleTweet returning data without public_metrics
      mockSingleTweet.mockResolvedValueOnce({
        data: {
          public_metrics: undefined,
        },
      });

      const client = createPlatformClient("x", validCredentials);
      const result = await client.getEngagement("tweet-456");

      expect(result).toBeNull();
    });
  });
});
