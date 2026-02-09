import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStreamChat } from "./use-stream-chat";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        "chat.error_generic": "Lo siento, hubo un error. Intenta de nuevo.",
        "chat.error_processing": "Lo siento, no pude procesar tu pregunta.",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock upsell detection
vi.mock("@/lib/chat-upsell-detection", () => ({
  detectUpsellMarker: (content: string) => {
    const match = content.match(/\s*\[\[VOICE_UPSELL:(\w+)\]\]\s*$/);
    if (match) {
      return {
        hasUpsell: true,
        reason: match[1],
        cleanContent: content.replace(/\s*\[\[VOICE_UPSELL:\w+\]\]\s*$/, "").trim(),
      };
    }
    return { hasUpsell: false, reason: null, cleanContent: content };
  },
}));

// Mock upsell throttle
const mockCanShowUpsell = vi.fn().mockReturnValue(true);
const mockRecordUpsellShown = vi.fn();
vi.mock("@/lib/chat-upsell-throttle", () => ({
  canShowUpsell: (...args: unknown[]) => mockCanShowUpsell(...args),
  recordUpsellShown: (...args: unknown[]) => mockRecordUpsellShown(...args),
  recordUpsellDismissed: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Helper to create a mock SSE streaming response.
 */
function createStreamingResponse(message: string, images: unknown[] = []) {
  const encoder = new TextEncoder();
  const words = message.split(" ");
  const events: Uint8Array[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = i === 0 ? words[i] : " " + words[i];
    const event = `data: ${JSON.stringify({ type: "text", content: word })}\n\n`;
    events.push(encoder.encode(event));
  }

  const finalEvent = `data: ${JSON.stringify({ type: "done", images, sources: [] })}\n\n`;
  events.push(encoder.encode(finalEvent));

  let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(events[index]);
        index++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: stream,
  };
}

/**
 * Helper to create a JSON (non-streaming) response.
 */
function createJsonResponse(message: string, images: unknown[] = []) {
  return {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve({ message, images }),
  };
}

describe("useStreamChat", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockCanShowUpsell.mockReturnValue(true);
    mockRecordUpsellShown.mockReset();
  });

  it("should initialize with empty messages and not streaming", () => {
    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should add user message and stream assistant response", async () => {
    mockFetch.mockResolvedValueOnce(createStreamingResponse("Hello from AI"));

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Hello", {
        context: "test context",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({
      role: "user",
      content: "Hello",
    });
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.messages[1].content).toBe("Hello from AI");
  });

  it("should set isStreaming to true while fetching", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    // Start sending (don't await)
    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("Test", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // isStreaming should be true while waiting
    expect(result.current.isStreaming).toBe(true);

    // Resolve and clean up
    await act(async () => {
      resolvePromise!(createStreamingResponse("Done"));
      await sendPromise!;
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it("should handle API failure (non-ok response)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe(
      "Lo siento, hubo un error. Intenta de nuevo."
    );
    expect(result.current.isStreaming).toBe(false);
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe(
      "Lo siento, hubo un error. Intenta de nuevo."
    );
  });

  it("should handle SSE error events", async () => {
    const encoder = new TextEncoder();
    const errorEvent = `data: ${JSON.stringify({ type: "error", message: "Error" })}\n\n`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].content).toBe(
      "Lo siento, hubo un error. Intenta de nuevo."
    );
  });

  it("should handle JSON (non-streaming) responses", async () => {
    mockFetch.mockResolvedValueOnce(
      createJsonResponse("Flagged content response", [])
    );

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].content).toBe("Flagged content response");
  });

  it("should include images from done event", async () => {
    const images = [
      { id: "img-1", path: "/images/test.jpg", caption: "Test", sourcePdf: "guide.pdf" },
    ];
    mockFetch.mockResolvedValueOnce(createStreamingResponse("Here is an image", images));

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Show image", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].images).toEqual(images);
  });

  it("should detect upsell markers and strip them from content", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Try voice mode " })}\n\n`,
      `data: ${JSON.stringify({ type: "text", content: "[[VOICE_UPSELL:booking]]" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`,
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Book restaurant", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].content).toBe("Try voice mode");
    expect(result.current.messages[1].upsellReason).toBe("booking");
  });

  it("should NOT show upsell when user has voice access", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Info [[VOICE_UPSELL:weather]]" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`,
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: true })
    );

    await act(async () => {
      await result.current.sendMessage("Weather?", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // Content should still be cleaned but upsellReason should be undefined
    expect(result.current.messages[1].content).toBe("Info");
    expect(result.current.messages[1].upsellReason).toBeUndefined();
  });

  it("should NOT show upsell when throttle blocks it", async () => {
    mockCanShowUpsell.mockReturnValue(false);

    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Try this [[VOICE_UPSELL:realtime]]" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`,
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Realtime info?", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].upsellReason).toBeUndefined();
    expect(mockRecordUpsellShown).not.toHaveBeenCalled();
  });

  it("should record upsell shown when displaying upsell", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Check [[VOICE_UPSELL:weather]]" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`,
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Weather?", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(mockRecordUpsellShown).toHaveBeenCalled();
  });

  it("should process remaining buffer after stream ends", async () => {
    // Simulate a stream where the done event is in the final buffer
    // (not followed by \n\n before the stream closes)
    const encoder = new TextEncoder();
    const textEvent = `data: ${JSON.stringify({ type: "text", content: "Hello" })}\n\n`;
    const doneEvent = `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}`;
    // Note: no trailing \n\n — this stays in the buffer

    const chunks = [
      encoder.encode(textEvent),
      encoder.encode(doneEvent),
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index]);
          index++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Hi", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // The done event should have been processed from the remaining buffer
    expect(result.current.messages[1].content).toBe("Hello");
    expect(result.current.isStreaming).toBe(false);
  });

  it("should reset messages via resetMessages", async () => {
    mockFetch.mockResolvedValueOnce(createStreamingResponse("Response"));

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.resetMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it("should dismiss upsell for a specific message", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Info [[VOICE_UPSELL:booking]]" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`,
    ];

    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Book a place", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].upsellReason).toBe("booking");
    expect(result.current.messages[1].upsellDismissed).toBeFalsy();

    act(() => {
      result.current.dismissUpsell(1);
    });

    expect(result.current.messages[1].upsellDismissed).toBe(true);
  });

  it("should not send empty messages", async () => {
    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("should not send whitespace-only messages", async () => {
    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("   ", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("should not send while already streaming", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    // Start first message
    let firstSend: Promise<void>;
    act(() => {
      firstSend = result.current.sendMessage("First", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // Try sending second message while streaming
    await act(async () => {
      await result.current.sendMessage("Second", {
        context: "ctx",
        locale: "es",
        messageIndex: 1,
      });
    });

    // Only one fetch call should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Clean up
    await act(async () => {
      resolvePromise!(createStreamingResponse("Done"));
      await firstSend!;
    });
  });

  it("should handle response with no reader", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: null,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].content).toBe(
      "Lo siento, hubo un error. Intenta de nuevo."
    );
  });

  it("should handle JSON response with images", async () => {
    const images = [
      { id: "img-1", path: "/test.jpg", caption: "Test", sourcePdf: "guide.pdf" },
    ];
    mockFetch.mockResolvedValueOnce(createJsonResponse("Response with images", images));

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Show me", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].images).toEqual(images);
  });

  it("should send correct request body to API", async () => {
    mockFetch.mockResolvedValueOnce(createStreamingResponse("Response"));

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("My question", {
        context: "Story about Lagos",
        locale: "es",
        messageIndex: 3,
      });
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "My question",
        context: "Story about Lagos",
        locale: "es",
        messageIndex: 3,
      }),
    });
  });

  it("should handle malformed SSE data gracefully", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Good " })}\n\n`,
      `data: {malformed json\n\n`,
      `data: ${JSON.stringify({ type: "text", content: "content" })}\n\n`,
      `data: ${JSON.stringify({ type: "done", images: [], sources: [] })}\n\n`,
    ];

    const combined = encoder.encode(events.join(""));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(combined);
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    await act(async () => {
      await result.current.sendMessage("Test", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // Should have the valid content, skipping the malformed event
    expect(result.current.messages[1].content).toBe("Good content");
  });
});
