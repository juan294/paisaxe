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
    files: ["src/app/api/**/*.ts"],
    ignores: [
      "src/app/api/admin/agent-config/route.ts",
      "src/app/api/admin/agents-summary/route.ts",
      "src/app/api/admin/analytics/route.ts",
      "src/app/api/admin/costs-analytics/*/route.ts",
      "src/app/api/admin/elevenlabs-analytics/route.ts",
      "src/app/api/admin/feature-flags/*/route.ts",
      "src/app/api/admin/github-analytics/route.ts",
      "src/app/api/admin/marketing/agent-logs/route.ts",
      "src/app/api/admin/marketing/agent/route.ts",
      "src/app/api/admin/marketing/dashboard/route.ts",
      "src/app/api/admin/stories/*/content-images/route.ts",
      "src/app/api/admin/stories/*/image-source/route.ts",
      "src/app/api/admin/stories/*/image/route.ts",
      "src/app/api/admin/stories/*/route.ts",
      "src/app/api/admin/stories/*/status/route.ts",
      "src/app/api/admin/stories/approve-all/route.ts",
      "src/app/api/admin/stories/bulk-delete/route.ts",
      "src/app/api/admin/stories/bulk-status/route.ts",
      "src/app/api/admin/stripe-analytics/route.ts",
      "src/app/api/admin/suggestions/*/route.ts",
      "src/app/api/admin/suggestions/route.ts",
      "src/app/api/chat/route.ts",
      "src/app/api/chat/stream/route.ts",
      "src/app/api/checkout/day-pass/route.ts",
      "src/app/api/checkout/embedded/route.ts",
      "src/app/api/cron/content-discovery/route.ts",
      "src/app/api/cron/subscription-optimizer/route.ts",
      "src/app/api/favorites/route.ts",
      "src/app/api/feature-flags/route.ts",
      "src/app/api/suggestions/route.ts",
      "src/app/api/voice-access/route.ts",
      "src/app/api/webhooks/supabase/route.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            "Use the shared logger from @/lib/logger instead of console.* in API routes. See docs/plans/2026-04-20-engineering-audit-remediation-phases/phase-3.md.",
        },
      ],
    },
  },
];
