/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { XClient, checkXPostingAvailable } from "./x-client";
import type { MarketingCredentials } from "@/types/marketing";

// Create mocks for twitter-api-v2
const mockMe = vi.fn();
const mockTweet = vi.fn();
const mockDeleteTweet = vi.fn();
const mockSingleTweet = vi.fn();
const mockUploadMedia = vi.fn();

vi.mock("twitter-api-v2", () => {
  // Use a shared object that references the mock functions
  const sharedV2 = {
    get me() {
      return mockMe;
    },
    get tweet() {
      return mockTweet;
    },
    get deleteTweet() {
      return mockDeleteTweet;
    },
    get singleTweet() {
      return mockSingleTweet;
    },
  };

  const sharedV1 = {
    get uploadMedia() {
      return mockUploadMedia;
    },
  };

  return {
    TwitterApi: class MockTwitterApi {
      v2 = sharedV2;
      v1 = sharedV1;
    },
  };
});

describe("XClient", () => {
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
          impression_count: 100,
          bookmark_count: 3,
        },
      },
    });
    mockUploadMedia.mockResolvedValue("media-123");
  });

  describe("constructor", () => {
    it("throws error when apiKey is missing", () => {
      const creds = { ...validCredentials, apiKey: undefined };
      expect(() => new XClient(creds as any)).toThrow(
        "X client requires apiKey and apiSecret"
      );
    });

    it("throws error when apiSecret is missing", () => {
      const creds = { ...validCredentials, apiSecret: undefined };
      expect(() => new XClient(creds as any)).toThrow(
        "X client requires apiKey and apiSecret"
      );
    });

    it("throws error when accessToken is missing", () => {
      const creds = { ...validCredentials, accessToken: undefined };
      expect(() => new XClient(creds as any)).toThrow(
        "X client requires accessToken and refreshToken"
      );
    });

    it("throws error when refreshToken is missing", () => {
      const creds = { ...validCredentials, refreshToken: undefined };
      expect(() => new XClient(creds as any)).toThrow(
        "X client requires accessToken and refreshToken"
      );
    });

    it("creates client successfully with valid credentials", () => {
      const client = new XClient(validCredentials);
      expect(client).toBeInstanceOf(XClient);
    });
  });

  describe("verifyCredentials", () => {
    it("returns user info from API", async () => {
      const client = new XClient(validCredentials);
      const result = await client.verifyCredentials();

      expect(result).toEqual({
        id: "123",
        username: "testuser",
        name: "Test User",
      });
    });

    it("throws error when API call fails", async () => {
      mockMe.mockRejectedValue(new Error("API Error"));
      const client = new XClient(validCredentials);

      await expect(client.verifyCredentials()).rejects.toThrow("API Error");
    });

    it("returns null gracefully on free tier (read endpoint blocked)", async () => {
      const apiError = new Error("Forbidden") as any;
      apiError.code = 403;
      apiError.data = {};
      mockMe.mockRejectedValue(apiError);

      const client = new XClient(validCredentials);
      const result = await client.verifyCredentials();

      expect(result).toBeNull();
    });
  });

  describe("postTweet", () => {
    it("posts tweet and returns success", async () => {
      const client = new XClient(validCredentials);
      await client.verifyCredentials(); // Set username
      const result = await client.postTweet("Hello world!");

      expect(result.success).toBe(true);
      expect(result.postId).toBe("tweet-123");
      expect(result.postUrl).toBe("https://x.com/testuser/status/tweet-123");
    });

    it("returns error when content exceeds 280 characters", async () => {
      const client = new XClient(validCredentials);
      const content = "a".repeat(281);
      const result = await client.postTweet(content);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Tweet exceeds 280 characters (281)");
      expect(result.errorCode).toBe("CONTENT_TOO_LONG");
    });

    it("includes media IDs when provided", async () => {
      const client = new XClient(validCredentials);
      await client.postTweet("Hello", { mediaIds: ["media-1", "media-2"] });

      expect(mockTweet).toHaveBeenCalledWith({
        text: "Hello",
        media: { media_ids: ["media-1", "media-2"] },
      });
    });

    it("includes reply settings when provided", async () => {
      const client = new XClient(validCredentials);
      await client.postTweet("Hello", { replyToId: "parent-123" });

      expect(mockTweet).toHaveBeenCalledWith({
        text: "Hello",
        reply: { in_reply_to_tweet_id: "parent-123" },
      });
    });

    it("uses generic URL when username is not set", async () => {
      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.postUrl).toBe("https://x.com/i/status/tweet-123");
    });

    it("returns error when API call fails", async () => {
      mockTweet.mockRejectedValue(new Error("Post failed"));
      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Post failed");
    });
  });

  describe("postThread", () => {
    it("posts multiple tweets as a thread", async () => {
      const client = new XClient(validCredentials);
      const tweets = ["First", "Second", "Third"];
      const results = await client.postThread(tweets);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("stops on first failure", async () => {
      mockTweet
        .mockResolvedValueOnce({ data: { id: "tweet-1" } })
        .mockRejectedValueOnce(new Error("Failed"));

      const client = new XClient(validCredentials);
      const tweets = ["First", "Second", "Third"];
      const results = await client.postThread(tweets);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe("deleteTweet", () => {
    it("deletes tweet and returns success", async () => {
      const client = new XClient(validCredentials);
      const result = await client.deleteTweet("tweet-123");

      expect(result.success).toBe(true);
      expect(mockDeleteTweet).toHaveBeenCalledWith("tweet-123");
    });

    it("returns error when delete fails", async () => {
      mockDeleteTweet.mockRejectedValue(new Error("Delete failed"));
      const client = new XClient(validCredentials);
      const result = await client.deleteTweet("tweet-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
    });
  });

  describe("getEngagement", () => {
    it("returns engagement metrics", async () => {
      const client = new XClient(validCredentials);
      const result = await client.getEngagement("tweet-123");

      expect(result).toEqual({
        likes: 10,
        retweets: 5,
        replies: 2,
        quotes: 1,
        impressions: 100,
        bookmarks: 3,
      });
    });

    it("returns null when no metrics available", async () => {
      mockSingleTweet.mockResolvedValue({ data: {} });
      const client = new XClient(validCredentials);
      const result = await client.getEngagement("tweet-123");

      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      mockSingleTweet.mockRejectedValue(new Error("Failed"));
      const client = new XClient(validCredentials);
      const result = await client.getEngagement("tweet-123");

      expect(result).toBeNull();
    });
  });

  describe("uploadMedia", () => {
    it("uploads media and returns ID", async () => {
      const client = new XClient(validCredentials);
      const buffer = Buffer.from("test");
      const result = await client.uploadMedia(buffer, "image/png");

      expect(result).toBe("media-123");
      expect(mockUploadMedia).toHaveBeenCalledWith(buffer, { mimeType: "image/png" });
    });

    it("returns null on error", async () => {
      mockUploadMedia.mockRejectedValue(new Error("Upload failed"));
      const client = new XClient(validCredentials);
      const buffer = Buffer.from("test");
      const result = await client.uploadMedia(buffer, "image/png");

      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("handles CreditsDepleted error as free tier write limit", async () => {
      const apiError = new Error("Credits depleted") as any;
      apiError.data = { title: "CreditsDepleted" };
      mockTweet.mockRejectedValue(apiError);

      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.success).toBe(false);
      expect(result.error).toContain("1,500 posts/month");
      expect(result.errorCode).toBe("CREDITS_DEPLETED");
    });

    it("handles rate limit error", async () => {
      const apiError = new Error("Rate limited") as any;
      apiError.code = 429;
      apiError.data = {};
      mockTweet.mockRejectedValue(apiError);

      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded. Please try again later.");
      expect(result.errorCode).toBe("RATE_LIMITED");
    });

    it("handles forbidden error", async () => {
      const apiError = new Error("Forbidden") as any;
      apiError.code = 403;
      apiError.data = {};
      mockTweet.mockRejectedValue(apiError);

      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient permissions");
      expect(result.errorCode).toBe("FORBIDDEN");
    });

    it("handles API error with data.detail field", async () => {
      const apiError = new Error("API error") as any;
      apiError.data = { detail: "Detailed error description", title: "SomeTitle" };
      mockTweet.mockRejectedValue(apiError);

      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Detailed error description");
      expect(result.errorCode).toBe("SomeTitle");
    });

    it("handles non-Error thrown value", async () => {
      mockTweet.mockRejectedValue("string error");

      const client = new XClient(validCredentials);
      const result = await client.postTweet("Hello");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to post tweet");
    });
  });
});

describe("checkXPostingAvailable", () => {
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
  });

  it("returns available when credentials are valid", async () => {
    const result = await checkXPostingAvailable(validCredentials);

    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns available on free tier even when v2.me fails", async () => {
    const apiError = new Error("Forbidden") as any;
    apiError.code = 403;
    apiError.data = {};
    mockMe.mockRejectedValue(apiError);

    const result = await checkXPostingAvailable(validCredentials);

    expect(result.available).toBe(true);
  });

  it("handles unknown errors", async () => {
    mockMe.mockRejectedValue("Unknown error");
    const result = await checkXPostingAvailable(validCredentials);

    expect(result.available).toBe(false);
    expect(result.reason).toBe("Unknown error");
  });
});
