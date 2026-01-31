import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase browser client
vi.mock("./supabase-browser", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

// Mock the environment module
vi.mock("./environment", () => ({
  getEnvironment: vi.fn(() => "development"),
}));

import { createSupabaseBrowserClient } from "./supabase-browser";

// Helper to create a mock channel that tracks calls
function createMockChannel() {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return channel;
}

function createMockSupabaseClient(mockChannel: ReturnType<typeof createMockChannel>) {
  return {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  };
}

describe("realtime", () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.resetModules();
    mockChannel = createMockChannel();
    mockClient = createMockSupabaseClient(mockChannel);
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(mockClient as never);
  });

  describe("subscribeToTable", () => {
    it("should create a channel with the correct name", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      subscribeToTable("feature_flags", callback);

      expect(mockClient.channel).toHaveBeenCalledWith("table-feature_flags");
    });

    it("should subscribe to postgres_changes on the specified table", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      subscribeToTable("feature_flags", callback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "*",
          schema: "public",
          table: "feature_flags",
        }),
        expect.any(Function)
      );
    });

    it("should filter by event type when specified in options", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      subscribeToTable("feature_flags", callback, { event: "UPDATE" });

      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "UPDATE",
          schema: "public",
          table: "feature_flags",
        }),
        expect.any(Function)
      );
    });

    it("should include column filter when specified in options", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      subscribeToTable("stories", callback, {
        event: "UPDATE",
        filter: "is_active=eq.true",
      });

      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "UPDATE",
          schema: "public",
          table: "stories",
          filter: "is_active=eq.true",
        }),
        expect.any(Function)
      );
    });

    it("should call subscribe on the channel", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      subscribeToTable("feature_flags", callback);

      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it("should return a cleanup function that removes the channel", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      const cleanup = subscribeToTable("feature_flags", callback);

      expect(typeof cleanup).toBe("function");
      cleanup();
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it("should invoke the callback when an event fires", async () => {
      const { subscribeToTable } = await import("./realtime");
      const callback = vi.fn();

      subscribeToTable("feature_flags", callback);

      // Extract the callback that was passed to .on()
      const onCallback = mockChannel.on.mock.calls[0][2];
      const payload = {
        eventType: "UPDATE",
        new: { id: "1", flag_key: "surprise_me", enabled: true },
        old: { id: "1", flag_key: "surprise_me", enabled: false },
      };

      onCallback(payload);

      expect(callback).toHaveBeenCalledWith(payload);
    });
  });

  describe("subscribeToFeatureFlags", () => {
    it("should subscribe to the feature_flags table for UPDATE events with environment filter", async () => {
      const { subscribeToFeatureFlags } = await import("./realtime");
      const callback = vi.fn();

      subscribeToFeatureFlags(callback);

      expect(mockClient.channel).toHaveBeenCalledWith("table-feature_flags");
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "UPDATE",
          schema: "public",
          table: "feature_flags",
          filter: "environment=eq.development", // Environment filter
        }),
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it("should pass the updated row to the callback", async () => {
      const { subscribeToFeatureFlags } = await import("./realtime");
      const callback = vi.fn();

      subscribeToFeatureFlags(callback);

      const onCallback = mockChannel.on.mock.calls[0][2];
      const payload = {
        eventType: "UPDATE",
        new: {
          id: "abc",
          flag_key: "surprise_me",
          enabled: true,
          label: "Surprise Me",
          description: null,
          config: {},
          environment: "development", // Must match mocked getEnvironment()
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-06-01T00:00:00Z",
        },
        old: {},
      };

      onCallback(payload);

      expect(callback).toHaveBeenCalledWith(payload.new);
    });

    it("should not call callback for different environment", async () => {
      const { subscribeToFeatureFlags } = await import("./realtime");
      const callback = vi.fn();

      subscribeToFeatureFlags(callback);

      const onCallback = mockChannel.on.mock.calls[0][2];
      const payload = {
        eventType: "UPDATE",
        new: {
          id: "abc",
          flag_key: "surprise_me",
          enabled: true,
          label: "Surprise Me",
          description: null,
          config: {},
          environment: "production", // Different from mocked "development"
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-06-01T00:00:00Z",
        },
        old: {},
      };

      onCallback(payload);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should return a cleanup function", async () => {
      const { subscribeToFeatureFlags } = await import("./realtime");
      const callback = vi.fn();

      const cleanup = subscribeToFeatureFlags(callback);

      expect(typeof cleanup).toBe("function");
      cleanup();
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe("subscribeToStories", () => {
    it("should subscribe to the stories table for UPDATE events", async () => {
      const { subscribeToStories } = await import("./realtime");
      const callback = vi.fn();

      subscribeToStories(callback);

      expect(mockClient.channel).toHaveBeenCalledWith("table-stories");
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "UPDATE",
          schema: "public",
          table: "stories",
        }),
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it("should pass the updated row to the callback", async () => {
      const { subscribeToStories } = await import("./realtime");
      const callback = vi.fn();

      subscribeToStories(callback);

      const onCallback = mockChannel.on.mock.calls[0][2];
      const payload = {
        eventType: "UPDATE",
        new: {
          id: "story-1",
          slug: "picos-de-europa",
          title: "Picos de Europa",
          is_active: true,
        },
        old: {},
      };

      onCallback(payload);

      expect(callback).toHaveBeenCalledWith(payload.new);
    });

    it("should return a cleanup function", async () => {
      const { subscribeToStories } = await import("./realtime");
      const callback = vi.fn();

      const cleanup = subscribeToStories(callback);

      expect(typeof cleanup).toBe("function");
      cleanup();
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
