import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Story } from "@/types/immersive";
import { GET } from "./route";

const mockGetStoriesServer = vi.fn();

vi.mock("@/lib/stories-server", () => ({
  getStoriesServer: (...args: unknown[]) => mockGetStoriesServer(...args),
}));

const mockStories: Story[] = [
  {
    id: "story-1",
    slug: "story-1",
    title: "Story One",
    subtitle: "Sub 1",
    description: "Desc 1",
    image: "/img1.png",
    category: "nature",
    sourcePdf: "story1.pdf",
  },
];

describe("GET /api/stories", () => {
  beforeEach(() => {
    mockGetStoriesServer.mockReset();
    mockGetStoriesServer.mockResolvedValue(mockStories);
  });

  it("returns stories from getStoriesServer wrapped in a data envelope", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(mockStories);
    expect(mockGetStoriesServer).toHaveBeenCalledTimes(1);
  });

  it("includes short-lived public Cache-Control and Vary: Host headers", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=120"
    );
    expect(response.headers.get("vary")).toContain("Host");
  });

  // FE-H1 (#759): this route exists so that use-stories.ts (a client hook)
  // never has to import @/lib/stories-data directly — that module pulls in
  // the Pino-based @/lib/logger, which was reaching the browser bundle and
  // triggering a CSP unsafe-eval violation. getStoriesServer itself still
  // performs the FALLBACK_STORIES safety net and [STORIES_FALLBACK]/
  // [TABLE_FALLBACK] logging server-side; this route is a thin passthrough.
  it("passes through whatever getStoriesServer returns, including its own fallback data", async () => {
    const fallbackShaped: Story[] = [
      {
        id: "fallback-1",
        slug: "fallback-1",
        title: "Fallback Story",
        subtitle: "Fallback Sub",
        description: "Fallback Desc",
        image: "/fallback.png",
        category: "nature",
        sourcePdf: "fallback.pdf",
      },
    ];
    mockGetStoriesServer.mockResolvedValue(fallbackShaped);

    const response = await GET();
    const body = await response.json();

    expect(body.data).toEqual(fallbackShaped);
  });
});
