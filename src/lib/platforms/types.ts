/**
 * Platform Client Types
 *
 * Shared types and interfaces for all social media platform clients.
 */

import type { MarketingPlatform, PostEngagement } from "@/types/marketing";

/**
 * Result of a post operation
 */
export interface PostResult {
  success: boolean;
  /** Platform-specific post ID */
  postId?: string;
  /** URL to view the post */
  postUrl?: string;
  /** Error message if failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  success: boolean;
  error?: string;
}

/**
 * User info from the platform
 */
export interface PlatformUserInfo {
  id: string;
  username: string;
  displayName: string;
  profileUrl?: string;
  avatarUrl?: string;
}

/**
 * Options for posting content
 */
export interface PostOptions {
  /** Media file URLs or IDs to attach */
  mediaUrls?: string[];
  /** For replies/comments - the parent post ID */
  replyToId?: string;
  /** Link to include in the post */
  linkUrl?: string;
  /** Hashtags to append (will be formatted per platform) */
  hashtags?: string[];
}

/**
 * Abstract interface for platform clients
 * All platform-specific clients should implement this interface
 */
export interface PlatformClient {
  /** The platform this client handles */
  platform: MarketingPlatform;

  /** Verify credentials are valid and get user info */
  verifyCredentials(): Promise<PlatformUserInfo>;

  /** Post content to the platform */
  post(content: string, options?: PostOptions): Promise<PostResult>;

  /** Delete a post */
  delete(postId: string): Promise<DeleteResult>;

  /** Get engagement metrics for a post */
  getEngagement(postId: string): Promise<PostEngagement | null>;
}

/**
 * Platform-specific content limits
 */
export const PLATFORM_CONTENT_LIMITS: Record<
  MarketingPlatform,
  {
    maxLength: number;
    maxMedia: number;
    maxHashtags: number;
    supportsThreads: boolean;
    supportsLinks: boolean;
  }
> = {
  x: {
    maxLength: 280,
    maxMedia: 4,
    maxHashtags: 5, // Recommended, not enforced
    supportsThreads: true,
    supportsLinks: true,
  },
  instagram: {
    maxLength: 2200,
    maxMedia: 10,
    maxHashtags: 30,
    supportsThreads: false,
    supportsLinks: false, // Only in bio or with 10k+ followers
  },
  pinterest: {
    maxLength: 500,
    maxMedia: 1,
    maxHashtags: 20,
    supportsThreads: false,
    supportsLinks: true,
  },
};

/**
 * Check if content fits within platform limits
 */
export function validateContent(
  platform: MarketingPlatform,
  content: string,
  options?: PostOptions
): { valid: boolean; errors: string[] } {
  const limits = PLATFORM_CONTENT_LIMITS[platform];
  const errors: string[] = [];

  if (content.length > limits.maxLength) {
    errors.push(
      `Content exceeds ${limits.maxLength} characters (${content.length})`
    );
  }

  if (options?.mediaUrls && options.mediaUrls.length > limits.maxMedia) {
    errors.push(
      `Too many media items (${options.mediaUrls.length}/${limits.maxMedia})`
    );
  }

  if (options?.hashtags && options.hashtags.length > limits.maxHashtags) {
    errors.push(
      `Too many hashtags (${options.hashtags.length}/${limits.maxHashtags})`
    );
  }

  if (options?.linkUrl && !limits.supportsLinks) {
    errors.push(`${platform} does not support links in posts`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
