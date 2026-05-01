import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatMode } from "./use-chat-mode";

describe("useChatMode", () => {
  describe("initial state", () => {
    it("defaults to text mode (useElevenLabs = false) when not provided", () => {
      const { result } = renderHook(() => useChatMode());
      expect(result.current.useElevenLabs).toBe(false);
    });

    it("respects the provided initial value", () => {
      const { result } = renderHook(() => useChatMode(true));
      expect(result.current.useElevenLabs).toBe(true);
    });
  });

  describe("toggle", () => {
    it("toggles from false to true", () => {
      const { result } = renderHook(() => useChatMode(false));
      act(() => {
        result.current.toggle();
      });
      expect(result.current.useElevenLabs).toBe(true);
    });

    it("toggles from true to false", () => {
      const { result } = renderHook(() => useChatMode(true));
      act(() => {
        result.current.toggle();
      });
      expect(result.current.useElevenLabs).toBe(false);
    });

    it("can toggle multiple times", () => {
      const { result } = renderHook(() => useChatMode(false));
      act(() => result.current.toggle());
      expect(result.current.useElevenLabs).toBe(true);
      act(() => result.current.toggle());
      expect(result.current.useElevenLabs).toBe(false);
      act(() => result.current.toggle());
      expect(result.current.useElevenLabs).toBe(true);
    });
  });

  describe("setUseElevenLabs", () => {
    it("sets to true explicitly", () => {
      const { result } = renderHook(() => useChatMode(false));
      act(() => {
        result.current.setUseElevenLabs(true);
      });
      expect(result.current.useElevenLabs).toBe(true);
    });

    it("sets to false explicitly", () => {
      const { result } = renderHook(() => useChatMode(true));
      act(() => {
        result.current.setUseElevenLabs(false);
      });
      expect(result.current.useElevenLabs).toBe(false);
    });
  });
});
