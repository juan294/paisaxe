---
name: "Debug Mode"
description: "Multi-agent debugging workflow. Triggered by 'enter debug mode', 'debug this', or 'let's debug this'."
---

# Debug Mode (Agent Team)

**Trigger:** User says "enter debug mode", "debug this", or "let's debug this"

Create a team of parallel investigators to diagnose the issue:

1. **Assess complexity** — Simple bugs (single component, clear error): 3 investigators. Cross-cutting issues (multiple systems, intermittent): up to 5.

2. **Create team** called "debug-squad" with investigators, each assigned a different hypothesis:
   - Each investigator focuses on a different area (API / client / database / config / dependencies / etc.)
   - Each investigator must state their hypothesis upfront, then gather evidence
   - Investigators should actively try to disprove their own hypothesis
   - Time-boxed: if no evidence found after thorough investigation, report "hypothesis unlikely" and stop

3. **Synthesize findings** — After all investigators complete:
   - Rank hypotheses by evidence strength
   - Present the most likely root cause with supporting evidence
   - Propose a specific fix with code changes

4. **Do NOT auto-apply fixes** — Present the diagnosis and proposed fix to the user for approval. Only implement after the user confirms.

**Example team for a "chat responses are empty" bug:**
- Investigator 1: API route — check if the Claude API is being called correctly, verify request/response
- Investigator 2: Client-side — check if SSE parsing is working, verify state updates
- Investigator 3: Database/RAG — check if embeddings are being retrieved, verify search results
