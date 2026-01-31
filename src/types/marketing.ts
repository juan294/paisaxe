/**
 * Marketing Automation Types
 *
 * Types for the automated social media marketing system.
 * Supports X (Twitter), Instagram, and Pinterest.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type MarketingPlatform = "x" | "instagram" | "pinterest";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "posting"
  | "posted"
  | "failed";

export type ContentType =
  | "photo_caption"
  | "reel_caption"
  | "thread"
  | "pin_description"
  | "story_prompt";

export type ContentTheme =
  | "cozy" // Jan-Feb: sidrerias, comfort food
  | "spring" // Mar-Apr: wildflowers, waterfalls
  | "summer" // May-Aug: beaches, hiking, festivals
  | "autumn" // Sep-Oct: harvest, fall colors
  | "winter"; // Nov-Dec: Christmas, cocido, snow

export type AgentAction =
  | "generate_content"
  | "schedule_post"
  | "post"
  | "refresh_tokens"
  | "fetch_engagement"
  | "cleanup";

export type AgentStatus = "started" | "success" | "failed";

// Platform-specific content limits
export const PLATFORM_LIMITS: Record<
  MarketingPlatform,
  { maxLength: number; maxMedia: number; maxHashtags: number }
> = {
  x: { maxLength: 280, maxMedia: 4, maxHashtags: 5 },
  instagram: { maxLength: 2200, maxMedia: 10, maxHashtags: 30 },
  pinterest: { maxLength: 500, maxMedia: 1, maxHashtags: 20 },
};

// =============================================================================
// APP TYPES (camelCase for application use)
// =============================================================================

/** Encrypted credentials wrapper - credentials are stored encrypted in the database */
export interface EncryptedCredentials {
  encrypted: string;
}

export interface MarketingAccount {
  id: string;
  platform: MarketingPlatform;
  accountName: string;
  accountHandle: string | null;
  /** OAuth tokens - stored encrypted in DB, decrypt with getDecryptedCredentials() when needed */
  credentials: MarketingCredentials | EncryptedCredentials | null;
  platformUserId: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Safe version of MarketingAccount without credentials */
export interface MarketingAccountPublic {
  id: string;
  platform: MarketingPlatform;
  accountName: string;
  accountHandle: string | null;
  isActive: boolean;
  /** Whether credentials are stored (without exposing them) */
  hasCredentials: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType?: string;
  scope?: string;
  // Platform-specific fields
  apiKey?: string; // X
  apiSecret?: string; // X
  clientId?: string;
  clientSecret?: string;
}

export interface MarketingPost {
  id: string;
  accountId: string;
  platform: MarketingPlatform;
  content: string;
  mediaUrls: string[];
  hashtags: string[];
  linkUrl: string | null;
  scheduledFor: string | null;
  postedAt: string | null;
  status: PostStatus;
  platformPostId: string | null;
  postUrl: string | null;
  errorMessage: string | null;
  engagement: PostEngagement;
  storyId: string | null;
  contentTheme: ContentTheme | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostEngagement {
  likes?: number;
  reposts?: number;
  comments?: number;
  saves?: number;
  clicks?: number;
  impressions?: number;
  reach?: number;
}

export interface MarketingSchedule {
  id: string;
  platform: MarketingPlatform;
  dayOfWeek: number | null; // 0=Sunday, null=every day
  timeUtc: string; // HH:MM format
  contentType: ContentType | "auto";
  isActive: boolean;
  createdAt: string;
}

export interface MarketingContentBank {
  id: string;
  platform: MarketingPlatform | "all";
  contentType: ContentType;
  content: string;
  mediaSuggestions: string[];
  hashtagSet: string[];
  storyId: string | null;
  theme: ContentTheme | null;
  isUsed: boolean;
  timesUsed: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface MarketingAgentLog {
  id: string;
  agentName: string;
  action: AgentAction;
  status: AgentStatus;
  details: Record<string, unknown>;
  errorMessage: string | null;
  postId: string | null;
  durationMs: number | null;
  createdAt: string;
}

// =============================================================================
// DATABASE ROW TYPES (snake_case matching Supabase)
// =============================================================================

export interface MarketingAccountRow {
  id: string;
  platform: string;
  account_name: string;
  account_handle: string | null;
  /** Credentials can be encrypted or plain (legacy). Always store encrypted going forward. */
  credentials: MarketingCredentials | EncryptedCredentials | null;
  platform_user_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingPostRow {
  id: string;
  account_id: string;
  platform: string;
  content: string;
  media_urls: string[] | null;
  hashtags: string[] | null;
  link_url: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  status: string;
  platform_post_id: string | null;
  post_url: string | null;
  error_message: string | null;
  engagement: PostEngagement | null;
  story_id: string | null;
  content_theme: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingScheduleRow {
  id: string;
  platform: string;
  day_of_week: number | null;
  time_utc: string;
  content_type: string;
  is_active: boolean;
  created_at: string;
}

export interface MarketingContentBankRow {
  id: string;
  platform: string;
  content_type: string;
  content: string;
  media_suggestions: string[] | null;
  hashtag_set: string[] | null;
  story_id: string | null;
  theme: string | null;
  is_used: boolean;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
}

export interface MarketingAgentLogRow {
  id: string;
  agent_name: string;
  action: string;
  status: string;
  details: Record<string, unknown> | null;
  error_message: string | null;
  post_id: string | null;
  duration_ms: number | null;
  created_at: string;
}

// =============================================================================
// CONVERTER FUNCTIONS
// =============================================================================

export function rowToMarketingAccount(
  row: MarketingAccountRow
): MarketingAccount {
  return {
    id: row.id,
    platform: row.platform as MarketingPlatform,
    accountName: row.account_name,
    accountHandle: row.account_handle,
    credentials: row.credentials,
    platformUserId: row.platform_user_id,
    isActive: row.is_active,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMarketingAccountPublic(
  row: MarketingAccountRow
): MarketingAccountPublic {
  // Check for credentials - handles both encrypted format { encrypted: "..." }
  // and legacy plain format { accessToken: "..." }
  const hasCredentials = row.credentials !== null &&
    (('encrypted' in row.credentials && typeof row.credentials.encrypted === 'string') ||
     ('accessToken' in row.credentials && typeof row.credentials.accessToken === 'string'));

  return {
    id: row.id,
    platform: row.platform as MarketingPlatform,
    accountName: row.account_name,
    accountHandle: row.account_handle,
    isActive: row.is_active,
    hasCredentials,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMarketingPost(row: MarketingPostRow): MarketingPost {
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

export function rowToMarketingSchedule(
  row: MarketingScheduleRow
): MarketingSchedule {
  return {
    id: row.id,
    platform: row.platform as MarketingPlatform,
    dayOfWeek: row.day_of_week,
    timeUtc: row.time_utc,
    contentType: row.content_type as ContentType | "auto",
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function rowToMarketingContentBank(
  row: MarketingContentBankRow
): MarketingContentBank {
  return {
    id: row.id,
    platform: row.platform as MarketingPlatform | "all",
    contentType: row.content_type as ContentType,
    content: row.content,
    mediaSuggestions: row.media_suggestions || [],
    hashtagSet: row.hashtag_set || [],
    storyId: row.story_id,
    theme: row.theme as ContentTheme | null,
    isUsed: row.is_used,
    timesUsed: row.times_used,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export function rowToMarketingAgentLog(
  row: MarketingAgentLogRow
): MarketingAgentLog {
  return {
    id: row.id,
    agentName: row.agent_name,
    action: row.action as AgentAction,
    status: row.status as AgentStatus,
    details: row.details || {},
    errorMessage: row.error_message,
    postId: row.post_id,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/** Request to create a new post */
export interface CreatePostRequest {
  platform: MarketingPlatform;
  content: string;
  mediaUrls?: string[];
  scheduledFor?: string;
  storyId?: string;
  contentTheme?: ContentTheme;
}

/** Request to update account credentials */
export interface UpdateAccountCredentialsRequest {
  platform: MarketingPlatform;
  accountName: string;
  accountHandle?: string;
  credentials: MarketingCredentials;
}

/** Request to update schedule */
export interface UpdateScheduleRequest {
  platform: MarketingPlatform;
  dayOfWeek?: number | null;
  timeUtc: string;
  contentType?: ContentType | "auto";
  isActive?: boolean;
}

/** Dashboard summary response */
export interface MarketingDashboardSummary {
  accounts: MarketingAccountPublic[];
  recentPosts: MarketingPost[];
  upcomingPosts: MarketingPost[];
  schedules: MarketingSchedule[];
  stats: MarketingStats;
}

export interface MarketingStats {
  totalPosts: number;
  postsThisWeek: number;
  postsThisMonth: number;
  failedPosts: number;
  totalEngagement: PostEngagement;
  byPlatform: Record<MarketingPlatform, PlatformStats>;
}

export interface PlatformStats {
  posts: number;
  scheduled: number;
  engagement: PostEngagement;
  lastPostedAt: string | null;
}

// =============================================================================
// AGENT CONFIGURATION TYPES
// =============================================================================

/** Configuration for a marketing agent */
export interface MarketingAgentConfig {
  platform: MarketingPlatform;
  enabled: boolean;
  voiceGuidelines: string;
  hashtags: {
    always: string[];
    sometimes: string[];
    location: string[];
  };
  postingRules: {
    maxPostsPerDay: number;
    minHoursBetweenPosts: number;
    preferredTimes: string[]; // HH:MM format
    avoidTopics: string[];
  };
}

/** Default voice guidelines from CLAUDE.md */
export const DEFAULT_VOICE_GUIDELINES = `
Voice Guidelines:
- First person ("I discovered this...")
- Warm and curious, never salesy
- Show don't tell - let the images do the heavy lifting
- Avoid tourism clichés ("hidden gem", "off the beaten path", "bucket list")
- A knowledgeable guide - but never stuffy or lecturing
- Friendly and warm - like a local showing you their favorite spots
- Human - uses "I", feels personal, not robotic
- Inclusive - respects everyone

Topics to focus on:
- Stunning visuals that inspire
- Secrets and lesser-known places
- The human element and local stories
- Practical tips (how to get there, best times to visit)
`;

/** Hashtag sets by platform */
export const PLATFORM_HASHTAGS: Record<
  MarketingPlatform,
  { always: string[]; location: string[] }
> = {
  x: {
    always: ["#Asturias", "#Spain"],
    location: [
      "#Oviedo",
      "#Gijón",
      "#Avilés",
      "#PicosDeEuropa",
      "#CostaVerde",
    ],
  },
  instagram: {
    always: [
      "#Asturias",
      "#NorthernSpain",
      "#ParaisoNatural",
      "#VisitAsturias",
      "#SpainTravel",
    ],
    location: [
      "#Oviedo",
      "#Gijón",
      "#Avilés",
      "#PicosDeEuropa",
      "#CostaVerde",
      "#CaminoDeSantiago",
    ],
  },
  pinterest: {
    always: [
      "#Asturias",
      "#SpainTravel",
      "#TravelSpain",
      "#NorthernSpain",
      "#EuropeTravel",
    ],
    location: [
      "#Oviedo",
      "#Gijón",
      "#PicosDeEuropa",
      "#SpanishFood",
      "#HikingSpain",
    ],
  },
};
