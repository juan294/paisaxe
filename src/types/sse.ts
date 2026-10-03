import type { ImageResult, Source } from "@/types";
import { isBookingCard, type BookingCard } from "./booking-cards";

type ChatTextEvent = {
  type: "text";
  content: string;
};

type ChatDoneEvent = {
  type: "done";
  images: ImageResult[];
  sources: Source[];
};

type ChatErrorEvent = {
  type: "error";
  message: string;
};

/** Booking chat only: a tool call's progress, for the "checking availability" status line. */
type ChatToolEvent = {
  type: "tool";
  name: string;
  status: "start" | "done" | "error";
};

/** Booking chat only: a structured card attached to the current assistant message. */
type ChatCardEvent = {
  type: "card";
  card: BookingCard;
};

export type ChatStreamEvent = ChatTextEvent | ChatDoneEvent | ChatErrorEvent | ChatToolEvent | ChatCardEvent;

const TOOL_STATUSES = new Set(["start", "done", "error"]);

export function encodeSseEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseEvent(line: string): ChatStreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  try {
    const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

    if (event.type === "text" && typeof event.content === "string") {
      return event as ChatTextEvent;
    }

    if (event.type === "tool" && typeof event.name === "string" && TOOL_STATUSES.has(event.status as string)) {
      return { type: "tool", name: event.name, status: event.status as ChatToolEvent["status"] };
    }

    if (event.type === "card" && isBookingCard(event.card)) {
      return { type: "card", card: event.card };
    }

    if (
      event.type === "done" &&
      Array.isArray(event.images) &&
      Array.isArray(event.sources)
    ) {
      return event as unknown as ChatDoneEvent;
    }

    if (
      event.type === "error" &&
      typeof event.message === "string"
    ) {
      return {
        type: "error",
        message: event.message,
      };
    }
  } catch {
    return null;
  }

  return null;
}
