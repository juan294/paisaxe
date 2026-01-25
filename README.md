# Asturias Tourism Guide

An AI-powered tourism guide for Asturias, Spain. Experience the region through immersive visual stories and ask questions in natural language to discover hidden gems, local gastronomy, hiking routes, and more.

## Features

- **Immersive Visual Stories**: Full-screen images showcasing Asturias' landscapes, cities, and culture
- **AI-Powered Chat**: Ask questions about any location and get contextual answers
- **Voice Input**: Use speech recognition to ask questions hands-free
- **Multilingual**: Responds in Spanish or English based on your query
- **Curated Content**: Information sourced from official Asturias tourism guides

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| AI Chat | Claude API (Anthropic) |
| Embeddings | Voyage AI |

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Anthropic API key
- Voyage AI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/juan294/asturias.git
   cd asturias
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
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   VOYAGE_API_KEY=pa-xxxxx
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
   SUPABASE_SERVICE_KEY=eyJxxxxx
   ```

5. Set up the database:
   - Create a Supabase project
   - Run the migrations in `supabase/migrations/`
   - Enable the pgvector extension

6. Seed the database with tourism content:
   ```bash
   npm run process-pdfs   # Extract content from PDFs
   npm run seed-db        # Generate embeddings and populate DB
   ```

7. Start the development server:
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |

## Project Structure

```
asturias/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/chat/           # Chat API endpoint
│   │   └── immersive/          # Immersive stories page
│   ├── components/
│   │   ├── immersive/          # Story viewer & voice chat
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/                    # Utilities & API clients
│   └── types/                  # TypeScript definitions
├── content/
│   └── pdfs/                   # Source tourism guides
├── scripts/                    # Data processing scripts
└── supabase/
    └── migrations/             # Database schema
```

## Content Sources

The tourism information is sourced from official Asturias guides covering:
- City guides (Oviedo, Gijón, Avilés)
- Outdoor activities (hiking, cycling)
- Culture (pre-Romanesque art, museums)
- Gastronomy (sidra, fabada, local dishes)
- Camino de Santiago planning
- Family activities

## License

MIT
