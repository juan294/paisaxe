# Turbopack ECONNRESET Fix (January 2026)

## Problem

The chat endpoint (`POST /api/chat`) consistently failed with `ECONNRESET` (errno -54, syscall `read`) when calling `api.anthropic.com` from the Next.js 16.1.4 Turbopack dev server.

- **Only affected**: `api.anthropic.com` — Voyage AI and Supabase calls from the same route worked fine.
- **Only in dev**: Production builds (webpack on Vercel) were never affected.
- **Environment**: Node.js v23.9.0, macOS Darwin 25.3.0, Next.js 16.1.4 with Turbopack.

## Timeline

The issue appeared after a dependency upgrade that rewrote `claude.ts` from using the Anthropic SDK to raw `undici` fetch. Reverting to the SDK did not help because the corruption affects all Node.js HTTP mechanisms, not just specific libraries.

## Approaches Tried (All Failed)

### 1. Anthropic SDK with default fetch

Replaced raw `undici` fetch with `@anthropic-ai/sdk`. The SDK internally uses `globalThis.fetch`, which Turbopack had corrupted.

**Result**: Same ECONNRESET. Error type: `TypeError: fetch failed`.

### 2. Lazy SDK initialization

Changed from module-level `const client = new Anthropic()` to a lazy `getClient()` pattern to avoid capturing `globalThis.fetch` at module load time.

**Result**: Worked for one or two curl calls, then failed from the browser consistently.

### 3. Dynamic import of SDK

Changed `claude.ts` to `await import("@anthropic-ai/sdk")` inside `callAnthropicAPI()` instead of a static import.

**Result**: ECONNRESET persisted. The corrupted `globalThis.fetch` is process-wide, not bundle-scoped.

### 4. node-fetch as custom SDK fetch

Passed `node-fetch` v2 to the SDK constructor as a custom fetch implementation, bypassing `globalThis.fetch` entirely.

```typescript
const nodeFetch = (await import("node-fetch")).default;
const client = new AnthropicSDK({
  fetch: nodeFetch as unknown as typeof globalThis.fetch,
});
```

**Result**: ECONNRESET still occurred, but the error changed to `FetchError` (from node-fetch) instead of `TypeError` (from undici). This confirmed node-fetch was being used, but its internal `require('http')` / `require('https')` calls were also broken.

### 5. node-fetch in serverExternalPackages

Added `node-fetch` to `next.config.ts` `serverExternalPackages` to prevent Turbopack from bundling/transforming it.

```typescript
serverExternalPackages: ["@anthropic-ai/sdk", "node-fetch"],
```

**Result**: ECONNRESET persisted. Even as an external package, node-fetch still uses Node.js's `https` module, which is corrupted at the process level.

### 6. Dynamic imports of ALL route dependencies

Changed `route.ts` to dynamically import every lib module (`embeddings`, `search`, `supabase`, `validation`, `rate-limit`, `claude`) to prevent Turbopack from co-bundling them.

**Result**: Inconsistent. Worked for the first 1-2 requests after server start, then failed on all subsequent requests. Module caching meant the dynamic imports only isolated the initial load.

### 7. Node.js native https module

Replaced all fetch-based code with raw `node:https` (`https.request()`), bypassing every fetch abstraction.

```typescript
const https = await import("node:https");
const req = https.request({ hostname: "api.anthropic.com", ... });
```

**Result**: ECONNRESET. The corruption is at the Node.js `https` module level within the Turbopack process, not at any fetch wrapper level.

### 8. Child process with node

Spawned a child `node` process to make the API call, attempting to escape the Turbopack process entirely.

```typescript
const { execFile } = await import("node:child_process");
await execFileAsync("node", ["-e", script], { timeout: 30000 });
```

**Result**: ECONNRESET in the child process too. Even with a minimal `env` (only `PATH` and `HOME`), child node processes spawned from the Turbopack parent inherited the broken HTTPS behavior.

**Key observation**: Running the exact same `node -e` script directly from the terminal worked perfectly (HTTP 200). The issue was specific to child processes spawned from the Turbopack dev server process.

## Key Diagnostic Findings

### 1. Individual module imports work fine

A diagnostic endpoint (`/api/debug-chat`) that statically imported only `claude.ts` and then dynamically imported each other module (embeddings, supabase, search, etc.) one at a time — all calls succeeded. The issue only manifested when modules were statically co-bundled.

### 2. Only api.anthropic.com is affected

A diagnostic endpoint (`/api/debug-http`) tested 6 different HTTP methods (globalThis.fetch, node-fetch, SDK default, SDK+node-fetch, node:https, voyageai) against `api.anthropic.com` — from a simple route with no other imports, all 6 returned HTTP 200.

### 3. The corruption is process-level, not bundle-level

Even `node:https` and child node processes failed. The corruption extends beyond JavaScript module scope into the Node.js runtime's native TLS/networking layer when running inside the Turbopack dev server.

### 4. Direct terminal node calls always work

Running `node -e "require('https').request(...)"` from the terminal always succeeds. The issue is specific to the Turbopack process tree.

## Final Fix

### Approach: curl subprocess

Use `curl` (the system binary) via `child_process.execFile()` to make the Anthropic API call. Since `curl` uses `libcurl`/OpenSSL for its own TLS implementation (completely independent of Node.js), it is unaffected by the Turbopack corruption.

### Changes

**`src/lib/claude.ts`** — `callAnthropicAPI()` uses `execFile("curl", [...])`:

```typescript
export async function callAnthropicAPI(...): Promise<Anthropic.Message> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const { stdout } = await execFileAsync("curl", [
    "-s", "-X", "POST",
    "https://api.anthropic.com/v1/messages",
    "-H", "Content-Type: application/json",
    "-H", `x-api-key: ${apiKey}`,
    "-H", "anthropic-version: 2023-06-01",
    "-d", body,
  ], { timeout: 30000 });

  return JSON.parse(stdout) as Anthropic.Message;
}
```

**`src/app/api/chat/route.ts`** — All lib imports changed to dynamic `await import()` to avoid co-bundling (belt-and-suspenders with the curl fix):

```typescript
export async function POST(request: NextRequest) {
  const { generateChatResponse, extractSourcesFromChunks } = await import("@/lib/claude");
  const { generateEmbedding } = await import("@/lib/embeddings");
  const { search } = await import("@/lib/search");
  // ... etc
}
```

**`src/lib/claude.test.ts`** — Tests mock `node:child_process` instead of `@anthropic-ai/sdk`.

### Packages removed

- `node-fetch` (no longer used)
- `@types/node-fetch` (no longer used)

### Packages retained

- `@anthropic-ai/sdk` — still needed for TypeScript types (`Anthropic.Message`, `Anthropic.TextBlock`) and by `scripts/generate-stories.ts` (a CLI script that runs outside Turbopack via `tsx`).

## Known Limitations of the Fix

1. **curl only available locally**: The system must have `curl` installed. This is standard on macOS and Linux. **Important**: Vercel's serverless runtime does NOT have `curl` — see "Production Fix" section below.

2. **API key in process args**: The API key is passed as a command-line argument to curl, which is visible in `ps` output. This is acceptable for a dev-only workaround. If this is a concern, the body could be passed via stdin (`-d @-`) and the key via a temp file.

3. **Subprocess overhead**: Each API call spawns a curl process. The overhead (~10-50ms) is negligible compared to the LLM response time (~1-3 seconds).

4. **Streaming support**: The curl approach now supports streaming via `spawn` with stdout piping (implemented in `streamWithCurl`).

## Production Fix (February 2026)

### Problem Discovered

The original curl-based fix worked in development but **broke production**. Vercel's serverless Node.js runtime does NOT include the `curl` binary. The chat endpoint returned empty responses:

```json
{"type":"done","images":[],"sources":[]}
```

### Root Cause

The assumption in the original fix that "curl is available on Vercel's Node.js runtime" was incorrect. When `spawn("curl", [...])` runs on Vercel, it silently fails because there's no `curl` binary.

### Solution: Conditional SDK/curl

Since Turbopack only runs in development (Vercel production uses webpack), we use a conditional approach:

```typescript
// src/lib/claude.ts
const USE_CURL = process.env.NODE_ENV !== "production";
```

- **Development** (`NODE_ENV=development`): Uses curl subprocess (Turbopack workaround)
- **Test** (`NODE_ENV=test`): Uses curl subprocess (tests mock `child_process`)
- **Production** (`NODE_ENV=production`): Uses Anthropic SDK directly (no Turbopack, SDK works fine)

### Implementation

**`src/lib/claude.ts`** now has two code paths:

```typescript
export async function callAnthropicAPI(...) {
  if (USE_CURL) {
    return callWithCurl(...);  // Development: curl subprocess
  } else {
    return callWithSDK(...);   // Production: @anthropic-ai/sdk
  }
}

export async function* streamAnthropicAPI(...) {
  if (USE_CURL) {
    yield* streamWithCurl(...);  // Development: curl with spawn
  } else {
    yield* streamWithSDK(...);   // Production: SDK streaming
  }
}
```

### Verification

1. **Local development**: Chat works via curl (`npm run dev`)
2. **Tests**: Pass via mocked curl (`npm test`)
3. **Production**: Chat works via SDK (Vercel deployment)

## When to Revisit

- **Next.js / Turbopack update**: If a future Next.js version fixes the HTTPS corruption, revert to using the SDK directly. Test by changing `USE_CURL` to `false` and running `npm run dev` with multiple consecutive chat requests.

- **Node.js update**: The issue may be related to Node.js v23.x (experimental). If upgrading to Node.js 22 LTS or 24+, test if the SDK works directly in development.

- **Webpack dev mode**: Running `next dev --turbo=false` (webpack mode) may bypass the issue entirely. This wasn't tested because Turbopack provides faster dev builds.

- ~~**Vercel production**: The fix works in production, but the SDK approach would also work there (no Turbopack in production). If the curl overhead is ever a concern, a conditional approach could be used.~~ **DONE** — Implemented in February 2026. See "Production Fix" section above.

## Reproduction Steps

To verify if the issue still exists with future updates:

1. Revert `callAnthropicAPI` to use the SDK directly:
   ```typescript
   const { default: Anthropic } = await import("@anthropic-ai/sdk");
   const client = new Anthropic();
   return client.messages.create({ model, max_tokens, system, messages });
   ```
2. Revert `route.ts` to use static imports.
3. Run `npm run dev` (Turbopack).
4. Send 5 consecutive `POST /api/chat` requests.
5. If any return 500 with ECONNRESET in the server logs, the issue persists.
