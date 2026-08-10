import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});

// Node 24+ (and 26) sets global.localStorage = undefined (experimental Web Storage
// API, needs --localstorage-file). In jsdom, window === global, so this instance-
// level undefined shadows jsdom's prototype getter, breaking any test that uses bare
// `localStorage`. Provide an in-memory Storage implementation when undefined.
if (typeof window !== "undefined" && global.localStorage === undefined) {
  let _store: Record<string, string> = {};
  const _mockStorage: Storage = {
    getItem: (key: string) =>
      Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
    setItem: (key: string, value: string) => {
      _store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete _store[key];
    },
    clear: () => {
      _store = {};
    },
    get length() {
      return Object.keys(_store).length;
    },
    key: (i: number) => Object.keys(_store)[i] ?? null,
  };
  Object.defineProperty(global, "localStorage", {
    value: _mockStorage,
    configurable: true,
    writable: true,
  });
}

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
