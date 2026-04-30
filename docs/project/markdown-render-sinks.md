# Markdown Render Sinks

Registry of every `react-markdown` usage in the Paisaxe codebase.

## Rules

- Do not use `rehype-raw`.
- Do not use `allowDangerousHtml`.
- Use either an `allowedElements` allowlist or explicit `components` overrides.
- Add new sinks to this document and cover them in [`e2e/xss-canary.spec.ts`](../../e2e/xss-canary.spec.ts).

## Registered Sinks

### `src/components/immersive/voice-chat/chat-message-list.tsx`

- Purpose: render assistant chat responses in the immersive chat panel.
- Defense shape: explicit `components` overrides for `p`, `strong`, `ul`, `ol`, `li`, and `a`.
- Raw HTML: not enabled.
- Dangerous HTML prop: not used.
- Note: Previously in `src/components/immersive/voice-chat.tsx`; extracted during FE-M1 monolith split.

### `src/components/admin/agents-dashboard/safe-markdown.tsx`

- Purpose: render LLM-generated reports in the admin agents dashboard.
- Defense shape: `allowedElements` allowlist plus `unwrapDisallowed`.
- Raw HTML: not enabled.
- Dangerous HTML prop: not used.
