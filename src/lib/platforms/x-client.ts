/**
 * X (Twitter) API Client
 *
 * Handles posting, deleting, and fetching engagement for X/Twitter.
 * Uses OAuth 1.0a authentication with user context.
 *
 * Free tier: write-only (1,500 posts/month), no read access.
 * Basic tier ($200/month): 50k posts + 15k reads.
 * Pro tier ($5,000/month): 300k posts + 1M reads.
 */

import { TwitterApi, type ApiResponseError } from "twitter-api-v2";
import type { MarketingCredentials } from "@/types/marketing";

export interface XPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface XDeleteResult {
  success: boolean;
  error?: string;
}

export interface XEngagement {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions?: number;
  bookmarks?: number;
}

export interface XUserInfo {
  id: string;
  username: string;
  name: string;
}

/**
 * X API Client for marketing automation
 */
export class XClient {
  private client: TwitterApi;
  private username?: string;

  constructor(credentials: MarketingCredentials) {
    if (!credentials.apiKey || !credentials.apiSecret) {
      throw new Error("X client requires apiKey and apiSecret (Consumer Key/Secret)");
    }
    if (!credentials.accessToken || !credentials.refreshToken) {
      throw new Error("X client requires accessToken and refreshToken (Access Token/Secret)");
    }

    this.client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.refreshToken, // This is actually the Access Token Secret
    });
  }

  /**
   * Verify credentials and get authenticated user info.
   *
   * Uses v2.me() which is a read endpoint — not available on the free tier.
   * Returns null instead of throwing when the read endpoint is blocked (403),
   * since the free tier is write-only and posting can still work.
   */
  async verifyCredentials(): Promise<XUserInfo | null> {
    try {
      const { data } = await this.client.v2.me();
      this.username = data.username;
      return {
        id: data.id,
        username: data.username,
        name: data.name,
      };
    } catch (error) {
      // On the free tier, read endpoints return 403 — this is expected.
      // Return null so callers know verification wasn't possible but posting may still work.
      if (error instanceof Error) {
        const apiError = error as ApiResponseError;
        if (apiError.code === 403 || apiError.data?.title === "Forbidden") {
          return null;
        }
      }
      throw this.handleError(error, "Failed to verify credentials");
    }
  }

  /**
   * Post a tweet
   *
   * @param content - Tweet text (max 280 characters)
   * @param options - Optional media IDs or reply settings
   * @returns Post result with ID and URL
   */
  async postTweet(
    content: string,
    options?: {
      mediaIds?: string[];
      replyToId?: string;
    }
  ): Promise<XPostResult> {
    try {
      // Validate content length
      if (content.length > 280) {
        return {
          success: false,
          error: `Tweet exceeds 280 characters (${content.length})`,
          errorCode: "CONTENT_TOO_LONG",
        };
      }

      // Build tweet payload
      const payload: Parameters<typeof this.client.v2.tweet>[0] = {
        text: content,
      };

      if (options?.mediaIds?.length) {
        payload.media = { media_ids: options.mediaIds as [string] };
      }

      if (options?.replyToId) {
        payload.reply = { in_reply_to_tweet_id: options.replyToId };
      }

      const { data } = await this.client.v2.tweet(payload);

      const postUrl = this.username
        ? `https://x.com/${this.username}/status/${data.id}`
        : `https://x.com/i/status/${data.id}`;

      return {
        success: true,
        postId: data.id,
        postUrl,
      };
    } catch (error) {
      const result = this.handleError(error, "Failed to post tweet");
      return {
        success: false,
        error: result.message,
        errorCode: result.code,
      };
    }
  }

  /**
   * Post a thread (multiple connected tweets)
   *
   * @param tweets - Array of tweet contents
   * @returns Results for each tweet in the thread
   */
  async postThread(tweets: string[]): Promise<XPostResult[]> {
    const results: XPostResult[] = [];
    let previousTweetId: string | undefined;

    for (const content of tweets) {
      const result = await this.postTweet(content, {
        replyToId: previousTweetId,
      });

      results.push(result);

      if (!result.success) {
        // Stop thread on first failure
        break;
      }

      previousTweetId = result.postId;
    }

    return results;
  }

  /**
   * Delete a tweet
   *
   * @param tweetId - ID of the tweet to delete
   */
  async deleteTweet(tweetId: string): Promise<XDeleteResult> {
    try {
      await this.client.v2.deleteTweet(tweetId);
      return { success: true };
    } catch (error) {
      const result = this.handleError(error, "Failed to delete tweet");
      return {
        success: false,
        error: result.message,
      };
    }
  }

  /**
   * Get engagement metrics for a tweet
   *
   * @param tweetId - ID of the tweet
   */
  async getEngagement(tweetId: string): Promise<XEngagement | null> {
    try {
      const { data } = await this.client.v2.singleTweet(tweetId, {
        "tweet.fields": ["public_metrics", "non_public_metrics", "organic_metrics"],
      });

      const metrics = data.public_metrics;
      if (!metrics) {
        return null;
      }

      return {
        likes: metrics.like_count ?? 0,
        retweets: metrics.retweet_count ?? 0,
        replies: metrics.reply_count ?? 0,
        quotes: metrics.quote_count ?? 0,
        impressions: metrics.impression_count,
        bookmarks: metrics.bookmark_count,
      };
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
      return null;
    }
  }

  /**
   * Upload media for attachment to a tweet
   * Note: This uses v1.1 API as v2 doesn't support media upload yet
   *
   * @param mediaBuffer - Buffer containing the media file
   * @param mimeType - MIME type of the media
   * @returns Media ID string for use in postTweet
   */
  async uploadMedia(
    mediaBuffer: Buffer,
    mimeType: string
  ): Promise<string | null> {
    try {
      const mediaId = await this.client.v1.uploadMedia(mediaBuffer, {
        mimeType,
      });
      return mediaId;
    } catch (error) {
      console.error("Failed to upload media:", error);
      return null;
    }
  }

  /**
   * Handle API errors and extract useful information
   */
  private handleError(
    error: unknown,
    defaultMessage: string
  ): { message: string; code?: string } {
    if (error instanceof Error) {
      // Check for Twitter API specific errors
      const apiError = error as ApiResponseError;
      if (apiError.data) {
        const data = apiError.data as {
          title?: string;
          detail?: string;
          errors?: Array<{ message: string }>;
        };

        // Handle credits depleted (free tier: 1,500 posts/month limit reached)
        if (data.title === "CreditsDepleted") {
          return {
            message: "X API free tier limit reached (1,500 posts/month). Upgrade to Basic ($200/month) for 50k posts.",
            code: "CREDITS_DEPLETED",
          };
        }

        // Handle rate limiting
        if (apiError.code === 429) {
          return {
            message: "Rate limit exceeded. Please try again later.",
            code: "RATE_LIMITED",
          };
        }

        // Handle forbidden (permissions)
        if (apiError.code === 403) {
          return {
            message: "Insufficient permissions. Check app settings in X Developer Portal.",
            code: "FORBIDDEN",
          };
        }

        return {
          message: data.detail || data.title || defaultMessage,
          code: data.title,
        };
      }

      return { message: error.message };
    }

    return { message: defaultMessage };
  }
}

/**
 * Check if posting is available.
 *
 * On the free tier, verifyCredentials() returns null (read endpoint blocked)
 * but posting is still available (write-only access). We only report unavailable
 * for actual auth failures or unknown errors.
 */
export async function checkXPostingAvailable(
  credentials: MarketingCredentials
): Promise<{ available: boolean; reason?: string }> {
  const client = new XClient(credentials);

  try {
    // verifyCredentials returns null on free tier (403 on read endpoint).
    // That's fine — posting still works on the free tier.
    await client.verifyCredentials();
    return { available: true };
  } catch (error) {
    if (error instanceof Error) {
      return { available: false, reason: error.message };
    }
    return { available: false, reason: "Unknown error" };
  }
}
