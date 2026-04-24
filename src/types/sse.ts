import type { ImageResult, Source } from "@/types";

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
  hadPartialContent: boolean;
};

type ChatStreamEvent = ChatTextEvent | ChatDoneEvent | ChatErrorEvent;

export function encodeSseEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseEvent(line: string): ChatStreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  try {
    const event = JSON.parse(line.slice(6)) as Partial<ChatStreamEvent>;

    if (event.type === "text" && typeof event.content === "string") {
      return event as ChatTextEvent;
    }

    if (
      event.type === "done" &&
      Array.isArray(event.images) &&
      Array.isArray(event.sources)
    ) {
      return event as ChatDoneEvent;
    }

    if (
      event.type === "error" &&
      typeof event.message === "string"
    ) {
      return {
        type: "error",
        message: event.message,
        hadPartialContent: event.hadPartialContent === true,
      };
    }
  } catch {
    return null;
  }

  return null;
}
