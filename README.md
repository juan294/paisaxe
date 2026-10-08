# Paisaxe - Look. Ask. Discover.

[![CI](https://github.com/juan294/paisaxe/actions/workflows/ci.yml/badge.svg)](https://github.com/juan294/paisaxe/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/juan294/paisaxe/actions/workflows/e2e.yml/badge.svg)](https://github.com/juan294/paisaxe/actions/workflows/e2e.yml)
[![Security Scan](https://github.com/juan294/paisaxe/actions/workflows/security.yml/badge.svg)](https://github.com/juan294/paisaxe/actions/workflows/security.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24_LTS-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[paisaxe.es](https://paisaxe.es)**

An AI-powered tourism experience for Asturias, Spain. Explore the region through immersive visual stories and ask questions via voice or text to discover landscapes, local gastronomy, hiking routes, and more.

*"Paisaxe" means "landscape" in Asturian (Bable), the traditional language of the region.*

## Features

- **Immersive Visual Stories**: Full-screen carousel showcasing Asturias' landscapes, cities, and culture
- **AI-Powered Chat**: Ask questions about any location and get contextual answers with source references
- **Voice Input**: Speech recognition for hands-free questions
- **Voice Agents**: AI-powered conversational guides via ElevenLabs for immersive storytelling
- **Multilingual**: UI in Spanish; chat responds in the visitor's language
- **Curated Content**: Information sourced from 37 official Asturias tourism guides
- **User Favorites**: Save and revisit stories you love (Google OAuth)
- **Admin Panel**: Content curation and feature flag management
- **Real-time Updates**: Live content sync via Supabase Realtime
- **Analytics**: Visitor interaction tracking

## Hackathon: booking local experiences through conversation (PayPal AI Hackathon)

During the PayPal AI Hackathon, Paisaxe gained a booking flow for local experiences.
Visitors describe in the text chat how many people are going, the date, their budget and
any needs (for example, step-free access). The assistant compares that with the
provider's catalog and its stated facts. Then it makes an explicit offer, holds a place
when the visitor accepts, and takes a deposit through **PayPal (sandbox)**. Visitors can
see and cancel the booking afterwards. The decision is recorded in
[ADR-0024](docs/decisions/0024-conversational-experience-booking.md), and the
implementation follows the
[plan](docs/plans/2026-10-03-paypal-hackathon-booking.md) and its
[notes](docs/plans/2026-10-03-paypal-hackathon-booking-notes.md) (deviations, reviews and
evidence for each phase).

### What it does

- **Conversational booking.** `POST /api/booking/chat/stream` runs Claude with tools:
  `search_experiences`, `update_booking_draft`, `get_quote`, `create_payment_order`,
  `get_booking_status` and `preview_cancellation`. Tools take ids, not amounts. Every
  price comes from the database, inputs are validated with zod, and ownership is checked
  on the server. A visitor need is judged *supported*, *unsupported* or *unknown* from the
  provider's facts. The assistant may not claim that an unknown is suitable.
- **Money moves only on a button.** Accepting an offer, paying and confirming a
  cancellation are buttons. The model cannot call them, and a typed "I accept" or
  "cancel it" does nothing by itself.
- **PayPal deposit.** Orders are created through the official PayPal Server SDK
  (`@paypal/paypal-server-sdk` 2.5.0, built with the PayPal Context Plugin; see
  [docs/hackathon/apimatic.md](docs/hackathon/apimatic.md)) with an idempotency key,
  and the buyer approves by redirect. A single capture path is shared by the return page,
  the `CHECKOUT.ORDER.APPROVED` webhook and a reconciliation cron that runs every 5 minutes,
  so a buyer who approves and closes the browser is still confirmed. Webhooks are
  signature-verified and stored in an inbox, so a failed event is retried. A capture that
  cannot be honoured is refunded exactly once.
- **Capability links.** Each booking has a link `/booking/<id>.<token>`, an HMAC that can be
  rebuilt and revoked. The link alone opens the booking: status, payment, cancellation.
  Tokens never reach the model and are redacted from PostHog, Sentry and Vercel Analytics.
- **Voucher access.** New bookings are invisible to ordinary visitors. `/acceso` redeems a
  voucher code with a Supabase anonymous session, so no account is needed. Every
  booking-start route answers 404 without an active redemption, while the
  `experience_booking` flag is off, or on a Vercel Preview. Each redemption is metered
  (60 chat turns and 10 booking attempts by default). A voucher may also grant a 24-hour
  pass for the existing voice guide.
- **Cancellation.** A preview computes the refund and writes nothing: the full deposit up to
  24 hours before the start, nothing after. Confirming sends the amount that was shown. The
  server recomputes it under a row lock and refuses with the new terms if they changed.
  Then it refunds the deposit through PayPal, or cancels without a refund after the
  cutoff.
- **Operator view.** `/operator/<id>.<token>` is a capability link for the merchant. It
  shows upcoming and recent bookings, deposits collected, the balance due, exceptions,
  active holds (with a release action), free places for 14 days, and a link re-issue for a
  booking. It also checks each deposit against PayPal's own records (Transaction Search,
  read-only): "PayPal confirma", "Reembolso en PayPal", or "Pendiente en PayPal" while PayPal
  has not listed it yet. This view is in Spanish.
- **Postman collection.** [`docs/hackathon/postman/`](docs/hackathon/postman/README.md)
  walks the same journey over HTTP, including the negative cases.

### Fixture merchant and sandbox labels

The catalog belongs to a **fictitious merchant**, "Rutas del Sella (demo, ficticio)"
(`merchants.is_fixture = true`). It is seeded by migration
`116_operator_access_and_fixture.sql` with three experiences, available every day at 10:00
and 16:00 (Madrid time), 12 places per slot, all prices for one party:

| Experience | Price | Deposit | Max party | Step-free access (provider fact) |
| --- | --- | --- | --- | --- |
| Paseo por la senda costera (coastal walk) | €120 | €30 | 6 | yes |
| Descenso en canoa (canoe descent) | €60 | €15 | 4 | no |
| Ruta de miradores en 4x4 (4x4 viewpoint route) | €200 | €50 | 6 | unknown (not confirmed) |

Every booking card carries a "Demo" badge, and the payment card says "PayPal sandbox: test
payment, no real money". The operator view marks the merchant "demo". No real provider
takes part, and none is implied.

### Run it from a fresh clone (local only)

Everything below runs on your machine against a local Docker Supabase. **Never point
these steps at a production project.**

**Required:** Node.js 24, npm, Docker. **Optional:** an Anthropic API key (needed only for
the chat itself; the Postman run below does not need it), a Voyage AI key (guide context
in the chat; skipped without one), and your own PayPal sandbox app (instead of the local
PayPal mock).

1. Install and start the local database:

   ```bash
   git clone https://github.com/juan294/paisaxe.git && cd paisaxe
   npm install
   npx supabase start -x vector,logflare   # the vector container is unhealthy on some machines
   npx supabase db reset                    # re-applies every migration, including 112-124
   ```

   Migrations 112 to 124 create the booking schema, the fixture merchant and the operator
   row. They also turn the `experience_booking` flag on for the `development` environment
   (it is off for `production`). Local anonymous sign-ins are on in `supabase/config.toml`.

2. Environment variables. The template is `.env.example`. For the booking flow the app
   needs:

   | Variable | Local value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` from `npx supabase status -o env` |
   | `BOOKING_LINK_SECRET` | any random value of at least 32 bytes, e.g. `openssl rand -base64 48` |
   | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE` | the mock: `local-mock`, `local-mock`, `http://127.0.0.1:4010`. Your sandbox app: its credentials and `https://api-m.sandbox.paypal.com` (the only non-loopback host the adapter accepts) |
   | `PAYPAL_WEBHOOK_ID` | optional; the id of a sandbox webhook that reaches your machine through a tunnel. Without it, the return page and reconciliation still confirm payments |
   | `ANTHROPIC_API_KEY` | optional; needed for the booking chat |

3. Reproduce the whole journey with the Postman collection, Newman and the PayPal mock. In
   three terminals, follow [docs/hackathon/postman/README.md](docs/hackathon/postman/README.md#run-it-locally-newman-local-docker-paypal-mock):

   ```bash
   npx tsx scripts/booking/postman-local.ts    # 1: PayPal mock, flag on, a local voucher
   # 2: next dev on port 3006 with only the local variables (exact command in that README)
   npx --yes newman@6 run docs/hackathon/postman/paisaxe-booking.postman_collection.json \
     -e "$TMPDIR/paisaxe-postman/paisaxe-booking.local.postman_environment.json"   # 3
   ```

   The run redeems a voucher, accepts a quote, pays the deposit, confirms the booking,
   cancels it with a refund, and checks the 404, 409 and webhook cases. Its last recorded
   run is in [`run-2026-10-03-local.md`](docs/hackathon/postman/run-2026-10-03-local.md).
   To use your own PayPal sandbox instead of the mock, follow the approval step in the
   same README.

4. Issue vouchers and operator links for your local stack (both scripts target local by
   default; production needs `--target production --yes-production` and the owner):

   ```bash
   npx tsx scripts/booking/create-voucher.ts --label local-test
   BOOKING_LINK_SECRET=<the server's secret> \
     npx tsx --conditions=react-server scripts/booking/create-operator-link.ts --merchant demo-rutas-del-sella
   ```

5. Tests: `npm run test` runs the unit suites. The live database suites
   (`*.postgrest-integration.test.ts`) run when the local stack is up and skip otherwise.
   `npm run eval:booking` runs the six-scenario model evaluation against the local stack.
   It reads only `ANTHROPIC_API_KEY`: from the environment
   (`ANTHROPIC_API_KEY=… npm run eval:booking`), else from `$HOME/code/paisaxe/.env.local`.
   Its results are in [`docs/hackathon/evaluation/`](docs/hackathon/evaluation/).

`next dev` rewrites `AGENTS.md`; restore it with `git checkout -- AGENTS.md`.

### What changed during the hackathon

The baseline is commit `d368b2b3` (1 October 2026). `git log d368b2b3..` lists every
change since then. The booking feature is the bulk of it:

- **Phase 0:** ADR-0024, the release-checklist rulings, and spikes for the PayPal sandbox
  cycle and SDK tool streaming.
- **Phase 1:** migrations 112 to 117, covering the booking schema, the atomic
  `accept_quote`, availability with one inventory owner, provider facts, the fixture
  merchant and the flag.
- **Phase 2:** the voucher gate (`/acceso`, `redeem_voucher`), anonymous guest sessions,
  metering and Preview isolation.
- **Phase 3:** the booking chat route, the tool loop, the cards and the `?booking=1` text
  entry.
- **Phase 4:** the PayPal adapter, the single capture path, the booking and return pages,
  capability links with telemetry redaction, the webhook inbox and the reconciliation cron.
- **Phase 5:** cancellation (preview and confirm), the operator view and the Postman
  collection.
- **Phase 6:** this section, the `LICENSE` file, the review-workflow author check and the
  release probes.

The same range also contains unrelated maintenance: dependency updates, a database
security fix (migration 110), the RAG embedding-model fix and migration 111, CI pinning,
and the removal of the tourism guide PDFs from the repository.

### Known limitations

- **Sandbox only, one fictitious merchant.** No real money moves. Bookings are for one
  party, in EUR. The deposit is taken now; the balance is due on the day and is not
  collected by the app. There is no multi-merchant onboarding, commission or payout.
- **Booking is text only.** The voice guide is the existing discovery guide and cannot
  book.
- **A normal local browser cannot run the booking flow.** The site's Content Security
  Policy allows Supabase only at `https://*.supabase.co`, so a browser cannot reach
  `http://127.0.0.1:54321`. Locally, the journey is reproduced over HTTP (Postman/Newman),
  by the test suites, and by the `booking-roundtrip` Playwright probe, which runs it in a
  browser with the CSP bypassed for that test only.
- **Voice minutes are not metered.** The redemption cap limits distinct guests, and the
  voice-session rate limit bounds session starts, not minutes. The only real stop is the
  ElevenLabs workspace limit, so vouchers can be issued without the voice pass
  (`--no-voice`).
- **Guest identity is the browser session.** If both the booking link and the anonymous
  session are lost, only the operator can re-issue the link. The assistant can show the
  link again only while the session lasts.
- **Refusals in the compensation path.** A refund that PayPal refuses outright, when a
  payment that could not be honoured is being refunded, is retried by reconciliation
  instead of stopping. The booking is already flagged for attention and visible to the
  operator. Refunds for cancellations stop on a definitive refusal.
- **Webhook coverage.** `PAYMENT.CAPTURE.PENDING` and `PAYMENT.CAPTURE.DENIED` are handled
  but were not observed in the sandbox. Events that match no payment (for example, from
  another environment sharing the sandbox app) stay in the inbox and are not replayed.
  Reconciliation queries every open payment directly, so no payment depends on them.
- **Demo-scale queries.** A search without a date makes 7 availability calls per
  experience, and the operator view makes 14 per active experience.
- **Platform request logs** contain capability paths. Analytics and error tracking redact
  them; the hosting provider's own logs are private to the owner.
- **Smaller accepted residuals.** A retried acceptance of the same offer spends one of the
  10 booking attempts. A 6-character booking reference could collide; the unique
  constraint rejects the duplicate. If creating a new quote version fails, the draft has no
  open offer until the visitor asks again.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| AI Chat | Claude API (Anthropic) |
| Embeddings | Voyage AI (voyage-3.5, 512 dims) |
| Reranking | Voyage AI (rerank-2.5) |
| Voice Agents | ElevenLabs Conversational AI |
| Auth | Google OAuth via Supabase Auth |
| Testing | Vitest + React Testing Library + Playwright |
| Deployment | Vercel |
| Monitoring | Upptime + Vercel Speed Insights |
| Logging | Pino (structured JSON) + Sentry (error tracking) |
| Cache | Upstash Redis (embedding cache, rate limiting) |

## Getting Started

### Prerequisites

- Node.js 24+ (LTS)
- npm
- Supabase account
- Anthropic API key
- Voyage AI API key
- ElevenLabs API key (optional, for voice agents)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/juan294/paisaxe.git
   cd paisaxe
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your environment variables in `.env.local`:
   ```
   # AI Services
   ANTHROPIC_API_KEY=
   VOYAGE_API_KEY=
   ELEVENLABS_API_KEY=     # Voice agents (optional)

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_KEY=

   # Admin
   ADMIN_SECRET_KEY=

   # Google OAuth
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=

   # Webhooks
   WEBHOOK_SECRET=

   # Site URL
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Set up the database:
   - Create a Supabase project
   - Enable the pgvector extension
   - Run the migrations in `supabase/migrations/` (96 migration files)

6. Seed the database with tourism content:
   ```bash
   npm run process-pdfs     # Extract content from PDFs
   npm run extract-images   # Extract images from PDFs
   npm run seed-all         # Seed images + embeddings
   ```

7. Start the development server:
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run build:analyze` | Create a webpack analyzer build and write bundle reports under `.next/analyze/` |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint for `src/` and TypeScript scripts |
| `npm run lint:scripts` | Run ESLint for `scripts/` |
| `npm run typecheck` | Run TypeScript checks for app, scripts, E2E, and Edge functions |
| `npm run check-verification-coverage` | Verify CI/package wiring for non-src and live-gate coverage |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run unit & component tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:ui` | Open Vitest UI |
| `npm run test:e2e` | Run E2E tests (Playwright, headless) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:headed` | Run with visible browser |
| `npm run test:e2e:debug` | Debug mode with inspector |
| `npm run test:e2e:stripe` | Run real Stripe test-mode checkout integration (requires Stripe/Supabase QA env vars) |
| `npm run prelaunch:live` | Run launch-critical live integration gate; fails instead of skipping missing credentials |

### Data Pipeline

| Command | Description |
|---------|-------------|
| `npm run process-pdfs` | Extract text content from PDFs |
| `npm run extract-images` | Extract images from PDFs |
| `npm run generate-stories` | Generate story definitions |
| `npm run seed-db` | Generate embeddings and populate DB |
| `npm run seed-db:clear` | Clear and re-seed embeddings |
| `npm run seed-images` | Seed extracted images to DB |
| `npm run seed-images:clear` | Clear and re-seed images |
| `npm run seed-all` | Seed images + embeddings |
| `npm run seed-all:clear` | Clear and re-seed everything |

## Project Structure

```
paisaxe/
├── e2e/                        # Playwright E2E tests
│   ├── fixtures/               # Mock data for E2E
│   └── *.spec.ts               # Test files
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Redirects to /immersive
│   │   ├── layout.tsx          # Root layout
│   │   ├── admin/              # Admin panel
│   │   ├── auth/               # OAuth callback
│   │   ├── favorites/          # User favorites page
│   │   ├── immersive/          # Immersive stories page
│   │   ├── story/              # Individual story pages
│   │   └── api/
│   │       ├── chat/           # Chat endpoint
│   │       ├── health/         # Health check (uptime monitoring)
│   │       └── webhooks/       # Supabase webhook receiver
│   ├── components/
│   │   ├── a11y/               # Accessibility components
│   │   ├── admin/              # Admin panel components
│   │   ├── auth/               # Authentication UI
│   │   ├── immersive/          # Story viewer & voice chat
│   │   ├── seo/                # SEO components
│   │   └── ui/                 # shadcn/ui components
│   ├── config/                 # Feature configuration
│   │   └── elevenlabs-agents.ts # Voice agent IDs
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities & API clients
│   │   └── i18n/               # Internationalization
│   └── types/                  # TypeScript definitions
├── content/
│   └── pdfs/                   # Source tourism guides (not tracked; see Content Sources)
├── scripts/                    # Data processing & automation
├── supabase/
│   ├── functions/              # Edge Functions (Deno)
│   └── migrations/             # Database schema (96 migrations)
├── docs/                       # Project documentation
└── .github/
    └── workflows/              # CI/CD (11 workflows)
```

## CI/CD

Automated quality checks run on every push and pull request via GitHub Actions.

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **CI** | Push/PR | Lint, typecheck, verification wiring, test, build |
| **E2E** | Push/PR | Playwright end-to-end tests |
| **Stripe E2E Integration** | Stripe-touching PR paths, nightly, manual dispatch | Real Stripe test-mode checkout; manual live gate fails if required secrets are missing |
| **Security Audit** | Push/PR + daily 08:00 UTC | `npm audit --omit=dev --audit-level=moderate` |
| **Gitleaks** | Push/PR + daily | Scans for secrets in git history |
| **License Check** | PRs | Blocks copyleft/GPL dependencies |
| **Lighthouse CI** | PRs | Performance & accessibility auditing |
| **Bundle Size** | PRs | Reports JS bundle sizes as PR comment |
| **Knip** | PRs | Dead code & unused dependency detection |
| **Claude Review** | PRs | AI-powered code review |

Dependabot opens weekly PRs for dependency updates.

## Architecture

### Chat Pipeline

1. User sends a question (text or voice)
2. Generate embedding via Voyage AI (`voyage-3.5`, 512 dims)
3. Find top-10 candidate chunks via pgvector similarity search
4. Rerank candidates to top-3 via Voyage AI `rerank-2.5`
5. Pass reranked context to Claude for response generation
6. Render markdown response with inline images and source attribution

### Voice Agents

ElevenLabs Conversational AI powers interactive voice guides for immersive storytelling:
- **Pelayo** - Visitor guide for story exploration (default agent)
- Real-time voice conversation with WebSocket streaming
- Automatic speech recognition and text-to-speech
- Transcript displayed alongside voice interaction
- Gated by `visitor_voice_agent` feature flag in admin panel

### Database

PostgreSQL on Supabase with pgvector for vector similarity search, pg_cron for scheduled maintenance, and pg_net for webhook-driven cache invalidation.

### Edge Functions

Deno-based functions on Supabase for background tasks:
- **keep-alive**: Prevents free-tier database auto-pause
- **cleanup-analytics**: Deletes analytics events older than 90 days

## Content Sources

Tourism information is sourced from 37 official Asturias tourism guides published by
Turismo Asturias (Sociedad Pública de Gestión y Promoción Turística y Cultural del
Principado de Asturias). Topics covered:
- City guides (Oviedo, Gijon, Aviles)
- Outdoor activities (hiking, cycling)
- Culture (pre-Romanesque art, museums, festivals)
- Gastronomy (sidra, fabada, local dishes)
- Camino de Santiago planning
- Family activities and seasonal events

The guides are the property of their publisher and are **not distributed with this
repository**. To run the content pipeline locally, download the guides from
[turismoasturias.es](https://www.turismoasturias.es) into `content/pdfs/` (gitignored)
and run `npm run process-pdfs`. Story photographs are attributed to their sources in each
story's `image_source` field; most come from Unsplash.

## License

The source code in this repository is released under the [MIT License](LICENSE).

The license covers the code only. Tourism guide content, photographs and other
third-party material referenced or processed by this project remain the property of
their respective owners and are not covered by the MIT License.
