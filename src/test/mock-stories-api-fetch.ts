import { vi } from "vitest";

/**
 * FE-H1 (#759): use-stories.ts fetches stories via `fetch("/api/stories")`
 * instead of calling `getStoriesFromDB` directly. This stubs `global.fetch`
 * to wrap a mock's resolved/rejected value in the same `{ data: [...] }`
 * envelope the real /api/stories route returns, so existing tests written
 * against a directly-mocked `getStoriesFromDB` keep working unchanged.
 *
 * Shared across use-stories.test.ts, use-stories.cache-hit.test.ts,
 * use-stories.provider.test.tsx, and use-stories.hydration.test.ts.
 */
export function stubStoriesApiFetch(
  mockGetStoriesFromDB: (...args: unknown[]) => unknown
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (...args: unknown[]) => {
      const data = await mockGetStoriesFromDB(...args);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data }),
      } as Response;
    })
  );
}
