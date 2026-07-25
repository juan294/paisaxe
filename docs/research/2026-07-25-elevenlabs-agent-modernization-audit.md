# ElevenLabs Agent Modernization Audit

**Date:** 2026-07-25
**Repository:** Paisaxe
**Phase:** Research only; no ElevenLabs or repository configuration was changed.

## Research question

What is the current ElevenLabs state of Paisaxe's five agents, including voice model, language, conversation timing, security, tools, knowledge, privacy, and dashboard modernization signals?

## Scope and evidence

The repository manifest maps five agents: Pelayo Visitor Guide, Pelayo Booking, Penny, Iris, and Xander (`agents.json:4-25`). Evidence was collected read-only from tracked files, ElevenLabs CLI 0.5.4 dry runs, authenticated agent/tool API readbacks on 2026-07-25, the signed-in Spotlight pages, and current official documentation.

`elevenlabs agents pull --dry-run --update --no-ui` reported five available manifest updates. No files were written and no Spotlight, Publish, or configuration action was taken.

## Live inventory

| Agent | LLM | TTS / Expressive | Voice | Languages | Timezone | Auth | Platform guardrails | Live tests/evals |
|---|---|---|---|---|---|---|---|---|
| Pelayo Visitor Guide | Gemini 2.5 Flash Lite | Multilingual v2 / off | Ignacio, Spanish/Galician | Spanish plus de/en/fr/it/pt/pt-br presets | Europe/Madrid | Off | Focus off; prompt injection off | 0 / 0 |
| Pelayo Booking | Gemini 2.5 Flash | Multilingual v2 / off | Ignacio, Spanish/Galician | Spanish | Europe/Madrid | Off | Focus off; prompt injection off | 0 / 0 |
| Penny | GPT-4o mini | Flash v2 / off | Alice, English/British | English | Unset | Off | Focus off; prompt injection off | 0 / 0 |
| Iris | GPT-4o mini | Flash v2 / off | Sarah, English/American | English | Unset | Off | Focus off; prompt injection off | 0 / 0 |
| Xander | GPT-4o mini | Flash v2 / off | Roger, English/American | English | Unset | Off | Focus off; prompt injection off | 0 / 0 |

The manifest IDs are recorded at `agents.json:4-25`. The tracked Pelayo Visitor turn-taking and Expressive Mode state appears at `agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:26-43`; Booking uses the same seven-second/normal/non-expressive profile (`agent_configs/Paisaxe-Pelayo-(Booking).json:11-28`). The three social agents use ten-second, normal, non-expressive Flash v2 profiles, for example Penny at `agent_configs/Paisaxe-Penny-(Pinterest).json:11-28`, Iris at `agent_configs/Paisaxe-Iris-(Instagram).json:11-28`, and Xander at `agent_configs/Paisaxe-Xander-(X).json:11-28`.

All five agents have the platform safety evaluation enabled, while the optional content/moderation categories are disabled in the live API.

## Dashboard recommendations

The Spotlight pages currently show both **High severity — Enable guardrails** and **Suggested — Try Eleven v3** for Pelayo Visitor Guide and Pelayo Booking. The three social agents show neither card in their current Spotlight pages. General workflow and platform discovery cards are separate from these agent-specific cards.

## Language, voice, and greeting context

Pelayo Visitor uses one Spanish/Galician voice for all configured languages. Its de/en/fr/it/pt/pt-br presets change localized first messages and consent text but do not contain per-language TTS voice overrides; the override schema records `voice_id=false` (`agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:628-688`). ElevenLabs documents language-specific voices as the route to natural regional pronunciation and notes that a voice can retain its original accent when speaking an untrained language:

- [Language customization](https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language)
- [Language and accent selection](https://elevenlabs.io/docs/help-center/product/speech-synthesis/text-to-speech/how-do-i-select-the-language-and-accent)

The application starts the session with Spanish or English as an explicit agent-language override and supplies story, locale, returning-user, time-of-day, and browser-local current-time variables (`src/components/immersive/voice-chat-elevenlabs.tsx:221-258`). The operational prompt uses `is_returning`, `time_of_day`, and `current_time` to select first-contact and returning-user greeting behavior (`docs/operations/elevenlabs-pelayo-config.md:54-90`).

The platform timezone is Madrid for the two Pelayo agents and unset for the social agents. ElevenLabs' `system__timezone` is user-provided context, not automatic visitor geolocation:

- [Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)
- [Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)

No built-in random greeting rotation feature was found in the current official documentation. The current documented surfaces are first-message templates, dynamic variables, language presets, and SDK/session overrides.

## Knowledge and tool state

Pelayo Visitor is the only Paisaxe agent with native RAG enabled. The published agent contains seven knowledge-base files; its tracked knowledge block starts at `agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:220` and RAG configuration at `agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:265-273`.

The live Visitor agent has authenticated webhook tools for weather, place search, and booking, plus the platform end-call and language-detection tools. The webhook definitions target Paisaxe production endpoints and include an `x-mcp-secret` header; secret values were not inspected or recorded. The account also retains older same-name tool definitions without that header and two tunnel-development tools, but those older tools are not attached to the published Visitor agent.

The tracked Paisaxe Visitor config contains an inline `save_favorite` tool (`agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:500`) that is absent from the published agent and from the Archy/Portfolio mirror copies. ElevenLabs documents webhook inputs, authentication, and request composition separately from agent prompting:

- [Webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools)
- [MCP security](https://elevenlabs.io/docs/eleven-agents/customization/tools/mcp/security)
- [Knowledge base](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base)
- [RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag)

## Safety, access, and privacy state

All five published agents have unauthenticated agent access and no required origin header. The tracked states are visible for Pelayo Visitor at `agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:825-827` and for the social agents at `agent_configs/Paisaxe-Penny-(Pinterest).json:307-309`, `agent_configs/Paisaxe-Iris-(Instagram).json:307-309`, and `agent_configs/Paisaxe-Xander-(X).json:307-309`.

Neither platform Focus nor prompt-injection guardrails is enabled on any of the five. Pelayo's prompt itself contains identity protection, tool sequencing, booking confirmation, scope, and spoken-output rules. ElevenLabs describes prompt-level constraints and platform guardrails as separate layers:

- [Guardrails](https://elevenlabs.io/docs/eleven-agents/best-practices/guardrails)
- [Prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide)
- [Authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication)

All five agents record voice, retain data indefinitely (`retention_days=-1`), and have zero-retention and history redaction disabled. Pelayo Visitor displays localized recording/storage consent terms (`agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json:594-673`). ElevenLabs treats recording, retention, redaction, and zero-retention as independent privacy controls:

- [Privacy](https://elevenlabs.io/docs/eleven-agents/customization/privacy)
- [Retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention)
- [Disclosure requirement](https://elevenlabs.io/docs/eleven-agents/legal/disclosure-requirement)

## Tests, evaluations, and versions

None of the five published agents has an attached ElevenLabs test or success-evaluation criterion. Paisaxe has a separate repository test plan, including microphone-dependent manual cases (`docs/agents/paisaxe-voice-agent-test-plan.md:8-30`, `docs/agents/paisaxe-voice-agent-test-plan.md:302-309`).

The manifest version IDs for the two Pelayo agents (`agents.json:4-12`) differ from the current published version IDs returned by the API. ElevenLabs supports branches, versions, and traffic experiments, but no staged v3 experiment is represented in the current repository manifest:

- [Agent testing](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing)
- [Success evaluation](https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/success-evaluation)
- [Versioning](https://elevenlabs.io/docs/eleven-agents/operate/versioning)
- [Experiments](https://elevenlabs.io/docs/eleven-agents/operate/experiments)

## Summary

Paisaxe has five published agents. The two Pelayo agents use Spanish/Galician voices and Madrid time context; the Visitor agent additionally has seven RAG files, production webhook tools, multilingual first-message presets, and application-supplied greeting/time context. All five have platform authentication and guardrails disabled, record voice indefinitely, and have no live tests or evaluators. The dashboard currently surfaces both guardrail and v3 cards for the two Pelayo agents, while the three inactive social agents show neither. The repository's Visitor tool set and manifest versions differ from the published API state.
