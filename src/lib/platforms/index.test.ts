import { describe, it, expect, vi } from "vitest";
import { createPlatformClient } from "./index";
import type { MarketingCredentials, MarketingPlatform } from "@/types/marketing";

// Mock twitter-api-v2
vi.mock("twitter-api-v2", () => {
  return {
    TwitterApi: class MockTwitterApi {
      v2 = {
        me: vi.fn().mockResolvedValue({
          data: { id: "123", username: "testuser", name: "Test User" },
        }),
        tweet: vi.fn().mockResolvedValue({ data: { id: "tweet-123" } }),
        deleteTweet: vi.fn().mockResolvedValue({}),
        singleTweet: vi.fn().mockResolvedValue({
          data: {
            public_metrics: {
              like_count: 10,
              retweet_count: 5,
              reply_count: 2,
              quote_count: 1,
            },
          },
        }),
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
  });
});
