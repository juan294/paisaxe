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
        "chat.error": "No se pudo conectar. Por favor, inténtalo de nuevo.",
        "chat.error_auth": "Tu sesión ha expirado. Recarga la página para continuar.",
        "chat.error_server": "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.",
        "chat.connection_lost": "Se perdió la conexión. Reintentar",
        "chat.error_timeout": "La respuesta tardó demasiado. Por favor, inténtalo de nuevo.",
        "chat.new_chat_prompt": "Has alcanzado el límite de mensajes. Empieza un nuevo chat para continuar.",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock upsell detection
const mockDetectUpsellMarker = vi.fn().mockImplementation((content: string) => {
  const match = content.match(/\s*\[\[VOICE_UPSELL:(\w+)\]\]\s*$/);
  if (match) {
    return {
      hasUpsell: true,
      reason: match[1],
      cleanContent: content.replace(/\s*\[\[VOICE_UPSELL:\w+\]\]\s*$/, "").trim(),
    };
  }
  return { hasUpsell: false, reason: null, cleanContent: content };
});
vi.mock("@/lib/chat-upsell-detection", () => ({
  detectUpsellMarker: (...args: unknown[]) => mockDetectUpsellMarker(...args),
}));

// Mock upsell throttle
const mockCanShowUpsell = vi.fn().mockReturnValue(true);
const mockRecordUpsellShown = vi.fn();
vi.mock("@/lib/chat-upsell-throttle", () => ({
  canShowUpsell: (...args: unknown[]) => mockCanShowUpsell(...args),
  recordUpsellShown: (...args: unknown[]) => mockRecordUpsellShown(...args),
  recordUpsellDismissed: vi.fn(),
}));

// Mock chat-safety (read-only — only used for MAX_CONVERSATION_TURNS)
vi.mock("@/lib/chat-safety", () => ({
  MAX_CONVERSATION_TURNS: 20,
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
    // Restore the default detectUpsellMarker implementation
    mockDetectUpsellMarker.mockImplementation((content: string) => {
      const match = content.match(/\s*\[\[VOICE_UPSELL:(\w+)\]\]\s*$/);
      if (match) {
        return {
          hasUpsell: true,
          reason: match[1],
          cleanContent: content.replace(/\s*\[\[VOICE_UPSELL:\w+\]\]\s*$/, "").trim(),
        };
      }
      return { hasUpsell: false, reason: null, cleanContent: content };
    });
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
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "Hello",
      })
    );
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

  it("should replace partial assistant text with the generic fallback on SSE error", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Partial answer" })}\n\n`,
      `data: ${JSON.stringify({ type: "error", message: "stream_failed" })}\n\n`,
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

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/chat/stream",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "My question",
          context: "Story about Lagos",
          locale: "es",
          messageIndex: 3,
        }),
      })
    );
  });

  it("should push error message when assistantIndex is out of bounds (line 193)", async () => {
    // This tests the else branch in the catch handler where updated[assistantIndex]
    // is falsy. This happens when messages are reset while a send is in progress:
    // 1. sendMessage starts → sets assistantIndex = messages.length + 1 = 1
    // 2. User/assistant messages are added to state
    // 3. resetMessages is called → messages becomes []
    // 4. fetch fails → catch handler runs setMessages(prev => ...) where prev = []
    // 5. updated[1] is undefined → else branch pushes the error message

    let rejectFetch: (reason: Error) => void;
    const pendingPromise = new Promise((_, reject) => {
      rejectFetch = reject;
    });
    mockFetch.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    // Start sending (don't await — we need to reset messages while it's in progress)
    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // isStreaming should be true, messages should have user + assistant placeholder
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.messages).toHaveLength(2);

    // Reset messages while the send is in progress
    act(() => {
      result.current.resetMessages();
    });

    // Messages are now empty
    expect(result.current.messages).toEqual([]);

    // Now make the fetch fail — the catch handler will try updated[assistantIndex]
    // where assistantIndex = 1 but updated (from prev = []) has length 0
    await act(async () => {
      rejectFetch!(new Error("Network error"));
      await sendPromise!;
    });

    // The else branch should have pushed an error message
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Lo siento, hubo un error. Intenta de nuevo.",
      })
    );
    expect(result.current.isStreaming).toBe(false);
  });

  it("should skip non-data SSE lines in processEvent (line 112)", async () => {
    // processEvent skips lines that don't start with "data: ".
    // This tests the early return on line 112.
    const encoder = new TextEncoder();
    const events = [
      `:comment line\n\n`,  // SSE comment — not "data: " prefixed
      `event: ping\n\n`,    // Named event — not "data: " prefixed
      `data: ${JSON.stringify({ type: "text", content: "Hello" })}\n\n`,
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

    // Only the valid data events should have been processed
    expect(result.current.messages[1].content).toBe("Hello");
  });

  it("should dismiss upsell at an invalid index without crashing (line 49 branch)", async () => {
    // Line 49: if (updated[messageIndex]) — when messageIndex is out of bounds,
    // the update function simply returns the array without modification.
    const { result } = renderHook(() =>
      useStreamChat({ canUseVoice: false })
    );

    // Dismiss at index 5 when there are no messages — exercises the falsy branch on line 49
    act(() => {
      result.current.dismissUpsell(5);
    });

    // Should not crash; messages remain empty
    expect(result.current.messages).toEqual([]);
  });

  it("should handle JSON response with no message field (line 96 fallback)", async () => {
    // Line 96: content: data.message || t("chat.error_processing")
    // When data.message is undefined/empty, it falls back to the translation.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ images: [] }), // no `message` field
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
      "Lo siento, no pude procesar tu pregunta."
    );
  });

  it("should set upsellReason to undefined when reason is null (line 147 nullish coalescing)", async () => {
    // Lines 147-151: upsellReason: shouldShowUpsell ? reason ?? undefined : undefined
    // When detectUpsellMarker returns hasUpsell=true but reason=null,
    // the ?? undefined converts null to undefined.
    // Override the mock to return hasUpsell=true with reason=null.
    mockDetectUpsellMarker.mockReturnValue({
      hasUpsell: true,
      reason: null,
      cleanContent: "Cleaned content",
    });

    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Some content" })}\n\n`,
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
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // reason was null, so `reason ?? undefined` should produce undefined
    // shouldShowUpsell is true (hasUpsell=true, canUseVoice=false, canShowUpsell=true)
    // so the ternary takes the truthy path, but reason ?? undefined = undefined
    expect(result.current.messages[1].upsellReason).toBeUndefined();
    expect(result.current.messages[1].content).toBe("Cleaned content");
  });

  it("should ignore unrecognized SSE event types (implicit else after line 151)", async () => {
    // This tests the case where event.type is neither "text", "done", nor "error".
    // The if/else-if chain on lines 118/128/151 has no else clause, so unrecognized
    // event types are silently ignored. This exercises the false branch of the
    // `else if (event.type === "error")` condition on line 151.
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "text", content: "Hello" })}\n\n`,
      `data: ${JSON.stringify({ type: "heartbeat", ts: 12345 })}\n\n`,
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

    // The "heartbeat" event should be silently ignored; only "text" content appears
    expect(result.current.messages[1].content).toBe("Hello");
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

  it("onError: sets error state and replaces assistant message when the stream reader throws", async () => {
    // Trigger readSseStream's onError by providing a ReadableStream that errors immediately
    const streamError = new Error("Unexpected read failure");
    const erroringStream = new ReadableStream({
      start(controller) {
        controller.error(streamError);
      },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: erroringStream,
    });

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "",
        locale: "es",
        messageIndex: 0,
      });
    });

    // onError non-AbortError path: sets error and updates assistant message
    expect(result.current.error).toBe("No se pudo conectar. Por favor, inténtalo de nuevo.");
    expect(result.current.messages[1].content).toBe(
      "Lo siento, hubo un error. Intenta de nuevo."
    );
  });

  it("onError: silently ignores AbortError from the stream reader", async () => {
    const abortError = new Error("AbortError");
    abortError.name = "AbortError";
    const erroringStream = new ReadableStream({
      start(controller) {
        controller.error(abortError);
      },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: erroringStream,
    });

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "",
        locale: "es",
        messageIndex: 0,
      });
    });

    // AbortError is silently ignored — no error state set
    expect(result.current.error).toBeNull();
  });

  it("onError else branch: pushes new error message when assistantIndex is out of bounds after reset", async () => {
    // To hit the else branch (line 209), assistantIndex must be out of bounds in the
    // setMessages callback. This happens when messages are reset while the stream hangs:
    // 1. sendMessage starts → assistantIndex = 1, messages = [user, assistant]
    // 2. resetMessages() → messages = []
    // 3. stream errors → onError fires → setMessages(prev => ...) where prev = []
    // 4. updated[1] is undefined → else branch (line 209) pushes a new error message
    let triggerStreamError: (err: Error) => void;
    const hangingStream = new ReadableStream({
      start(controller) {
        triggerStreamError = (err) => controller.error(err);
      },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: hangingStream,
    });

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("Question", {
        context: "",
        locale: "es",
        messageIndex: 0,
      });
    });

    // Messages should have user + assistant placeholder
    expect(result.current.messages).toHaveLength(2);

    // Reset messages while the stream is pending
    act(() => {
      result.current.resetMessages();
    });
    expect(result.current.messages).toEqual([]);

    // Trigger stream error — onError will see an empty messages array
    await act(async () => {
      triggerStreamError!(new Error("Stream read error"));
      await sendPromise!;
    });

    // else branch (line 209): pushed a new error message
    expect(result.current.error).toBe("No se pudo conectar. Por favor, inténtalo de nuevo.");
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      role: "assistant",
      content: "Lo siento, hubo un error. Intenta de nuevo.",
    });
  });

  it("outer catch: silently ignores AbortError thrown by fetch()", async () => {
    const abortError = new Error("AbortError");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "",
        locale: "es",
        messageIndex: 0,
      });
    });

    // AbortError from fetch() is silently returned (no error state, no crash)
    expect(result.current.error).toBeNull();
  });

  it("60-second timeout aborts the request and surfaces a connection-lost error (FE-H2)", async () => {
    vi.useFakeTimers();

    let resolvePromise!: (value: unknown) => void;
    const neverResolvingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(neverResolvingPromise);

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    // Advance 60 seconds — fires the timeout callback
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    // The AbortController abort fires — fetch rejects with AbortError
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    resolvePromise(Promise.reject(abortError));

    await act(async () => {
      await sendPromise;
    });

    vi.useRealTimers();

    // FE-H2: timeout should now surface an error and timeout message, not silently resolve
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe("Se perdió la conexión. Reintentar");
    expect(result.current.messages[1].content).toBe(
      "La respuesta tardó demasiado. Por favor, inténtalo de nuevo."
    );
  });

  it("FE-H2: 401 response sets auth error message", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.error).toBe(
      "Tu sesión ha expirado. Recarga la página para continuar."
    );
  });

  it("FE-H2: 500 response sets server error message", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.error).toBe(
      "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde."
    );
  });

  it("FE-H2: SSE response_timeout event shows timeout message", async () => {
    const encoder = new TextEncoder();
    const timeoutEvent = `data: ${JSON.stringify({ type: "error", message: "response_timeout" })}\n\n`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(timeoutEvent));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    await act(async () => {
      await result.current.sendMessage("Question", {
        context: "ctx",
        locale: "es",
        messageIndex: 0,
      });
    });

    expect(result.current.messages[1].content).toBe(
      "La respuesta tardó demasiado. Por favor, inténtalo de nuevo."
    );
  });

  it("FE-M3: 20-turn cap — sends new_chat_prompt instead of fetching when messages === MAX_CONVERSATION_TURNS*2", async () => {
    // Fill 20 turns (40 messages) via 20 successful sends, then verify
    // the 21st send is blocked and a new_chat_prompt message is appended.
    // Use a fast 1-word response to keep each round-trip minimal.
    for (let i = 0; i < 20; i++) {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Ok"));
    }

    const { result } = renderHook(() => useStreamChat({ canUseVoice: false }));

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await result.current.sendMessage(`Q${i}`, {
          context: "ctx",
          locale: "es",
          messageIndex: i,
        });
      });
    }

    // Should have exactly 40 messages (20 turns × 2)
    expect(result.current.messages).toHaveLength(40);

    // 21st send should be blocked
    mockFetch.mockReset();

    await act(async () => {
      await result.current.sendMessage("Over the limit", {
        context: "ctx",
        locale: "es",
        messageIndex: 20,
      });
    });

    // Fetch must NOT have been called
    expect(mockFetch).not.toHaveBeenCalled();
    // A new_chat_prompt assistant message should have been appended
    expect(result.current.messages).toHaveLength(41);
    const lastMsg = result.current.messages[40];
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.content).toBe(
      "Has alcanzado el límite de mensajes. Empieza un nuevo chat para continuar."
    );
  });
});
