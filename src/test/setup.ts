import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.VOYAGE_API_KEY = "test-voyage-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.NEXT_PUBLIC_SITE_URL = "https://paisaxe.es";

// DOM-specific mocks (skip when running in node environment)
if (typeof Element !== "undefined") {
  // Mock scrollIntoView for jsdom
  Element.prototype.scrollIntoView = () => {};

  // Mock IntersectionObserver for jsdom
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly scrollMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(
      private callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit
    ) {}

    observe(target: Element): void {
      // Immediately trigger callback with isIntersecting: true for testing
      this.callback(
        [
          {
            isIntersecting: true,
            target,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRatio: 1,
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now(),
          },
        ],
        this
      );
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  global.IntersectionObserver = MockIntersectionObserver;
}

if (typeof window !== "undefined") {
  // Mock window.SpeechRecognition
  Object.defineProperty(window, "SpeechRecognition", {
    value: undefined,
    writable: true,
  });
  Object.defineProperty(window, "webkitSpeechRecognition", {
    value: undefined,
    writable: true,
  });

  // Mock window.matchMedia (not available in jsdom)
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
