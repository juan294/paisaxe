# Can Jev make Paisaxe more useful, reliable and fast?

Date: 2026-10-28. Repository: `/Users/juan/code/paisaxe`. Integration branch: `develop`. Assessed source: `26c624adce298a98d15ef123b902a4a13d2134bb`. Workflow: `rpi-assess`, following the explicitly requested `rpi-research`. [Current-state research and documentation coverage](2026-10-28-jev-capabilities-and-paisaxe.md).

## Recommendation

**Yes: Jev merits a bounded evaluation for semantic decisions in Paisaxe. Adoption is YELLOW: technically plausible, with benefits unmeasured.** The strongest opportunities are developer evaluation tools, booking interpretation, telephone-outcome analysis, and evidence-aware discovery. A general replacement of the existing AI stack is not supported by the evidence.

Start with an offline developer decision inspector that compares the current behavior with typed Jev judgments on labelled cases. Its first useful cases are call outcomes and claim/evidence support. The best subsequent performance experiment is booking intake: remove a generative tool-selection iteration for straightforward requests while preserving the existing validated tools. The best new visitor feature is matching an explicit request to a short list of verified experiences, showing both supported matches and unknown requirements.

This recommendation is based on source compatibility and documented capabilities, not a live Jev benchmark. No model calls, application changes or account mutations were made.

## Evaluation criteria

The decision is whether Jev adds value relative to the existing implementation and simpler alternatives. Criteria are Spanish/Asturian correctness, unknown-case handling, task completion, developer diagnosis time, end-to-end latency, total cost, operational failure behavior, maintainability, data handling and migration risk.

Paisaxe's charter centers on simple, conversational Asturias discovery and source attribution (`docs/project/project-charter.md:15`, `docs/project/project-charter.md:73`, `docs/project/project-charter.md:94`). Developer usefulness here means inspectable application decisions and reusable domain interfaces. A general developer platform is a possible later product decision, not an assumed change to that charter.

## Ranked opportunities

The order below is an assessment judgment, not a measured ROI ranking. Relative effort includes evaluation and integration, not just an SDK call.

| ID | Opportunity | Expected benefit if validated | Main cost/counterevidence | Disposition |
| --- | --- | --- | --- | --- |
| J1 | Developer decision inspector and semantic evaluation assistant | Faster diagnosis; reusable cases and typed decision traces | Model judgments need independent labels; existing evals already provide a base | **First bounded pilot**, modest integration |
| J2 | Booking intent and candidate extraction | Fewer model iterations, lower turn latency and cost | Ambiguity, open-ended fields and multilingual errors; dependent writes remain sequential | **First runtime performance experiment**, medium effort |
| J3 | Role-aware telephone outcome interpretation | More precise handling of assent, refusal, changed details and retractions | Classification can lead to SMS and payment settlement | **Offline/shadow comparison first**, high assurance effort |
| J4 | Passage answerability and citation support | Better answers when retrieved text is related but insufficient | Voyage already reranks; another synchronous stage adds delay | **Evaluate offline, then narrowly**, medium effort |
| J5 | Natural-language experience matching | More useful discovery from explicit multi-part preferences | Facts may be missing; existing local ranking is fast | **Best new visitor feature candidate**, medium effort |
| J6 | Typed public-chat routing and capability metadata | Inspectable routing; possible retrieval/generation bypass | Additional call on ordinary turns; marker generation currently costs no separate call | **Conditional on bypass savings**, medium effort |
| J7 | Editorial tagging, duplicate review and extraction checks | Less manual curation work, outside visitor latency path | Low discovery volume; authored-content and provenance restrictions remain | **Useful secondary trial**, modest to medium effort |
| J8 | Public matching API / agent developer interface | Reuse domain judgments outside Paisaxe's UI | New access, quota, documentation and support contracts | **Separate product decision**, larger scope |

## J1. Give developers a decision inspector, using the existing evaluators

Paisaxe already has an eight-scenario real-model booking evaluator and a 40-query frozen corpus evidence contract (`scripts/eval/booking-eval.ts:1`, `scripts/lib/corpus-quality-evidence.ts:7`, `scripts/lib/corpus-quality-evidence.ts:25`). Extend those concepts rather than introduce a separate evaluation framework.

A useful local view would show a case's supplied state, exact model/question version, current result, Jev probabilities, final code-selected disposition and expected label. For an answer failure, separate “retrieval did not contain the fact” from “the model ignored available evidence.” For a phone result, show which speaker accepted which details and whether a later statement changed them. Jev can supply proposed semantic labels; developers can inspect disagreements without changing visitor behavior. The [citation](https://docs.typesafe.ai/cookbooks/citation_check) and [passage classification](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) recipes support these narrow checks.

This would make a concrete developer task easier: reproduce why a case was routed, classified or answered incorrectly, compare question revisions, and see which cases regress when a model changes. Keep the existing owner/independent-review gate: Jev's label is not an approval receipt (`scripts/lib/corpus-quality-evidence.ts:38`, `scripts/lib/corpus-quality-evidence.ts:66`).

**Comparison:** existing assertions plus human review; improved deterministic assertions; Jev-assisted review. **Evidence that would justify it:** reduced review time with equal or better detection of unsupported claims and incorrect call outcomes on held-out cases. **Reject it if:** the review burden merely shifts to checking noisy Jev labels, or simple assertions perform equally well.

## J2. Shorten straightforward booking turns

The current conversation can make up to six Claude calls, with tool execution between them (`src/lib/booking/agent.ts:48`, `src/lib/booking/agent.ts:138`). This is a useful optimization target because a typed interpretation might eliminate work that currently needs a generative round trip.

Example visitor request: “La visita de sidra el sábado, cuatro adultos, máximo cien euros.” Code can provide the current draft, relevant recent turns, a bounded experience shortlist and candidate spans for dates, party size and amounts. Jev can judge the intended action, selected experience, which extracted amount is the budget, and which constraints were expressed. Presence questions must accompany forced selections. Code resolves the calendar in Europe/Madrid, converts exact amounts, validates the schema, and invokes the same domain operations. This is consistent with [function calling](https://docs.typesafe.ai/cookbooks/function_calling), [candidate-value extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook) and [date extraction](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook).

For clear requests, a bounded dispatcher could execute the established search/draft/quote sequence and then use a template or one generative response. For ambiguous or unsupported requests, retain the current conversation path or ask a focused clarification. Supplying Jev output before an unchanged Claude loop would not establish a performance benefit.

The existing Zod schemas and revalidation remain the contract (`src/lib/booking/tools.ts:344`, `src/lib/booking/tools.ts:379`). Price, availability, provider-confirmed facts, ownership and quote acceptance remain deterministic (`src/lib/booking/availability.ts:77`, `src/lib/booking/facts.ts:51`, `src/lib/booking/tools.ts:176`). The post-acceptance path already skips the model; it has no classification step to remove (`src/lib/booking/agent.ts:196`, `src/lib/booking/agent.ts:224`). Sequential writes intentionally avoid races (`src/lib/booking/agent.ts:167`).

**Required comparison:** current Claude loop versus code/parser improvements versus Jev extraction plus the same tools. Measure correct draft fields, wrong-action rate, clarification turns, model iterations, p50/p95 time to useful card, completion rate and total provider cost. Include changed dates, negation, “same as before,” cancelled requests, mixed languages, missing candidates and multiple amounts. A speed win with worse booking correctness is not a win.

## J3. Interpret telephone outcomes with speaker and temporal context

This is the most concrete existing heuristic that maps to Jev's semantic strengths. `analyzeOutcome` flattens the transcript, combines a summary and checks phrase lists; common assent words are among the confirmation terms (`src/lib/services/elevenlabs-webhook-service.ts:38`, `src/lib/services/elevenlabs-webhook-service.ts:161`, `src/lib/services/elevenlabs-webhook-service.ts:204`). This observation does not prove a production incident.

Evaluate separate judgments over the requested booking and speaker-labelled transcript: did a human merchant answer; did that merchant explicitly accept the request; was another slot offered; was acceptance subsequently withdrawn; which supplied date/party-size candidate was accepted? Code compares selected values to the requested values. Mapping the provider's role label to the actual merchant is part of constructing the state; a field called `user` alone is not sufficient context.

Use synthetic Spanish cases such as an agent saying “perfecto” before the merchant responds, a merchant correcting an earlier acceptance, an alternative date, voicemail, missing summary, and summary/transcript disagreement. Compare against both the present phrase detector and a better role-aware deterministic baseline. Jev's instruction-following limitations mean these cases must be tested rather than assumed solved. [State](https://docs.typesafe.ai/concepts/state), [Atomic decision design](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [Published 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

**Why not replace it immediately:** the classification feeds booking status and SMS, and phone-confirmation settlement can capture or void an authorization (`src/app/api/webhooks/elevenlabs/route.ts:341`, `src/app/api/webhooks/elevenlabs/route.ts:383`, `src/lib/booking/phone-confirmation.ts:383`). An uncertain/review disposition would be new application behavior; today's unresolved classifier returns `failed` (`src/lib/services/elevenlabs-webhook-service.ts:231`). Retaining deterministic settlement alone is insufficient if a new classifier supplies it with incorrect evidence.

The initial comparison must be observational: no booking-status writes, SMS, calls or settlement from Jev results. Track false confirmations separately from overall accuracy, review workload, missed confirmations and corrections. A finite set with zero errors does not establish zero production risk. Any later decision to use these results as settlement evidence needs its own acceptance criteria and authority review.

## J4. Test evidence sufficiency, not just topical similarity

Paisaxe already asks Claude to match the exact place and property and to admit missing evidence (`src/lib/chat-config.ts:83`). A retrieved passage about a beach does not necessarily answer “Is the path step-free?” The source list is currently derived from the retrieved chunks rather than a semantic claim verifier (`src/lib/claude.ts:697`).

Jev could classify each shortlisted passage for support, relevance, contradictory assumptions and instruction-like text. Start offline against the frozen corpus cases. Compare three alternatives: existing Voyage retrieval/reranking; Jev replacing the reranking decision; Jev as a targeted answerability check. The [RAG recipe](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) uses multiple questions per passage request. Batching a whole shortlist is another hypothesis, with a larger shared state and different distraction/cost trade-offs.

Preserve corpus-aware cache hits that already remove upstream calls (`src/lib/retrieve-chat-context.ts:22`). A new answerability cache would need query, corpus, question and model identity; personal or conversation state cannot silently share a public-query cache. Reuse current retrieval failure behavior when Jev fails rather than interpreting a timeout as “no evidence.”

For citation checks, exact quote/source-ID validation belongs in code, followed by semantic support assessment. Jev cannot establish truth outside supplied sources or make stale information current. A post-generation check cannot retract text already streamed (`src/app/api/chat/stream/route.ts:270`). Prevention requires buffering or bounded-unit validation, with a visible latency cost; asynchronous checks are diagnosis, not prevention.

**Evidence that would justify it:** fewer unsupported answers and fewer false refusals at an acceptable end-to-end latency/cost. The vendor's legal-document BM25 benchmark does not establish superiority to Voyage rerank-2.5. [Reranking cookbook](https://docs.typesafe.ai/cookbooks/rerank_typesafe)

## J5. Match experiences to explicit needs

This is the strongest new visitor feature. Today, related stories use category/region/duration points and mood filters use tags/categories (`src/lib/related-stories.ts:45`, `src/lib/mood-mapping.ts:10`). A request such as “algo tranquilo para esta tarde, sin coche y con niños” contains more useful intent than those controls alone express.

Keep the existing fast shortlist. Score a small set of candidates on separately defined soft preferences, then combine scores in code with explicit weights. Show a few matches with source-backed reasons and unknown requirements. For example, “ambiente tranquilo: coincide; transporte público: sin información verificada” is more useful than converting missing evidence into a suitability claim. Use the existing provider-fact evaluator for hard constraints (`src/lib/booking/facts.ts:51`). [Composite scoring](https://docs.typesafe.ai/patterns/composite-scoring)

Run this when the visitor asks for matching, or precompute suitable editorial metadata where evidence permits; avoid a remote request on every swipe. Current filtering runs locally in memoized UI logic (`src/app/immersive/immersive-page-content.tsx:134`). Jev adds semantic expressiveness, not a speed improvement over that local function.

A full itinerary builder is a larger adjacent feature: Jev can assess candidate fit, but routing, travel times, opening windows, budgets and scheduling need authoritative data and ordinary algorithms. Weather support in the inspected tool is current conditions, not a multi-day forecast (`src/app/api/mcp/weather/route.ts:105`). Do not imply a new classifier supplies those missing capabilities.

**Comparison:** present ranking; richer deterministic tags/filters; Jev composite matching. Measure blinded visitor preference, task completion, unknown-fact honesty, diversity and interaction latency. This does not require an inferred long-term personal profile.

## J6–J8. Other worthwhile but conditional directions

**J6 — Typed routing and UI metadata.** Scope, booking intent, live-information need and desire for voice could become explicit judgments consumed by code. This would decouple UI events from `[[VOICE_UPSELL:...]]` text parsing (`src/lib/chat-config.ts:166`, `src/hooks/use-stream-chat.ts:263`). Keep capability checks deterministic: intent to get live weather does not prove a tool is available. Independent Nouls suit overlapping intents better than a single exclusive Choice. [Intent routing](https://docs.typesafe.ai/patterns/intent-routing)

The benefit depends on how many cases can safely bypass retrieval or generation. For ordinary conversational requests, an added serial classifier increases latency. Public chat also omits full conversation history (`src/hooks/use-stream-chat.ts:196`), so follow-up understanding needs an explicit state contract before any model can improve it. Existing regex input controls remain independent; a semantic guardrail is supplementary, not an authentication or injection-proof security boundary. [Guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails)

**J7 — Editorial assistance.** Jev could flag candidate duplicate places, propose more nuanced tags, check source support or compare translated claims. Current discovery uses exact/substring matching and category maps, producing at most five inactive drafts per run (`src/lib/content-discovery.ts:75`, `src/lib/content-discovery.ts:132`, `src/lib/content-discovery.ts:159`, `src/lib/content-discovery.ts:319`). Expected payoff is curation quality/time, not a major site-speed saving. [Entity alignment](https://docs.typesafe.ai/cookbooks/entity_alignment), [Hierarchy](https://docs.typesafe.ai/cookbooks/hierarchical_classification), [Extraction cascade](https://docs.typesafe.ai/cookbooks/sde_cascade)

Keep this on reviewed authored content. The old guide-generation pipeline is disabled (`scripts/lib/legacy-content-gate.ts:1`), and image publication requires manual provenance (`src/lib/image-provenance.ts:34`). Jev cannot establish rights, authorize publication or replace those receipts.

**J8 — Reusable matching interface for developers.** A future read-only domain interface could return candidate IDs, matched requirements, missing facts, source IDs and versioned judgments. The same contract could serve Paisaxe's UI and another agent. Existing MCP-named routes are secret-protected JSON tools for ElevenLabs, not evidence of a general external developer platform (`src/app/api/mcp/places/route.ts:11`, `src/lib/mcp-auth.ts:16`). Public API/MCP/WebMCP exposure adds authentication, abuse limits, documentation and lifecycle decisions beyond adopting Jev. Begin with internal reuse only if J2/J5 proves useful; do not publish a generic proxy to Jev.

## Directions to defer or reject

| Direction | Assessment and reason |
| --- | --- |
| Replace Claude's prose, translation or multi-step reasoning | Reject. Jev selects/scores supplied possibilities; it does not generate those outputs. [Coding-agent guidance](https://docs.typesafe.ai/introduction/coding-agents) |
| Replace embeddings or all Voyage reranking immediately | Reject blanket replacement. Candidate retrieval still needs an index; current reranking already exists (`src/lib/search.ts:120`). |
| Replace date math, prices, authorization or booking policy | Reject. Exact computation and authority belong in existing code (`src/lib/booking/availability.ts:77`, `src/lib/booking/tools.ts:176`). |
| Promise better Lighthouse, image delivery or database performance | Reject causal claim. Jev cannot itself reduce asset transfer, React work or SQL cost; the catalogue already has a payload warning (`src/lib/stories-server.ts:21`). |
| Live landmark recognition, automatic crops or image approval | Defer. Images/Box are experimental; visual judgment cannot establish named-place truth or permission. [Image status](https://docs.typesafe.ai/images); `src/lib/image-provenance.ts:34`. |
| Automatic persistent memory copied from the cookbook | Defer. The example lacks a production retention/expiry design and can preserve incorrect answers. Public chat first needs a conversation-state contract. [Memory recipe](https://docs.typesafe.ai/cookbooks/basic_memory); `src/hooks/use-stream-chat.ts:196`. |
| Learned personalization using autoresearch | Defer until labelled outcomes justify it. Jev probabilities can be features, but the predictor still needs held-out evaluation and a defined objective. [Feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery) |
| Add a skill router to all developer tasks | No demonstrated need. The recipe addresses a large ambiguous skill catalogue and can add two requests; it is not automatically useful to this application's seven booking tools. [Skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion); `src/lib/booking/tools.ts:344`. |
| Treat a voice checklist as permanently complete after a positive score | Reject that direct transfer. Booking details can be corrected or withdrawn; recompute from current state. [Intelliprompter](https://docs.typesafe.ai/cookbooks/intelliprompter) |
| Let Jev alter CI routing or release authority | Outside scope. Sutura ownership and publication rules remain independent of model judgments (`AGENTS.md:232`). |

## Performance and cost: conditions for an actual improvement

For a serial router, let `J` be its observed latency, `C` the existing path latency for comparable cases, and `p` the fraction that still require that path. A simplified expected new latency is `J + p × C`. A benefit requires `J < (1 − p) × C`. Real measurements must separate case types, cache hits, retries and cold starts; this equation is a design check, not a forecast.

For booking, estimate value from generative iterations actually removed. For retrieval, compare with the current complete-cache hit and Voyage path, not an uncached hypothetical baseline. Speculative Jev questions sharing state can be bundled, but a question requiring fresh tool output must wait for it. [Fan-out](https://docs.typesafe.ai/patterns/fan-out)

Illustrative input-only arithmetic using the published rate: 2,000 billable tokens cost $0.000084; 100,000 such requests cost $8.40. Tokens include question/state content, and retries or per-passage requests increase the total. This excludes other providers, infrastructure and engineering effort. Actual payload size and traffic were not measured. [Pricing](https://docs.typesafe.ai/models)

The SDK's default 10-second per-attempt timeout and two retries are unsuitable as an assumed low-latency budget. Any interactive integration needs an explicit total deadline, bounded retry behavior, cancellation and a visible fallback. [SDK configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig), [Retries](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy), [Cancellation](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions)

Record the exact model, question-set version, decision outcome, fallback reason, latency, token usage and review result. Do not log raw personal transcripts by default. The existing cost recorder is Anthropic-specific, so its totals would not automatically include Jev (`src/lib/costs/anthropic-usage.ts:27`, `src/lib/costs/anthropic-usage.ts:73`).

## Integration rules that follow from the evidence

| Concern | Proposed rule |
| --- | --- |
| Boundaries | Server-side adapter supplies judgments; domain code chooses actions. No direct model authority over side effects. |
| Question design | Atomic questions, descriptive options, explicit presence/unknown handling; keep arithmetic and exact normalization in code. |
| Versioning | Pin evaluated model/question definitions; log returned model. Revalidate before changing aliases or thresholds. |
| Uncertainty | Distinguish supported, unsupported, unresolved and provider failure. Never collapse an API error into false or confirmation. |
| Fallback | Use the existing conversational/retrieval path for suitable read-only cases; no automatic repetition of an operation whose result is unknown. |
| Data | Send the minimum relevant state; use synthetic/redacted cases first. Keep account keys and capability links out of client/model-visible data. |
| Caching | Bind results to relevant corpus, question, model and state identity. Keep user-specific decisions out of shared public caches. |
| Evaluation | Separate mocked transport/contract tests from live model quality, and model agreement from authoritative truth. |

These are proposed integration constraints, not implemented behavior. They follow the [TypeSafe architecture guidance](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [state design](https://docs.typesafe.ai/concepts/state), and Paisaxe's existing uncertain-tool recovery (`src/lib/booking/agent.ts:172`).

## Evidence needed before adopting a runtime path

Use a frozen labelled comparison set plus held-out cases; do not tune thresholds against the acceptance set. Cover Spanish first, Asturian separately, supported visitor languages, conflicting statements, omitted fields, changes of mind, adversarial text and “none fits.” Review individual dangerous errors, not just aggregate agreement. Evaluate threshold error rates and the fraction routed to review/fallback; a confidence value is not a safety certification. [Confidence](https://docs.typesafe.ai/confidence), [Self-consistency](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook)

Reuse the current booking and corpus evaluation mechanisms, with additional candidate-specific cases rather than claiming eight or forty cases prove all workloads (`scripts/eval/booking-eval.ts:1`, `scripts/lib/corpus-quality-evidence.ts:25`). Compare current code, a simpler code-only improvement, the current generative path and Jev where each is relevant. Keep the same source data, cache conditions and deployment region for latency comparisons.

Approve a runtime candidate only when its defined task improves on held-out evidence, its fallback preserves current authority/recovery, and the end-to-end latency/cost trade-off is acceptable. J3 also needs an explicit decision about uncertain call outcomes before it can become evidence for settlement. This is an acceptance framework for a later evaluation, not an implementation plan.

## Remaining decisions, limits and handoff

**Recommended next decision:** authorize a small evaluation of J1, focused on call-outcome and claim-support cases, then use results to choose J2 or J4 for a runtime experiment. This avoids committing the application to a new provider before its semantic value is demonstrated. The supplied request authorized research/assessment, so this report stops here.

A live evaluation would need a defined data scope and spending cap. The installed [TypeSafe skill](/Users/juan/.codex/plugins/cache/typesafe-ai/typesafe/0.6.2/skills/typesafe-ai/SKILL.md) says: “Ask the user for permission first. Get a budget for experimentation.” That applies to future inference using `TYPESAFE_API_KEY`; it did not prevent completion of the present documentation/source assessment. No permission or account change is needed to read these reports.

The logged-in console could not be inspected because the browser access host was unavailable. Account quotas, effective retention terms, regional commitments and model access remain **UNAVAILABLE**. The public docs offer enterprise ZDR and describe US hosting; they do not establish that this account has zero retention. Those facts matter before using customer transcripts. [Legal](https://docs.typesafe.ai/legal), [Privacy](https://typesafe.ai/legal/privacy-policy), [DPA](https://typesafe.ai/legal/data-processing)

All proposed accuracy, speed and cost benefits remain **unmeasured**. Public source/SDK compatibility is verified at documentation level only. No tests or live evaluations were run, because only research documents changed; the existing live evaluator explicitly incurs provider spend (`scripts/eval/booking-eval.ts:9`).

The source baseline remains `develop` at `26c624adce298a98d15ef123b902a4a13d2134bb`. J1–J8 have explicit dispositions above; none is implemented. Only the two research documents were added locally. No issue, dependency, credential, provider, payment, CI, deployment or publication mutation occurred. On resumption, revalidate branch/status, source references, current Jev/SDK documentation and account terms before planning or running experiments.
