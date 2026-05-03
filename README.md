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
   - Run the migrations in `supabase/migrations/` (83 migration files)

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
│   └── pdfs/                   # Source tourism guides (37 PDFs)
├── scripts/                    # Data processing & automation
├── supabase/
│   ├── functions/              # Edge Functions (Deno)
│   └── migrations/             # Database schema (83 migrations)
├── docs/                       # Project documentation
└── .github/
    └── workflows/              # CI/CD (9 workflows)
```

## CI/CD

Automated quality checks run on every push and pull request via GitHub Actions.

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **CI** | Push/PR | Lint, typecheck, verification wiring, test, build |
| **E2E** | Push/PR | Playwright end-to-end tests |
| **Stripe E2E Integration** | Stripe-touching PR paths, nightly, manual dispatch | Real Stripe test-mode checkout; manual live gate fails if required secrets are missing |
| **Security Audit** | Push/PR + weekly | `npm audit` for vulnerabilities |
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

Tourism information sourced from 37 official Asturias guides:
- City guides (Oviedo, Gijon, Aviles)
- Outdoor activities (hiking, cycling)
- Culture (pre-Romanesque art, museums, festivals)
- Gastronomy (sidra, fabada, local dishes)
- Camino de Santiago planning
- Family activities and seasonal events

## License

MIT
