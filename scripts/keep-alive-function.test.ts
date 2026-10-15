// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryResult = vi.hoisted(() => ({ value: { count: 7, error: null as unknown } }));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: async () => queryResult.value }),
    }),
  }),
}));

type Handler = () => Promise<Response>;

async function loadHandler(): Promise<Handler> {
  let handler: Handler | undefined;
  vi.stubGlobal("Deno", {
    env: { get: () => undefined },
    serve: (registered: Handler) => {
      handler = registered;
    },
  });
  vi.resetModules();
  // Deno code outside the TypeScript program: load it by file URL so tsc never resolves it.
  const entry = new URL("../supabase/functions/keep-alive/index.ts", import.meta.url).href;
  await import(/* @vite-ignore */ entry);
  if (!handler) throw new Error("keep-alive did not register a handler");
  return handler;
}

describe("keep-alive edge function", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports the active story count", async () => {
    queryResult.value = { count: 7, error: null };
    const response = await (await loadHandler())();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, active_stories: 7 });
  });

  it("answers 500 with a generic message and keeps the failure detail in the log", async () => {
    queryResult.value = { count: 0, error: new Error('relation "stories" does not exist at /var/task/secret.ts:12') };
    const response = await (await loadHandler())();
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ ok: false, error: "Keep-alive check failed" });
    expect(body).not.toContain("stories");
    expect(body).not.toContain("secret.ts");
    expect(console.error).toHaveBeenCalledWith("Keep-alive error:", expect.any(Error));
  });
});
