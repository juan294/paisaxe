import { requiredValue } from "@/test/required-value";
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Framework request-cookie boundary; Supabase Auth and all owned access code stay real.
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

// Real cache, retrieval, provider SDKs and route; only HTTP responses are replaced.
const citation = { title: "Synthetic factual source", url: "https://source.example.test/facts", license: "CC0-1.0", revision: "2026-10-11", attribution: "Example source owner" };
const rows = Array.from({ length: 5 }, (_, i) => ({
  id: `chunk-${i}`, content: `Paisaje de Asturias ${i}`, source_pdf: null, citation,
  page_number: null, section_title: "Paisajes", image_refs: [`/images/reviewed/image-${i}.jpg`], similarity: 0.9 - i / 10,
}));
const images = rows.map((row, i) => {
  const path = requiredValue(row.image_refs[0], "Synthetic reviewed photo path");
  const provenance = JSON.stringify({ assetUrl: path, originalSha256: "a".repeat(64), replacementSha256: "b".repeat(64), sourcePage: "https://owner.example.test/photo", photographer: "Example owner", license: "owner-permission", permission: "Synthetic owner receipt", date: "2026-10-11", credit: "Example owner · Thematic landscape", context: "thematic", alt: "Reviewed thematic landscape", crop: { mobile: "center", desktop: "center" }, reviewer: "Example reviewer", reviewReceipt: "c".repeat(64), status: "approved", flow: "manual" });
  return { id: `image-${i}`, path, provenance };
});
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
let failSelector: boolean;
let activeVersion: string;
let vectorVersions: string[];
let transportOrder: string[];
let imageRequests: { corpus_version: string; image_paths: string[] }[];
let databasePaths: string[];
let imageData: unknown;
let emptyImageRefs: boolean;
let generationBodies: Record<string, unknown>[];
const visitorId = "00000000-0000-4000-8000-000000000005";

function upstream(path: string, signal: AbortSignal | null | undefined, response: () => Response) {
  calls.push(path);
  transportOrder.push(path);
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
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJ-synthetic-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "synthetic-service-key");
  vi.stubEnv("BOOKING_AGENT_REPLAY", "");
  vi.stubEnv("VERCEL_ENV", "development");
  store = new Map(); calls = []; requests = []; hold = undefined; release = undefined; ignoreAbort = false;
  rerankData = [{ index: 4 }, { index: 2 }, { index: 0 }];
  failVector = false; failSelector = false; activeVersion = "authored-v1"; vectorVersions = []; transportOrder = []; imageRequests = []; databasePaths = []; imageData = images; generationBodies = [];
  emptyImageRefs = false;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (url.hostname === "test.supabase.co") databasePaths.push(url.pathname);
    if (url.hostname === "cache.invalid") {
      const body = JSON.parse(String(init?.body));
      const run = ([command, key, value, , ttl]: [string, string, string?, string?, number?]) => {
        transportOrder.push(`cache:${command.toLowerCase()}`);
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
    if (url.hostname === "test.supabase.co" && url.pathname.endsWith("/rpc/active_corpus_version")) return upstream("selector", signal, () => failSelector
      ? new Response(JSON.stringify({ message: "Synthetic selector outage" }), { status: 503, headers: { "Content-Type": "application/json" } }) : json(activeVersion));
    if (url.hostname === "test.supabase.co" && url.pathname.endsWith("/rpc/match_corpus_chunks")) {
      const body = JSON.parse(String(init?.body));
      vectorVersions.push(body.corpus_version);
      return upstream("vector", signal, () => failVector || body.corpus_version !== activeVersion
        ? new Response(JSON.stringify({ message: body.corpus_version !== activeVersion ? "Corpus version changed" : "synthetic retrieval outage" }), { status: 409, headers: { "Content-Type": "application/json" } })
        : json(rows.map(row => ({ ...row, image_refs: emptyImageRefs ? [] : row.image_refs, content: `${activeVersion}: ${row.content}` }))));
    }
    if (url.hostname === "test.supabase.co" && url.pathname.endsWith("/rpc/corpus_related_images")) {
      const body = JSON.parse(String(init?.body));
      expect(init?.method).toBe("POST");
      expect(body).toEqual({ corpus_version: requiredValue(vectorVersions.at(-1), "Captured vector version for image boundary"), image_paths: emptyImageRefs ? [] : rows.flatMap(row => row.image_refs) });
      imageRequests.push(body);
      return upstream("images", signal, () => failSelector
        ? new Response(JSON.stringify({ code: "P0001", message: "corpus_selection_unavailable" }), { status: 400, headers: { "Content-Type": "application/json" } })
        : body.corpus_version !== activeVersion
          ? new Response(JSON.stringify({ code: "PT409", message: "corpus_version_not_selected" }), { status: 409, headers: { "Content-Type": "application/json" } })
          : json(imageData));
    }
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
    await new SearchResultCache().set("¿Qué visitar?", 3, { chunks: [], images: [] }, activeVersion);
    await vi.waitFor(() => expect(store.size).toBe(1));
    const { POST } = await import("@/app/api/chat/stream/route");
    const response = await POST(new NextRequest("http://localhost/api/chat/stream", {
      method: "POST", body: JSON.stringify({ message: "¿Qué visitar?" }),
    }));
    expect(await response.text()).toContain('"type":"done"');
    expect(calls).toEqual(["selector", "generation"]);
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
    expect(calls).toEqual(["selector", "vector"]);
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
  expect(first.images.map(image => image.path)).toEqual(["/images/reviewed/image-0.jpg", "/images/reviewed/image-2.jpg", "/images/reviewed/image-4.jpg"]);
  expect(calls).toHaveLength(5);
  expect(calls).toEqual(expect.arrayContaining(["selector", "embedding", "vector", "rerank", "images"]));
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith("search:"))).toBe(true));
  calls = [];
  expect(await retrieveChatContext("  Oviedo  ", 3)).toEqual(first);
  expect(calls).toEqual(["selector"]);
  calls = [];
  const resultKey = [...store.keys()].find(key => key.startsWith("search:"))!;
  store.get(resultKey)!.expiresAt = 0;
  await retrieveChatContext("Oviedo", 3);
  expect(calls).toHaveLength(4);
  expect(calls).toEqual(expect.arrayContaining(["selector", "vector", "rerank", "images"]));
  await vi.waitFor(() => expect(store.get(resultKey)!.expiresAt).toBeGreaterThan(Date.now()));
  store.set(resultKey, { value: JSON.stringify({ chunks: "corrupt", images: [] }), expiresAt: Infinity });
  calls = [];
  expect(requiredValue((await retrieveChatContext("Oviedo", 3)).chunks[0], "src/lib/retrieve-chat-context.test.ts:199 (await retrieveChatContext(\"Oviedo\", 3)).chunks[0]").id).toBe("chunk-4");
  expect(calls).toHaveLength(4);
  expect(calls).toEqual(expect.arrayContaining(["selector", "vector", "rerank", "images"]));
});

it.each(["selector", "embedding", "vector", "rerank", "images"])("parent cancellation at %s aborts the actual child request and forbids late full-result writes", async (stage) => {
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
  const response = stage === "selector" ? json(activeVersion) : stage === "embedding" ? embeddingResponse() : stage === "rerank" ? rerankResponse() : json(stage === "vector" ? rows : images);
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
  expect(calls).toEqual(["selector", "embedding"]);
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
  activeVersion = "legacy";
  const { SearchResultCache } = await import("./embedding-cache");
  await new SearchResultCache().set("rutas de Asturias", 3, {
    chunks: [{ id: "cached", content: "Pasaje cacheado del Sella", sourcePdf: "guia.pdf", sectionTitle: "Ríos" }], images: [],
  }, activeVersion);
  await vi.waitFor(() => expect(store.size).toBe(1));
  const { POST } = await import("@/app/api/booking/chat/stream/route");
  const response = await POST(bookingRequest("rutas de Asturias"));
  const text = await response.text();
  expect(text).toContain('"type":"text"');
  expect(text).toContain('"type":"done"');
  expect(text).toContain("guia.pdf");
  expect(calls).toEqual(["selector", "generation"]);
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
  expect(calls).toEqual(["selector", "embedding"]);
  expect(store.size).toBe(0);
  hold = undefined;
  const next = await POST(bookingRequest("reserva corregida"));
  expect(await next.text()).toContain('"type":"done"');
  expect(calls.filter(call => call === "generation")).toHaveLength(1);
});

it("resolves the active version before a full-result hit and never reads cache when selection fails", async () => {
  const { SearchResultCache } = await import("./embedding-cache");
  await new SearchResultCache().set("selector boundary", 3, { chunks: [], images: [] }, activeVersion);
  await vi.waitFor(() => expect(store.size).toBe(1));
  transportOrder = []; calls = [];
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  expect(await retrieveChatContext("selector boundary", 3)).toEqual({ chunks: [], images: [] });
  expect(transportOrder).toEqual(["selector", "cache:get"]);
  failSelector = true; transportOrder = []; calls = [];
  await expect(retrieveChatContext("selector boundary", 3)).rejects.toThrow("Corpus selection unavailable");
  expect(transportOrder).toEqual(["selector"]);
  expect(calls).toEqual(["selector"]);
});

it("isolates two active corpus versions and captures each selection only once for its pipeline", async () => {
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const first = await retrieveChatContext("same query", 3);
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith("search:v2:authored-v1:"))).toBe(true));
  activeVersion = "authored-v2"; calls = [];
  const second = await retrieveChatContext("same query", 3);
  expect(second.chunks[0]?.content).toContain("authored-v2:");
  expect(second.chunks[0]?.content).not.toBe(first.chunks[0]?.content);
  expect(calls.filter(call => call === "selector")).toHaveLength(1);
  expect(calls.filter(call => call === "vector")).toHaveLength(1);
  expect(vectorVersions).toEqual(["authored-v1", "authored-v2"]);
  expect(imageRequests.map(request => request.corpus_version)).toEqual(["authored-v1", "authored-v2"]);
  expect(imageRequests.map(request => request.image_paths)).toEqual([rows.flatMap(row => row.image_refs), rows.flatMap(row => row.image_refs)]);
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith("search:v2:authored-v2:"))).toBe(true));
  activeVersion = "authored-v1"; calls = [];
  expect(await retrieveChatContext("same query", 3)).toEqual(first);
  expect(calls).toEqual(["selector"]);
});

it("rejects a version switch during embedding rather than falling back or caching mixed content", async () => {
  hold = "embedding";
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const pending = retrieveChatContext("version switch", 3);
  const outcome = pending.then(() => "unexpected success", error => error);
  await untilCalled("embedding");
  activeVersion = "authored-v2";
  requiredValue(release, "Held embedding response")(embeddingResponse());
  expect(await outcome).toBeInstanceOf(Error);
  expect(String(await outcome)).toContain("Corpus version changed");
  expect(vectorVersions).toEqual(["authored-v1"]);
  expect(calls).toEqual(["selector", "embedding", "vector"]);
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
});

it.each([
  { name: "promotion conflict", status: 409, code: "PT409", message: "corpus_version_not_selected" },
  { name: "revoked selector", status: 400, code: "P0001", message: "corpus_selection_unavailable" },
])("a held image RPC $name after captured-A text retrieval rejects without result caching or legacy fallback, and a corrected retry succeeds", async ({ status, code, message }) => {
  hold = "images";
  const capturedVersion = activeVersion;
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const pending = retrieveChatContext("image selector recovery", 3);
  const rejection = expect(pending).rejects.toThrow("Corpus selection changed or unavailable during image retrieval");
  await untilCalled("images");
  expect(vectorVersions).toEqual([capturedVersion]);
  expect(imageRequests).toEqual([{ corpus_version: capturedVersion, image_paths: rows.flatMap(row => row.image_refs) }]);
  expect(calls.filter(call => call === "selector")).toHaveLength(1);
  expect(calls.slice(0, 3)).toEqual(["selector", "embedding", "vector"]);
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  if (code === "PT409") activeVersion = "authored-v2";
  else failSelector = true;
  requiredValue(release, "Held version-bound image response")(new Response(JSON.stringify({ code, message }), {
    status, headers: { "Content-Type": "application/json" },
  }));
  await rejection;
  // Flush the real Redis automatic pipeline before checking for forbidden result writes.
  await new Promise(resolve => setTimeout(resolve, 0));
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  expect(calls).toHaveLength(5);
  expect(calls).toEqual(expect.arrayContaining(["selector", "embedding", "vector", "rerank", "images"]));
  expect(databasePaths).toEqual([
    "/rest/v1/rpc/active_corpus_version", "/rest/v1/rpc/match_corpus_chunks", "/rest/v1/rpc/corpus_related_images",
  ]);
  expect(vectorVersions).not.toContain("legacy");

  // Restore the same approved selection and reviewed image bytes, then retry the same query.
  activeVersion = capturedVersion; failSelector = false; hold = undefined; calls = []; databasePaths = [];
  const corrected = await retrieveChatContext("image selector recovery", 3);
  expect(corrected.chunks.map(chunk => chunk.id)).toEqual(["chunk-4", "chunk-2", "chunk-0"]);
  expect(corrected.chunks.every(chunk => chunk.content.startsWith(`${capturedVersion}:`))).toBe(true);
  expect(corrected.images.map(image => image.path)).toEqual([
    "/images/reviewed/image-0.jpg", "/images/reviewed/image-2.jpg", "/images/reviewed/image-4.jpg",
  ]);
  expect(corrected.images.every(image => typeof image.provenance === "string")).toBe(true);
  expect(calls).toHaveLength(4);
  expect(calls).toEqual(expect.arrayContaining(["selector", "vector", "rerank", "images"]));
  expect(vectorVersions).toEqual([capturedVersion, capturedVersion]);
  expect(imageRequests.map(request => request.corpus_version)).toEqual([capturedVersion, capturedVersion]);
  expect(databasePaths).toEqual([
    "/rest/v1/rpc/active_corpus_version", "/rest/v1/rpc/match_corpus_chunks", "/rest/v1/rpc/corpus_related_images",
  ]);
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith(`search:v2:${capturedVersion}:`))).toBe(true));
});

it.each(["promotion", "revocation"] as const)("empty authored image references still reject %s before the image boundary, without caching text, and recover on corrected retry", async change => {
  emptyImageRefs = true; imageData = []; hold = "vector";
  const capturedVersion = activeVersion;
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const pending = retrieveChatContext("empty-reference selector recovery", 3);
  const rejection = expect(pending).rejects.toThrow("Corpus selection changed or unavailable during image retrieval");
  await untilCalled("vector");
  expect(vectorVersions).toEqual([capturedVersion]);
  expect(calls).toEqual(["selector", "embedding", "vector"]);
  if (change === "promotion") activeVersion = "authored-v2";
  else failSelector = true;
  requiredValue(release, "Held captured-version text response")(json(rows.map(row => ({
    ...row, content: `${capturedVersion}: ${row.content}`, image_refs: [],
  }))));
  await rejection;
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(imageRequests).toEqual([{ corpus_version: capturedVersion, image_paths: [] }]);
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  expect(calls).toHaveLength(5);
  expect(calls).toEqual(expect.arrayContaining(["selector", "embedding", "vector", "rerank", "images"]));
  expect(databasePaths).toEqual([
    "/rest/v1/rpc/active_corpus_version", "/rest/v1/rpc/match_corpus_chunks", "/rest/v1/rpc/corpus_related_images",
  ]);
  expect(vectorVersions).not.toContain("legacy");

  activeVersion = capturedVersion; failSelector = false; hold = undefined; calls = []; databasePaths = [];
  const corrected = await retrieveChatContext("empty-reference selector recovery", 3);
  expect(corrected.chunks.map(chunk => chunk.id)).toEqual(["chunk-4", "chunk-2", "chunk-0"]);
  expect(corrected.chunks.every(chunk => chunk.content.startsWith(`${capturedVersion}:`) && chunk.imageRefs?.length === 0)).toBe(true);
  expect(corrected.images).toEqual([]);
  expect(calls).toHaveLength(4);
  expect(calls).toEqual(expect.arrayContaining(["selector", "vector", "rerank", "images"]));
  expect(vectorVersions).toEqual([capturedVersion, capturedVersion]);
  expect(imageRequests).toEqual([
    { corpus_version: capturedVersion, image_paths: [] }, { corpus_version: capturedVersion, image_paths: [] },
  ]);
  expect(databasePaths).toEqual([
    "/rest/v1/rpc/active_corpus_version", "/rest/v1/rpc/match_corpus_chunks", "/rest/v1/rpc/corpus_related_images",
  ]);
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith(`search:v2:${capturedVersion}:`))).toBe(true));
});

it("publishes authored source evidence through the real route without inventing a PDF or page", async () => {
  const { POST } = await import("@/app/api/chat/stream/route");
  const response = await POST(new NextRequest("http://localhost/api/chat/stream", {
    method: "POST", body: JSON.stringify({ message: "authored source" }),
  }));
  const text = await response.text();
  expect(text).toContain('"type":"done"');
  expect(text).toContain(citation.url);
  expect(text).toContain(citation.license);
  expect(text).not.toContain('"sourcePdf":"guia.pdf"');
  expect(text).not.toContain('"pageNumber":');
  const system = JSON.stringify(requiredValue(generationBodies[0], "Authored context generation").messages);
  expect(system).toContain(citation.title);
  expect(system).toContain(citation.url);
  expect(system).not.toContain("guia.pdf");
  expect(system).not.toContain("pag.");
});

it("never queries legacy photos and does not cache an authored image with reused permission evidence", async () => {
  const { getRelatedImages, search } = await import("./search");
  activeVersion = "legacy";
  expect(await getRelatedImages(["/images/unreviewed.jpg"])).toEqual([]);
  expect(calls).toEqual(["selector"]);
  expect(imageRequests).toEqual([]);
  activeVersion = "authored-v1"; calls = [];
  const original = requiredValue(images[0], "Reviewed image fixture");
  imageData = [{ ...original, path: "/images/reviewed/another-photo.jpg" }];
  const degraded = await search(vector, 3, "image permission recovery");
  expect(degraded.images).toEqual([]);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect([...store.keys()].filter(key => key.startsWith("search:"))).toEqual([]);
  imageData = images;
  const recovered = await search(vector, 3, "image permission recovery");
  expect(recovered.images).toHaveLength(3);
  expect(recovered.images.every(image => typeof image.provenance === "string")).toBe(true);
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith("search:v2:authored-v1:"))).toBe(true));
});

it("treats cached malformed authored citations and photo permission records as misses and replaces them", async () => {
  const { retrieveChatContext } = await import("./retrieve-chat-context");
  const good = await retrieveChatContext("evidence recovery", 3);
  await vi.waitFor(() => expect([...store.keys()].some(key => key.startsWith("search:v2:"))).toBe(true));
  const key = requiredValue([...store.keys()].find(item => item.startsWith("search:v2:")), "Authored cache key");
  for (const corrupt of [
    { ...good, chunks: good.chunks.map(chunk => ({ ...chunk, citation: { ...citation, attribution: "" }, sourcePdf: "legacy.pdf" })) },
    { ...good, images: good.images.map(image => ({ ...image, provenance: undefined })) },
    { ...good, images: good.images.map(image => ({ ...image, path: "/images/reviewed/unapproved-photo.jpg" })) },
  ]) {
    store.set(key, { value: JSON.stringify(corrupt), expiresAt: Infinity });
    calls = [];
    expect(await retrieveChatContext("evidence recovery", 3)).toEqual(good);
    expect(calls).toEqual(expect.arrayContaining(["selector", "vector", "rerank", "images"]));
    await vi.waitFor(() => expect(JSON.parse(requiredValue(store.get(key), "Recovered cache entry").value)).toEqual(good));
  }
});
