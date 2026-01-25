import "@testing-library/jest-dom/vitest";

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.VOYAGE_API_KEY = "test-voyage-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = () => {};

// Mock window.SpeechRecognition
Object.defineProperty(window, "SpeechRecognition", {
  value: undefined,
  writable: true,
});
Object.defineProperty(window, "webkitSpeechRecognition", {
  value: undefined,
  writable: true,
});
