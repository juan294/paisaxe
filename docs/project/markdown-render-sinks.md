# Markdown Render Sinks

Registry of every markdown rendering sink in the Paisaxe codebase.

## Rules

- Do not render raw HTML from markdown.
- Do not emit anchors unless the renderer explicitly validates safe URL protocols.
- Keep renderer feature sets intentionally small and covered by unit tests.
- Add new sinks to this document and cover them in [`e2e/xss-canary.spec.ts`](../../e2e/xss-canary.spec.ts).

## Registered Sinks

### `src/components/immersive/voice-chat/chat-markdown.tsx`

- Purpose: render assistant chat responses in the immersive chat panel.
- Defense shape: delegates to `BasicMarkdown` with links enabled; link hrefs must pass the safe protocol allowlist.
- Raw HTML: not enabled.
- Dangerous HTML prop: not used.
- Note: Previously in `src/components/immersive/voice-chat.tsx`; extracted during FE-M1 monolith split.

### `src/components/admin/agents-dashboard/safe-markdown.tsx`

- Purpose: render LLM-generated reports in the admin agents dashboard.
- Defense shape: delegates to `BasicMarkdown` with links disabled.
- Raw HTML: not enabled.
- Dangerous HTML prop: not used.

### `src/components/markdown/basic-markdown.tsx`

- Purpose: shared small-subset markdown renderer for safe first-party sinks.
- Defense shape: React text rendering by default, no `dangerouslySetInnerHTML`, no raw HTML parsing, safe protocol allowlist for sinks that opt into links.
- Raw HTML: not enabled.
- Dangerous HTML prop: not used.
