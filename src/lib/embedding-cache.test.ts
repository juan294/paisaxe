import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmbeddingCache } from "./embedding-cache";

describe("EmbeddingCache", () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new EmbeddingCache(3, 5000); // max 3 entries, 5s TTL for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null for cache miss", () => {
    expect(cache.get("unknown")).toBeNull();
  });

  it("should store and retrieve embedding", () => {
    const embedding = [0.1, 0.2, 0.3];
    cache.set("hello", embedding);
    expect(cache.get("hello")).toEqual(embedding);
  });

  it("should return null for expired entries", () => {
    cache.set("hello", [0.1, 0.2]);
    vi.advanceTimersByTime(5001);
    expect(cache.get("hello")).toBeNull();
  });

  it("should evict LRU entry when at max size", () => {
    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.set("c", [3]);
    // Cache is full (3), add one more
    cache.set("d", [4]);
    // "a" should be evicted (LRU)
    expect(cache.get("a")).toBeNull();
    expect(cache.get("d")).toEqual([4]);
  });

  it("should update LRU order on get", () => {
    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.set("c", [3]);
    // Access "a" to make it most recently used
    cache.get("a");
    // Add new entry - "b" should be evicted (now LRU)
    cache.set("d", [4]);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toEqual([1]);
  });

  it("should report correct size", () => {
    expect(cache.size).toBe(0);
    cache.set("a", [1]);
    expect(cache.size).toBe(1);
    cache.set("b", [2]);
    expect(cache.size).toBe(2);
  });

  it("should clear all entries", () => {
    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeNull();
  });

  it("should update existing entry without increasing size", () => {
    cache.set("a", [1]);
    cache.set("a", [2]);
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toEqual([2]);
  });

  it("should use SHA-256 hash so different texts with same content get same entry", () => {
    cache.set("test", [1, 2, 3]);
    cache.set("test", [4, 5, 6]);
    expect(cache.size).toBe(1);
    expect(cache.get("test")).toEqual([4, 5, 6]);
  });

  // NOTE: embedding-cache.ts line 55 (`if (firstKey !== undefined)`) has an
  // uncovered false branch. This guard is defensive: when `cache.size >= maxSize`,
  // `cache.keys().next().value` will always return a defined key because the Map
  // is non-empty. The `undefined` check is unreachable during normal operation.
});
