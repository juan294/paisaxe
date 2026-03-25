import { describe, it, expect, beforeEach } from "vitest";
import {
  canShowUpsell,
  recordUpsellShown,
  recordUpsellDismissed,
  resetUpsellThrottle,
} from "./chat-upsell-throttle";

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
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

Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

describe("chat-upsell-throttle", () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    resetUpsellThrottle();
  });

  describe("canShowUpsell", () => {
    it("returns true initially", () => {
      expect(canShowUpsell(0)).toBe(true);
    });

    it("returns true after one upsell shown", () => {
      recordUpsellShown();
      expect(canShowUpsell(5)).toBe(true);
    });

    it("returns false after max upsells shown (2)", () => {
      recordUpsellShown();
      recordUpsellShown();
      expect(canShowUpsell(10)).toBe(false);
    });

    it("returns false during cooldown period after dismissal", () => {
      recordUpsellDismissed(5);

      // Within 5 message cooldown
      expect(canShowUpsell(6)).toBe(false);
      expect(canShowUpsell(7)).toBe(false);
      expect(canShowUpsell(8)).toBe(false);
      expect(canShowUpsell(9)).toBe(false);
    });

    it("returns true after cooldown period ends", () => {
      recordUpsellDismissed(5);

      // After 5 message cooldown (5 + 5 = 10)
      expect(canShowUpsell(10)).toBe(true);
      expect(canShowUpsell(11)).toBe(true);
    });

    it("combines shown count and cooldown checks", () => {
      recordUpsellShown();
      recordUpsellDismissed(5);

      // During cooldown - should be false
      expect(canShowUpsell(7)).toBe(false);

      // After cooldown, but still under max - should be true
      expect(canShowUpsell(10)).toBe(true);

      // After second upsell shown
      recordUpsellShown();
      expect(canShowUpsell(15)).toBe(false); // Max reached
    });
  });

  describe("recordUpsellShown", () => {
    it("increments shown count", () => {
      expect(canShowUpsell(0)).toBe(true);

      recordUpsellShown();
      expect(canShowUpsell(0)).toBe(true); // Still under max

      recordUpsellShown();
      expect(canShowUpsell(0)).toBe(false); // Max reached
    });
  });

  describe("recordUpsellDismissed", () => {
    it("sets cooldown from the dismissed message index", () => {
      recordUpsellDismissed(10);

      // Messages 11-14 should be in cooldown
      expect(canShowUpsell(11)).toBe(false);
      expect(canShowUpsell(14)).toBe(false);

      // Message 15 should be after cooldown (10 + 5)
      expect(canShowUpsell(15)).toBe(true);
    });

    it("updates cooldown on subsequent dismissals", () => {
      recordUpsellDismissed(5);
      expect(canShowUpsell(8)).toBe(false);

      // Second dismissal at later index
      recordUpsellDismissed(15);
      expect(canShowUpsell(18)).toBe(false);
      expect(canShowUpsell(20)).toBe(true);
    });
  });

  describe("resetUpsellThrottle", () => {
    it("clears all throttle state", () => {
      recordUpsellShown();
      recordUpsellShown();
      recordUpsellDismissed(10);

      // Should be blocked
      expect(canShowUpsell(12)).toBe(false);

      // Reset
      resetUpsellThrottle();

      // Should be able to show upsells again
      expect(canShowUpsell(12)).toBe(true);
    });
  });

  describe("sessionStorage persistence", () => {
    it("persists state across function calls", () => {
      recordUpsellShown();

      // Simulate re-reading state
      expect(canShowUpsell(5)).toBe(true);

      recordUpsellShown();
      expect(canShowUpsell(5)).toBe(false);
    });

    it("handles corrupted sessionStorage gracefully", () => {
      sessionStorageMock.setItem("paisaxe-upsell-throttle", "invalid json{");

      // Should not throw and return default state
      expect(canShowUpsell(0)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles message index 0", () => {
      expect(canShowUpsell(0)).toBe(true);
      recordUpsellDismissed(0);
      expect(canShowUpsell(3)).toBe(false);
      expect(canShowUpsell(5)).toBe(true);
    });

    it("handles very large message indices", () => {
      recordUpsellShown();
      expect(canShowUpsell(1000000)).toBe(true);
    });

    it("handles dismissal at message 0 with check at message 0", () => {
      recordUpsellDismissed(0);
      expect(canShowUpsell(0)).toBe(false);
    });
  });

  describe("SSR safety", () => {
    it("handles missing window/sessionStorage gracefully", () => {
      // This is tested implicitly by the mock, but we can verify
      // the functions don't throw when called
      expect(() => {
        canShowUpsell(0);
        recordUpsellShown();
        recordUpsellDismissed(5);
        resetUpsellThrottle();
      }).not.toThrow();
    });

    it("returns default state when window is undefined (SSR)", () => {
      // Temporarily make typeof window === "undefined" to cover getState SSR branch
      const originalWindow = globalThis.window;
      // @ts-expect-error - intentionally setting window to undefined for SSR test
      delete globalThis.window;

      try {
        // canShowUpsell internally calls getState(), which returns defaults when no window
        expect(canShowUpsell(0)).toBe(true);
        // recordUpsellShown calls getState() + saveState() — both bail out on SSR
        recordUpsellShown();
        // resetUpsellThrottle bails out when no window
        resetUpsellThrottle();
      } finally {
        // Restore window
        globalThis.window = originalWindow;
      }
    });
  });
});
