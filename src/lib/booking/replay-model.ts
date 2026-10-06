/**
 * A scripted stand-in for the Anthropic model in the booking conversation,
 * for the local release probes only (PayPal hackathon plan, Phase 6, unit
 * [probes]: "the chat model is mocked by a fixture that replays a recorded
 * tool sequence").
 *
 * Selected by BOOKING_AGENT_REPLAY=<fixture name>, which loads
 * e2e/fixtures/booking-agent-replay/<name>.json. Only the model is replaced:
 * the tool calls it emits run through the real executor (src/lib/booking/tools.ts),
 * so drafts, quotes, holds, bookings, payments, cards and capability links are
 * the real ones in the local database.
 *
 * It can never run in production: createReplayModelClient throws when
 * NODE_ENV is "production" or the process runs on Vercel (VERCEL or
 * VERCEL_ENV set), and the booking chat then fails closed with
 * `ai_unavailable` instead of falling back to the real model.
 *
 * Fixture shape: scenarios, each a regular expression over the visitor's
 * latest words and a list of steps. A turn's first model call plays step 0,
 * the call after its tool results step 1, and so on. A step is either tool
 * calls (stop_reason tool_use) or text (end_turn). Strings may hold
 * placeholders:
 *   {{match.N}}             capture group N of the scenario's expression
 *   {{result.<path>}}       the latest tool_result of this turn (parsed JSON)
 *   {{state.acceptedBookingId}}, {{state.bookings[0].bookingId}}
 *                           the server's state block (agent.ts stateBlock)
 * A path segment `[n]` indexes an array and `[key=value]` picks its first
 * element whose `key` equals `value`. A string that is exactly one
 * placeholder ending in `:number` becomes a number. A missing value in a tool
 * input throws (the probe must fail loudly); in text it renders as "none".
 */
import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/lib/env";
import type { BookingModelClient } from "./model-client";

interface ReplayToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface ReplayStep {
  tools?: ReplayToolCall[];
  text?: string;
}

interface ReplayScenario {
  name: string;
  when: string;
  steps: ReplayStep[];
}

export interface ReplayFixture {
  /** Each scenario with its `when` compiled once. */
  scenarios: (ReplayScenario & { pattern: RegExp })[];
}

const FIXTURE_NAME = /^[a-z0-9-]{1,40}$/;
const FIXTURE_DIR = join("e2e", "fixtures", "booking-agent-replay");

/** Throws unless this is a local, non-production process. */
export function assertReplayAllowed(env: { nodeEnv?: string; vercel?: string; vercelEnv?: string }): void {
  if (env.nodeEnv === "production" || env.vercel || env.vercelEnv) {
    throw new Error(
      "BOOKING_AGENT_REPLAY is set in a production or Vercel process; the scripted booking model runs only in local tests"
    );
  }
}

export function parseReplayFixture(raw: unknown): ReplayFixture {
  const scenarios = (raw as { scenarios?: unknown } | null)?.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new Error("booking replay: fixture has no scenarios");
  return {
    scenarios: (scenarios as ReplayScenario[]).map((scenario) => {
      if (typeof scenario?.name !== "string" || typeof scenario.when !== "string" || !Array.isArray(scenario.steps)) {
        throw new Error("booking replay: every scenario needs name, when and steps");
      }
      for (const step of scenario.steps) {
        if (!step.text === !step.tools) throw new Error(`booking replay: a step of "${scenario.name}" needs text or tools`);
      }
      return { ...scenario, pattern: new RegExp(scenario.when) };
    }),
  };
}

function loadFixture(name: string): ReplayFixture {
  if (!FIXTURE_NAME.test(name)) throw new Error("booking replay: BOOKING_AGENT_REPLAY must be a fixture name");
  const path = join(process.cwd(), FIXTURE_DIR, `${name}.json`);
  return parseReplayFixture(JSON.parse(readFileSync(path, "utf8")));
}

type Json = unknown;

function resolvePath(root: Json, path: string): Json {
  let value: Json = root;
  for (const [, key, bracket] of path.matchAll(/([^.[\]]+)|\[([^\]]+)\]/g)) {
    if (value === null || value === undefined) return undefined;
    if (key !== undefined) {
      value = (value as Record<string, Json>)[key];
    } else if (/^\d+$/.test(bracket)) {
      value = Array.isArray(value) ? value[Number(bracket)] : undefined;
    } else {
      const eq = bracket.indexOf("=");
      const [field, wanted] = [bracket.slice(0, eq), bracket.slice(eq + 1)];
      value = Array.isArray(value)
        ? value.find((item) => String((item as Record<string, Json> | null)?.[field]) === wanted)
        : undefined;
    }
  }
  return value;
}

interface TemplateScope {
  match: RegExpMatchArray;
  result: Json;
  state: { acceptedBookingId: string | null; bookings: Json[] };
}

const PLACEHOLDER = /\{\{(match|result|state)((?:\.[^{}:]+|\[[^\]]+\])*)(:number)?\}\}/g;
const WHOLE_PLACEHOLDER = new RegExp(`^${PLACEHOLDER.source}$`);

function lookup(scope: TemplateScope, source: string, path: string): Json {
  const root = source === "match" ? [...scope.match] : source === "result" ? scope.result : scope.state;
  return resolvePath(root, path.replace(/^\./, ""));
}

function renderString(template: string, scope: TemplateScope, strict: boolean): Json {
  // A missing value throws in a tool input (the probe must fail loudly) and reads "none" in text.
  const resolve = (source: string, path: string): Json => {
    const value = lookup(scope, source, path);
    if (value !== undefined && value !== null) return value;
    if (strict) throw new Error(`booking replay: nothing at {{${source}${path}}}`);
    return "none";
  };
  const whole = template.match(WHOLE_PLACEHOLDER);
  if (whole) {
    const value = resolve(whole[1], whole[2]);
    return whole[3] && value !== "none" ? Number(value) : value;
  }
  return template.replace(PLACEHOLDER, (_all, source: string, path: string) => {
    const value = resolve(source, path);
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

function render(value: Json, scope: TemplateScope): Json {
  if (typeof value === "string") return renderString(value, scope, true);
  if (Array.isArray(value)) return value.map((item) => render(item, scope));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, render(item, scope)]));
  }
  return value;
}

function systemText(system: Anthropic.MessageStreamParams["system"]): string {
  if (typeof system === "string") return system;
  return (system ?? []).map((block) => block.text).join("");
}

/** What the replay may read from agent.ts's state block. */
function readState(system: string): TemplateScope["state"] {
  const accepted = system.match(/\(bookingId ([0-9a-f-]{36})\)/);
  const bookingsLine = system.match(/^Reservas del visitante: (\[.*\])$/m);
  return {
    acceptedBookingId: accepted?.[1] ?? null,
    bookings: bookingsLine ? (JSON.parse(bookingsLine[1]) as Json[]) : [],
  };
}

function isVisitorText(message: Anthropic.MessageParam): boolean {
  if (message.role !== "user") return false;
  return typeof message.content === "string" || message.content.every((block) => block.type === "text");
}

function textOf(message: Anthropic.MessageParam): string {
  if (typeof message.content === "string") return message.content;
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

function latestToolResult(messages: Anthropic.MessageParam[]): Json {
  const last = messages.at(-1);
  if (!last || typeof last.content === "string") return undefined;
  const results = last.content.filter((block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result");
  const content = results.at(-1)?.content;
  return typeof content === "string" ? JSON.parse(content) : undefined;
}

/** The next model response for this conversation, per the fixture. */
export function replayResponse(fixture: ReplayFixture, params: Anthropic.MessageStreamParams, callId: number): Anthropic.Message {
  const { messages } = params;
  let visitorIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isVisitorText(messages[i])) {
      visitorIndex = i;
      break;
    }
  }
  const visitorText = visitorIndex >= 0 ? textOf(messages[visitorIndex]).trim() : "";
  // The visitor's words may be merged with earlier history: match the last paragraph.
  const latest = visitorText.split("\n\n").at(-1) ?? "";
  const scenario = fixture.scenarios.find((candidate) => candidate.pattern.test(latest));
  if (!scenario) throw new Error("booking replay: no scenario matches the visitor's message");

  const stepIndex = messages.slice(visitorIndex + 1).filter((message) => message.role === "assistant").length;
  const step = scenario.steps[stepIndex];
  if (!step) throw new Error(`booking replay: scenario "${scenario.name}" has no step ${stepIndex}`);

  const scope: TemplateScope = {
    match: latest.match(scenario.pattern) as RegExpMatchArray,
    result: latestToolResult(messages),
    state: readState(systemText(params.system)),
  };
  const content: Anthropic.ContentBlock[] = step.tools
    ? step.tools.map(
        (call, i) =>
          ({
            type: "tool_use",
            id: `toolu_replay_${callId}_${i}`,
            name: call.name,
            input: render(call.input, scope),
          }) as Anthropic.ToolUseBlock
      )
    : [{ type: "text", text: renderString(step.text as string, scope, false) as string, citations: null }];

  return {
    id: `msg_replay_${callId}`,
    type: "message",
    role: "assistant",
    model: params.model,
    content,
    stop_reason: step.tools ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as Anthropic.Message;
}

/** A BookingModelClient that answers from a fixture instead of calling Anthropic. */
export function replayModelClient(fixture: ReplayFixture): BookingModelClient {
  let calls = 0;
  return {
    messages: {
      stream(params, options) {
        if (options?.signal?.aborted) throw new Error("booking replay: aborted");
        const message = replayResponse(fixture, params, ++calls);
        return {
          async *[Symbol.asyncIterator]() {
            for (const [index, block] of message.content.entries()) {
              if (block.type === "text") {
                yield {
                  type: "content_block_delta",
                  index,
                  delta: { type: "text_delta", text: block.text },
                } as Anthropic.MessageStreamEvent;
              }
            }
          },
          finalMessage: async () => message,
        };
      },
    },
  };
}

/** Entry point for agent.ts: refuses production, then loads the named fixture. */
export function createReplayModelClient(name: string): BookingModelClient {
  assertReplayAllowed({ nodeEnv: process.env.NODE_ENV, vercel: getEnv("VERCEL"), vercelEnv: getEnv("VERCEL_ENV") });
  return replayModelClient(loadFixture(name));
}
