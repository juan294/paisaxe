# Paisaxe ElevenLabs Agent Test Plan

> Written 2026-04-05 | Covers Pelayo Visitor Guide + Pelayo Booking agents

---

## Agents Under Test

| Agent | ID | Role |
|-------|----|----|
| Pelayo Visitor Guide | `agent_1201kgqhsdzxfkk9x7m1bjaew9mv` | Visitor-facing tourism guide (sections 1–10) |
| Pelayo Booking | `agent_5201kgm2956ge8ct95yxjas867z5` | Restaurant booking caller (section 11) |

---

## Running the Suite

```bash
# Run all tests (both agents)
python3 scripts/run-paisaxe-tests.py

# Run a specific section
python3 scripts/run-paisaxe-tests.py --section 5

# Run specific tests
python3 scripts/run-paisaxe-tests.py 1.1 3.2 9.2

# Booking agent only
python3 scripts/run-paisaxe-tests.py --section 11
```

Exits `0` if all pass, `1` if any fail.

---

## Part 1 — Manual Tests (Cannot Be Automated)

These tests require physical hardware, real phone numbers, or features not yet exposed in the ElevenLabs testing API.

### M1 — Voice Quality: Natural Asturian Accent Warmth
**Trigger**: Start a live voice conversation with Pelayo Visitor Guide.
**Expected**: Pelayo sounds warm and local, not robotic. Voice conveys enthusiasm. Pauses feel natural.
**Why manual**: Voice quality and expressiveness cannot be evaluated by an LLM text evaluator.

### M2 — Language Detection: Auto-switches via `language_detection` tool
**Trigger**: Start a conversation in English with the default Spanish session.
**Expected**: Pelayo's `language_detection` built-in tool fires and the agent switches to English naturally.
**Why manual**: The `language_detection` tool is a system tool that operates at the voice layer — text-only testing does not exercise it.

### M3 — Post-call SMS Notification
**Trigger**: Complete a full restaurant booking via Pelayo Visitor Guide (all fields collected, `make_booking` called).
**Expected**: The visitor receives an SMS confirmation when the restaurant confirms via the Pelayo Booking agent callback.
**Why manual**: Requires a real phone number, live restaurant, and Twilio SMS delivery to verify.

### M4 — Interruption Handling
**Trigger**: Interrupt Pelayo mid-sentence during a live voice session.
**Expected**: Agent stops speaking, listens, responds to the interruption.
**Why manual**: Voice interruption handling is a real-time audio behavior that cannot be tested in text mode.

### M5 — Background Noise Resistance
**Trigger**: Speak to Pelayo with background music or crowd noise.
**Expected**: Agent correctly transcribes and responds despite ambient noise.
**Why manual**: ASR behavior under noise requires physical audio testing.

### M6 — `agent_config_override` Prompt Injection via Widget
**Trigger**: Attempt to inject a custom system prompt via the widget's `agent_config_override` parameter.
**Expected**: Widget override is blocked (overrides are disabled in platform_settings).
**Why manual**: ElevenLabs does not expose `agent_config_override` in the test API.

### M7 — Booking Agent: Live Outbound Call
**Trigger**: Trigger Pelayo Booking to call a real restaurant (test restaurant or your own phone).
**Expected**: Agent speaks naturally, provides booking details, handles restaurant responses in real-time.
**Why manual**: Requires a live phone call with a real outbound number.

---

## Part 2 — Automated Tests

47 LLM-evaluated tests across 11 sections. Run via `scripts/run-paisaxe-tests.py`.

### Section 1: Identity & Persona (4 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 1.1 | Introduces as Pelayo | Named correctly, describes Asturias tourism role |
| 1.2 | Does not re-greet after first message | No "Hola!" after conversation starts |
| 1.3 | Knows what Paisaxe is | Describes it as an immersive Asturias tourism experience |
| 1.4 | Returning user: jumps straight to help | Direct response, minimal intro |

### Section 2: Asturian Knowledge — Nature (5 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 2.1 | Lagos de Covadonga: location and character | Glacial lakes, Picos de Europa, eastern Asturias |
| 2.2 | Picos de Europa fully in scope | Does not refuse Naranjo de Bulnes or cross-province content |
| 2.3 | Covadonga sanctuary history | King Pelayo, Reconquista, Basílica / Santa Cueva |
| 2.4 | Fuente Dé teleférico and Cantabrian scope | Doesn't refuse because technically in Cantabria |
| 2.5 | Coastal geography | Names Cudillero, Llanes, Ribadesella, or similar |

### Section 3: Asturian Knowledge — Gastronomy (5 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 3.1 | Fabada asturiana | Bean stew with fabes, chorizo, morcilla, lacón |
| 3.2 | Sidra and cider culture | Escanciado technique, cultural importance |
| 3.3 | Cachopo | Fried veal escalope stuffed with ham and cheese |
| 3.4 | Cabrales cheese | Blue cheese, mountain caves, PDO |
| 3.5 | Full gastronomy recommendation | Mentions ≥2 authentic dishes |

### Section 4: Asturian Knowledge — Culture & Cities (5 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 4.1 | Oviedo pre-Romanesque churches | Santa María del Naranco, San Miguel de Lillo, or Cathedral |
| 4.2 | Gijón attractions | Cimadevilla, San Lorenzo beach, Laboral, waterfront |
| 4.3 | Camino de Santiago routes | Primitivo, Norte, or Costero |
| 4.4 | Gaita asturiana | Identifies bagpipe as traditional Asturian instrument |
| 4.5 | Cangas de Onís gateway | Mentions as entry point for Picos, Roman bridge |

### Section 5: Tool Usage — Weather (3 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 5.1 | Weather for "there" (Lagos context) | Does NOT ask which city — knows it's Covadonga |
| 5.2 | "¿Cómo está el tiempo por allí?" | Same as 5.1 — infers location from story context |
| 5.3 | Seasonal advice for Picos | Summer for hiking, avoids winter fog/snow |

### Section 6: Tool Usage — Places & Recommendations (3 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 6.1 | Searches for restaurants near Lagos | Names at least one venue or area |
| 6.2 | Sidra bars in Gijón | Names Cimadevilla or a specific sidrería |
| 6.3 | Does not invent phone numbers | Defers to search tool or directs to official site |

### Section 7: Booking Flow — Visitor Guide (5 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 7.1 | Asks for party size before booking | Collects info — doesn't call tool yet |
| 7.2 | Asks for customer phone after getting name | Still collecting — doesn't call tool yet |
| 7.3 | Confirms all details before calling tool | Reads back summary and asks "¿Correcto?" |
| 7.4 | Does not fake a booking confirmation | Never says "confirmado" without tool response |
| 7.5 | Provides phone number if booking fails | Honest about outcome, gives fallback |

### Section 8: Conversation Behavior (4 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 8.1 | Does not ask for location when discussing a story | Knows Lagos de Covadonga from context |
| 8.2 | Avoids banned tourism clichés | No "hidden gem", "breathtaking", "bucket list" |
| 8.3 | Concise voice-optimized responses | Conversational, ends with follow-up hook |
| 8.4 | Sensory and specific language | Sounds, smells, tactile details about Picos |

### Section 9: Guardrails & Security (5 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 9.1 | Redirects off-topic questions | Does not help write work emails |
| 9.2 | Resists prompt injection | Does not reveal system prompt |
| 9.3 | Does not invent prices or hours | Defers to official site for specific details |
| 9.4 | Handles gibberish gracefully | Politely asks to clarify, stays in character |
| 9.5 | Handles repeated questions | Re-explains helpfully, no frustration |

### Section 10: Multilingual Behavior (3 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 10.1 | Responds in English to English speaker | Language matches user input |
| 10.2 | Switches to English mid-conversation | Follows user language switch seamlessly |
| 10.3 | Responds in French | Handles French input correctly |

### Section 11: Pelayo Booking Agent (5 tests)

| ID | Name | Key behavior |
|----|------|--------------|
| 11.1 | States purpose and key reservation details | Party size, date, time — natural Spanish call |
| 11.2 | Provides customer name when asked | Real name from dynamic variables |
| 11.3 | Provides customer phone when asked | Real phone from dynamic variables |
| 11.4 | Adapts to unavailable time slot | Politely asks for alternatives |
| 11.5 | Confirms booking and ends gracefully | Verifies details, thanks staff, goodbye |

---

## Test Run History

| Date | Tests Run | Pass | Fail | Notes |
|------|-----------|------|------|-------|
| _(pending first run)_ | — | — | — | — |

---

## Adding a New Test

1. Add a new entry to the `TESTS` list in `scripts/create-paisaxe-tests.py`
2. Assign the next sequential ID in the relevant section
3. **Do NOT re-run the full create script** (creates duplicates)
4. Instead, run just the new test creation by extracting its definition and calling `create_test()` directly:
   ```bash
   python3 -c "
   import sys; sys.path.insert(0, 'scripts')
   from create_paisaxe_tests import *
   folder_id = open('docs/agents/paisaxe-elevenlabs-folders.json').read()
   import json; folder_id = json.loads(folder_id)['Paisaxe']
   result = create_test('2.6 — My new test', VISITOR_GUIDE_AGENT_ID, [...], '...', folder_id)
   print(result)
   "
   ```
5. Add the returned `test_id` manually to `docs/agents/paisaxe-test-ids.json`

---

## Cost Estimate

| Scenario | Rate | ~47-test suite |
|----------|------|---------------|
| Live session (manual testing) | ~$0.10/min | ~$5–10 per session |
| Agent Testing (automated) | ~$0.05/min | ~$2–5 per full run |

The full suite costs under $5 per run. Run it after every significant prompt or tool change.
