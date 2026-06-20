import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [react()],
  test: {
    // QA-M1: Default environment is jsdom (required for React component tests).
    //
    // Pure-logic modules under src/lib/ that have no DOM access can be run in
    // the faster 'node' environment to reduce jsdom churn. Vitest 4.x does not
    // support a global `environmentMatchGlobs` config option — per-file overrides
    // are applied using a docstring at the top of each test file:
    //
    //   // @vitest-environment node
    //
    // This pattern is already used in this codebase (see src/lib/claude.test.ts,
    // src/lib/costs/anthropic-costs.test.ts, etc.). To extend this optimisation,
    // add the docstring to any src/lib/**/*.test.ts that does NOT use:
    //   - document, window, HTMLElement, sessionStorage, localStorage
    //   - @testing-library/react, render(), screen
    //
    // Confirmed DOM-dependent exceptions (must stay jsdom):
    //   - src/lib/csrf-client.test.ts — reads document.cookie
    //   - src/lib/chat-upsell-throttle.test.ts — uses sessionStorage
    //
    // Incrementally applying the node docstring to pure-logic lib tests is
    // safe and non-breaking; each file is independently opted in.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    exclude: ["node_modules", "**/node_modules.nosync/**", "src/tests/qa/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/__mocks__/server-only.ts"),
      "@content": path.resolve(__dirname, "./content"),
      // content/processed/ is gitignored; use main repo copy when available,
      // otherwise fall back to a test stub so pipeline script tests don't fail.
      "../content/processed/extracted-stories": fs.existsSync(
        path.resolve(__dirname, "./content/processed/extracted-stories.ts")
      )
        ? path.resolve(__dirname, "./content/processed/extracted-stories.ts")
        : path.resolve(__dirname, "./scripts/tests/__stubs__/extracted-stories.ts"),
    },
  },
});
