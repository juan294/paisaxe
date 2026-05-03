import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { logger } from "@/lib/logger";

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/translate-story", () => ({
  translateStory: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";

describe("translate webhook", () => {
  const VALID_SECRET = "test-webhook-secret";
  const VALID_STORY_ID = "550e8400-e29b-41d4-a716-446655440000";
  const mockRpc = vi.fn();

  function createRequest(body: unknown, secret = VALID_SECRET) {
    return new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": secret },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WEBHOOK_SECRET", VALID_SECRET);

    mockRpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
      if (fn === "enqueue_translate_webhook_event") {
        return Promise.resolve({ data: "queued", error: null, args });
      }

      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }

      if (fn === "claim_next_translate_webhook_event") {
        return Promise.resolve({
          data: [
            {
              event_key: args?.p_event_key ?? `${VALID_STORY_ID}:default:all`,
              story_id: VALID_STORY_ID,
              locales: null,
              force_retranslate: false,
            },
          ],
          error: null,
        });
      }

      if (
        fn === "complete_translate_webhook_event" ||
        fn === "fail_translate_webhook_event" ||
        fn === "pg_advisory_unlock"
      ) {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);
  });

  it("rejects requests without webhook secret", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      body: JSON.stringify({ storyId: VALID_STORY_ID }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("rejects requests with invalid webhook secret", async () => {
    const response = await POST(createRequest({ storyId: VALID_STORY_ID }, "wrong-secret"));

    expect(response.status).toBe(401);
  });

  it("rejects null payloads", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: "null",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.errors).toBeDefined();
  });

  it("rejects payloads without storyId or eventKey", async () => {
    const response = await POST(createRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.errors).toBeDefined();
  });

  it("enqueues and processes a direct story translation request", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: true,
      successCount: 5,
      failedCount: 0,
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe("processed");
    expect(mockRpc).toHaveBeenCalledWith("enqueue_translate_webhook_event", {
      p_event_key: `${VALID_STORY_ID}:default:all`,
      p_story_id: VALID_STORY_ID,
      p_force_retranslate: false,
      p_locales: null,
    });
    expect(mockRpc).toHaveBeenCalledWith("claim_next_translate_webhook_event", {
      p_event_key: `${VALID_STORY_ID}:default:all`,
      p_lease_seconds: 180, // BE-H6: reduced from 600 to 180 (3 minutes)
      p_batch_size: 3, // BE-H6: reduced from 10 to 3 jobs per batch
    });
    expect(mockRpc).toHaveBeenCalledWith("complete_translate_webhook_event", {
      p_event_key: `${VALID_STORY_ID}:default:all`,
    });
    expect(translateStory).toHaveBeenCalledWith(VALID_STORY_ID, {
      locales: undefined,
      forceRetranslate: false,
    });
  });

  it("returns 202 when the worker lock is already held", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "enqueue_translate_webhook_event") {
        return Promise.resolve({ data: "queued", error: null });
      }

      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: false, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.status).toBe("queued");
    expect(json.storyId).toBe(VALID_STORY_ID);
    expect(translateStory).not.toHaveBeenCalled();
  });

  it("#440 QA-H2: relies on leased job claims instead of session advisory worker locks", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: true,
      successCount: 5,
      failedCount: 0,
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));

    expect(response.status).toBe(200);
    const rpcNames = mockRpc.mock.calls.map((args: unknown[]) => args[0]);
    expect(rpcNames).toContain("claim_next_translate_webhook_event");
    expect(rpcNames).not.toContain("pg_try_advisory_lock");
    expect(rpcNames).not.toContain("pg_advisory_unlock");
  });

  it("recovers and processes a job by event key", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: true,
      successCount: 2,
      failedCount: 0,
    });

    let claimCount = 0;
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }

      if (fn === "claim_next_translate_webhook_event") {
        claimCount += 1;

        if (claimCount === 1) {
          return Promise.resolve({
            data: [
              {
                event_key: `${VALID_STORY_ID}:force:en,fr`,
                story_id: VALID_STORY_ID,
                locales: ["en", "fr"],
                force_retranslate: true,
              },
            ],
            error: null,
          });
        }

        return Promise.resolve({ data: [], error: null });
      }

      if (
        fn === "complete_translate_webhook_event" ||
        fn === "pg_advisory_unlock"
      ) {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const response = await POST(createRequest({ eventKey: `${VALID_STORY_ID}:force:en,fr` }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("processed");
    expect(json.storyId).toBe(VALID_STORY_ID);
    expect(translateStory).toHaveBeenCalledWith(VALID_STORY_ID, {
      locales: ["en", "fr"],
      forceRetranslate: true,
    });
  });

  it("passes locales and forceRetranslate through the durable queue", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: true,
      successCount: 2,
      failedCount: 0,
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "enqueue_translate_webhook_event") {
        return Promise.resolve({ data: "queued", error: null });
      }

      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }

      if (fn === "claim_next_translate_webhook_event") {
        return Promise.resolve({
          data: [
            {
              event_key: `${VALID_STORY_ID}:force:en,fr`,
              story_id: VALID_STORY_ID,
              locales: ["en", "fr"],
              force_retranslate: true,
            },
          ],
          error: null,
        });
      }

      if (
        fn === "complete_translate_webhook_event" ||
        fn === "pg_advisory_unlock"
      ) {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    await POST(
      createRequest({
        storyId: VALID_STORY_ID,
        locales: ["en", "fr"],
        forceRetranslate: true,
      })
    );

    expect(mockRpc).toHaveBeenCalledWith("enqueue_translate_webhook_event", {
      p_event_key: `${VALID_STORY_ID}:force:en,fr`,
      p_story_id: VALID_STORY_ID,
      p_force_retranslate: true,
      p_locales: ["en", "fr"],
    });
    expect(translateStory).toHaveBeenCalledWith(VALID_STORY_ID, {
      locales: ["en", "fr"],
      forceRetranslate: true,
    });
  });

  it("returns duplicate when the requested job is already complete", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "enqueue_translate_webhook_event") {
        return Promise.resolve({ data: "duplicate", error: null });
      }

      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }

      if (fn === "claim_next_translate_webhook_event") {
        return Promise.resolve({ data: [], error: null });
      }

      if (fn === "pg_advisory_unlock") {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("duplicate");
    expect(translateStory).not.toHaveBeenCalled();
  });

  it("returns 500 when the enqueue RPC fails", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "enqueue_translate_webhook_event") {
        return Promise.resolve({
          data: null,
          error: { message: "enqueue failed" },
        });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Database error");
    expect(translateStory).not.toHaveBeenCalled();
  });

  it("returns 500 when the claim RPC fails", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "enqueue_translate_webhook_event") {
        return Promise.resolve({ data: "queued", error: null });
      }

      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }

      if (fn === "claim_next_translate_webhook_event") {
        return Promise.resolve({
          data: null,
          error: { message: "claim failed" },
        });
      }

      if (fn === "pg_advisory_unlock") {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Database error");
    expect(translateStory).not.toHaveBeenCalled();
  });

  it("marks the job failed instead of deleting the claim when translation fails", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: false,
      error: "API error",
      successCount: 0,
      failedCount: 5,
    });

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe("API error");
    expect(mockRpc).toHaveBeenCalledWith("fail_translate_webhook_event", {
      p_event_key: `${VALID_STORY_ID}:default:all`,
      p_error: "API error",
    });
  });

  it("marks the job failed when translation throws unexpectedly", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockRejectedValue(new Error("Unexpected crash"));

    const response = await POST(createRequest({ storyId: VALID_STORY_ID }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Unexpected crash");
    expect(mockRpc).toHaveBeenCalledWith("fail_translate_webhook_event", {
      p_event_key: `${VALID_STORY_ID}:default:all`,
      p_error: "Unexpected crash",
    });
  });

  describe("BE-H3: lease expiry allows reclaim of stranded jobs", () => {
    it("processes a job that was reclaimed after its lease expired", async () => {
      // Arrange: claim_next returns a job that was previously processing with an
      // expired lease — simulating a crashed handler being retried.
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        successCount: 3,
        failedCount: 0,
      });

      const expiredLeaseKey = `${VALID_STORY_ID}:default:all`;

      mockRpc.mockImplementation((fn: string, _args?: Record<string, unknown>) => {
        if (fn === "pg_try_advisory_lock") {
          return Promise.resolve({ data: true, error: null });
        }

        if (fn === "claim_next_translate_webhook_event") {
          // Simulates DB returning a job previously held by a crashed handler
          // (status was 'processing', lease_expires_at is now in the past).
          return Promise.resolve({
            data: [
              {
                event_key: expiredLeaseKey,
                story_id: VALID_STORY_ID,
                locales: null,
                force_retranslate: false,
                // The handler sees it as a normal job — DB already reclaimed it
              },
            ],
            error: null,
          });
        }

        if (
          fn === "complete_translate_webhook_event" ||
          fn === "pg_advisory_unlock"
        ) {
          return Promise.resolve({ data: true, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      });

      // Act: recovery mode (no direct enqueue — mimics cron kicking the worker)
      const response = await POST(createRequest({ eventKey: expiredLeaseKey }));
      const json = await response.json();

      // Assert: job is processed successfully despite previously being 'processing'
      expect(response.status).toBe(200);
      expect(json.status).toBe("processed");
      expect(json.storyId).toBe(VALID_STORY_ID);
      expect(translateStory).toHaveBeenCalledWith(VALID_STORY_ID, {
        locales: undefined,
        forceRetranslate: false,
      });
      expect(mockRpc).toHaveBeenCalledWith("complete_translate_webhook_event", {
        p_event_key: expiredLeaseKey,
      });
    });

    it("marks a reclaimed job as failed when translation throws during retry", async () => {
      const { translateStory } = await import("@/lib/translate-story");
      vi.mocked(translateStory).mockRejectedValue(new Error("Retry crash"));

      const expiredLeaseKey = `${VALID_STORY_ID}:default:all`;

      mockRpc.mockImplementation((fn: string) => {
        if (fn === "pg_try_advisory_lock") {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === "claim_next_translate_webhook_event") {
          return Promise.resolve({
            data: [
              {
                event_key: expiredLeaseKey,
                story_id: VALID_STORY_ID,
                locales: null,
                force_retranslate: false,
              },
            ],
            error: null,
          });
        }
        if (
          fn === "fail_translate_webhook_event" ||
          fn === "pg_advisory_unlock"
        ) {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const response = await POST(createRequest({ eventKey: expiredLeaseKey }));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Retry crash");
      expect(mockRpc).toHaveBeenCalledWith("fail_translate_webhook_event", {
        p_event_key: expiredLeaseKey,
        p_error: "Retry crash",
      });
    });
  });

  describe("Zod schema validation", () => {
    it("warns when payload has unexpected fields", async () => {
      const loggerSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        successCount: 1,
        failedCount: 0,
      });

      const response = await POST(
        createRequest({
          storyId: VALID_STORY_ID,
          unknownField: "surprise",
          anotherUnknown: 42,
        })
      );

      expect(response.status).toBe(200);
      expect(loggerSpy).toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.objectContaining({ webhook: "translate" })
      );

      loggerSpy.mockRestore();
    });

    it("rejects a non-string storyId", async () => {
      const response = await POST(createRequest({ storyId: 123 }));

      expect(response.status).toBe(400);
    });
  });

  describe("BE-H6: batch size and lease timeout", () => {
    it("BE-H6: claims at most 3 jobs per invocation (batch size <= 3)", async () => {
      // The effective batch size must be <= 3 to stay within Vercel's 60s timeout
      // (each job takes ~5-15s, so 3 * 15s = 45s leaves margin)
      const claimArgs: Record<string, unknown>[] = [];

      mockRpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
        if (fn === "enqueue_translate_webhook_event") {
          return Promise.resolve({ data: "queued", error: null });
        }
        if (fn === "pg_try_advisory_lock") {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === "claim_next_translate_webhook_event") {
          if (args) claimArgs.push(args);
          return Promise.resolve({ data: [], error: null });
        }
        if (fn === "pg_advisory_unlock") {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      await POST(createRequest({ storyId: VALID_STORY_ID }));

      expect(claimArgs.length).toBeGreaterThan(0);
      for (const args of claimArgs) {
        expect(args.p_batch_size).toBeLessThanOrEqual(3);
      }
    });

    it("BE-H6: lease timeout must be <= 3 minutes (180 seconds)", async () => {
      const claimArgs: Record<string, unknown>[] = [];

      mockRpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
        if (fn === "enqueue_translate_webhook_event") {
          return Promise.resolve({ data: "queued", error: null });
        }
        if (fn === "pg_try_advisory_lock") {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === "claim_next_translate_webhook_event") {
          if (args) claimArgs.push(args);
          return Promise.resolve({ data: [], error: null });
        }
        if (fn === "pg_advisory_unlock") {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      await POST(createRequest({ storyId: VALID_STORY_ID }));

      expect(claimArgs.length).toBeGreaterThan(0);
      for (const args of claimArgs) {
        // Lease should be <= 180 seconds (3 minutes) to recover faster from crashes
        expect(args.p_lease_seconds).toBeLessThanOrEqual(180);
      }
    });
  });
});
