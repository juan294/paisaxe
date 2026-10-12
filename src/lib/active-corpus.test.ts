// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let data: unknown;
let failure: boolean;
let requests: { url: URL; signal: AbortSignal | null | undefined }[];
let release: ((response: Response) => void) | undefined;
let held: boolean;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://corpus.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon-key");
  data = "authored-v1"; failure = false; requests = []; release = undefined; held = false;
  vi.stubGlobal("fetch", vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== "https://corpus.example.test" || url.pathname !== "/rest/v1/rpc/active_corpus_version") throw new Error("Forbidden test egress");
    requests.push({ url, signal: init?.signal ?? (input instanceof Request ? input.signal : undefined) });
    if (held) return new Promise<Response>(resolve => { release = resolve; });
    return Promise.resolve(failure ? json({ message: "Synthetic selector outage" }, 503) : json(data));
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("actual SDK active corpus selector", () => {
  it.each(["legacy", "authored-v1", "corpus-2026-10-11"])("reads the explicit %s selection", async version => {
    data = version;
    const { activeCorpusVersion } = await import("./active-corpus");
    expect(await activeCorpusVersion()).toBe(version);
    expect(requests).toHaveLength(1);
  });

  it.each([null, [], {}, 7, "", "Version-A", "../legacy", "a".repeat(81)])("does not infer legacy from malformed selector %j", async value => {
    data = value;
    const { activeCorpusVersion } = await import("./active-corpus");
    await expect(activeCorpusVersion()).rejects.toThrow("Corpus selection unavailable");
  });

  it("does not infer legacy after a database selector error", async () => {
    failure = true;
    const { activeCorpusVersion } = await import("./active-corpus");
    await expect(activeCorpusVersion()).rejects.toThrow("Corpus selection unavailable");
    expect(requests).toHaveLength(1);
  });

  it("does no transport work for an already cancelled selection", async () => {
    const { activeCorpusVersion } = await import("./active-corpus");
    const controller = new AbortController();
    const reason = new Error("Caller cancelled selection");
    controller.abort(reason);
    await expect(activeCorpusVersion(controller.signal)).rejects.toBe(reason);
    expect(requests).toEqual([]);
  });

  it("propagates cancellation to PostgREST and rejects even a late successful selector response", async () => {
    held = true;
    const { activeCorpusVersion } = await import("./active-corpus");
    const controller = new AbortController();
    const pending = activeCorpusVersion(controller.signal);
    const outcome = pending.then(() => "unexpected success", error => error);
    // Assert the actual transport signal, not a mocked owned selector outcome.
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    controller.abort();
    expect(requests[0]?.signal?.aborted).toBe(true);
    if (!release) throw new Error("Expected held selector response");
    release(json("authored-v1"));
    expect(await outcome).toBe(controller.signal.reason);
  });
});
