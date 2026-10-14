# PayPal webinar notes for the Paisaxe submission

Reviewed on October 7, 2026. Source: Devpost’s [Set Up PayPal’s Sandbox and AI Toolkit From Scratch](https://www.youtube.com/watch?v=FFJfCW9z3Do), recorded October 6, 2026, duration 44:35. Speakers: Jo Franchetti, Marco Podien and Eddie Jaoude. These notes cover the complete English automatic captions. Names and resource URLs were checked against the video description; automatic captions contain transcription errors. Timestamp links below identify the relevant passages. Submission advice is our interpretation of those passages.

Paisaxe fits the session’s central requirement: AI helps a traveler select a suitable experience, and PayPal completes the booking through a deposit and subsequent payment states. The submission should make that relationship visible in one short working journey. The most useful remaining work is presentation, judge access and credible validation evidence.

## Guidance that affects our submission

| Webinar passage | What the speakers shared | Application to Paisaxe |
| --- | --- | --- |
| [02:17–02:57](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=137s) | Both AI and PayPal must have a meaningful role. A payment button attached to an unrelated app is insufficient. Any AI stack is allowed. | Explain how traveler constraints lead to a persisted offer, reserved capacity, buyer approval, a deposit and confirmed booking. Show the result of the transaction. |
| [04:12–05:23](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=252s) | Prepare a concise pitch, project story, source repository with an open source license, a demo under three minutes, feature description and tool list. Existing projects need substantial progress during the event and an explanation of the changes. | Describe the original Asturias discovery product, then identify the new booking, payments and recovery work with dated commits. Make the new contribution easy to find. |
| [05:49–06:57](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=349s) | Five judging criteria have equal weight: technical implementation, design, impact, innovation and presentation. Best Demo Delivery is also a $5,000 award. | Give presentation its own preparation time. A working booking, understandable payment terms and clear status changes can demonstrate several criteria together. |
| [06:32–07:44](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=392s) | Multiple prizes can be won. Partner tools are optional; a useful integration can qualify for an additional prize. | Keep APIMatic as the recorded sponsor target. Explain its actual contribution. Additional sponsor scope needs a product reason and evidence. |
| [09:12–10:12](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=552s) | Product availability may depend on country or business approval. Start with a real problem, then choose capabilities. | Lead with travelers’ booking decisions and small providers’ confirmation/payment work. Keep the demonstration in Spain/EUR and avoid assuming every PayPal brand is available locally. |
| [11:09–12:24](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=669s) | PayPal also supports invoicing, subscriptions, payouts, disputes and other commerce operations. | A balance invoice is a relevant extension already supported by our sandbox record. Include it only if it improves the short story. The session does not require every API family. |
| [14:20–15:20](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=860s) | The official Postman collections include API workflows and can exercise complete journeys. | Link our booking collection as reproducible technical evidence. Explain which runs use a local mock and which transactions reached the real sandbox. |
| [25:35–27:47](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=1535s) and [29:49–30:15](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=1789s) | The sandbox supports buyer and merchant accounts, payments and refunds without real funds. Matching countries avoids currency confusion. | Keep fixture and sandbox labels visible. Use a matching buyer/merchant configuration and EUR. A sandbox transaction is appropriate hackathon evidence. |
| [34:07–37:34](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=2047s) | Browser actions do not describe every later payment outcome. Webhooks need a reachable endpoint and origin verification; failed delivery is retried. | Show durable booking status and explain recovery after buyer approval without a return. Our existing local evidence makes this a defensible technical strength. |
| [38:27–40:23](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=2307s) | Check the buyer and merchant perspectives; API, error and webhook logs help explain outcomes. | Pair the traveler’s confirmation with the operator’s deposit/status view. Keep sensitive information out of the recording. |
| [40:54–41:08](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=2454s) | Test failure scenarios as well as successful payments. | Include a brief cancellation/refund or recovery moment, with detailed negative cases in the repository. Do not spend the video explaining every test. |

## Deadline conflict and submission rules

At [01:30](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=90s), the speaker gives **November 12 at 2 p.m. Pacific**. The [official rules](https://paypalaihackathon.devpost.com/rules), as indexed on October 7, instead give **November 12, 2026 at noon Pacific**, or **21:00 Europe/Madrid**. The direct rules page was unavailable and showed planned maintenance in the browser during this review. Use the earlier time as the working deadline and recheck the direct page before submission. Our existing Phase 7 already records noon Pacific and submission on November 11 (`docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-7.md:3`), so the webinar does not justify moving it later.

Additional points from the indexed official rules: judges need a functioning build, provided through complete run instructions or a hosted demo; public hosting is optional. Source must be public and openly licensed. The YouTube demo must be public and under three minutes. Submission materials need English or English translations, including testing instructions. Judge access must remain available through the judging period ending December 15. The rules govern conflicts with promotional statements. Recheck their final wording when Devpost is available.

## What our current evidence supports

The existing product story already connects conversation to commerce. The documented example is four travelers, a €120 activity, a €30 deposit and €90 balance. Provider facts distinguish supported, unsupported and unknown constraints. Offer acceptance, payment and cancellation require explicit visitor actions; typed payment claims cannot change financial state (`docs/hackathon/testing-instructions.md:35`; `README.md:45`).

The October 7 acceptance record documents a local application and local database using the **real PayPal sandbox**, with owner approval as buyer. It covers return capture, approval without return through a webhook, approval without return or reachable webhook through reconciliation, abandonment expiry, completed refund and duplicate confirmation, and a paid balance invoice. These are recorded results from that candidate and environment, not fresh execution in this review (`docs/plans/2026-10-03-paypal-hackathon-booking-phases/sandbox-acceptance-2026-10-07.md:3`, `:10`, `:15`, `:28`, `:37`, `:45`).

Use the evidence precisely:

- **AI evaluation:** the October 7 artifact reports eight of eight scenarios passing. This is a small model evaluation, not a human usability result (`docs/hackathon/evaluation/2026-10-07.json:2`).
- **Human validation:** the observation sheet still has five empty tester rows. Complete the planned sessions before claiming successful usability testing or quantified benefits (`docs/hackathon/validation/observation-sheet.md:6`).
- **Real providers:** the public website survey supplies context, with no provider contact or endorsement. The catalog demonstrated by Paisaxe is fictitious (`docs/hackathon/validation/provider-desk-survey.md:5`; `docs/hackathon/testing-instructions.md:10`).
- **Zapier:** the acceptance session delivered notifications to a local substitute receiver. Describe that as a tested notification contract; it does not prove delivery through a real Zap (`docs/plans/2026-10-03-paypal-hackathon-booking-phases/sandbox-acceptance-2026-10-07.md:21`).
- **Voice:** the existing visitor guide is for discovery. The current judge instructions say booking is through text and booking pages. The separate provider phone-confirmation path was not covered in the October 7 session (`docs/hackathon/testing-instructions.md:97`; `docs/plans/2026-10-03-paypal-hackathon-booking-phases/sandbox-acceptance-2026-10-07.md:50`).

## Submission emphasis

Suggested pitch: **Paisaxe helps travelers turn their needs into a local experience booking, with a clear PayPal deposit, explicit approval and recoverable payment status.** State that the prototype uses a fixture merchant and sandbox funds. Describe the demonstrated accessibility facts as catalog facts, without implying certification or a real provider endorsement.

Keep the existing 2:40 video target. The Phase 7 plan already calls for a transaction opening, a rejected option, an unconfirmed constraint, sandbox labels and English captions (`docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-7.md:33`). A useful edit structure is:

| Video time | Footage and message |
| --- | --- |
| 00:00–00:15 | Show a confirmed booking and the €30 deposit, then identify the traveler’s problem and the demo scope. |
| 00:15–00:50 | Show the traveler’s constraints, one rejected option and one fact left unconfirmed. Make the assistant’s useful reasoning visible. |
| 00:50–01:30 | Show the offer’s total/deposit/balance, explicit acceptance, PayPal sandbox approval and confirmed booking. |
| 01:30–02:05 | Show cancellation terms, confirmation and refund status. Add a brief explanation of recovery after an interrupted return, backed by the acceptance record. |
| 02:05–02:25 | Show the operator’s corresponding booking and payment status. Mention the balance invoice only if the sequence stays clear. |
| 02:25–02:40 | Explain what was added during the hackathon, identify APIMatic’s contribution and point to the runnable source. |

For potential impact, use the provider survey and completed tester observations with their actual limits. The current blank observation sheet cannot support a conversion, time-saving or demand claim. For technical implementation, describe server-owned prices, explicit approval and consistent payment/booking state in one sentence, then let the working footage demonstrate the outcome.

## Tooling details worth retaining

The session distinguishes three tools: the **PayPal AI Toolkit** helps coding assistants; the **Agent Toolkit** supplies tools for application agents; the **MCP server** exposes PayPal operations. See [15:58](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=958s), [19:10](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=1150s) and [23:58](https://www.youtube.com/watch?v=FFJfCW9z3Do&t=1438s). These are useful development options, not a stated submission requirement to replace our adapter.

The current [PayPal AI Toolkit README](https://github.com/paypal/AI-Toolkit#readme) clarifies two details from the recording: Codex uses skills and MCP through natural language, while slash commands are for Claude Code and Cursor; token expiry depends on scope, so use the returned `expires_in` rather than the speaker’s approximate nine-hour figure. A 401 can indicate an expired token. Its diagnostic commands cover integration review and error explanation.

Our installed **APIMatic Context Plugin** is a separate product. The repository records its use for the pinned generated SDK adapter, and the owner chose APIMatic as the sponsor target while skipping AG Studio. Preserve that distinction in the tool list and sponsor entry (`docs/plans/2026-10-03-paypal-hackathon-booking-notes.md:315`, `:569`).

Resources shared: [developer docs](https://developer.paypal.com), [AI resources](https://developer.paypal.com/ai-tools/get-started), [AI Toolkit](https://github.com/paypal/AI-Toolkit), [official Postman workspace](https://postman.com/paypal), [example code](https://github.com/paypal-examples/docs-examples) and [PayPal Discord](https://developer.paypal.com/discord).

## Submission preparation priorities

1. Record the complete 2:40 working journey on the final demonstrated candidate, with English narration or captions and visible fixture/sandbox labels.
2. Complete the planned human validation sessions and describe observed friction and comprehension without unsupported improvement claims.
3. Prepare the existing-project change summary and the APIMatic contribution explanation with dated repository evidence.
4. Verify judge access from a fresh browser and keep it usable through December 15. Check voucher limits, bookable dates, sandbox buyer access and operator access against the current submission instructions.
5. Recheck the official deadline and sponsor entry conditions, then submit with the existing November 11 margin.

This review adds submission notes only. Recorded acceptance results remain bounded by their tested identities and environments; publication and any new provider or production actions follow their existing authorization gates.
