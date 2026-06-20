import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import vitestPlugin from "@vitest/eslint-plugin";

export default [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    // Warn on skipped tests so they don't accumulate silently.
    // Using "warn" (not "error") so pre-existing skips don't break CI.
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      "vitest/no-disabled-tests": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    // Ban console.* in production source paths. Server modules use the pino
    // logger (@/lib/logger); client-bundled modules use @/lib/client-logger.
    files: [
      "src/app/api/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
    ],
    ignores: [
      // The logger implementations are the one legitimate console sink.
      "src/lib/logger.ts",
      "src/lib/client-logger.ts",
      // Tests assert on log output and may use console directly.
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            "Use the shared logger from @/lib/logger (server) or @/lib/client-logger (client) instead of console.*. See docs/plans/2026-04-20-engineering-audit-remediation-phases/phase-3.md.",
        },
      ],
    },
  },
];
