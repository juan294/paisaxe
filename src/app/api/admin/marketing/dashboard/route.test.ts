import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("GET /api/admin/marketing/dashboard", () => {
  const mockAccounts = [
    {
      id: "acc-1",
      platform: "x",
      account_name: "Paisaxe",
      account_handle: "@paisaxe",
      // Encrypted format - the actual encrypted value doesn't matter for public API tests
      // since credentials are never exposed, only hasCredentials boolean is computed
      credentials: { encrypted: "encrypted-credentials-string" },
      platform_user_id: null,
      is_active: true,
      last_sync_at: "2025-01-15T10:00:00.000Z",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-10T12:00:00.000Z",
    },
  ];

  const mockPosts = [
    {
      id: "post-1",
      account_id: "acc-1",
      platform: "x",
      content: "Beautiful morning!",
      media_urls: [],
      hashtags: ["#Asturias"],
      link_url: null,
      scheduled_for: null,
      posted_at: "2025-01-15T14:00:00.000Z",
      status: "posted",
      platform_post_id: "123",
      post_url: "https://x.com/paisaxe/123",
      error_message: null,
      engagement: { likes: 10 },
      story_id: null,
      content_theme: null,
      created_at: "2025-01-15T10:00:00.000Z",
      updated_at: "2025-01-15T14:00:00.000Z",
    },
    {
      id: "post-2",
      account_id: "acc-1",
      platform: "x",
      content: "Coming soon!",
      media_urls: [],
      hashtags: [],
      link_url: null,
      scheduled_for: "2025-01-20T14:00:00.000Z",
      posted_at: null,
      status: "scheduled",
      platform_post_id: null,
      post_url: null,
      error_message: null,
      engagement: {},
      story_id: null,
      content_theme: null,
      created_at: "2025-01-15T10:00:00.000Z",
      updated_at: "2025-01-15T10:00:00.000Z",
    },
  ];

  const mockSchedules = [
    {
      id: "sched-1",
      platform: "x",
      day_of_week: null,
      time_utc: "14:00",
      content_type: "photo_caption",
      is_active: true,
      created_at: "2025-01-01T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("should return dashboard summary when auth is valid", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockSchedules, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveProperty("accounts");
    expect(data.data).toHaveProperty("recentPosts");
    expect(data.data).toHaveProperty("upcomingPosts");
    expect(data.data).toHaveProperty("schedules");
    expect(data.data).toHaveProperty("stats");
    expect(data.data.accounts).toHaveLength(1);
    expect(data.data.accounts[0].platform).toBe("x");
    // Should not include credentials in response
    expect(data.data.accounts[0]).not.toHaveProperty("credentials");
  });

  it("should calculate stats correctly", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockSchedules, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(data.data.stats.totalPosts).toBe(1); // Only "posted" status counts
    expect(data.data.stats.byPlatform.x.posts).toBe(1);
    expect(data.data.stats.byPlatform.x.scheduled).toBe(1);
  });

  it("should return 500 when accounts fetch fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch accounts");
  });

  it("should return 500 when posts fetch fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch posts");
  });

  it("should return 500 when schedules fetch fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch schedules");
  });

  it("should count failed posts and recent posts in stats", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const postsWithFailed = [
      {
        id: "post-recent",
        account_id: "acc-1",
        platform: "x",
        content: "Recent post",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: recentDate.toISOString(),
        status: "posted",
        platform_post_id: "456",
        post_url: "https://x.com/paisaxe/456",
        error_message: null,
        engagement: { likes: 5, retweets: 2 },
        story_id: null,
        content_theme: null,
        created_at: recentDate.toISOString(),
        updated_at: recentDate.toISOString(),
      },
      {
        id: "post-failed",
        account_id: "acc-1",
        platform: "x",
        content: "Failed post",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: null,
        status: "failed",
        platform_post_id: null,
        post_url: null,
        error_message: "API rate limit",
        engagement: {},
        story_id: null,
        content_theme: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: postsWithFailed, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockSchedules, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.stats.failedPosts).toBe(1);
    expect(data.data.stats.postsThisWeek).toBe(1);
    expect(data.data.stats.postsThisMonth).toBe(1);
    // Engagement should be aggregated
    expect(data.data.stats.totalEngagement.likes).toBe(5);
    expect(data.data.stats.totalEngagement.retweets).toBe(2);
  });

  it("should sort upcoming posts by scheduledFor date ascending", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const scheduledPosts = [
      {
        id: "post-later",
        account_id: "acc-1",
        platform: "x",
        content: "Later post",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: "2027-06-15T14:00:00.000Z",
        posted_at: null,
        status: "scheduled",
        platform_post_id: null,
        post_url: null,
        error_message: null,
        engagement: {},
        story_id: null,
        content_theme: null,
        created_at: "2025-01-15T10:00:00.000Z",
        updated_at: "2025-01-15T10:00:00.000Z",
      },
      {
        id: "post-sooner",
        account_id: "acc-1",
        platform: "x",
        content: "Sooner post",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: "2027-03-10T14:00:00.000Z",
        posted_at: null,
        status: "scheduled",
        platform_post_id: null,
        post_url: null,
        error_message: null,
        engagement: {},
        story_id: null,
        content_theme: null,
        created_at: "2025-01-15T10:00:00.000Z",
        updated_at: "2025-01-15T10:00:00.000Z",
      },
    ];

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: scheduledPosts, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // Upcoming posts should be sorted by scheduledFor ascending (sooner first)
    expect(data.data.upcomingPosts).toHaveLength(2);
    expect(data.data.upcomingPosts[0].id).toBe("post-sooner");
    expect(data.data.upcomingPosts[1].id).toBe("post-later");
  });

  it("should handle posts without postedAt date", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const postsNoDate = [
      {
        id: "post-no-date",
        account_id: "acc-1",
        platform: "x",
        content: "No date post",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: null, // No postedAt
        status: "posted",
        platform_post_id: "789",
        post_url: null,
        error_message: null,
        engagement: null, // No engagement either
        story_id: null,
        content_theme: null,
        created_at: "2025-01-15T10:00:00.000Z",
        updated_at: "2025-01-15T10:00:00.000Z",
      },
    ];

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: postsNoDate, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // Post without postedAt should still be counted as posted but not add to weekly/monthly
    expect(data.data.stats.totalPosts).toBe(1);
    expect(data.data.stats.postsThisWeek).toBe(0);
    expect(data.data.stats.postsThisMonth).toBe(0);
  });

  it("should handle posts across multiple platforms with engagement aggregation", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const multiPlatformPosts = [
      {
        id: "post-ig",
        account_id: "acc-2",
        platform: "instagram",
        content: "Instagram post",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: recentDate.toISOString(),
        status: "posted",
        platform_post_id: "ig-1",
        post_url: null,
        error_message: null,
        engagement: { likes: 100, comments: 20 },
        story_id: null,
        content_theme: null,
        created_at: recentDate.toISOString(),
        updated_at: recentDate.toISOString(),
      },
      {
        id: "post-pinterest",
        account_id: "acc-3",
        platform: "pinterest",
        content: "Pinterest pin",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: recentDate.toISOString(),
        status: "posted",
        platform_post_id: "pin-1",
        post_url: null,
        error_message: null,
        engagement: { saves: 50 },
        story_id: null,
        content_theme: null,
        created_at: recentDate.toISOString(),
        updated_at: recentDate.toISOString(),
      },
    ];

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: multiPlatformPosts, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.stats.totalPosts).toBe(2);
    expect(data.data.stats.byPlatform.instagram.posts).toBe(1);
    expect(data.data.stats.byPlatform.pinterest.posts).toBe(1);
    // Engagement should be aggregated across platforms
    expect(data.data.stats.totalEngagement.likes).toBe(100);
    expect(data.data.stats.totalEngagement.comments).toBe(20);
    expect(data.data.stats.totalEngagement.saves).toBe(50);
    // Each platform should have its own engagement
    expect(data.data.stats.byPlatform.instagram.engagement.likes).toBe(100);
    expect(data.data.stats.byPlatform.pinterest.engagement.saves).toBe(50);
  });

  it("should track lastPostedAt per platform and update when newer post found", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const olderDate = "2025-01-10T10:00:00.000Z";
    const newerDate = "2025-01-15T14:00:00.000Z";

    const postsWithDates = [
      {
        id: "post-older",
        account_id: "acc-1",
        platform: "x",
        content: "Older",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: olderDate,
        status: "posted",
        platform_post_id: "1",
        post_url: null,
        error_message: null,
        engagement: {},
        story_id: null,
        content_theme: null,
        created_at: olderDate,
        updated_at: olderDate,
      },
      {
        id: "post-newer",
        account_id: "acc-1",
        platform: "x",
        content: "Newer",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: newerDate,
        status: "posted",
        platform_post_id: "2",
        post_url: null,
        error_message: null,
        engagement: {},
        story_id: null,
        content_theme: null,
        created_at: newerDate,
        updated_at: newerDate,
      },
    ];

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "marketing_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "marketing_posts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: postsWithDates, error: null }),
            }),
          }),
        };
      }
      if (table === "marketing_schedule") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // lastPostedAt should be the newer date
    expect(data.data.stats.byPlatform.x.lastPostedAt).toBe(newerDate);
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
