/**
 * Posting Service
 *
 * Handles the workflow for creating, scheduling, and posting content
 * to social media platforms. Supports both automated posting (when
 * API access is available) and manual posting workflow (copy/paste).
 */

import { createAdminClient } from "./supabase";
import { validateContent } from "./platforms";
import type {
  MarketingPlatform,
  MarketingPost,
  MarketingPostRow,
  PostStatus,
  ContentTheme,
} from "@/types/marketing";

export interface CreateDraftInput {
  platform: MarketingPlatform;
  content: string;
  mediaUrls?: string[];
  hashtags?: string[];
  linkUrl?: string;
  scheduledFor?: string;
  storyId?: string;
  contentTheme?: ContentTheme;
}

export interface CreateDraftResult {
  success: boolean;
  post?: MarketingPost;
  error?: string;
  validationErrors?: string[];
}

export interface MarkAsPostedInput {
  postId: string;
  platformPostId?: string;
  postUrl?: string;
}

/**
 * Create a draft post for a platform
 * The draft can later be posted automatically or manually
 */
export async function createDraft(
  input: CreateDraftInput
): Promise<CreateDraftResult> {
  // Validate content against platform limits
  const validation = validateContent(input.platform, input.content, {
    mediaUrls: input.mediaUrls,
    hashtags: input.hashtags,
    linkUrl: input.linkUrl,
  });

  if (!validation.valid) {
    return {
      success: false,
      error: "Content validation failed",
      validationErrors: validation.errors,
    };
  }

  const supabase = createAdminClient();

  // Get the account for this platform
  const { data: account, error: accountError } = await supabase
    .from("marketing_accounts")
    .select("id")
    .eq("platform", input.platform)
    .eq("is_active", true)
    .single();

  if (accountError || !account) {
    return {
      success: false,
      error: `No active ${input.platform} account found`,
    };
  }

  // Create the draft
  const { data, error } = await supabase
    .from("marketing_posts")
    .insert({
      account_id: account.id,
      platform: input.platform,
      content: input.content,
      media_urls: input.mediaUrls || [],
      hashtags: input.hashtags || [],
      link_url: input.linkUrl || null,
      scheduled_for: input.scheduledFor || null,
      status: input.scheduledFor ? "scheduled" : "draft",
      story_id: input.storyId || null,
      content_theme: input.contentTheme || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create draft:", error);
    return {
      success: false,
      error: "Failed to save draft to database",
    };
  }

  return {
    success: true,
    post: rowToPost(data as MarketingPostRow),
  };
}

/**
 * Get all drafts for manual posting
 */
export async function getDrafts(
  platform?: MarketingPlatform
): Promise<MarketingPost[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("marketing_posts")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch drafts:", error);
    return [];
  }

  return (data as MarketingPostRow[]).map(rowToPost);
}

/**
 * Mark a draft as manually posted
 * Used when the user copies content and posts it themselves
 */
export async function markAsPosted(
  input: MarkAsPostedInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("marketing_posts")
    .update({
      status: "posted" as PostStatus,
      platform_post_id: input.platformPostId || null,
      post_url: input.postUrl || null,
      posted_at: new Date().toISOString(),
    })
    .eq("id", input.postId);

  if (error) {
    console.error("Failed to mark post as posted:", error);
    return { success: false, error: "Failed to update post status" };
  }

  return { success: true };
}

/**
 * Delete a draft post
 */
export async function deleteDraft(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Only allow deleting drafts, not posted content
  const { error } = await supabase
    .from("marketing_posts")
    .delete()
    .eq("id", postId)
    .in("status", ["draft", "scheduled", "failed"]);

  if (error) {
    console.error("Failed to delete draft:", error);
    return { success: false, error: "Failed to delete draft" };
  }

  return { success: true };
}

/**
 * Update a draft's content
 */
export async function updateDraft(
  postId: string,
  updates: Partial<CreateDraftInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {};

  if (updates.content !== undefined) {
    updateData.content = updates.content;
  }
  if (updates.mediaUrls !== undefined) {
    updateData.media_urls = updates.mediaUrls;
  }
  if (updates.hashtags !== undefined) {
    updateData.hashtags = updates.hashtags;
  }
  if (updates.linkUrl !== undefined) {
    updateData.link_url = updates.linkUrl;
  }
  if (updates.scheduledFor !== undefined) {
    updateData.scheduled_for = updates.scheduledFor;
    updateData.status = updates.scheduledFor ? "scheduled" : "draft";
  }

  const { error } = await supabase
    .from("marketing_posts")
    .update(updateData)
    .eq("id", postId)
    .in("status", ["draft", "scheduled"]);

  if (error) {
    console.error("Failed to update draft:", error);
    return { success: false, error: "Failed to update draft" };
  }

  return { success: true };
}

/**
 * Helper to convert database row to app type
 */
function rowToPost(row: MarketingPostRow): MarketingPost {
  return {
    id: row.id,
    accountId: row.account_id,
    platform: row.platform as MarketingPlatform,
    content: row.content,
    mediaUrls: row.media_urls || [],
    hashtags: row.hashtags || [],
    linkUrl: row.link_url,
    scheduledFor: row.scheduled_for,
    postedAt: row.posted_at,
    status: row.status as PostStatus,
    platformPostId: row.platform_post_id,
    postUrl: row.post_url,
    errorMessage: row.error_message,
    engagement: row.engagement || {},
    storyId: row.story_id,
    contentTheme: row.content_theme as ContentTheme | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
