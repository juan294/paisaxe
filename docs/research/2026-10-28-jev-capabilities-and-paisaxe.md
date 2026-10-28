# Jev capabilities and Paisaxe: current-state research

Date: 2026-10-28. Repository: `/Users/juan/code/paisaxe`. Branch: `develop`. Source commit: `26c624adce298a98d15ef123b902a4a13d2134bb`. Working tree was clean at the start. Research ran on the integration branch; only research artifacts were written.

## Question and scope

What does Jev currently provide, and where does Paisaxe currently interpret language, choose actions, rank content, verify evidence, and expose interfaces to developers or agents?

This document follows `rpi-research` and describes the existing systems. The requested evaluation and recommendations are in [the separate assessment](2026-10-28-jev-opportunities-assessment.md). “Useful to developers” is interpreted as usefulness to Paisaxe maintainers and possible consumers of its agent/API interfaces, while retaining the tourism product described in `docs/project/project-charter.md:15` and `docs/project/project-charter.md:28`.

## Answer

Paisaxe has several distinct semantic decision surfaces: public chat instructions and UI markers, Claude's booking tool loop, phrase-based telephone outcome classification, and fixed story matching rules. It also has deterministic booking authority, retrieval caches, a specialized reranker, and existing evaluation contracts. These are separate mechanisms, not one interchangeable AI component.

Jev answers bounded questions with typed values and probabilities. Its documented primitives and recipes cover classification, candidate selection, scoring, evidence checks and extraction from supplied candidates. It does not generate Paisaxe's conversational prose or supply missing provider facts. Experimental image support has a separate readiness status. The correspondence between these capabilities and the current code is evaluated in the companion assessment.

No Jev inference was run. Paisaxe-specific accuracy, latency, cost savings, and production behavior are **unmeasured**.

## Evidence and coverage

The local Graphify generation `2026-10-28t07-57-41-686z-f6446d` was queried through Paisaxe's own graph path before source orientation. Broad graph responses were truncated; they were navigation aids, and all material repository findings below were confirmed in source. Three bounded read-only investigations covered chat/RAG, product/booking/developer interfaces, and external documentation. All returned results were inspected; the parent additionally traced content discovery, provenance, usage recording and settlement consequences.

The public TypeSafe corpus was discovered from [llms.txt](https://docs.typesafe.ai/llms.txt) and [sitemap.xml](https://docs.typesafe.ai/sitemap.xml). All **131 unique indexed documentation pages** were retrieved successfully on 2026-10-28. Conceptual and cookbook narrative, reported results and limitations were reviewed; example code was inspected selectively. Generated SDK references received an API-surface and type-description scan, not a line-by-line audit of every member. The live [OpenAPI specification](https://api.typesafe.ai/openapi.json), version `0.2.0`, three linked legal documents, and the official JavaScript SDK `v0.7.0` package/license were also inspected. Downloaded examples were not executed.

| Documentation family | Pages | Coverage |
| --- | ---: | --- |
| Root pages and indexes | 11 | Introduction, models, images, confidence, building blocks, legal and navigation |
| Concepts and introduction detail | 7 | State, System One, coding agents, architecture, use cases and primer |
| Primitives | 5 | Choice, Score, Noul, Box and structured criteria |
| Patterns | 4 | Fan-out, confidence routing, composite scoring and intent routing |
| Cookbooks | 21 | All recipe narratives, caveats and results; selected implementation examples |
| Demo detail | 1 | Smart-home dispatcher |
| Model limitations | 1 | Published Jev 1.13 jaggedness |
| HTTP API | 3 | Inference, model listing, request rules/errors |
| SDK guidance/changelogs | 6 | Python and JavaScript guidance and versions |
| Python reference | 10 | Clients, types, assets, responses, retries and exceptions |
| JavaScript reference | 62 | Exported clients, types, assets, options, errors and helpers |

Raw pages, hashes, retrieval statuses and the full URL inventory are transient evidence at `/tmp/jev-docs-2026-10-28/manifest.json` and `/tmp/jev-docs-2026-10-28/coverage.md`. The source links and coverage description in this report are the durable record.

## Jev: external observations

### Model and operational contract

The current documented model is `jev-1.14.0`, released 2026-10-14; both `jev-latest` and `jev-preview` currently resolve to it. Published pricing is $0.042 per million input tokens, with free output. Default limits are 64k tokens per request and 32k per question. A long-context opt-in raises both to 262k, with an explicit speed/accuracy trade-off. Organization limits are account-specific. English is its strongest language; the docs do not establish Spanish or Asturian quality for this application. No audio/video input is supported. These are vendor statements, not results measured here. [Models](https://docs.typesafe.ai/models)

Choice selects a supplied option, Score rates against ordered criteria, and Noul returns the probability of a yes answer. OpenAPI specifies at most 255 Choice options and 10 Score levels. Parallel questions see the shared state but do not see each other's answers. Free-form extraction requires candidate generation or another model; Jev itself does not generate prose or code or execute tools. [Primitives](https://docs.typesafe.ai/primitives), [Coding agents](https://docs.typesafe.ai/introduction/coding-agents), [OpenAPI](https://api.typesafe.ai/openapi.json)

Confidence summarizes the answer distribution; it is not a correctness guarantee. Noul has no separate confidence value. Calibration concerns groups of predictions, not certainty about an individual booking or claim. Choice still selects an option when none fits; a separate presence/answerability judgment can represent that situation. [Confidence](https://docs.typesafe.ai/confidence), [Choice](https://docs.typesafe.ai/primitives/choice), [Noul](https://docs.typesafe.ai/primitives/noul)

Images and Box require an experimental opt-in and are explicitly described as not ready for production. Box returns coordinates even when its target is absent. Dedicated image documentation describes support beyond the text-only model table and older conceptual text. [Images](https://docs.typesafe.ai/images), [Box](https://docs.typesafe.ai/primitives/box)

### SDK and failure contract

The documented JavaScript/TypeScript SDK is `@typesafe-ai/sdk` v0.7.0, MIT licensed, with Node >=22, ESM/CommonJS builds and inferred answer types. Paisaxe declares Node >=24 and ESM (`package.json:5`). This establishes apparent runtime compatibility; the package was not installed or compiled in Paisaxe. The older quickstart's Node 20 statement conflicts with the versioned package/current SDK page. [SDK](https://docs.typesafe.ai/sdk/javascript), [Versioned package](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.7.0/package.json), [License](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.7.0/LICENSE)

The SDK defaults to a 10-second timeout per attempt and two retries, with no total retry budget. A request AbortSignal cancels the request and pending retries. Browser use is disabled by default; debug logging includes bodies, which are not redacted. HTTP errors include rate limiting and overload. These defaults matter separately from typical model inference time. [Client configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig), [Retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy), [Request options](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions), [Errors](https://docs.typesafe.ai/api/errors)

### Recipe coverage

| Recipe family | Recipes reviewed and documented mechanism |
| --- | --- |
| Dispatch | [Function calling](https://docs.typesafe.ai/cookbooks/function_calling) selects fixed function/argument values; [skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion) ranks and rechecks a large skill catalogue. |
| Input/output judgments | [LLM guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails) combines hazard judgments; [Twitch filtering](https://docs.typesafe.ai/cookbooks/twitch_chat_filter) applies several message classifications. |
| Evidence | [Citation checks](https://docs.typesafe.ai/cookbooks/citation_check) combine exact quote checks with semantic support; [RAG passage classification](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) separates relevance, usable evidence, conflicts and instruction-like content. |
| Retrieval | [Reranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe) scores candidates; [semantic find](https://docs.typesafe.ai/cookbooks/semantic_find) selects line IDs and tests answer presence. |
| Extraction | [Date extraction](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook) identifies components for code to resolve; [pre-parsed values](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook) selects candidate spans; [SDE cascade](https://docs.typesafe.ai/cookbooks/sde_cascade) verifies a smaller model's extraction and escalates. |
| Content structure | [Hierarchical classification](https://docs.typesafe.ai/cookbooks/hierarchical_classification) traverses taxonomies; [classification using confidence](https://docs.typesafe.ai/cookbooks/classification_using_confidence) selects coarse versus fine classes; [structure recovery](https://docs.typesafe.ai/cookbooks/autoformat) restores formatting without authoring new prose. |
| Identity | [Entity alignment](https://docs.typesafe.ai/cookbooks/entity_alignment) judges candidate pairs and field disagreements. |
| Conversation state | [Simple memory](https://docs.typesafe.ai/cookbooks/basic_memory) retains selected interactions; [Intelliprompter](https://docs.typesafe.ai/cookbooks/intelliprompter) scores transcript coverage of a checklist. |
| Reliability and efficiency | [Choice consistency](https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook), [Noul consistency](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook) and [parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions) examine abstention, repeated judgments and shared-state batching. |
| Learned features | [Autoresearch feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery) turns semantic answers into features for a supervised predictor with labelled outcomes. |

The architecture guidance assigns language judgments to Jev and decisions/actions to application code. Shared-state batching avoids repeatedly transmitting and charging for the same state. It does not make dependent operations independent. [Architecture](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [Fan-out](https://docs.typesafe.ai/patterns/fan-out)

### Evidence limits and data handling

The parallel-questions recipe's approximately tenfold speed comparison is against sequential individual calls. The reranking recipe compares with BM25 on legal queries, not Paisaxe's Voyage reranker. Citation and RAG examples include cached Jev 1.12 results. These demonstrate recipes and recorded examples, not current Jev 1.14 performance on this repository. [Parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions), [Reranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe), [Citation checks](https://docs.typesafe.ai/cookbooks/citation_check)

The published jaggedness page is explicitly for Jev 1.13, reviewed 2026-10-02. It reports numerical/date weaknesses, literal interpretation, distractor context, adversarial input and option-order effects. No 1.14-specific replacement was in the index/sitemap; this research does not assume either unchanged behavior or fixes. [Jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

TypeSafe states it does not train on customer inputs and offers enterprise zero data retention. Its privacy policy describes US hosting; the DPA uses retention as necessary for the processing purpose and applicable obligations, rather than a fixed default-zero period. Account-specific agreements, retention and region arrangements were not verified. The DPA is dated 2026-04-24, privacy policy 2025-11-19, and MCA 2026-09-23. This is a source summary, not a legal conclusion. [Legal](https://docs.typesafe.ai/legal), [Privacy](https://typesafe.ai/legal/privacy-policy), [DPA](https://typesafe.ai/legal/data-processing), [MCA](https://typesafe.ai/legal/mca)

## Paisaxe: current behavior

### R1. Public chat and retrieval

The public streaming route applies rate limiting, schema validation and an injection-pattern filter before retrieval/generation (`src/app/api/chat/stream/route.ts:95`, `src/app/api/chat/stream/route.ts:123`, `src/app/api/chat/stream/route.ts:136`). Current source uses `claude-sonnet-5-5`, `voyage-context-3` embeddings at 512 dimensions, and `rerank-2.5` (`src/lib/models.ts:7`, `src/lib/embeddings.ts:18`, `src/lib/rerank.ts:10`). The inspected path retrieves 10 vector candidates and normally returns 3 after reranking; it does not show the hybrid keyword path described in the older overview (`src/lib/search.ts:12`, `src/lib/search.ts:27`, `src/lib/search.ts:120`, `src/app/api/chat/stream/route.ts:191`).

Complete retrieval-cache hits skip embedding, vector search, reranking and image retrieval (`src/lib/retrieve-chat-context.ts:22`). Embedding TTL is 24 hours and result TTL is 10 minutes; keys account for relevant model/corpus inputs (`src/lib/embedding-cache.ts:9`, `src/lib/embedding-cache.ts:42`, `src/lib/embedding-cache.ts:117`). Image lookup and reranking run concurrently (`src/lib/search.ts:141`). Stable system content is separately cached, and client text updates are batched per animation frame (`src/lib/claude.ts:581`, `src/hooks/use-stream-chat.ts:149`).

Tourism scope, recipe redirection, evidence sufficiency and safety are expressed in the generation prompt (`src/lib/chat-config.ts:74`, `src/lib/chat-config.ts:80`). The prompt requires both place and property to match, states that a listing is not current availability, and distinguishes evidence from embedded instructions (`src/lib/chat-config.ts:83`). Voice CTA categories are generated as text markers and then parsed by the client, with eligibility checks; the prompt explicitly says those markers do not establish a live capability (`src/lib/chat-config.ts:166`, `src/lib/chat-config.ts:177`, `src/hooks/use-stream-chat.ts:263`).

The public client sends the current question, story context, locale and message index, not its complete displayed conversation (`src/hooks/use-stream-chat.ts:196`). The model receives one user message assembled with retrieved evidence (`src/lib/claude.ts:647`). Sources attached to the answer are mapped from retrieved chunks; this mapping itself does not verify semantic support for every generated claim (`src/lib/claude.ts:697`, `src/app/api/chat/stream/route.ts:283`).

### R2. Booking interpretation and authority

Booking uses history, server draft, existing bookings, locale and current Madrid date in a maximum six-call Claude tool loop (`src/lib/booking/agent.ts:48`, `src/lib/booking/agent.ts:86`, `src/lib/booking/agent.ts:117`). Seven tools have Zod-derived schemas and execution-time validation. Calls execute sequentially, including potentially dependent writes (`src/lib/booking/tools.ts:344`, `src/lib/booking/tools.ts:379`, `src/lib/booking/agent.ts:167`).

Budget, party size, provider-confirmed suitability facts and availability are evaluated in code; missing or unconfirmed facts remain unknown (`src/lib/booking/availability.ts:77`, `src/lib/booking/facts.ts:51`). Prices come from the catalogue. Quote acceptance is a UI event, and the post-acceptance payment-order turn already runs without a model (`src/lib/booking/tools.ts:176`, `src/lib/booking/agent.ts:196`, `src/lib/booking/agent.ts:224`). Cancellation tools preview rather than confirm a cancellation; capability URLs are kept out of model results (`src/lib/booking/tools.ts:4`, `src/lib/booking/tools.ts:10`).

### R3. Voice call interpretation and consequences

`analyzeOutcome` removes transcript speaker roles when joining message strings, appends the provider summary, then matches no-answer, denial and confirmation substrings in that order (`src/lib/services/elevenlabs-webhook-service.ts:161`, `src/lib/services/elevenlabs-webhook-service.ts:204`). Confirmation terms include common assent phrases. Unresolved content returns `failed` (`src/lib/services/elevenlabs-webhook-service.ts:38`, `src/lib/services/elevenlabs-webhook-service.ts:231`). These are observed mechanics; no production misclassification was established in this research.

The resulting outcome is committed through an idempotent booking-status/SMS-outbox operation (`src/app/api/webhooks/elevenlabs/route.ts:322`, `src/app/api/webhooks/elevenlabs/route.ts:341`). For phone-confirmation payments, settlement uses the recorded outcome: confirmed permits capture, other final outcomes permit voiding, and unresolved state waits within the existing time limit (`src/app/api/webhooks/elevenlabs/route.ts:383`, `src/lib/booking/phone-confirmation.ts:378`).

Outbound initiation separately enforces shared-secret authentication, schema, feature flags, phone validation, provider configuration, idempotency, rate limits and a daily cap (`src/app/api/mcp/make-booking/route.ts:144`, `src/app/api/mcp/make-booking/route.ts:172`, `src/app/api/mcp/make-booking/route.ts:249`, `src/app/api/mcp/make-booking/route.ts:276`).

### R4. Discovery and developer interfaces

Related-story ranking gives three points for category, two for region and one for duration; it returns three results by default (`src/lib/related-stories.ts:21`, `src/lib/related-stories.ts:45`). Mood selection uses tags or category mappings (`src/lib/mood-mapping.ts:10`). The immersive pipeline combines mood, season, seeded shuffle and exact filters (`src/app/immersive/immersive-page-content.tsx:132`). Voice context includes story, language, time and conversation count; persisted voice-session context is a counter, not a learned preference profile (`src/components/immersive/voice-chat-elevenlabs.tsx:285`, `src/hooks/use-voice-session.ts:9`). No dedicated itinerary builder was found in the inspected source/search.

The MCP-named places/weather routes are authenticated JSON tools for ElevenLabs (`src/app/api/mcp/places/route.ts:11`, `src/app/api/mcp/weather/route.ts:11`, `src/lib/mcp-auth.ts:16`). Places returns bounded candidates; weather supplies current conditions (`src/app/api/mcp/places/route.ts:157`, `src/app/api/mcp/weather/route.ts:105`). Searches of `src` and package dependencies found no `modelContext`, `registerTool`, `McpServer` or `@modelcontextprotocol` implementation. These routes therefore do not establish the existence of a public general-purpose MCP/WebMCP developer platform (`package.json:87`).

### R5. Content and provenance

Content discovery checks normalized titles/slugs/substrings for duplicates, maps Places types to categories, generates descriptions with Claude and creates at most five inactive drafts needing curation (`src/lib/content-discovery.ts:75`, `src/lib/content-discovery.ts:132`, `src/lib/content-discovery.ts:159`, `src/lib/content-discovery.ts:252`, `src/lib/content-discovery.ts:298`, `src/lib/content-discovery.ts:393`). The cron route uses an acquired lease and releases it in `finally` (`src/app/api/cron/content-discovery/route.ts:69`, `src/app/api/cron/content-discovery/route.ts:106`).

Legacy guide-derived generation/image-mapping implementations still exist, but their operational entrypoints are disabled by `rejectLegacyContentOperation`; the error directs users to reviewed authored manifests (`scripts/lib/legacy-content-gate.ts:1`). Their presence is not an active ingestion contract. Images require explicit manual provenance and approval receipts; otherwise the public resolver returns a neutral illustration (`src/lib/image-provenance.ts:34`, `src/lib/image-provenance.ts:51`).

### R6. Existing evaluation and observability

The booking evaluator exercises the real model against local fixtures and a local payment mock across eight scenarios, recording outcomes, clarification turns and latency; it costs provider credits and rejects replay mode (`scripts/eval/booking-eval.ts:1`, `scripts/eval/booking-eval.ts:44`, `scripts/eval/booking-eval.ts:60`, `scripts/eval/booking-eval.ts:83`).

Corpus evidence requires 40 frozen queries, exact corpus/model/config identities, baseline/candidate answer hashes and scores for support, relevance, grounding, safety and source correctness. Distinct independent-agent and owner reviewers are required. The validator explicitly does not establish actual provider execution or review authenticity (`scripts/lib/corpus-quality-evidence.ts:7`, `scripts/lib/corpus-quality-evidence.ts:25`, `scripts/lib/corpus-quality-evidence.ts:38`, `scripts/lib/corpus-quality-evidence.ts:66`). Live chat QA also exists, with sampled categories and content-boundary cases (`src/tests/qa/llm-quality.test.ts:70`, `src/tests/qa/llm-quality.test.ts:431`).

Stage timing is logged; Anthropic token/cache usage and estimated costs are recorded by call source without blocking responses (`src/lib/chat-stream-timeouts.ts:125`, `src/lib/costs/anthropic-usage.ts:27`, `src/lib/costs/anthropic-usage.ts:64`, `src/lib/costs/anthropic-usage.ts:100`). No TypeSafe dependency/integration was found in the inspected source, scripts or package manifests (`package.json:87`). Existing test files were read, not executed; their current pass status is unmeasured.

## Recovery and user visibility

| Boundary | Current recovery | Visibility/evidence |
| --- | --- | --- |
| Retrieval cache unavailable | Treat as a miss | Soft failure in `src/lib/embedding-cache.ts:42`. |
| Reranker unavailable/slow | Return vector-order top results; do not cache degraded result | Logged, no visitor degradation field in the returned result; `src/lib/rerank.ts:47`, `src/lib/search.ts:152`, `src/lib/search.ts:186`. |
| Search/embedding failure | Stop generation and emit search-unavailable error | Localized timeout message; this SSE branch does not activate the separate retry banner. `src/app/api/chat/stream/route.ts:190`, `src/hooks/use-stream-chat.ts:283`, `src/components/immersive/voice-chat.tsx:390`. |
| Rate-limit stage timeout | Fail closed with 429 and Retry-After | HTTP response; `src/app/api/chat/stream/route.ts:102`. |
| Booking tool timeout | Stop remaining tools; tell visitor to check booking status before repeating | Explicit uncertain-operation recovery; `src/lib/booking/agent.ts:172`. |
| Tool-loop exhaustion | Ask for a more specific date and party size | Visitor text; `src/lib/booking/agent.ts:48`, `src/lib/booking/agent.ts:188`. |
| Outbound voice disabled/unconfigured | Offer direct venue contact | Visitor message; `src/app/api/mcp/make-booking/route.ts:175`, `src/app/api/mcp/make-booking/route.ts:238`. |
| Voice tracking failure after initiation | Return degraded status and reconciliation instructions | Tool response; `src/app/api/mcp/make-booking/route.ts:127`. |
| Unclassified telephone outcome | Store failed; failure SMS directs visitor to contact venue | `src/lib/services/elevenlabs-webhook-service.ts:231`, `src/lib/twilio-sms.ts:165`. |
| Content-description failure | Log and use generic draft description; draft stays inactive | `src/lib/content-discovery.ts:286`, `src/lib/content-discovery.ts:319`. |
| Concurrent discovery job | Return skipped/409; lease has a 20-minute duration | Operator endpoint; `src/app/api/cron/content-discovery/route.ts:23`, `src/app/api/cron/content-discovery/route.ts:69`. |
| Missing image provenance | Show neutral thematic illustration | Visible fallback; `src/lib/image-provenance.ts:51`. |

## Uncertainty and durable handoff

**Completed:** source research and public documentation coverage above. **Unmeasured:** Jev quality, live latency distributions, actual cache-hit mix, monthly savings and all current test pass statuses. **Unavailable:** signed-in console details. Browser control returned “The browser access host is unavailable”; an unauthenticated fetch of the supplied console URL redirected to login. Quotas, account model access, billing arrangements and retention configuration remain unknown. Public docs were sufficient for this assessment.

No private transcripts or project data were submitted to TypeSafe. No inference budget was consumed, credentials created, provider settings changed, issues opened, code installed, or remote state modified. The historical memory lookup was orientation only; repository facts were rechecked at the source commit above.

The authorized continuation from descriptive research is the companion assessment, because the user expressly requested recommendations. Planning, implementation and live experiments remain separate work. On resumption, verify HEAD, dirty state, relevant source paths, model/SDK versions and account constraints before relying on this snapshot. Local report files are preserved under `docs/research/`; raw inventories remain transient.
