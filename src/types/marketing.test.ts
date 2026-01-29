import { describe, it, expect } from "vitest";
import {
  rowToMarketingAccount,
  rowToMarketingAccountPublic,
  rowToMarketingPost,
  rowToMarketingSchedule,
  rowToMarketingContentBank,
  rowToMarketingAgentLog,
  PLATFORM_LIMITS,
  PLATFORM_HASHTAGS,
  DEFAULT_VOICE_GUIDELINES,
  type MarketingAccountRow,
  type MarketingPostRow,
  type MarketingScheduleRow,
  type MarketingContentBankRow,
  type MarketingAgentLogRow,
} from "./marketing";

describe("rowToMarketingAccount", () => {
  const sampleRow: MarketingAccountRow = {
    id: "acc-123",
    platform: "x",
    account_name: "Paisaxe",
    account_handle: "@paisaxe",
    credentials: { accessToken: "secret-token", refreshToken: "refresh" },
    platform_user_id: "12345",
    is_active: true,
    last_sync_at: "2025-01-15T10:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-10T12:00:00.000Z",
  };

  it("converts snake_case row to camelCase", () => {
    const account = rowToMarketingAccount(sampleRow);

    expect(account).toHaveProperty("accountName");
    expect(account).toHaveProperty("accountHandle");
    expect(account).toHaveProperty("isActive");
    expect(account).toHaveProperty("lastSyncAt");
    expect(account).toHaveProperty("createdAt");
    // Should not have snake_case keys
    expect(account).not.toHaveProperty("account_name");
    expect(account).not.toHaveProperty("is_active");
  });

  it("maps all fields correctly", () => {
    const account = rowToMarketingAccount(sampleRow);

    expect(account.id).toBe("acc-123");
    expect(account.platform).toBe("x");
    expect(account.accountName).toBe("Paisaxe");
    expect(account.accountHandle).toBe("@paisaxe");
    expect(account.credentials).toEqual({
      accessToken: "secret-token",
      refreshToken: "refresh",
    });
    expect(account.platformUserId).toBe("12345");
    expect(account.isActive).toBe(true);
  });

  it("handles null optional fields", () => {
    const rowWithNulls: MarketingAccountRow = {
      ...sampleRow,
      account_handle: null,
      credentials: null,
      platform_user_id: null,
      last_sync_at: null,
    };

    const account = rowToMarketingAccount(rowWithNulls);
    expect(account.accountHandle).toBeNull();
    expect(account.credentials).toBeNull();
    expect(account.platformUserId).toBeNull();
    expect(account.lastSyncAt).toBeNull();
  });
});

describe("rowToMarketingAccountPublic", () => {
  const sampleRow: MarketingAccountRow = {
    id: "acc-123",
    platform: "instagram",
    account_name: "Paisaxe",
    account_handle: "@paisaxe",
    credentials: { accessToken: "secret-token" },
    platform_user_id: "12345",
    is_active: true,
    last_sync_at: "2025-01-15T10:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-10T12:00:00.000Z",
  };

  it("excludes credentials from public version", () => {
    const publicAccount = rowToMarketingAccountPublic(sampleRow);

    expect(publicAccount).not.toHaveProperty("credentials");
    expect(publicAccount).not.toHaveProperty("platformUserId");
    expect(publicAccount.id).toBe("acc-123");
    expect(publicAccount.platform).toBe("instagram");
    expect(publicAccount.accountName).toBe("Paisaxe");
  });
});

describe("rowToMarketingPost", () => {
  const sampleRow: MarketingPostRow = {
    id: "post-456",
    account_id: "acc-123",
    platform: "x",
    content: "Beautiful morning in Asturias!",
    media_urls: ["https://example.com/image1.jpg"],
    hashtags: ["#Asturias", "#Spain"],
    link_url: "https://paisaxe.com/stories/covadonga",
    scheduled_for: "2025-01-20T14:00:00.000Z",
    posted_at: null,
    status: "scheduled",
    platform_post_id: null,
    post_url: null,
    error_message: null,
    engagement: { likes: 10, reposts: 2 },
    story_id: "story-789",
    content_theme: "winter",
    created_at: "2025-01-15T10:00:00.000Z",
    updated_at: "2025-01-15T10:00:00.000Z",
  };

  it("converts snake_case row to camelCase", () => {
    const post = rowToMarketingPost(sampleRow);

    expect(post).toHaveProperty("accountId");
    expect(post).toHaveProperty("mediaUrls");
    expect(post).toHaveProperty("scheduledFor");
    expect(post).toHaveProperty("contentTheme");
    expect(post).not.toHaveProperty("account_id");
    expect(post).not.toHaveProperty("media_urls");
  });

  it("maps all fields correctly", () => {
    const post = rowToMarketingPost(sampleRow);

    expect(post.id).toBe("post-456");
    expect(post.platform).toBe("x");
    expect(post.content).toBe("Beautiful morning in Asturias!");
    expect(post.mediaUrls).toEqual(["https://example.com/image1.jpg"]);
    expect(post.hashtags).toEqual(["#Asturias", "#Spain"]);
    expect(post.status).toBe("scheduled");
    expect(post.engagement).toEqual({ likes: 10, reposts: 2 });
    expect(post.contentTheme).toBe("winter");
  });

  it("handles null arrays as empty arrays", () => {
    const rowWithNulls: MarketingPostRow = {
      ...sampleRow,
      media_urls: null,
      hashtags: null,
    };

    const post = rowToMarketingPost(rowWithNulls);
    expect(post.mediaUrls).toEqual([]);
    expect(post.hashtags).toEqual([]);
  });

  it("handles null engagement as empty object", () => {
    const rowWithNullEngagement: MarketingPostRow = {
      ...sampleRow,
      engagement: null,
    };

    const post = rowToMarketingPost(rowWithNullEngagement);
    expect(post.engagement).toEqual({});
  });
});

describe("rowToMarketingSchedule", () => {
  const sampleRow: MarketingScheduleRow = {
    id: "sched-123",
    platform: "instagram",
    day_of_week: 1, // Monday
    time_utc: "17:00",
    content_type: "reel_caption",
    is_active: true,
    created_at: "2025-01-01T00:00:00.000Z",
  };

  it("converts snake_case row to camelCase", () => {
    const schedule = rowToMarketingSchedule(sampleRow);

    expect(schedule).toHaveProperty("dayOfWeek");
    expect(schedule).toHaveProperty("timeUtc");
    expect(schedule).toHaveProperty("contentType");
    expect(schedule).toHaveProperty("isActive");
    expect(schedule).not.toHaveProperty("day_of_week");
    expect(schedule).not.toHaveProperty("time_utc");
  });

  it("maps all fields correctly", () => {
    const schedule = rowToMarketingSchedule(sampleRow);

    expect(schedule.id).toBe("sched-123");
    expect(schedule.platform).toBe("instagram");
    expect(schedule.dayOfWeek).toBe(1);
    expect(schedule.timeUtc).toBe("17:00");
    expect(schedule.contentType).toBe("reel_caption");
    expect(schedule.isActive).toBe(true);
  });

  it("handles null day_of_week (every day)", () => {
    const dailyRow: MarketingScheduleRow = {
      ...sampleRow,
      day_of_week: null,
    };

    const schedule = rowToMarketingSchedule(dailyRow);
    expect(schedule.dayOfWeek).toBeNull();
  });
});

describe("rowToMarketingContentBank", () => {
  const sampleRow: MarketingContentBankRow = {
    id: "content-123",
    platform: "all",
    content_type: "photo_caption",
    content: "Discover the hidden valleys of Asturias.",
    media_suggestions: ["/images/stories/covadonga.png"],
    hashtag_set: ["#Asturias", "#HiddenValleys"],
    story_id: "story-456",
    theme: "spring",
    is_used: false,
    times_used: 0,
    last_used_at: null,
    created_at: "2025-01-01T00:00:00.000Z",
  };

  it("converts snake_case row to camelCase", () => {
    const content = rowToMarketingContentBank(sampleRow);

    expect(content).toHaveProperty("contentType");
    expect(content).toHaveProperty("mediaSuggestions");
    expect(content).toHaveProperty("hashtagSet");
    expect(content).toHaveProperty("storyId");
    expect(content).toHaveProperty("isUsed");
    expect(content).toHaveProperty("timesUsed");
    expect(content).not.toHaveProperty("content_type");
    expect(content).not.toHaveProperty("media_suggestions");
  });

  it("maps all fields correctly", () => {
    const content = rowToMarketingContentBank(sampleRow);

    expect(content.id).toBe("content-123");
    expect(content.platform).toBe("all");
    expect(content.contentType).toBe("photo_caption");
    expect(content.content).toBe("Discover the hidden valleys of Asturias.");
    expect(content.mediaSuggestions).toEqual(["/images/stories/covadonga.png"]);
    expect(content.theme).toBe("spring");
    expect(content.isUsed).toBe(false);
  });

  it("handles null arrays as empty arrays", () => {
    const rowWithNulls: MarketingContentBankRow = {
      ...sampleRow,
      media_suggestions: null,
      hashtag_set: null,
    };

    const content = rowToMarketingContentBank(rowWithNulls);
    expect(content.mediaSuggestions).toEqual([]);
    expect(content.hashtagSet).toEqual([]);
  });
});

describe("rowToMarketingAgentLog", () => {
  const sampleRow: MarketingAgentLogRow = {
    id: "log-789",
    agent_name: "x-agent",
    action: "post",
    status: "success",
    details: { postId: "post-123" },
    error_message: null,
    post_id: "post-123",
    duration_ms: 1500,
    created_at: "2025-01-15T14:00:00.000Z",
  };

  it("converts snake_case row to camelCase", () => {
    const log = rowToMarketingAgentLog(sampleRow);

    expect(log).toHaveProperty("agentName");
    expect(log).toHaveProperty("errorMessage");
    expect(log).toHaveProperty("postId");
    expect(log).toHaveProperty("durationMs");
    expect(log).toHaveProperty("createdAt");
    expect(log).not.toHaveProperty("agent_name");
    expect(log).not.toHaveProperty("error_message");
  });

  it("maps all fields correctly", () => {
    const log = rowToMarketingAgentLog(sampleRow);

    expect(log.id).toBe("log-789");
    expect(log.agentName).toBe("x-agent");
    expect(log.action).toBe("post");
    expect(log.status).toBe("success");
    expect(log.details).toEqual({ postId: "post-123" });
    expect(log.durationMs).toBe(1500);
  });

  it("handles null details as empty object", () => {
    const rowWithNullDetails: MarketingAgentLogRow = {
      ...sampleRow,
      details: null,
    };

    const log = rowToMarketingAgentLog(rowWithNullDetails);
    expect(log.details).toEqual({});
  });
});

describe("PLATFORM_LIMITS", () => {
  it("defines limits for all platforms", () => {
    expect(PLATFORM_LIMITS).toHaveProperty("x");
    expect(PLATFORM_LIMITS).toHaveProperty("instagram");
    expect(PLATFORM_LIMITS).toHaveProperty("pinterest");
    expect(PLATFORM_LIMITS).toHaveProperty("tiktok");
  });

  it("has correct character limits", () => {
    expect(PLATFORM_LIMITS.x.maxLength).toBe(280);
    expect(PLATFORM_LIMITS.instagram.maxLength).toBe(2200);
    expect(PLATFORM_LIMITS.pinterest.maxLength).toBe(500);
    expect(PLATFORM_LIMITS.tiktok.maxLength).toBe(2200);
  });

  it("has correct media limits", () => {
    expect(PLATFORM_LIMITS.x.maxMedia).toBe(4);
    expect(PLATFORM_LIMITS.instagram.maxMedia).toBe(10);
    expect(PLATFORM_LIMITS.pinterest.maxMedia).toBe(1);
    expect(PLATFORM_LIMITS.tiktok.maxMedia).toBe(1);
  });
});

describe("PLATFORM_HASHTAGS", () => {
  it("defines hashtags for all platforms", () => {
    expect(PLATFORM_HASHTAGS).toHaveProperty("x");
    expect(PLATFORM_HASHTAGS).toHaveProperty("instagram");
    expect(PLATFORM_HASHTAGS).toHaveProperty("pinterest");
    expect(PLATFORM_HASHTAGS).toHaveProperty("tiktok");
  });

  it("includes Asturias hashtags", () => {
    expect(PLATFORM_HASHTAGS.x.always).toContain("#Asturias");
    expect(PLATFORM_HASHTAGS.instagram.always).toContain("#Asturias");
    expect(PLATFORM_HASHTAGS.pinterest.always).toContain("#Asturias");
    expect(PLATFORM_HASHTAGS.tiktok.always).toContain("#Asturias");
  });
});

describe("DEFAULT_VOICE_GUIDELINES", () => {
  it("contains key voice guidance", () => {
    expect(DEFAULT_VOICE_GUIDELINES).toContain("First person");
    expect(DEFAULT_VOICE_GUIDELINES).toContain("Warm and curious");
    expect(DEFAULT_VOICE_GUIDELINES).toContain("Avoid tourism clichés");
    expect(DEFAULT_VOICE_GUIDELINES).toContain("knowledgeable guide");
  });
});
