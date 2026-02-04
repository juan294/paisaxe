import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceSession, getTimeOfDay } from "./use-voice-session";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("useVoiceSession", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return conversation count of 0 on first use", () => {
    const { result } = renderHook(() => useVoiceSession());

    expect(result.current.conversationCount).toBe(0);
    expect(result.current.isReturning).toBe(false);
  });

  it("should increment conversation count", () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.incrementConversation();
    });

    expect(result.current.conversationCount).toBe(1);
    expect(result.current.isReturning).toBe(true);
  });

  it("should persist conversation count across re-renders", () => {
    const { result, rerender } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.incrementConversation();
      result.current.incrementConversation();
    });

    expect(result.current.conversationCount).toBe(2);

    rerender();

    expect(result.current.conversationCount).toBe(2);
  });

  it("should reset conversation count", () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.incrementConversation();
      result.current.incrementConversation();
    });

    expect(result.current.conversationCount).toBe(2);

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.conversationCount).toBe(0);
    expect(result.current.isReturning).toBe(false);
  });

  it("should return user locale from navigator", () => {
    // Mock navigator.language
    Object.defineProperty(navigator, "language", {
      value: "es-ES",
      configurable: true,
    });

    const { result } = renderHook(() => useVoiceSession());

    expect(result.current.userLocale).toBe("es-ES");
  });

  it("should detect Spanish as preferred language", () => {
    Object.defineProperty(navigator, "language", {
      value: "es-ES",
      configurable: true,
    });

    const { result } = renderHook(() => useVoiceSession());

    expect(result.current.preferredLanguage).toBe("Spanish");
  });

  it("should detect English as preferred language for non-Spanish locales", () => {
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });

    const { result } = renderHook(() => useVoiceSession());

    expect(result.current.preferredLanguage).toBe("English");
  });

  it("should detect French locale and default to English", () => {
    Object.defineProperty(navigator, "language", {
      value: "fr-FR",
      configurable: true,
    });

    const { result } = renderHook(() => useVoiceSession());

    expect(result.current.preferredLanguage).toBe("English");
  });
});

describe("getTimeOfDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return morning for 6am", () => {
    vi.setSystemTime(new Date("2024-01-15T06:00:00"));
    expect(getTimeOfDay()).toBe("morning");
  });

  it("should return morning for 11am", () => {
    vi.setSystemTime(new Date("2024-01-15T11:59:00"));
    expect(getTimeOfDay()).toBe("morning");
  });

  it("should return afternoon for 12pm", () => {
    vi.setSystemTime(new Date("2024-01-15T12:00:00"));
    expect(getTimeOfDay()).toBe("afternoon");
  });

  it("should return afternoon for 5pm", () => {
    vi.setSystemTime(new Date("2024-01-15T17:59:00"));
    expect(getTimeOfDay()).toBe("afternoon");
  });

  it("should return evening for 6pm", () => {
    vi.setSystemTime(new Date("2024-01-15T18:00:00"));
    expect(getTimeOfDay()).toBe("evening");
  });

  it("should return evening for 11pm", () => {
    vi.setSystemTime(new Date("2024-01-15T23:00:00"));
    expect(getTimeOfDay()).toBe("evening");
  });

  it("should return evening for 5am (late night)", () => {
    vi.setSystemTime(new Date("2024-01-15T05:00:00"));
    expect(getTimeOfDay()).toBe("evening");
  });
});
