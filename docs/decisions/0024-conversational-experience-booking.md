# ADR-0024: Conversational Booking of Local Experiences with PayPal Deposits

**Status:** Accepted
**Date:** 2026-10-02 (recorded 2026-10-03)
**Decided by:** Juan (owner), in conversation on 2026-10-02 and 2026-10-03
**Research:** [2026-10-02-paypal-ai-hackathon-proposal-assessment.md](../research/2026-10-02-paypal-ai-hackathon-proposal-assessment.md)
**Plan:** [2026-10-03-paypal-hackathon-booking.md](../plans/2026-10-03-paypal-hackathon-booking.md)

---

## Context

Paisaxe is an image-led discovery product for Asturias with a text and voice guide. Its
charter excluded bookings, transactions and monetization
(`docs/project/project-charter.md`, sections "What Paisaxe Is NOT" and "Core Values").

The PayPal AI Hackathon (submission deadline 2026-11-12, 12:00 Pacific / 21:00 Madrid)
accepts existing projects that are significantly updated during the event, and requires
central use of the PayPal sandbox together with AI. The owner chose to enter with
Paisaxe and to extend the product rather than build a separate demo.

## Decision

Paisaxe extends from discovery into **booking local experiences through conversation**:
a visitor describes people, date, budget and constraints; the AI matches them against a
provider-supplied catalog, presents an explicit offer, holds a slot, and the visitor pays
a deposit through PayPal. The visitor can then inspect and cancel the booking under the
stated terms.

Stripe remains the processor for existing voice passes. PayPal handles experience
deposits and refunds through a direct REST integration. Neither replaces the other.

The owner's decisions, numbered as in research section 1 and the plan:

| # | Decision |
| --- | --- |
| 1 | Direction approved; the charter's booking and monetization exclusions are superseded for this extension |
| 2 | Lean operation; the demo video is the primary judging artifact |
| 3 | No separate demo stack; the feature ships to the live site behind an access gate, with vouchers for judges |
| 4 | Guest booking by signed link; a seeded demo operator for the merchant view |
| 5 | The existing repository is published after a light cleanup; no new repository |
| 6 | APIMatic and Postman as support tools; native operator view; AG Studio only after a successful half-day trial; Bryntum not selected |
| 7 | Capture then refund in the core; authorize, capture and void only in the phone-confirmation stretch |
| 8 | The agent drives the PayPal operations through tools behind server validation |
| 9 | Extensions in order: invoice the balance, phone confirmation, Zapier |
| 10 | The video opens on the transaction |
| 11 | The release pull request's Vercel Preview is the standing exception to the no-Previews rule |
| 12 | Production verification of the booking flow is a separate, owner-authorized acceptance step; the required probes stay read-only |
| 13 | Content is published with its existing attribution; the remaining rights risk is accepted |

Planning added five design decisions (plan, P1 to P5): PayPal approval by redirect with
no JavaScript SDK; voucher identity through Supabase anonymous sign-in; operator access
by capability link rather than a new role; booking state held in the database and
injected each turn; own tool definitions over the PayPal REST API.

## Consequences

- **Charter.** The "not a booking engine" and "not a business" lines and the
  "discovery over commerce" value are rewritten to describe the new boundary: discovery
  stays first, and bookings exist only for local experiences that a visitor chooses
  through conversation. Ads, listings marketplaces and comparison pages stay excluded.
- **Operational scope grows.** Paisaxe now holds inventory, money state and refunds.
  The plan requires one capture path, a webhook inbox, reconciliation without the
  visitor, and explicit stuck-state recovery for each failure.
- **Release procedure.** Decisions 11 and 12 are written into
  `docs/runbooks/release-checklist.md`, the single procedural authority.
- **Public repository.** The repository becomes public for judging. The tourism guide
  PDFs were removed from history beforehand (#984, #985).
- **Fixture merchant.** Until a real provider participates, the catalog is a clearly
  labelled fictitious merchant, and no claim of provider adoption is made.

## Alternatives considered

- **Build a separate demo application.** Rejected by decision 3: more infrastructure for
  judges who mostly watch the video.
- **Route deposits through Stripe's PayPal method.** Rejected: the submission needs a
  PayPal-specific transaction flow driven by the agent.
- **Phone confirmation as the core flow.** Kept as a stretch goal; it adds authorization
  states and external dependencies the core does not need.
