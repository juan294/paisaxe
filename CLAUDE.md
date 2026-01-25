# Asturias Tourism Website

An immersive tourism experience for Asturias, Spain. Visitors explore the region through full-screen visual stories and can ask questions via voice or text to learn more about each location.

## Project Overview

- **Purpose**: Informative tourism site (no bookings)
- **Content Source**: 37 PDFs in `content/pdfs/` with curated tourism info
- **Interface**: Immersive visual stories with swipe navigation + voice/text chat
- **Languages**: UI in Spanish; chat responds in visitor's language

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| AI Chat | Claude API (Anthropic) |
| Embeddings | Voyage AI (voyage-3) |
| Testing | Vitest + React Testing Library |
| Deployment | Vercel |

## Git Workflow

**IMPORTANT: Always work on `develop` branch. Only merge to `main` for production releases.**

```bash
# Branch structure
main      # Production releases only
develop   # Active development (DEFAULT)
```

### Workflow Rules

1. **All development happens on `develop`**
2. **Never commit directly to `main`**
3. **Merge `develop` → `main` only when releasing to production**
4. **Always run tests before committing**

### Commit Process

```bash
# Before committing
npm run test           # Run all tests
npm run typecheck      # Check types
npm run lint           # Check linting

# Commit with descriptive message
git add <files>
git commit -m "feat: description"
```

### Release Process

```bash
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
git checkout develop
```

## CI/CD (GitHub Actions)

Automated quality checks run on every push and pull request to `develop` and `main`.

### Workflow Jobs

| Job | Description |
|-----|-------------|
| **lint-and-typecheck** | Runs `npm run typecheck` and `npm run lint` |
| **test** | Runs `npm run test` |
| **build** | Verifies production build with `npm run build` |

### Workflow Triggers

- Push to `develop` or `main` branches
- Pull requests targeting `develop` or `main`

### Required Checks

All three jobs must pass before merging:
- Lint & Typecheck
- Test
- Build

### Fixing CI Failures

1. **Typecheck failures**: Run `npm run typecheck` locally, fix type errors
2. **Lint failures**: Run `npm run lint` locally, fix or run `npm run lint -- --fix`
3. **Test failures**: Run `npm run test` locally, fix failing tests
4. **Build failures**: Run `npm run build` locally, check for build-time errors

### Notes

- Build job uses dummy env vars (APIs not called during build)
- Vercel deployment is handled separately via Vercel's GitHub integration
- Database migrations should be validated locally before pushing

## Test-Driven Development (TDD)

**IMPORTANT: Write tests BEFORE implementing new features.**

### TDD Workflow

1. **Red**: Write a failing test for the new feature
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

### Test Commands

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage report
npm run test:ui        # Open Vitest UI
```

### Test File Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- Located next to source files or in `__tests__/` directories
- Name pattern: `<component-name>.test.tsx`

### What to Test

- **Components**: Rendering, user interactions, state changes
- **API routes**: Request/response handling, error cases
- **Lib functions**: Embeddings, search, data transformations
- **Integration**: Chat flow end-to-end

## Project Structure

```
asturias/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Redirects to /immersive
│   │   ├── layout.tsx
│   │   ├── immersive/          # Immersive stories page
│   │   └── api/
│   │       └── chat/           # Chat endpoint
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   └── immersive/          # Story viewer & voice chat
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── claude.ts           # Claude API wrapper
│   │   ├── embeddings.ts       # Voyage AI embeddings
│   │   ├── search.ts           # Vector search logic
│   │   └── stories-data.ts     # Story content data
│   └── types/
│       ├── index.ts            # Core TypeScript types
│       └── immersive.ts        # Immersive mode types
├── content/
│   └── pdfs/                   # Source PDF files
├── scripts/
│   ├── process-pdfs.ts         # PDF text extraction
│   └── seed-database.ts        # Generate embeddings and populate DB
├── supabase/
│   └── migrations/             # Database schema
└── vitest.config.ts            # Test configuration
```

## Key Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Production build
npm run typecheck        # Run TypeScript checks
npm run lint             # Run ESLint

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Data Pipeline
npm run process-pdfs     # Extract content from PDFs
npm run seed-db          # Generate embeddings and populate database
npm run seed-db:clear    # Clear and re-seed database
```

## Environment Variables

Required in `.env.local`:
```
# AI Services
ANTHROPIC_API_KEY=       # Claude API key
VOYAGE_API_KEY=          # Voyage AI key for embeddings

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=    # Service role key (for seeding)
```

## Architecture Decisions

### Embeddings (Voyage AI)
- Model: `voyage-3` (1024 dimensions, optimized for multilingual)
- Batch processing: 128 texts per request
- Cost: ~$0.0001 per 1000 tokens

### Vector Search
- Store in Supabase pgvector with 1024 dimensions
- Hybrid search: vector similarity + keyword matching for place names
- Match threshold: 0.7 similarity

### Chat Flow
1. User sends query
2. Generate embedding via Voyage AI
3. Find top-k relevant chunks via vector search
4. Pass chunks as context to Claude
5. Claude generates response with references
6. Render response with linked images

### Response Rendering
- Support markdown in responses
- Display related images from PDFs inline
- Show source attribution (which guide, which section)

## Code Style

- Use ES modules (import/export)
- Prefer named exports over default exports
- Use `async/await` over `.then()` chains
- Components: PascalCase, files: kebab-case
- API routes return typed responses with proper error handling

## Database Schema

```sql
-- chunks table for PDF content (1024 dims for voyage-3)
create table chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1024),
  source_pdf text not null,
  page_number int,
  section_title text,
  image_refs text[],
  metadata jsonb,
  created_at timestamptz default now()
);

-- images table for extracted PDF images
create table images (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  caption text,
  source_pdf text not null,
  page_number int,
  tags text[],
  created_at timestamptz default now()
);
```

## Content Categories (from PDFs)

- City guides: Oviedo, Gijón, Avilés
- Activities: hiking, cycling, family activities
- Culture: pre-Romanesque art, museums, festivals
- Gastronomy: sidra, fabada, local dishes
- Camino de Santiago planning
- Seasonal events and practical tips
