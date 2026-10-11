import { requiredValue } from "@/test/required-value";
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Framework request-cookie boundary; Supabase Auth and all owned access code stay real.
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

// Real cache, retrieval, provider SDKs and route; only HTTP responses are replaced.
const rows = Array.from({ length: 5 }, (_, i) => ({
  id: `chunk-${i}`, content: `Paisaje de Asturias ${i}`, source_pdf: "guia.pdf",
  page_number: i + 1, section_title: "Paisajes", image_refs: [`image-${i}.jpg`], similarity: 0.9 - i / 10,
}));
const images = rows.map((row, i) => ({ id: `image-${i}`, path: row.image_refs[0], caption: "Asturias", source_pdf: "guia.pdf" }));
const vector = Array(512).fill(0.1);
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const embeddingResponse = () => json({ data: [{ index: 0, data: [{ index: 0, embedding: vector }] }], usage: { total_tokens: 7 } });
let rerankData: unknown;
const rerankResponse = () => json({ data: rerankData });

let store: Map<string, { value: string; expiresAt: number }>;
let calls: string[];
let requests: { path: string; signal: AbortSignal | null | undefined }[];
let hold: string | undefined;
let release: ((response: Response) => void) | undefined;
let ignoreAbort: boolean;
let failVector: boolean;
let generationBodies: Record<string, unknown>[];
const visitorId = "00000000-0000-4000-8000-000000000005";

function upstream(path: string, signal: AbortSignal | null | undefined, response: () => Response) {
  calls.push(path);
  requests.push({ path, signal });
  if (hold !== path) return Promise.resolve(response());
  return new Promise<Response>((resolve, reject) => {
    release = resolve;
    if (!ignoreAbort) signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  // Keep the real rate limiter on its development in-memory backend.
  await import("./rate-limit");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://cache.invalid");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "synthetic-test-token");
  vi.stubEnv("ANTHROPIC_TRANSPORT", "sdk");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJ-synthetic-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "synthetic-service-key");
  vi.stubEnv("BOOKING_AGENT_REPLAY", "");
  vi.stubEnv("VERCEL_ENV", "development");
  store = new Map(); calls = []; requests = []; hold = undefined; release = undefined; ignoreAbort = false;
  rerankData = [{ index: 4 }, { index: 2 }, { index: 0 }];
  failVector = false; generationBodies = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (url.hostname === "cache.invalid") {
      const body = JSON.parse(String(init?.body));
      const run = ([command, key, value, , ttl]: [string, string, string?, string?, number?]) => {
        if (command.toLowerCase() === "get") {
          const entry = store.get(key);
          const valid = entry && entry.expiresAt > Date.now();
          return { result: valid ? Buffer.from(entry.value).toString("base64") : null };
        }
        if (command.toLowerCase() === "set") {
          store.set(key, { value: value!, expiresAt: Date.now() + Number(ttl) * 1000 });
          return { result: "OK" };
        }
        throw new Error(`Unexpected Redis command: ${command}`);
      };
      return json(Array.isArray(body[0]) ? body.map(run) : run(body));
    }
    if (url.hostname === "api.voyageai.com" && url.pathname.endsWith("/contextualizedembeddings")) {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ model: "voyage-context-3", input_type: "query", output_dimension: 512 });
      return upstream("embedding", signal, embeddingResponse);
    }
    if (url.hostname === "api.voyageai.com" && url.pathname.endsWith("/rerank")) return upstream("rerank", signal, rerankResponse);
    if (url.hostname === "test.supabase.co" && url.pathname.endsWith("/rpc/match_chunks")) return upstream("vector", signal, () => failVector
      ? new Response(JSON.stringify({ message: "synthetic retrieval outage" }), { status: 503, headers: { "Content-Type": "application/json" } }) : json(rows));
    if (url.hostname === "test.supabase.co" && url.pathname.endsWith("/images")) return upstream("images", signal, () => json(images));
    if (url.hostname === "test.supabase.co") {
      if (url.pathname.endsWith("/feature_flags")) return json([{ enabled: url.searchParams.get("flag_key") === "eq.experience_booking" }]);
      if (url.pathname.endsWith("/auth/v1/user")) return json({ id: visitorId, aud: "authenticated", email: "visitor@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-10-09T00:00:00Z" });
      if (url.pathname.endsWith("/voucher_redemptions")) return json([{ id: "redemption-test", voucher_id: "voucher-test", chat_turns_used: 0, booking_attempts_used: 0, vouchers: { chat_turns_limit: 60, booking_attempts_limit: 10 } }]);
      if (url.pathname.endsWith("/rpc/consume_voucher_counter")) return json({ allowed: true, remaining: 59 });
      if (url.pathname.endsWith("/booking_drafts")) return json([{ id: "draft-test", user_id: visitorId, status: "open", constraints: {} }]);
      if (url.pathname.endsWith("/bookings")) return json([]);
    }
    if (url.hostname === "api.anthropic.com" && url.pathname.endsWith("/messages")) {
      calls.push("generation");
      generationBodies.push(JSON.parse(String(init?.body)));
      const events = [
        { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "synthetic", content: [], usage: { input_tokens: 0, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hola desde Asturias." } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } },
        { type: "message_stop" },
      ];
      return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    }
    throw new Error(`Forbidden test egress: ${url.origin}${url.pathname}`);
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function untilCalled(path: string) {
  await vi.waitFor(() => expect(calls).toContain(path));
}

describe("real retrieval cancellation and cache orchestration", () => {
  it("a full result-cache hit skips embedding as well as vector, rerank and images in the real general route", async () => {
    const { SearchResultCache } = await import("./embedding-cache");
    await new SearchResultCache().set("¿Qué visitar?", 3, { chunks: [], images: [] });
    await vi.waitFor(() => expect(store.size).toBe(1));
    const { POST } = await import("@/app/api/chat/stream/route");
    const response = await POST(new NextRequest("http://localhost/api/chat/stream", {
      method: "POST", body: JSON.stringify({ message: "¿Qué visitar?" }),
    }));
    expect(await response.text()).toContain('"type":"done"');
    expect(calls).toEqual(["generation"]);
  });

  it("the 2.5s fallback cancels the actual Voyage rerank request and never caches vector ordering", async () => {
    vi.useFakeTimers(); hold = "rerank";
    const { search, RERANK_TIMEOUT_MS } = await import("./search");
    const pending = search(vector, 3, "rerank lenta");
    await untilCalled("rerank");
    await vi.advanceTimersByTimeAsync(RERANK_TIMEOUT_MS);
    const result = await pending;
    expect(result.chunks.map(chunk => chunk.id)).toEqual(["chunk-0", "chunk-1", "chunk-2"]);
    expect(requests.find(request => request.path === "rerank")?.signal?.aborted).toBe(true);
    expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  });

  it("a cancelled embedding cannot write its late network response to the real cache", async () => {
    hold = "embedding"; ignoreAbort = true;
    const { generateEmbedding } = await import("./embeddings");
    const controller = new AbortController();
    const pending = generateEmbedding("cancelled", { signal: controller.signal });
    const outcome = pending.then(() => "completed", () => "aborted");
    await untilCalled("embedding"); controller.abort(); release!(embeddingResponse());
    expect(await outcome).toBe("aborted");
    expect(store.size).toBe(0);
  });

  it("a parent abort cancels PostgREST and prevents rerank, images and result-cache writes", async () => {
    hold = "vector";
    const { search } = await import("./search");
    const controller = new AbortController();
    // The old search API ignores this option; this pins the missing propagation.
    const pending = Reflect.apply(search, null, [vector, 3, "cancel vector", { signal: controller.signal }]) as Promise<unknown>;
    const outcome = pending.then(() => "completed", () => "aborted");
    await untilCalled("vector"); controller.abort();
    const vectorSignal = requests.find(request => request.path === "vector")?.signal;
    release!(json(rows));
    expect(vectorSignal?.aborted).toBe(true);
    expect(await outcome).toBe("aborted");
    expect(calls).toEqual(["vector"]);
    expect(store.size).toBe(0);
  });
});

 it("does not cache a degraded rerank transport response, and a corrected next attempt succeeds", async () => {
   rerankData = null;
   const { search } = await import("./search");
   const degraded = await search(vector, 3, "provider recovery");
   expect(degraded.chunks.map(chunk => chunk.id)).toEqual(["chunk-0", "chunk-1", "chunk-2"]);
   // Flush Redis's automatic pipeline before inspecting cache writes.
   await new Promise(resolve => setTimeout(resolve, 0));
   expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
   rerankData = [{ index: 4 }, { index: 2 }, { index: 0 }];
   const corrected = await search(vector, 3, "provider recovery");
   expect(requiredValue(corrected.chunks[0], "src/lib/retrieve-chat-context.test.ts:177 corrected.chunks[0]").id).toBe("chunk-4");
 });

it("a miss runs exactly one real pipeline, hits skip every retrieval request, and expired/corrupt results recover", async () => {
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const first = await retrieveChatContext("Oviedo", 3);
  expect(first.chunks.map(chunk => chunk.id)).toEqual(["chunk-4", "chunk-2", "chunk-0"]);
  expect(first.images.map(image => image.path)).toEqual(["image-0.jpg", "image-2.jpg", "image-4.jpg"]);
  expect(calls).toHaveLength(4);
  expect(calls).toEqual(expect.arrayContaining(["embedding", "vector", "rerank", "images"]));
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith("search:"))).toBe(true));
  calls = [];
  expect(await retrieveChatContext("  Oviedo  ", 3)).toEqual(first);
  expect(calls).toEqual([]);
  const resultKey = [...store.keys()].find(key => key.startsWith("search:"))!;
  store.get(resultKey)!.expiresAt = 0;
  await retrieveChatContext("Oviedo", 3);
  expect(calls).toHaveLength(3);
  expect(calls).toEqual(expect.arrayContaining(["vector", "rerank", "images"]));
  await vi.waitFor(() => expect(store.get(resultKey)!.expiresAt).toBeGreaterThan(Date.now()));
  store.set(resultKey, { value: JSON.stringify({ chunks: "corrupt", images: [] }), expiresAt: Infinity });
  calls = [];
  expect(requiredValue((await retrieveChatContext("Oviedo", 3)).chunks[0], "src/lib/retrieve-chat-context.test.ts:199 (await retrieveChatContext(\"Oviedo\", 3)).chunks[0]").id).toBe("chunk-4");
  expect(calls).toHaveLength(3);
  expect(calls).toEqual(expect.arrayContaining(["vector", "rerank", "images"]));
});

it.each(["embedding", "vector", "rerank", "images"])("parent cancellation at %s aborts the actual child request and forbids late full-result writes", async (stage) => {
  hold = stage; ignoreAbort = true;
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const parent = new AbortController();
  const add = vi.spyOn(parent.signal, "addEventListener");
  const remove = vi.spyOn(parent.signal, "removeEventListener");
  const pending = retrieveChatContext(`cancel ${stage}`, 3, { signal: parent.signal });
  const outcome = pending.then(() => "completed", () => "aborted");
  await untilCalled(stage);
  parent.abort();
  expect(await outcome).toBe("aborted");
  expect(requests.find(request => request.path === stage)?.signal?.aborted).toBe(true);
  const response = stage === "embedding" ? embeddingResponse() : stage === "rerank" ? rerankResponse() : json(stage === "vector" ? rows : images);
  release!(response);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  expect(add).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith("abort", requiredValue(add.mock.calls[0], "src/lib/retrieve-chat-context.test.ts:221 add.mock.calls[0]")[1]);
});

it("the real general route emits no late SSE after cancellation during embedding, then a fresh request succeeds", async () => {
  hold = "embedding"; ignoreAbort = true;
  const { POST } = await import("@/app/api/chat/stream/route");
  const parent = new AbortController();
  const pending = POST(new NextRequest("http://localhost/api/chat/stream", {
    method: "POST", body: JSON.stringify({ message: "cancelar" }), signal: parent.signal,
  }));
  await untilCalled("embedding"); parent.abort();
  const response = await pending;
  expect(await response.text()).toBe("");
  release!(embeddingResponse());
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(calls).toEqual(["embedding"]);
  expect(store.size).toBe(0);
  hold = undefined;
  const next = await POST(new NextRequest("http://localhost/api/chat/stream", {
    method: "POST", body: JSON.stringify({ message: "recuperar" }),
  }));
  expect(await next.text()).toContain('"type":"done"');
  expect(calls.filter(call => call === "generation")).toHaveLength(1);
});


it.each([
  ["wrong dimension", [0.1]],
  ["nonnumeric coordinates", Array(512).fill("bad")],
  ["object", { embedding: [0.1] }],
  ["string", "truthy corrupt entry"],
  ["nonfinite coordinates serialized as null", Array(512).fill(Infinity)],
])("a corrupt embedding cache %s is a soft miss and a corrected provider vector overwrites it", async (_label, value) => {
  const { EmbeddingCache } = await import("./embedding-cache");
  const cache = new EmbeddingCache("voyage-context-3:query", 512);
  await cache.set("cached corrupt vector", value as unknown as number[]);
  await vi.waitFor(() => expect(store.size).toBe(1));
  const { generateEmbedding } = await import("./embeddings");
  expect(await generateEmbedding("cached corrupt vector")).toEqual(vector);
  expect(calls).toEqual(["embedding"]);
  await vi.waitFor(() => expect(JSON.parse(requiredValue([...store.values()][0], "src/lib/retrieve-chat-context.test.ts:261 [...store.values()][0]").value)).toEqual(vector));
  calls = [];
  expect(await generateEmbedding("cached corrupt vector")).toEqual(vector);
  expect(calls).toEqual([]);
});


function bookingRequest(message: string, signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/booking/chat/stream", {
    method: "POST", headers: { Authorization: "Bearer synthetic-visitor-token", "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }), signal,
  });
}

it("the real booking route uses a full-result hit without Voyage or search and retains authenticated generation", async () => {
  const { SearchResultCache } = await import("./embedding-cache");
  await new SearchResultCache().set("rutas de Asturias", 3, {
    chunks: [{ id: "cached", content: "Pasaje cacheado del Sella", sourcePdf: "guia.pdf", sectionTitle: "Ríos" }], images: [],
  });
  await vi.waitFor(() => expect(store.size).toBe(1));
  const { POST } = await import("@/app/api/booking/chat/stream/route");
  const response = await POST(bookingRequest("rutas de Asturias"));
  const text = await response.text();
  expect(text).toContain('"type":"text"');
  expect(text).toContain('"type":"done"');
  expect(text).toContain("guia.pdf");
  expect(calls).toEqual(["generation"]);
  expect(JSON.stringify(requiredValue(generationBodies[0], "src/lib/retrieve-chat-context.test.ts:288 generationBodies[0]").system)).toContain("Pasaje cacheado del Sella");
});

it("the real booking route discloses optional context loss in its server observer and a fresh turn recovers", async () => {
  const warn = vi.spyOn(console, "warn");
  failVector = true;
  const { POST } = await import("@/app/api/booking/chat/stream/route");
  const response = await POST(bookingRequest("rutas sin contexto"));
  expect(await response.text()).toContain('"type":"done"');
  expect(JSON.stringify(requiredValue(generationBodies[0], "src/lib/retrieve-chat-context.test.ts:297 generationBodies[0]").system)).not.toContain("# CONTEXTO DE LA GUÍA");
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("[BOOKING_CHAT_RETRIEVAL_SKIPPED]"));
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  failVector = false;
  const next = await POST(bookingRequest("rutas corregidas"));
  expect(await next.text()).toContain('"type":"done"');
  expect(JSON.stringify(requiredValue(generationBodies[1], "src/lib/retrieve-chat-context.test.ts:303 generationBodies[1]").system)).toContain("Paisaje de Asturias");
  warn.mockRestore();
});

it("the real booking route cancels a pending retrieval, emits no late SSE/cache write, and a fresh authenticated turn succeeds", async () => {
  hold = "embedding"; ignoreAbort = true;
  const { POST } = await import("@/app/api/booking/chat/stream/route");
  const parent = new AbortController();
  const pending = POST(bookingRequest("cancelar reserva", parent.signal));
  await untilCalled("embedding"); parent.abort();
  expect(await (await pending).text()).toBe("");
  expect(requests.find(request => request.path === "embedding")?.signal?.aborted).toBe(true);
  release!(embeddingResponse());
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(calls).toEqual(["embedding"]);
  expect(store.size).toBe(0);
  hold = undefined;
  const next = await POST(bookingRequest("reserva corregida"));
  expect(await next.text()).toContain('"type":"done"');
  expect(calls.filter(call => call === "generation")).toHaveLength(1);
});
