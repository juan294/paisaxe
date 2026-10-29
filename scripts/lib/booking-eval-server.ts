/** Local-only evaluation HTTP adapter for the real booking route handler.
 * It measures route handler/auth/retrieval/tool work; Next proxy is outside scope.
 * Mode and transport selection are prebound server dependencies, never request flags. */
// Next captures request storage at module evaluation; bootstrap before any app imports.
import "next/dist/server/node-environment-baseline.js";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { JevOptions } from "../../src/lib/jev/client";
import type { BookingModelClient } from "../../src/lib/booking/model-client";
import type { BookingEvaluationMode } from "./booking-eval-harness";
import type { MatchHandlerDependencies } from "../../src/lib/booking/match-handler";
export interface BookingEvalServerOptions {
  mode: BookingEvaluationMode;
  createModel(): Promise<BookingModelClient>;
  jev?: JevOptions;
  now?: () => Date;
  /** Optional matching route, bound locally before the listener starts. */
  match?: MatchHandlerDependencies;
  /** Private local evidence only; never changes the HTTP error response. */
  onError?: (error: unknown) => void;
}
export async function startBookingEvalServer(
  options: BookingEvalServerOptions,
) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL?.trim() ||
    process.env.VERCEL_ENV?.trim()
  )
    throw new Error("Evaluation server refuses production/Vercel.");
  const [
    { NextRequest },
    { createBookingChatHandler },
    { streamBookingTurn },
    { eligibleIntakeTurn, tryBookingIntake, executeIntakeSearch },
    { deterministicIntake },
    requestStore,
    workStore,
    workStorage,
    unitStorage,
  ] = await Promise.all([
    import("next/server"),
    import("../../src/lib/booking/chat-handler"),
    import("../../src/lib/booking/agent"),
    import("../../src/lib/booking/intake"),
    import("../../src/lib/booking/intake-candidates"),
    import("next/dist/server/async-storage/request-store.js"),
    import("next/dist/server/async-storage/work-store.js"),
    import("next/dist/server/app-render/work-async-storage.external.js"),
    import("next/dist/server/app-render/work-unit-async-storage.external.js"),
  ]);
  const handler = createBookingChatHandler({
    createBookingModelClient: options.createModel,
    now: options.now,
    streamBookingTurn: (input) =>
      streamBookingTurn(input, {
        intake: async (turn) => {
          if (options.mode === "baseline")
            return { status: "fallback", reason: "baseline_arm" };
          if (options.mode === "jev")
            return tryBookingIntake(turn, options.jev);
          if (turn.signal.aborted) return { status: "aborted" };
          if (!eligibleIntakeTurn(turn, false))
            return { status: "fallback", reason: "ineligible_turn" };
          const literal = deterministicIntake(turn.message, turn.now);
          return literal.status === "fallback"
            ? literal
            : executeIntakeSearch(turn, literal.criteria);
        },
      }),
  });
  const matching = options.match
    ? (await import("../../src/lib/booking/match-handler")).createMatchHandlers(options.match)
    : undefined;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const target = new URL(incoming.url ?? "/", "http://127.0.0.1");
      const boundHandler = incoming.method === "POST" && incoming.url === "/api/booking/chat/stream"
        ? handler
        : target.pathname === "/api/booking/match" && matching
          ? incoming.method === "GET" ? matching.GET : incoming.method === "POST" ? matching.POST : null
          : null;
      if (!boundHandler) {
        outgoing.writeHead(404);
        outgoing.end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        if (chunks.reduce((sum, b) => sum + b.length, 0) > 65536)
          throw new Error("Evaluation request too large");
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value))
          for (const part of value) headers.append(key, part);
        else if (value !== undefined) headers.set(key, value);
      }
      const abort = new AbortController();
      outgoing.on("close", () => {
        if (!outgoing.writableEnded) abort.abort();
      });
      const request = new NextRequest(`http://127.0.0.1${incoming.url}`, {
        method: incoming.method,
        headers,
        ...(incoming.method === "POST" ? { body: Buffer.concat(chunks).toString("utf8") } : {}),
        signal: abort.signal,
      });
      const pending: Promise<unknown>[] = [];
      const closeCallbacks: (() => void)[] = [];
      const store = workStore.createWorkStore({
        page: `${target.pathname}/route`,
        buildId: "local-evaluation",
        deploymentId: "local-evaluation",
        previouslyRevalidatedTags: [],
        renderOpts: {
          cacheLifeProfiles: {
            default: { stale: 0, revalidate: 0, expire: 60 },
          },
          staticPageGenerationTimeout: 120,
          cacheComponents: false,
          validationLevel: "warning",
          assetPrefix: "",
          isBuildTimePrerendering: false,
          isDraftMode: false,
          isDebugDynamicAccesses: false,
          experimental: {
            isRoutePPREnabled: false,
            authInterrupts: false,
            useCacheTimeout: 10000,
            durableUseCacheEntries: false,
          },
          waitUntil: (promise) => {
            pending.push(promise);
          },
          onClose: (callback) => {
            closeCallbacks.push(callback);
          },
          onAfterTaskError: () => {},
        },
      });
      const units = requestStore.createRequestStoreForAPI(
        request,
        { pathname: target.pathname, search: target.search },
        { tags: [], expirationsByCacheKind: new Map() },
        undefined,
        undefined,
        undefined,
      );
      const response = await workStorage.workAsyncStorage.run(store, () =>
        unitStorage.workUnitAsyncStorage.run(units, () => boundHandler(request)),
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body)
        for await (const chunk of response.body) {
          if (abort.signal.aborted) break;
          if (!outgoing.write(chunk))
            await new Promise<void>((resolve) =>
              outgoing.once("drain", resolve),
            );
        }
      outgoing.end();
      for (const callback of closeCallbacks) callback();
      await Promise.allSettled(pending);
    } catch (error) {
      try {
        options.onError?.(error);
      } catch {
        /* Evidence failures cannot replace the original route failure. */
      }
      if (!outgoing.headersSent)
        outgoing.writeHead(500, { "content-type": "application/json" });
      outgoing.end('{"error":"local_evaluation_failed"}');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    mode: options.mode,
    timingScope: "route" as const,
    proxyIncluded: false,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
