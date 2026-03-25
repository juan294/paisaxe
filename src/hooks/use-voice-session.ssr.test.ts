// @vitest-environment node

/**
 * SSR-specific test for use-voice-session.
 *
 * Runs in Node.js environment (no window/DOM) to cover the SSR guard
 * on line 53: `if (typeof window === "undefined") return { conversationCount: 0 }`
 *
 * This branch is unreachable in jsdom because React DOM's renderHook requires
 * a browser-like environment. By using renderToString in Node, we exercise
 * the SSR code path that getStoredState uses when window is undefined.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { useVoiceSession } from "./use-voice-session";

describe("useVoiceSession SSR (node environment)", () => {
  it("should handle server-side rendering when window is undefined (line 53)", () => {
    // Verify we are in a node environment (no window)
    expect(typeof window).toBe("undefined");

    // Create a component that uses the hook and renders output
    function TestComponent() {
      const session = useVoiceSession();
      return React.createElement("div", {
        "data-count": session.conversationCount,
        "data-returning": String(session.isReturning),
        "data-language": session.preferredLanguage,
      });
    }

    // renderToString exercises useState(getStoredState) in a server context,
    // which hits the `typeof window === "undefined"` branch on line 52-53
    const html = renderToString(React.createElement(TestComponent));

    // The SSR guard returns { conversationCount: 0 }, so:
    expect(html).toContain('data-count="0"');
    expect(html).toContain('data-returning="false"');
    // In Node, navigator is also undefined, so preferredLanguage defaults to English
    expect(html).toContain('data-language="English"');
  });
});
