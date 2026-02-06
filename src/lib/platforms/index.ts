/**
 * Platform Clients
 *
 * Unified interface for social media platform APIs.
 * Each platform has its own client implementation.
 */

export * from "./types";

import type { MarketingPlatform, MarketingCredentials } from "@/types/marketing";
import type { PlatformClient } from "./types";
import { XClient } from "./x-client";

/**
 * Create a platform client for the specified platform
 *
 * @param platform - The social media platform
 * @param credentials - Decrypted OAuth credentials
 * @returns Platform-specific client instance
 */
export function createPlatformClient(
  platform: MarketingPlatform,
  credentials: MarketingCredentials
): PlatformClient {
  switch (platform) {
    case "x":
      return new XClientAdapter(credentials);
    case "instagram":
      throw new Error("Instagram client not yet implemented");
    case "pinterest":
      throw new Error("Pinterest client not yet implemented");
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Adapter to make XClient conform to PlatformClient interface
 */
class XClientAdapter implements PlatformClient {
  platform: MarketingPlatform = "x";
  private client: XClient;

  constructor(credentials: MarketingCredentials) {
    this.client = new XClient(credentials);
  }

  async verifyCredentials() {
    const info = await this.client.verifyCredentials();
    return {
      id: info.id,
      username: info.username,
      displayName: info.name,
      profileUrl: `https://x.com/${info.username}`,
    };
  }

  async post(content: string, options?: { mediaUrls?: string[]; replyToId?: string }) {
    // Note: mediaUrls would need to be uploaded first to get media IDs
    // For now, we only support text posts
    return this.client.postTweet(content, {
      replyToId: options?.replyToId,
    });
  }

  async delete(postId: string) {
    return this.client.deleteTweet(postId);
  }

  async getEngagement(postId: string) {
    const engagement = await this.client.getEngagement(postId);
    if (!engagement) return null;

    return {
      likes: engagement.likes,
      reposts: engagement.retweets,
      comments: engagement.replies,
      impressions: engagement.impressions,
    };
  }
}
