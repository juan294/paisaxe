---
description: Claude API prompt caching -- stable-first prefixes, breakpoint placement, model minimums, TTL choice, usage recording
paths:
  - src/lib/**
  - src/app/api/**
  - scripts/**
---

# Prompt Caching

Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
(retrieved 2026-09-30). Re-check the minimums and prices there before relying
on the numbers below.

## How the cache matches

- The cache is a **prefix match** in render order: `tools` -> `system` ->
  `messages`. A byte change at any position invalidates that level and every
  level after it.
- A `cache_control` breakpoint caches everything up to and including the block
  it sits on. The next request reads it only if every byte up to that block is
  identical.
- Caches are scoped to the model and to the workspace (Claude API) or
  organization (Bedrock). A model fallback is an expected miss.

## Rules

1. **Stable content first.** Persona, constitution, schema, tool definitions
   and static instructions come before anything that varies per request.
2. **Breakpoints sit on the last block that stays identical across requests.**
   Never interpolate request, user, date, RAG, message-index or history values
   into a block that carries `cache_control`, or into any block before it.
   Volatile content goes in an unmarked block after the last breakpoint.
3. **Growing histories are cached.** Multi-turn chats and tool loops use
   top-level automatic caching (`cache_control: { type: "ephemeral" }` on the
   request). It places one breakpoint on the last cacheable block and moves it
   forward each turn. The next request reads that entry only if every earlier
   byte is identical, and that includes any dynamic `system` block.
   - Within one turn, tool-loop iterations always read, because the dynamic
     block does not change between them.
   - Across turns, the history is read only when nothing volatile sits between
     the last stable breakpoint and `messages`. Per-request date/time, RAG or
     live state in a `system` block before the history defeats cross-turn
     reads, and each turn then writes a tail that nothing reads. For
     cross-turn reads, put per-request context in the final user turn.
   - The lookback checks at most 20 block positions back from a breakpoint.
     One iteration that adds more than 20 blocks, for example about 10
     parallel tool calls with their results, makes the next iteration miss.
4. **At most 4 breakpoints per request**, counting explicit markers plus the
   top-level automatic one. A fifth returns HTTP 400.
5. **The cached prefix must reach the model minimum**, or caching silently
   does nothing (no error, no writes, no reads):

   | Model                                     | Minimum tokens |
   | ----------------------------------------- | -------------- |
   | Opus 5.5, Opus 5, Sonnet 5.5, Fable 5/5.1 | 512            |
   | Opus 4.8, Sonnet 5, Sonnet 4.6            | 1,024          |
   | Opus 4.7                                  | 2,048          |
   | Opus 4.6, Opus 4.5, Haiku 4.5             | 4,096          |

   A marker on a shorter prompt is a documented no-op. Leave it or remove it,
   but do not count on it.
6. **TTL matches the real gap between requests.** Default is 5 minutes
   (`{type:"ephemeral"}`, write 1.25x). Use `ttl: "1h"` (write 2x) only when
   requests sharing a prefix arrive 5-60 minutes apart, for example Message
   Batches. 1-hour entries must precede 5-minute entries in the same request.
7. **Every call records its usage.** Persist `input_tokens`,
   `output_tokens`, `cache_creation_input_tokens` and
   `cache_read_input_tokens` with a `source` label to `anthropic_usage`
   (fire-and-forget; an insert failure logs `[ANTHROPIC_USAGE_WRITE_FAILED]`
   and never fails the request). CLIs and one-off scripts without a database
   print the four fields instead.

## Pricing multipliers (relative to base input price)

- Cache write: 1.25x (5-minute TTL), 2x (1-hour TTL).
- Cache read: 0.1x; Opus 5.5 0.05x; Fable 5.1 / Mythos 5.1 0.025x.
- `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` is the
  total input. `usage.cache_creation.ephemeral_5m_input_tokens` and
  `ephemeral_1h_input_tokens` split the writes by TTL.

## Silent invalidators

- Clear everything: any tool definition change (name, description, schema,
  order), a model switch.
- Clear system and later: web-search, citations or speed toggles.
- Clear messages: `tool_choice` changes, adding or removing images, thinking
  parameter changes.
- Non-deterministic serialization: object key order, timestamps, UUIDs, or
  unordered set/map iteration anywhere in the cached prefix.

## Tests

Every request builder that caches has a zero-spend prefix-stability test:
two requests that differ only in volatile inputs produce identical bytes up to
each non-final breakpoint, the breakpoint count is at most 4, and the cached
prefix is at or above the model minimum by a checked-in chars-per-token
estimate with a 20% safety margin.

## Repo examples

All paisaxe calls use `CHAT_MODEL` = `claude-sonnet-5` (`src/lib/models.ts`),
minimum 1,024 tokens. The shared test oracle is `src/test/prompt-cache.ts`
(`CHARS_PER_TOKEN` = 4, which under-counts tokens for the Claude 4.7+
tokenizer, and `CACHE_MIN_SAFETY_MARGIN` = 1.2).

### Builders

| Call path | Builder | Cached prefix | `source` |
| --- | --- | --- | --- |
| Public chat, streaming (`/api/chat/stream`) | `streamChatResponse` -> `buildChatSystem` (`src/lib/claude.ts`) | `buildSystemPrompt()` persona (`src/lib/chat-config.ts`), about 6K chars. `buildConversationFlow(messageIndex)` and the asturianu addition follow in an unmarked block. RAG context stays in the user message. | `chat_stream` |
| Chat, non-streaming | `generateChatResponse` -> `buildChatSystem` | Same as above | `chat` |
| Story translation | `translateStory` -> `callAnthropicAPI(..., { source: "translate" })` | None that qualifies (see below) | `translate` |
| Content discovery (weekly cron) | `generateDescription` (`src/lib/content-discovery.ts`, raw fetch) | None | `content_discovery` |
| Marketing agents (admin) | `buildAgentSystem(agent)` (`src/app/api/admin/marketing/agent/route.ts`) | Block 1: `brand-voice.md` + persona + static instructions (about 9.7-11.6K chars). Block 2: live `gatherContext()` output, unmarked. Top-level `cache_control` on the re-sent `conversationHistory` (2 of 4 breakpoints); see the cross-turn note below. | `marketing_<agent id>` |
| `scripts/generate-stories.ts` (manual CLI) | `generateStoriesFromChunks` | None | printed per call by `formatUsageLine` (no database) |

### Marketing history: when cross-turn reads happen

Block 2 (`gatherContext()`) sits between the last stable breakpoint and the
history, so rule 3 applies. It renders the active-story count and the
platform, type and status of the five latest `marketing_content` rows. It
renders no timestamps (`scheduled_for` is only the sort key), and a test
asserts two requests over unchanged data produce identical bytes. So the
history is read across turns while that data is unchanged, and each turn
after a change (a story activated, a post scheduled or its status moved)
rewrites the history once. Unverified risk: the query orders by
`scheduled_for` with no tiebreaker, so rows sharing a timestamp may come back
in a different order and change block 2. Block 1 is read either way. Moving
the context into the final user turn would make history reads unconditional;
that change is an owner decision, not made here.

### Transport parity

`src/lib/claude.ts` uses curl in dev and test and the SDK in production (see
the file header). Both transports send the same `system` blocks from
`buildSystemBlocks`, so local runs exercise the production cache prefix. A
test asserts the curl and SDK bodies carry identical `system` arrays.

### Short-prompt exceptions (left uncached on purpose)

- **Translation:** an 18-token system prompt. The static guidelines follow the
  interpolated story text in the user message, so no stable prefix reaches
  1,024 tokens. `callAnthropicAPI` still wraps the string in one marked block
  (a documented no-op below the minimum).
- **Content discovery:** about 50 tokens, no system prompt, at most 5 calls a
  week.
- **generate-stories:** the PDF name is interpolated first and about 600
  tokens of static instructions follow up to 50K chars of chunk text. The
  static part alone is below the minimum.

### Usage recorder

Request handlers call `recordAnthropicUsageInBackground`, which starts the
insert and hands it to next/server `after()` so Vercel does not freeze the
function before a streamed response's insert finishes. Outside a request scope
`after()` throws and the insert just runs unawaited; it never blocks or throws.
`recordAnthropicUsage` (`src/lib/costs/anthropic-usage.ts`) writes to
`anthropic_usage` (`supabase/migrations/097_anthropic_usage.sql`) and prices
the row with `src/lib/costs/anthropic-pricing.ts`. Its failure tags are
`[ANTHROPIC_USAGE_INSERT_FAILED]` (insert error) and
`[ANTHROPIC_USAGE_RECORD_ERROR]` (thrown error), which predate the fleet name
`[ANTHROPIC_USAGE_WRITE_FAILED]`.

Cost prices all four fields (`cost_usd`, `src/lib/costs/anthropic-pricing.ts`).
The marketing route's JSON `usage` is a display: it shows
`cacheCreationInputTokens` and `cacheReadInputTokens` separately next to
`inputTokens` (the uncached remainder). paisaxe has no token cap today; any
future cap counts input + cache_creation + output and excludes cache reads,
which would otherwise count the cached prefix again on every request.
