# Hacker News: Show HN

## Title

```
Show HN: Paisaxe – Voice-powered travel guide built with Claude, ElevenLabs, and RAG
```

Alternative:
```
Show HN: I built a conversational travel guide using RAG and voice AI
```

---

## Post Body

Link: https://paisaxe.com

I built a travel guide for Asturias (northern Spain) that you can chat with—either by text or voice.

**The problem I wanted to solve:**

Travel planning is either "read 50 blog posts" or "ask ChatGPT and hope it doesn't hallucinate." I wanted something that actually knew a specific region deeply and could answer questions like a knowledgeable local would.

**How it works:**

1. Ingested 37 PDFs of local travel guides, hiking routes, and cultural documentation
2. Chunked and embedded with Voyage AI (voyage-3, 512 dimensions using Matryoshka)
3. Hybrid search: pgvector similarity + keyword matching
4. Two-stage retrieval: fetch 10 candidates, rerank to top 3 with Voyage rerank-2.5
5. Claude generates responses with the retrieved context
6. Voice agents via ElevenLabs Conversational AI for hands-free interaction

**Stack:**
- Next.js 15 (App Router)
- Supabase (Postgres + pgvector)
- Claude API for chat
- Voyage AI for embeddings + reranking
- ElevenLabs for voice
- Deployed on Vercel

**What I learned:**

- Matryoshka embeddings at 512 dims perform nearly as well as 1024 for this use case, with significant cost savings
- Two-stage retrieval (retrieve then rerank) dramatically improved answer relevance vs. just top-k vector search
- Voice adds a surprisingly different UX—people ask questions differently when speaking vs. typing

The site is free, no login required. Would love feedback on the RAG implementation or UX.

---

## Potential HN Questions to Prepare For

**Q: Why not just use ChatGPT/Perplexity?**
A: They hallucinate on specific local details. My system is grounded in verified local sources and cites them. When it doesn't know something, it says so.

**Q: Why 512 dimensions instead of higher?**
A: Matryoshka embeddings let you truncate. I tested 256/512/1024—512 was the sweet spot for retrieval quality vs. storage/compute cost. Diminishing returns above that for this corpus size.

**Q: How do you handle the voice latency?**
A: ElevenLabs Conversational AI handles the real-time aspects. The bottleneck is actually the RAG retrieval + Claude generation. I stream responses to minimize perceived latency.

**Q: What's the corpus size?**
A: ~37 PDFs, roughly 200k tokens of source material after chunking. Small but deep on one region.

**Q: Cost to run?**
A: Supabase free tier, Vercel free tier, pay-as-you-go for Claude/Voyage/ElevenLabs. At current traffic (low), under $50/month.

---

## Timing

- Post between 9-11am ET on Tuesday-Thursday
- Avoid Mondays (crowded) and Fridays (low engagement)
- Be available to respond to comments for the first 2-3 hours
