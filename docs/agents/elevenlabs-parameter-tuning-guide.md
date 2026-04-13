# ElevenLabs Agent Parameter Tuning — Methodology Guide

> Written 2026-04-05 | Based on Paisaxe / Pelayo Visitor Guide tuning session
>
> Use this guide whenever you want to systematically find the best combination of
> temperature, model, RAG settings, or any other agent parameter — for any ElevenLabs
> conversational AI agent.

---

## The Core Insight

ElevenLabs Agent Testing runs at **~$0.05/min** — half the standard ConvAI rate (~$0.10/min).
That means you can run a full suite of 40–60 tests for $2–4, push a config change via CLI,
and re-run in minutes. This creates a fast, cheap tuning loop that would otherwise require
hours of manual voice testing or days of production observation.

Combined with the ElevenLabs CLI (`elevenlabs agents push`), you can change any agent
parameter programmatically, push the change in seconds, and have a test verdict in under
5 minutes — all without touching the dashboard.

This is the mechanism. The rest of this guide is how to use it deliberately.

---

## What You Can Tune

Any field in your `agent_configs/*.json` that affects behavior is a candidate. The most
impactful ones:

### LLM Settings

| Parameter | Path | What it controls | Typical range |
|-----------|------|-----------------|---------------|
| `temperature` | `prompt.temperature` | Randomness / creativity vs. determinism | 0.0 – 1.0 |
| `max_tokens` | `prompt.max_tokens` | Maximum response length | 100 – 2000 |
| `llm` | `prompt.llm` | The underlying model | `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `claude-3-5-haiku`, etc. |
| `thinking_budget` | `prompt.thinking_budget` | Extended reasoning tokens (Gemini) | 0 – 8192 |

### RAG / Knowledge Base

| Parameter | Path | What it controls |
|-----------|------|-----------------|
| `max_vector_distance` | `rag.max_vector_distance` | How similar a chunk must be to be retrieved (lower = stricter) |
| `max_retrieved_rag_chunks_count` | `rag.max_retrieved_rag_chunks_count` | How many knowledge chunks get injected |
| `max_documents_length` | `rag.max_documents_length` | Token budget for retrieved context |
| `embedding_model` | `rag.embedding_model` | Embedding model used for retrieval |

### Turn / Conversation

| Parameter | Path | What it controls |
|-----------|------|-----------------|
| `turn_timeout` | `turn.turn_timeout` | Seconds before agent assumes user is done |
| `turn_eagerness` | `turn.turn_eagerness` | `low` / `normal` / `high` — how quickly agent responds |
| `cascade_timeout_seconds` | `prompt.cascade_timeout_seconds` | Max wait for tool call before fallback |

### Voice / TTS

| Parameter | Path | What it controls |
|-----------|------|-----------------|
| `stability` | `tts.stability` | Voice consistency vs. expressiveness |
| `speed` | `tts.speed` | Speaking pace |
| `similarity_boost` | `tts.similarity_boost` | Adherence to reference voice |

---

## The Tuning Loop

```
┌──────────────────────────────────────────────────────────┐
│  1. Baseline run — understand current pass rate           │
│     python3 scripts/run-{project}-tests.py               │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  2. Change ONE parameter in agent_configs/*.json          │
│     (e.g. temperature: 0.65 → 0.3)                      │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  3. Push to ElevenLabs (no dashboard needed)              │
│     npm run agents:push                                   │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  4. Run targeted tests                                    │
│     python3 scripts/run-{project}-tests.py --section N   │
│     or run the full suite                                │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  5. Read the results — look for patterns, not just totals │
│     (see Interpreting Results below)                     │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  6. Repeat with next value or next parameter              │
│     until pass rate stops improving                      │
└──────────────────────────────────────────────────────────┘
```

### The script workflow

```bash
# 1. Edit agent config
vim agent_configs/MyProject-Agent.json   # change temperature, model, etc.

# 2. Push without touching the dashboard
npm run agents:push

# 3. Test one section to validate (fast, cheap)
python3 scripts/run-myproject-tests.py --section 3

# 4. Full suite if section looks good
python3 scripts/run-myproject-tests.py

# 5. Results written automatically to docs/agents/*-test-plan.md
```

---

## Interpreting Results — Failure Patterns

Don't just look at the total. The pattern of which tests fail reveals *why*:

### Pattern: "incomplete sentence fragment"

```
[2.1] FAIL — "The response is an incomplete sentence..."
[4.3] FAIL — "The response is an incomplete sentence..."
[8.3] FAIL — "The response is an incomplete sentence..."
```

**What it means**: The agent started a response, then deferred to a tool call (RAG, search_places).
The test framework captured the in-progress tool call as the final response — evaluating a fragment.

**Root cause**: The model is calling tools instead of answering from base knowledge.

**Levers**:
- *Raise* temperature → model becomes less deterministic, sometimes answers from base knowledge instead of always calling RAG
- Tighten the prompt's tool-use instructions to restrict tool calls to specific triggers
- Check your RAG `max_vector_distance` — if it's too permissive, the agent retrieves constantly

---

### Pattern: Failures concentrated in a specific section

```
Section 7 (booking flow): 3 FAIL
Section 9 (guardrails): 0 FAIL
Section 3 (gastronomy): 0 FAIL
```

**What it means**: The problem is specific to one behavior type. This is your signal to focus
prompt changes and parameter tuning on that section rather than making global changes.

**Run section-only tests** while tuning to get feedback in ~2 min instead of 10 min:

```bash
python3 scripts/run-myproject-tests.py --section 7
```

---

### Pattern: Isolation pass, batch fail

Same test passes when run alone but fails in the full 40+ test batch.

**What it means**: The batch run saturates the RAG system or agent infrastructure. Tool calls
that complete in isolation time out when 40 tests run simultaneously.

**Implications**:
- Don't tune purely based on batch results for tool-dependent tests
- Run failing tests in isolation (`python3 scripts/run.py 2.1 4.3`) to know if they're
  genuinely broken or just batch-sensitive
- Batch-sensitive failures are usually infrastructure artifacts — they pass in live sessions

---

### Pattern: Flipping between runs (same config)

```
Run 1: 7.3 PASS, 9.4 FAIL
Run 2: 7.3 FAIL, 9.4 PASS
```

**What it means**: These tests are at the boundary of the current temperature setting.
The model's output for these prompts varies enough that it's sometimes above the evaluator's
pass threshold and sometimes below.

**Levers**:
- If you want the test to *reliably* pass: lower temperature (more deterministic)
- If lowering temperature causes other tests to fail: the test itself may need a more robust
  success condition, or the prompt behavior needs to be made less ambiguous
- Two or three consecutive runs of a flaky test reveal its true pass rate at that temperature

---

## Temperature — The Dominant Variable

Temperature is the most impactful single parameter and the first one worth tuning.
Here is what the Paisaxe / Pelayo case study revealed, which generalizes broadly:

### The Temperature vs. Tool-Use Tradeoff

| Temperature | Behavior | Result in testing |
|-------------|----------|-------------------|
| Low (0.0–0.2) | Deterministic — model picks the "safest" path every time | Consistently calls RAG/tools even for questions it could answer from base knowledge. Procedural compliance improves (booking flow, guardrails) but knowledge tests fragment. |
| Medium (0.3–0.5) | Moderately deterministic | Mixed: procedural tasks more reliable, but knowledge tests may still fragment. Less responsive to creative/sensory prompts. |
| High (0.6–0.8) | Creative — model explores more options | Sometimes answers from base knowledge (no tool call → no fragment), sometimes calls RAG. Knowledge tests pass more often in batch runs. Procedural tasks may be flaky. |
| Very high (0.9–1.0) | Unpredictable | Quality degrades. Avoid for production agents. |

### The Key Insight (from Paisaxe)

**Lower temperature does not automatically mean better test results.** If your agent has an
active RAG knowledge base, low temperature makes the model *always* defer to retrieval. When
retrieval is the bottleneck (batch tests, high concurrency), this produces more failures — the
opposite of what you'd expect.

The sweet spot for RAG-heavy agents is typically **0.5–0.7**:
- High enough that the model sometimes answers from its own knowledge (no RAG latency)
- Low enough that procedural behaviors (multi-step flows, confirmation steps) are reliable

For agents without RAG (pure conversation, no knowledge base), lower temperatures are safe
and often better for compliance-critical flows.

### Bisect to Find the Sweet Spot

Don't guess. Bisect:

```
0.65 → baseline
0.2  → worse (too many RAG calls)
0.4  → also worse
→ Conclusion: 0.65 is the sweet spot for this agent/infrastructure combination
```

Run at 0.65, 0.3, and 0.8. Pick the best. Then narrow: if 0.65 > 0.3 and 0.65 > 0.8,
you've found it. If the ordering is different, bisect toward the winner.

---

## Isolation vs. Batch Testing Strategy

Use both modes deliberately:

```bash
# Isolation: run 1–3 tests to see exact agent behavior
python3 scripts/run-myproject-tests.py 7.3
python3 scripts/run-myproject-tests.py 7.3 7.5 9.2

# Section: test one behavioral dimension (2–5 min, ~$0.50)
python3 scripts/run-myproject-tests.py --section 7

# Full batch: final verification and overall score (~5–15 min, $2–4)
python3 scripts/run-myproject-tests.py
```

**Workflow during active tuning:**
1. Make a parameter change
2. Run isolation test on the specific failing test → fast feedback (30 sec)
3. If it passes in isolation, run the section → confirms no regressions in that behavior area
4. If section passes, run the full suite → final check

**Full suite only** when you're satisfied with isolated and section results. Avoid running the
full suite on every parameter change — it's slow and the noise from batch infrastructure
effects can be misleading.

---

## Model Selection

Swapping the underlying LLM is a high-impact lever. Update `prompt.llm` in the config:

```json
"llm": "gemini-2.5-flash-lite"   // fast, cheap, limited base knowledge
"llm": "gemini-2.5-flash"        // slower, better knowledge depth
"llm": "claude-3-5-haiku-20251001" // Anthropic model, different behavior profile
```

**When to try a model change:**
- Fragment failures persist across temperature values → the base model may lack knowledge
- Procedural compliance is consistently bad → try a model with stronger instruction-following
- Latency is unacceptable in live sessions → try a lighter model

Model changes require the same push-and-test loop. Each model has different temperature
characteristics — re-tune temperature after switching models.

---

## RAG Settings — The Other Dimension

If fragments persist regardless of temperature, the RAG system itself may be the issue.
Try these in order:

```json
// Less permissive retrieval (only retrieve when highly confident)
"max_vector_distance": 0.4   // was 0.6 — stricter similarity threshold

// Fewer but higher-quality chunks
"max_retrieved_rag_chunks_count": 10   // was 20

// More context per chunk
"max_documents_length": 80000   // was 50000
```

**Signs RAG is the bottleneck:**
- Tests that require specific local knowledge consistently fail
- The same test passes in isolation but fails in batches (RAG under load)
- Evaluator notes say "incomplete" or "only repeats the query"

**Signs the agent's base knowledge is sufficient:**
- General knowledge tests pass reliably
- RAG-tuning changes make no difference

---

## Multi-Parameter Experiments

Once you have one parameter stable, you can run experiments varying two parameters.
Keep it structured:

```
Experiment: temperature × model
            gemini-2.5-flash-lite  gemini-2.5-flash
temp=0.3         baseline A             B
temp=0.65           C                   D   ← pick the winner
```

Run each cell as a full suite. Compare pass rates. The winning cell is your next baseline.

Avoid changing more than two parameters per experiment — you'll lose the ability to understand
which change caused which result.

---

## Cost Budgeting

| Scope | Tests | Approx. cost | Time |
|-------|-------|--------------|------|
| Single test (isolation) | 1 | < $0.05 | 30–60 sec |
| Section run | 5–10 | $0.10–0.30 | 1–3 min |
| Full suite | 40–60 | $2–4 | 5–15 min |
| Full tuning session (8–12 full runs) | 400–600 | $15–40 | 1–3 hours |

A complete tuning session covering temperature, max_tokens, and RAG settings costs $15–40.
That is the price of one hour of a developer's time — for a result that would otherwise require
days of production observation or hundreds of manual live sessions.

---

## When to Use This Methodology

### Use it when:

- **Launching a new agent** — establish a performance baseline before going live
- **Changing the LLM model** — models have different behavior profiles; re-tune after every model swap
- **After significant prompt changes** — verify that prompt improvements didn't regress other behaviors
- **Debugging a specific behavior** — write a targeted test case, tune, re-run
- **Optimizing for latency** — adjust `turn_eagerness`, `cascade_timeout_seconds`, and model to find the responsiveness sweet spot
- **Adjusting voice expressiveness** — tune `stability` and `speed` with test cases checking natural delivery

### Don't use it when:

- The behavior you're testing is inherently voice-only (interruption handling, background noise)
- The test requires a real external system (live restaurant reservation, Telegram delivery)
- You're testing something that only makes sense with a real human user in the loop

Those cases belong in the Manual Tests section of your test plan — no automated evaluation
can substitute for them.

---

## Encoding Results in the Test Plan

After each tuning session, record the experiment in your `{project}-voice-agent-test-plan.md`:

```markdown
## Test Run History

| Date | Scope | Pass | Fail | Notes |
|------|-------|------|------|-------|
| 2026-04-05 | full suite, temp=0.65 | 34 | 11+2err | Best run — baseline |
| 2026-04-05 | full suite, temp=0.20 | 32 | 13+2err | More RAG calls → more fragments |
| 2026-04-05 | full suite, temp=0.40 | 26 | 18+3err | Worst — do not use |
| 2026-04-05 | full suite, temp=0.65 reverted | 28 | 17+2err | Confirmed 0.65 as optimal |
```

This makes the parameter decision traceable. Future developers (and future-you) can see why
the temperature is 0.65 and what was tested to arrive at that conclusion.

---

## Quick-Reference Checklist

When starting a tuning session:

- [ ] Baseline run complete — you know the current pass rate
- [ ] Failing tests categorized: fragment? flaky? consistent FAIL?
- [ ] Isolation tests run on failing tests — you know which fail in isolation vs. only in batch
- [ ] One parameter identified to change first
- [ ] Config pushed via CLI (not dashboard)
- [ ] Section run to validate before full suite
- [ ] Results recorded in test plan run history
- [ ] Commit config change with the reasoning documented in the commit message

---

## Appendix: The Paisaxe Temperature Case Study

**Agent**: Pelayo Visitor Guide (Paisaxe)
**Model**: gemini-2.5-flash-lite
**RAG**: enabled, 7 knowledge base files, 20 chunks max

| Temperature | Full suite pass rate | Key failure pattern |
|-------------|---------------------|---------------------|
| 0.65 (original) | 28–34 / 47 | Fragment failures on ~30% of knowledge tests in batch; flaky on procedural tasks |
| 0.20 | 32 / 47 | Fragment failures on ~60% of knowledge tests (model always calls RAG) |
| 0.40 | 26 / 47 | Worst result — most RAG-dependent failures + new procedural failures |
| 0.65 (final) | 28–34 / 47 | Optimal: sometimes answers from base knowledge, sometimes RAG |

**Conclusion**: For RAG-enabled agents on gemini-2.5-flash-lite, temperature 0.65 is the
sweet spot. Lower temperatures increase determinism but amplify RAG dependency, which is a
bottleneck under batch test load.

The batch test environment revealed a non-obvious insight: RAG contention under load shows up
as fragment failures. This is only visible when you run many tests simultaneously. A single
live session would never surface it.
