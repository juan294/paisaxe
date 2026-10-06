/**
 * The slice of the Anthropic SDK the booking tool loop uses (PayPal hackathon
 * plan, Phase 3). The real SDK client, the E2E replay (replay-model.ts) and
 * test fakes all satisfy it. Its own module so agent.ts and replay-model.ts
 * do not import each other.
 */
import type Anthropic from "@anthropic-ai/sdk";

interface ModelStream extends AsyncIterable<Anthropic.MessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Message>;
}

export interface BookingModelClient {
  messages: {
    stream(params: Anthropic.MessageStreamParams, options?: { signal?: AbortSignal }): ModelStream;
  };
}
