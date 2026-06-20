import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

type StatsResult = { data: unknown; error: { message: string } | null };

/**
 * Build a mock admin client.
 *
 * Stats are now aggregated in SQL via the `get_marketing_post_stats` RPC, so
 * tests provide the pre-aggregated stats jsonb directly via `statsResult`.
 * The 100-row post fetch is still used for the recent/upcoming lists only.
 */
function buildClient(opts: {
  accounts?: { data: unknown; error: unknown };
  posts?: { data: unknown; error: unknown };
  schedules?: { data: unknown; error: unknown };
  stats?: StatsResult;
}) {
  const accounts = opts.accounts ?? { data: [], error: null };
  const posts = opts.posts ?? { data: [], error: null };
  const schedules = opts.schedules ?? { data: [], error: null };
  const stats: StatsResult = opts.stats ?? { data: {}, error: null };

  const rpc = vi.fn().mockResolvedValue(stats);

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "marketing_accounts") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue(accounts),
        }),
      };
    }
    if (table === "marketing_posts") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(posts),
          }),
        }),
      };
    }
    if (table === "marketing_schedule") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(schedules),
          }),
        }),
      };
    }
    return { select: vi.fn() };
  });

  return { from, rpc };
}

describe("GET /api/admin/marketing/dashboard", () => {
  const mockAccounts = [
    {
      id: "acc-1",
      platform: "x",
      account_name: "Paisaxe",
      account_handle: "@paisaxe",
      credentials: { encrypted: "encrypted-credentials-string" },
      platform_user_id: null,
      is_active: true,
      last_sync_at: "2025-01-15T10:00:00.000Z",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-10T12:00:00.000Z",
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

  const fullStats = {
    totalPosts: 1,
    postsThisWeek: 1,
    postsThisMonth: 1,
    failedPosts: 0,
    totalEngagement: { likes: 10 },
    byPlatform: {
      x: { posts: 1, scheduled: 1, engagement: { likes: 10 }, lastPostedAt: "2025-01-15T14:00:00.000Z" },
      instagram: { posts: 0, scheduled: 0, engagement: {}, lastPostedAt: null },
      pinterest: { posts: 0, scheduled: 0, engagement: {}, lastPostedAt: null },
    },
  };

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
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({
        accounts: { data: mockAccounts, error: null },
        schedules: { data: mockSchedules, error: null },
        stats: { data: fullStats, error: null },
      }) as never
    );

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

  it("aggregates stats via the get_marketing_post_stats RPC (not in JS)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    const client = buildClient({ stats: { data: fullStats, error: null } });
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("get_marketing_post_stats");
    expect(data.data.stats.totalPosts).toBe(1);
    expect(data.data.stats.byPlatform.x.posts).toBe(1);
    expect(data.data.stats.byPlatform.x.scheduled).toBe(1);
    expect(data.data.stats.totalEngagement.likes).toBe(10);
  });

  it("normalizes RPC stats so all three platforms are always present", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    // RPC returns partial byPlatform (only x) — route must backfill the rest.
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({
        stats: {
          data: {
            totalPosts: 2,
            postsThisWeek: 0,
            postsThisMonth: 2,
            failedPosts: 1,
            totalEngagement: { likes: 30 },
            byPlatform: {
              x: { posts: 2, scheduled: 0, engagement: { likes: 30 }, lastPostedAt: "2025-01-15T14:00:00.000Z" },
            },
          },
          error: null,
        },
      }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.stats.totalPosts).toBe(2);
    expect(data.data.stats.failedPosts).toBe(1);
    expect(data.data.stats.byPlatform.instagram).toEqual({
      posts: 0,
      scheduled: 0,
      engagement: {},
      lastPostedAt: null,
    });
    expect(data.data.stats.byPlatform.pinterest.posts).toBe(0);
  });

  it("returns empty stats when the RPC returns no data", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ stats: { data: null, error: null } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.stats.totalPosts).toBe(0);
    expect(data.data.stats.totalEngagement).toEqual({});
    expect(data.data.stats.byPlatform.x).toEqual({
      posts: 0,
      scheduled: 0,
      engagement: {},
      lastPostedAt: null,
    });
  });

  it("should return 500 when accounts fetch fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ accounts: { data: null, error: { message: "DB Error" } } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch accounts");
  });

  it("should return 500 when posts fetch fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ posts: { data: null, error: { message: "DB Error" } } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch posts");
  });

  it("should return 500 when schedules fetch fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ schedules: { data: null, error: { message: "DB Error" } } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch schedules");
  });

  it("should return 500 when the stats RPC fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ stats: { data: null, error: { message: "RPC Error" } } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch stats");
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

    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ posts: { data: scheduledPosts, error: null } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.upcomingPosts).toHaveLength(2);
    expect(data.data.upcomingPosts[0].id).toBe("post-sooner");
    expect(data.data.upcomingPosts[1].id).toBe("post-later");
  });

  it("filters recentPosts to posted status from the 100-row fetch", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });

    const posts = [
      {
        id: "post-posted",
        account_id: "acc-1",
        platform: "x",
        content: "Posted",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: null,
        posted_at: "2025-01-15T14:00:00.000Z",
        status: "posted",
        platform_post_id: "1",
        post_url: null,
        error_message: null,
        engagement: {},
        story_id: null,
        content_theme: null,
        created_at: "2025-01-15T10:00:00.000Z",
        updated_at: "2025-01-15T14:00:00.000Z",
      },
      {
        id: "post-scheduled",
        account_id: "acc-1",
        platform: "x",
        content: "Scheduled",
        media_urls: [],
        hashtags: [],
        link_url: null,
        scheduled_for: "2027-01-20T14:00:00.000Z",
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

    vi.mocked(createAdminClient).mockReturnValue(
      buildClient({ posts: { data: posts, error: null } }) as never
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.recentPosts).toHaveLength(1);
    expect(data.data.recentPosts[0].id).toBe("post-posted");
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

  it("should use logger.error (not console.error) on unhandled GET error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-1" });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected DB failure");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET();
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
