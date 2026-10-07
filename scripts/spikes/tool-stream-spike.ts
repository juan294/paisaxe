/**
 * Phase 0 spike (docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-0.md):
 * prove that the Anthropic SDK streams tool use end to end with the model the app
 * already uses, so Phase 3 can build the booking tool loop on it.
 *
 * Run: npx tsx scripts/spikes/tool-stream-spike.ts
 * Output: scripts/spikes/tool-stream-evidence.json (event sequence and timings, no secrets)
 *
 * Makes three to four small real API calls. Not used by the application.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { z } from "zod";
import { CHAT_MODEL } from "../../src/lib/models";

config({ path: ".env.local" });

const QuoteInput = z.object({
  experience_id: z.string().min(1),
  party_size: z.number().int().min(1).max(12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const tools: Anthropic.Tool[] = [
  {
    name: "get_quote",
    description:
      "Create a price quote for a bookable experience. Returns total price, deposit and balance in euro cents. Never invent prices; call this tool.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        experience_id: { type: "string", description: "Catalog id, for example 'senda-costera'" },
        party_size: { type: "integer", minimum: 1, maximum: 12 },
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
      },
      required: ["experience_id", "party_size", "date"],
    },
  },
];

function runTool(name: string, input: unknown): { content: string; isError: boolean } {
  if (name !== "get_quote") return { content: `unknown tool ${name}`, isError: true };
  const parsed = QuoteInput.safeParse(input);
  if (!parsed.success) return { content: JSON.stringify({ error: "invalid_input" }), isError: true };
  // Fixed fixture answer: the spike tests the protocol, not pricing.
  return {
    content: JSON.stringify({
      quote_id: "q_spike_1",
      total_cents: 12000,
      deposit_cents: 3000,
      balance_cents: 9000,
      party_size: parsed.data.party_size,
      date: parsed.data.date,
    }),
    isError: false,
  };
}

interface EventRecord {
  iteration: number;
  msSinceStart: number;
  type: string;
  detail?: string;
}

async function main(): Promise<void> {
  const client = new Anthropic({ maxRetries: 1 });
  const started = Date.now();
  const events: EventRecord[] = [];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Somos cuatro y queremos hacer la senda costera (id 'senda-costera') el 2026-10-24. ¿Cuánto cuesta?",
    },
  ];
  const iterations: Array<{ stopReason: string | null; blockTypes: string[]; usage: Anthropic.Usage }> = [];
  let finalText = "";

  for (let iteration = 1; iteration <= 4; iteration++) {
    const stream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 4000,
      system:
        "Eres Pelayo, guía de Asturias. Responde en español, breve. Para precios usa siempre la herramienta get_quote.",
      tools,
      messages,
    });

    for await (const event of stream) {
      const record: EventRecord = { iteration, msSinceStart: Date.now() - started, type: event.type };
      if (event.type === "content_block_start") record.detail = event.content_block.type;
      if (event.type === "content_block_delta") record.detail = event.delta.type;
      if (event.type === "message_delta") record.detail = String(event.delta.stop_reason);
      events.push(record);
    }

    const message = await stream.finalMessage();
    iterations.push({
      stopReason: message.stop_reason,
      blockTypes: message.content.map((block) => block.type),
      usage: message.usage,
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (text) finalText = text;

    if (message.stop_reason !== "tool_use") break;

    // Append the assistant turn unchanged (it may contain thinking blocks).
    messages.push({ role: "assistant", content: message.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = message.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
      .map((block) => {
        const result = runTool(block.name, block.input);
        events.push({
          iteration,
          msSinceStart: Date.now() - started,
          type: "tool_executed",
          detail: `${block.name} valid=${!result.isError}`,
        });
        return { type: "tool_result", tool_use_id: block.id, content: result.content, is_error: result.isError };
      });
    messages.push({ role: "user", content: toolResults });
  }

  // Compress consecutive identical delta events so the evidence stays readable.
  const compact: Array<EventRecord & { count: number }> = [];
  for (const event of events) {
    const last = compact.at(-1);
    if (last && last.iteration === event.iteration && last.type === event.type && last.detail === event.detail) {
      last.count += 1;
    } else {
      compact.push({ ...event, count: 1 });
    }
  }

  const evidence = {
    recordedAt: new Date().toISOString(),
    model: CHAT_MODEL,
    sdk: "@anthropic-ai/sdk",
    transport: "sdk (standalone tsx process, not the Next.js dev server)",
    iterations,
    toolCalled: events.some((event) => event.type === "tool_executed"),
    priceInFinalTextFromTool: /120/.test(finalText) && /30/.test(finalText),
    finalText,
    totalMs: Date.now() - started,
    events: compact,
  };
  const out = resolve("scripts/spikes/tool-stream-evidence.json");
  writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { iterations: iterations.map((it) => it.stopReason), toolCalled: evidence.toolCalled, totalMs: evidence.totalMs },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  if (error instanceof Anthropic.APIError) {
    console.error(`API error ${error.status}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
