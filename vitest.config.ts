import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [react()],
  test: {
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
