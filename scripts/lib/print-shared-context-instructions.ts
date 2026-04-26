/**
 * Prints the shared context instructions (read + write) to stdout.
 * Called by shell scripts via: npx tsx scripts/lib/print-shared-context-instructions.ts [read|write]
 */

const SHARED_CONTEXT_READ_INSTRUCTION = `
SHARED CONTEXT FROM OTHER AGENTS:
The following are recent findings from other automated agents. Use this context to:
- Avoid duplicating work already reported by other agents
- Cross-reference findings (e.g., if Security found a vulnerable dep, consider its performance impact)
- Add cross-agent recommendations in your report when relevant

If the shared context is empty, no other agents have reported recently.
`;

const SHARED_CONTEXT_WRITE_INSTRUCTION = `
SHARED CONTEXT OUTPUT:
At the very end of your report, include a summary block for other agents wrapped in these exact markers:

SHARED_CONTEXT_START
## [Your Agent Name] — [Date]
- [Key finding 1]
- [Key finding 2]

**Cross-agent recommendations:**
- [Agent Name]: [Recommendation]
SHARED_CONTEXT_END

This block will be extracted from your report and shared with other agents on their next run.
Keep it concise (5-10 lines max). Focus on findings that other agents would benefit from knowing.

FORMATTING RULES:
- Do NOT use emojis or pictographic characters anywhere in reports or shared context.
- Use plain text only. Rich text formatting (bold, italic, bullet points) is fine.
- Instead of checkmarks or status emojis, use words: "Pass", "Fail", "Complete", "Incomplete".
`;

const mode = process.argv[2];
if (!mode || !["read", "write"].includes(mode)) {
  process.stderr.write("Usage: print-shared-context-instructions.ts <read|write>\n");
  process.exit(1);
}

if (mode === "read") {
  process.stdout.write(SHARED_CONTEXT_READ_INSTRUCTION);
} else {
  process.stdout.write(SHARED_CONTEXT_WRITE_INSTRUCTION);
}
