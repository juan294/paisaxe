import { randomUUID, createHash } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingModelClient } from "../../src/lib/booking/model-client";
import type { streamBookingTurn } from "../../src/lib/booking/agent";
import type { getOrCreateOpenDraft } from "../../src/lib/booking/drafts";
import type { listBookingsForUser } from "../../src/lib/booking/bookings";
import type { BookingCard } from "../../src/types/booking-cards";
type QuoteCard = Extract<BookingCard, { kind: "quote" }>;
export type BookingEvaluationMode = "baseline" | "deterministic" | "jev";
export interface LegacyHarnessDependencies {
  admin: SupabaseClient;
  anthropic: BookingModelClient;
  psql(sql: string): string;
  streamBookingTurn: typeof streamBookingTurn;
  getOrCreateOpenDraft: typeof getOrCreateOpenDraft;
  listBookingsForUser: typeof listBookingsForUser;
  mode: BookingEvaluationMode;
}
export interface LegacyBookingTurn {
  visitor: string;
  assistant: string;
  tools: string[];
  cards: BookingCard[];
  latencyMs: number;
  firstCardMs: number | null;
  firstQuoteMs: number | null;
  mode: BookingEvaluationMode;
  timingScope: "agent";
}

/** Importing this module performs no key loading, database access or provider setup. */
export function createBookingEvalHarness(deps: LegacyHarnessDependencies) {
  const {
    admin,
    anthropic,
    psql,
    streamBookingTurn,
    getOrCreateOpenDraft,
    listBookingsForUser,
    mode,
  } = deps;
  class Conversation {
    readonly userId = randomUUID();
    readonly turns: LegacyBookingTurn[] = [];
    private history: { role: "user" | "assistant"; content: string }[] = [];

    constructor(readonly locale: string = "es") {
      psql(
        `INSERT INTO auth.users (id, email) VALUES ('${this.userId}', '${this.userId}@booking-eval.test');`,
      );
    }

    async say(
      text: string,
      acceptedBooking: { id: string; reference: string } | null = null,
    ): Promise<LegacyBookingTurn> {
      const started = Date.now();
      const turn: LegacyBookingTurn = {
        visitor: text,
        assistant: "",
        tools: [],
        cards: [],
        latencyMs: 0,
        firstCardMs: null,
        firstQuoteMs: null,
        mode,
        timingScope: "agent",
      };
      for await (const event of streamBookingTurn(
        {
          anthropic,
          tools: { userId: this.userId, redemptionId: "eval", client: admin },
          message: text,
          history: this.history,
          draft: await getOrCreateOpenDraft(admin, this.userId),
          bookings: await listBookingsForUser(admin, this.userId),
          contextText: null,
          acceptedBooking,
          signal: AbortSignal.timeout(85_000),
          locale: this.locale,
        },
        {
          intake:
            mode === "baseline"
              ? async () => ({ status: "fallback", reason: "baseline_arm" })
              : undefined,
        },
      )) {
        if (event.type === "text") turn.assistant += event.content;
        if (event.type === "tool" && event.status === "start")
          turn.tools.push(event.name);
        if (event.type === "card") {
          turn.cards.push(event.card);
          turn.firstCardMs ??= Date.now() - started;
          if (event.card.kind === "quote")
            turn.firstQuoteMs ??= Date.now() - started;
        }
      }
      turn.latencyMs = Date.now() - started;
      // The post-accept turn has no visitor text (the client sends none), only the server's line.
      this.history.push(
        { role: "user", content: text },
        { role: "assistant", content: turn.assistant },
      );
      this.turns.push(turn);
      return turn;
    }

    quotes(): QuoteCard[] {
      return this.turns
        .flatMap((t) => t.cards)
        .filter((c): c is QuoteCard => c.kind === "quote");
    }

    cleanup(): void {
      const id = `'${this.userId}'`;
      psql(
        `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE user_id = ${id});` +
          `DELETE FROM public.bookings WHERE user_id = ${id};` +
          `DELETE FROM public.holds WHERE quote_id IN (SELECT id FROM public.quotes WHERE user_id = ${id});` +
          `DELETE FROM public.quotes WHERE user_id = ${id};` +
          `DELETE FROM public.booking_drafts WHERE user_id = ${id};` +
          `DELETE FROM public.user_profiles WHERE user_id = ${id};` +
          `DELETE FROM auth.users WHERE id = ${id};`,
      );
    }
  }

  /** Euro amounts written in assistant text (e.g. "120 €", "30,00 euros", "EUR 90"). */
  const eurosIn = extractBookingEuros;

  /** Amounts a tool supplied in this conversation (prices, deposits, balances) plus the visitor's own. */
  function knownAmounts(conversation: Conversation): Set<number> {
    const amounts = new Set<number>();
    for (const turn of conversation.turns) {
      for (const value of eurosIn(turn.visitor)) amounts.add(value);
      for (const card of turn.cards) {
        if (card.kind === "quote")
          [card.totalCents, card.depositCents, card.balanceCents].forEach((c) =>
            amounts.add(c / 100),
          );
        if (card.kind === "offer")
          card.options.forEach((o) =>
            [
              o.priceCents,
              o.depositCents,
              o.priceCents - o.depositCents,
            ].forEach((c) => amounts.add(c / 100)),
          );
      }
    }
    return amounts;
  }

  function inventedPrices(conversation: Conversation): number[] {
    const known = knownAmounts(conversation);
    return conversation.turns
      .flatMap((t) => eurosIn(t.assistant))
      .filter((amount) => !known.has(amount));
  }

  interface Result {
    id: number;
    name: string;
    pass: boolean;
    outcome: string;
    clarificationTurns: number;
    latencyMs: number;
    inventedPrices: number[];
    transcript: LegacyBookingTurn[];
  }

  async function scenario(
    id: number,
    name: string,
    run: (c: Conversation) => Promise<{
      pass: boolean;
      outcome: string;
      clarificationTurns?: number;
    }>,
    locale = "es",
  ): Promise<Result> {
    const conversation = new Conversation(locale);
    try {
      const verdict = await run(conversation);
      const invented = inventedPrices(conversation);
      return {
        id,
        name,
        pass: verdict.pass && invented.length === 0,
        outcome: verdict.outcome,
        clarificationTurns: verdict.clarificationTurns ?? 0,
        latencyMs: conversation.turns.reduce((sum, t) => sum + t.latencyMs, 0),
        inventedPrices: invented,
        transcript: conversation.turns,
      };
    } catch (error) {
      return {
        id,
        name,
        pass: false,
        outcome: `error: ${error instanceof Error ? error.message : String(error)}`,
        clarificationTurns: 0,
        latencyMs: 0,
        inventedPrices: [],
        transcript: conversation.turns,
      };
    } finally {
      conversation.cleanup();
    }
  }

  /** Answers clarifying questions with the facts of the representative request until a quote appears. */
  async function untilQuote(
    c: Conversation,
    opening: string,
    answers: string[],
  ): Promise<{ quote: QuoteCard | undefined; clarifications: number }> {
    await c.say(opening);
    let clarifications = 0;
    for (const answer of answers) {
      if (c.quotes().length > 0) break;
      clarifications++;
      await c.say(answer);
    }
    return { quote: c.quotes().at(-1), clarifications };
  }

  return { Conversation, scenario, untilQuote, eurosIn, inventedPrices };
}

export interface ClaudeCapOptions {
  maxRequests: number;
  maxSpendUsd: number;
  ledgerPath: string;
  fetch?: typeof globalThis.fetch;
}
/** Published 2026-10-28: Sonnet5.5 1M context,$2/$10 perM,5m cache$2.50,1h$4,read$0.10. */
export const CLAUDE_EVAL_PRICE_POLICY = {
  model: "claude-sonnet-5-5",
  contextCeilingTokens: 1_048_576,
  inputPerMillion: 2,
  outputPerMillion: 10,
  cacheWritePerMillion: 2.5,
  cacheHourPerMillion: 4,
  cacheReadPerMillion: 0.1,
  version: "sonnet-5-5-2026-10-28-v1",
} as const;
function appendClaudeLedger(filename: string, value: unknown): void {
  const fd = openSync(filename, "a");
  try {
    writeSync(fd, JSON.stringify(value) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
/** Per-HTTP accounting below SDK/outer-loop retries. No provider request occurs at construction. */
export function createCappedClaudeFetch(options: ClaudeCapOptions) {
  if (
    !Number.isSafeInteger(options.maxRequests) ||
    options.maxRequests <= 0 ||
    !Number.isFinite(options.maxSpendUsd) ||
    options.maxSpendUsd <= 0
  )
    throw new Error("Explicit positive Claude request/spend caps required.");
  mkdirSync(dirname(options.ledgerPath), { recursive: true });
  // Never append a new cap session onto prior spend without a resume design.
  const fd = openSync(options.ledgerPath, "wx");
  closeSync(fd);
  let requests = 0,
    reservedUsd = 0,
    settledUsd = 0,
    unknown = 0,
    exhausted = false;
  const pending: Promise<void>[] = [];
  const snapshot = () => ({
    requests,
    reservedUsd,
    settledUsd,
    unknownCompletion: unknown,
    exhausted,
    complete: unknown === 0 && !exhausted,
    pricePolicy: CLAUDE_EVAL_PRICE_POLICY,
  });
  const transport: typeof globalThis.fetch = async (url, init) => {
    if (String(url) !== "https://api.anthropic.com/v1/messages")
      throw new Error(
        "Claude guard accepts only the pinned messages endpoint.",
      );
    if (init?.signal?.aborted)
      throw new Error("Claude request aborted before dispatch.");
    const body = JSON.parse(String(init?.body));
    if (
      body.model !== CLAUDE_EVAL_PRICE_POLICY.model ||
      !Number.isSafeInteger(body.max_tokens) ||
      body.max_tokens <= 0 ||
      body.max_tokens > 131072
    )
      throw new Error(
        "Claude model/output ceiling differs from pinned evaluation policy.",
      );
    const hour = JSON.stringify(body).includes('"1h"');
    const reserve =
      (CLAUDE_EVAL_PRICE_POLICY.contextCeilingTokens * (hour ? 4 : 2.5)) /
        1_000_000 +
      (body.max_tokens * 10) / 1_000_000;
    if (
      requests + 1 > options.maxRequests ||
      settledUsd + reservedUsd + reserve > options.maxSpendUsd
    ) {
      exhausted = true;
      throw new Error("Claude request/spend cap exhausted before dispatch.");
    }
    const id = randomUUID();
    appendClaudeLedger(options.ledgerPath, {
      event: "reserved",
      id,
      request: requests + 1,
      reservedUsd: reserve,
      model: body.model,
      maxTokens: body.max_tokens,
      pricePolicy: CLAUDE_EVAL_PRICE_POLICY.version,
    });
    requests++;
    reservedUsd += reserve;
    unknown++;
    const response = await (options.fetch ?? globalThis.fetch)(url, init);
    const settling = response
      .clone()
      .text()
      .then((text) => {
        let model: string | undefined,
          input: number | undefined,
          output: number | undefined,
          creation = 0,
          read = 0,
          ended = false;
        try {
          const objects = text.trim().startsWith("{")
            ? [JSON.parse(text)]
            : text
                .split("\n")
                .filter((line) => line.startsWith("data: "))
                .map((line) => {
                  try {
                    return JSON.parse(line.slice(6));
                  } catch {
                    return null;
                  }
                })
                .filter(Boolean);
          for (const event of objects) {
            const message = event.message ?? event;
            if (message.model) model = message.model;
            const usage = event.usage ?? message.usage;
            if (usage) {
              if (usage.input_tokens !== undefined) input = usage.input_tokens;
              if (usage.output_tokens !== undefined)
                output = usage.output_tokens;
              if (usage.cache_creation_input_tokens !== undefined)
                creation = usage.cache_creation_input_tokens;
              if (usage.cache_read_input_tokens !== undefined)
                read = usage.cache_read_input_tokens;
            }
            if (event.type === "message_stop" || (!event.type && event.model))
              ended = true;
          }
          if (
            !response.ok ||
            !ended ||
            model !== CLAUDE_EVAL_PRICE_POLICY.model ||
            ![input, output, creation, read].every(
              (n) => Number.isSafeInteger(n) && Number(n) >= 0,
            ) ||
            Number(input) + creation + read >
              CLAUDE_EVAL_PRICE_POLICY.contextCeilingTokens ||
            Number(output) > body.max_tokens
          )
            return;
          const cost =
            (Number(input) * 2 +
              Number(output) * 10 +
              creation * (hour ? 4 : 2.5) +
              read * 0.1) /
            1_000_000;
          if (cost > reserve) return;
          appendClaudeLedger(options.ledgerPath, {
            event: "completed",
            id,
            usage: { input, output, creation, read },
            costUsd: cost,
          });
          reservedUsd -= reserve;
          settledUsd += cost;
          unknown--;
        } catch {
          /* Unknown completion retains its full reservation. */
        }
      })
      .catch(() => {});
    pending.push(settling);
    return response;
  };
  return {
    fetch: transport,
    snapshot,
    settled: async () => {
      await Promise.all(pending);
    },
  };
}
export interface BookingRouteTurn {
  events: Record<string, unknown>[];
  assistant: string;
  firstCardMs: number | null;
  firstQuoteMs: number | null;
  fullTurnMs: number;
  complete: boolean;
}
export async function collectBookingSse(
  response: Response,
  started = performance.now(),
): Promise<BookingRouteTurn> {
  const result: BookingRouteTurn = {
    events: [],
    assistant: "",
    firstCardMs: null,
    firstQuoteMs: null,
    fullTurnMs: 0,
    complete: false,
  };
  if (!response.ok || !response.body)
    throw new Error(`Booking route unavailable (${response.status})`);
  let buffer = "";
  const decoder = new TextDecoder();
  const accept = (frame: string) => {
    const payload = frame
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (!payload) return;
    const event = JSON.parse(payload) as Record<string, unknown>;
    result.events.push(event);
    if (event.type === "text") result.assistant += String(event.content ?? "");
    if (event.type === "card") {
      result.firstCardMs ??= performance.now() - started;
      if ((event.card as { kind?: string })?.kind === "quote")
        result.firstQuoteMs ??= performance.now() - started;
    }
    if (event.type === "done") result.complete = true;
    if (event.type === "error") result.complete = false;
  };
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      accept(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) accept(buffer);
  result.fullTurnMs = performance.now() - started;
  return result;
}
export interface BookingRouteScenario {
  id: string;
  now: string;
  locale: "es";
  opening: string;
  followUps: string[];
  expected: {
    outcome: "quote" | "no_match" | "clarification";
    quote?: {
      experienceTitle: string;
      date: string;
      time: string;
      partySize: number;
      totalCents: number;
      depositCents: number;
    };
    maxClarifications: number;
  };
  invariants: string[];
}
export interface BookingRouteArm {
  origin: string;
  catalogHash: string;
  retrievalHash: string;
  headers: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  setup?(
    scenario: BookingRouteScenario,
  ): Promise<{ headers: Record<string, string>; cleanup(): Promise<void> }>;
  clock?: string;
  transportKind?: "fixture" | "live";
  claudeBudget?: ReturnType<typeof createCappedClaudeFetch>;
  jevAccounting?: () => { complete: boolean; costUsd: number | null };
}
function assertLoopback(origin: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/" ||
    url.username ||
    url.password
  )
    throw new Error("Booking comparisons require an explicit loopback origin.");
}
/** Caller supplies isolated, correctly wired local route arms; no mode is sent to visitors. */
export async function compareBookingRouteScenarios(
  scenarios: BookingRouteScenario[],
  arms: Record<BookingEvaluationMode, BookingRouteArm>,
) {
  if (scenarios.length !== 30)
    throw new Error("Thirty frozen complete paired scenarios are required.");
  const modes: BookingEvaluationMode[] = ["baseline", "deterministic", "jev"];
  for (const mode of modes) assertLoopback(arms[mode].origin);
  if (
    new Set(modes.map((mode) => arms[mode].catalogHash)).size !== 1 ||
    new Set(modes.map((mode) => arms[mode].retrievalHash)).size !== 1
  )
    throw new Error("Paired route catalog/retrieval identities differ.");
  const rows = [];
  for (let index = 0; index < scenarios.length; index++) {
    const scenario = scenarios[index]!;
    // Deterministic rotation controls order without changing paired inputs.
    const order = [...modes.slice(index % 3), ...modes.slice(0, index % 3)];
    for (const mode of order) {
      const arm = arms[mode];
      if (arm.clock && arm.clock !== scenario.now)
        throw new Error("Scenario/server clock identity differs.");
      if (
        arm.transportKind === "live" &&
        (!arm.claudeBudget || (!arm.jevAccounting && mode === "jev"))
      )
        throw new Error(
          "Live route comparisons require separate bounded Claude and Jev accounting.",
        );
      const owned = await arm.setup?.(scenario);
      const headers = owned?.headers ?? arm.headers;
      const history: { role: "user" | "assistant"; content: string }[] = [];
      const turns: BookingRouteTurn[] = [];
      const started = performance.now();
      const priorClaudeCost = arm.claudeBudget?.snapshot().settledUsd ?? 0;
      const priorJevCost = arm.jevAccounting?.().costUsd ?? 0;
      try {
        for (const message of [scenario.opening, ...scenario.followUps]) {
          const turnStarted = performance.now();
          const response = await (arm.fetch ?? globalThis.fetch)(
            `${arm.origin}/api/booking/chat/stream`,
            {
              method: "POST",
              headers: { ...headers, "content-type": "application/json" },
              body: JSON.stringify({ message, history, locale: "es" }),
              signal: AbortSignal.timeout(115000),
            },
          );
          const turn = await collectBookingSse(response, turnStarted);
          turns.push(turn);
          history.push(
            { role: "user", content: message },
            { role: "assistant", content: turn.assistant },
          );
          if (!turn.complete || turn.firstQuoteMs !== null) break;
        }
        const cards = turns
          .flatMap((turn) => turn.events)
          .filter((event) => event.type === "card")
          .map((event) => event.card as Record<string, unknown>);
        const quote = cards.find((card) => card.kind === "quote");
        const clarificationCount =
          turns.findIndex((turn) => turn.firstQuoteMs !== null) >= 0
            ? Math.max(
                0,
                turns.findIndex((turn) => turn.firstQuoteMs !== null) - 1,
              )
            : Math.max(0, turns.length - 1);
        const knownAmounts = new Set([
          ...extractBookingEuros(scenario.opening),
          ...scenario.followUps.flatMap(extractBookingEuros),
        ]);
        for (const card of cards) {
          for (const key of [
            "totalCents",
            "depositCents",
            "balanceCents",
            "priceCents",
          ])
            if (typeof card[key] === "number")
              knownAmounts.add(Number(card[key]) / 100);
          for (const option of Array.isArray(card.options)
            ? card.options
            : []) {
            if (typeof option.priceCents === "number")
              knownAmounts.add(option.priceCents / 100);
            if (typeof option.depositCents === "number")
              knownAmounts.add(option.depositCents / 100);
          }
        }
        const inventedPrices = turns
          .flatMap((turn) => extractBookingEuros(turn.assistant))
          .filter((amount) => !knownAmounts.has(amount));
        const events = turns.flatMap((turn) => turn.events);
        const unauthorizedPayment =
          events.some(
            (event) =>
              event.type === "tool" &&
              event.status === "start" &&
              [
                "create_payment_order",
                "accept_quote",
                "send_balance_invoice",
              ].includes(String(event.name)),
          ) ||
          cards.some(
            (card) =>
              card.kind === "payment" ||
              (card.kind === "booking" && card.status === "confirmed"),
          );
        const badProviderFact = cards.some(
          (card) =>
            card.kind === "offer" &&
            Array.isArray(card.options) &&
            card.options.some(
              (option: Record<string, unknown>) =>
                Array.isArray(option.verdicts) &&
                option.verdicts.some(
                  (verdict: Record<string, unknown>) =>
                    (verdict.verdict === "supported" &&
                      verdict.confirmedByProvider !== true) ||
                    (verdict.verdict === "unsupported" &&
                      option.suitability !== "rejected") ||
                    (verdict.verdict === "unknown" &&
                      option.suitability === "suitable"),
                ),
            ),
        );
        const invariants = {
          no_invented_price: inventedPrices.length === 0,
          no_payment_without_accept: !unauthorizedPayment,
          provider_facts_preserved: !badProviderFact,
        };
        const invariantPass = scenario.invariants.every(
          (key) => invariants[key as keyof typeof invariants] === true,
        );
        const correct =
          scenario.expected.outcome === "quote"
            ? Boolean(
                quote &&
                  Object.entries(scenario.expected.quote ?? {}).every(
                    ([key, value]) =>
                      quote[
                        key === "date"
                          ? "slotDate"
                          : key === "time"
                            ? "slotTime"
                            : key
                      ] === value,
                  ),
              )
            : !quote;
        const offsetToQuote = turns.reduce(
          (acc, turn) =>
            acc.found
              ? acc
              : turn.firstQuoteMs == null
                ? { found: false, ms: acc.ms + turn.fullTurnMs }
                : { found: true, ms: acc.ms + turn.firstQuoteMs },
          { found: false, ms: 0 },
        );
        await arm.claudeBudget?.settled();
        const budget = arm.claudeBudget?.snapshot();
        const jev = arm.jevAccounting?.();
        rows.push({
          scenarioId: scenario.id,
          mode,
          timingScope: "route" as const,
          transportKind: arm.transportKind ?? "fixture",
          locale: "es",
          catalogHash: arm.catalogHash,
          retrievalHash: arm.retrievalHash,
          inputHash: createHashForScenario(scenario),
          complete:
            turns.every((t) => t.complete) &&
            correct &&
            clarificationCount <= scenario.expected.maxClarifications &&
            invariantPass &&
            (budget?.complete ?? true) &&
            (jev?.complete ?? true),
          firstCardMs: turns[0]?.firstCardMs ?? null,
          timeToQuoteMs: offsetToQuote.found ? offsetToQuote.ms : null,
          fullScenarioMs: performance.now() - started,
          clarificationCount,
          invariants,
          inventedPrices,
          claudeCostUsd: budget ? budget.settledUsd - priorClaudeCost : null,
          jevCostUsd: jev?.costUsd == null ? null : jev.costUsd - priorJevCost,
          turns,
        });
      } finally {
        await owned?.cleanup();
      }
    }
  }
  return {
    complete: rows.every((row) => row.complete),
    livePerformance: "UNAVAILABLE" as const,
    qualification: "unmeasured" as const,
    rows,
  };
}
function createHashForScenario(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Exact currency mentions for the no-invented-price oracle. */
export function extractBookingEuros(text: string): number[] {
  const pattern =
    /(?:€|eur(?:os?)?)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?)/gi;
  return [...text.matchAll(pattern)].flatMap((match) => {
    const amount = match[1] ?? match[2];
    return amount === undefined ? [] : [Number(amount.replace(",", "."))];
  });
}

/** Settlement and accounting are part of the durable report's completion contract. */
export async function finalizeLegacyBookingReport<T extends { pass: boolean }>(
  results: T[],
  guard: ReturnType<typeof createCappedClaudeFetch>,
) {
  await guard.settled();
  const accounting = guard.snapshot();
  const passed = results.filter((result) => result.pass).length;
  const complete = accounting.complete && passed === results.length;
  return {
    passed,
    total: results.length,
    pass: complete,
    complete,
    accounting,
    results,
  };
}
