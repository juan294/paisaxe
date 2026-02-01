import { defineConfig } from "vitest/config";
import path from "path";

// Dedicated config for QA/LLM tests - these are excluded from main config
// because they make real API calls and have longer timeouts
export default defineConfig({
  test: {
    include: ["src/tests/qa/**/*.test.ts"],
    testTimeout: 30000, // LLM calls can take a while
    hookTimeout: 10000,
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
