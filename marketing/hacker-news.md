# Hacker News: Show HN

## Title

```
Show HN: Paisaxe – AI travel guide that checks weather, finds restaurants, and calls to book your table
```

Alternative:
```
Show HN: I built a voice AI concierge for Asturias that makes real phone calls to book reservations
```

---

## Post Body

Link: https://paisaxe.es

I built a travel guide for Asturias (northern Spain) with two tiers: free text chat and a €1.99/day voice concierge that takes real-world actions.

**The problem I wanted to solve:**

Travel planning is either "read 50 blog posts" or "ask ChatGPT and hope it doesn't hallucinate." I wanted something that actually knew a specific region deeply—and could act on that knowledge.

**How it works:**

1. Ingested 37 PDFs of local travel guides, hiking routes, and cultural documentation
2. Chunked and embedded with Voyage AI (voyage-3, 512 dimensions using Matryoshka)
3. Hybrid search: pgvector similarity + keyword matching
4. Two-stage retrieval: fetch 10 candidates, rerank to top 3 with Voyage rerank-2.5
5. Claude generates responses with the retrieved context (free tier)
6. Voice agent "Pelayo" via ElevenLabs Conversational AI with real-world tools (paid tier)

**The voice agent can:**
- Check live weather via OpenWeatherMap before your hike
- Search restaurants/places with real-time hours, ratings, and phone numbers via Google Places
- Call a restaurant on your behalf via Twilio and make a reservation—a real outbound phone call

**Stack:**
- Next.js 16 (App Router)
- Supabase (Postgres + pgvector)
- Claude API for text chat
- Voyage AI for embeddings + reranking
- ElevenLabs for voice agent
- Twilio for outbound booking calls
- Stripe for payments
- Deployed on Vercel

**What I learned:**

- Matryoshka embeddings at 512 dims perform nearly as well as 1024 for this use case, with significant cost savings
- Two-stage retrieval (retrieve then rerank) dramatically improved answer relevance vs. just top-k vector search
- Giving a voice agent tools (weather, places, phone calls) transforms it from a chatbot into a concierge. The product shift was more significant than the UX shift.

Text chat is free, no login required. Voice Pass is €1.99/day. Would love feedback on the architecture or the voice-to-action pipeline.

---

## Potential HN Questions to Prepare For

**Q: Why not just use ChatGPT/Perplexity?**
A: They hallucinate on specific local details. My system is grounded in verified local sources and cites them. When it doesn't know something, it says so. And neither of them will call a restaurant and make a reservation for you.

**Q: Why 512 dimensions instead of higher?**
A: Matryoshka embeddings let you truncate. I tested 256/512/1024—512 was the sweet spot for retrieval quality vs. storage/compute cost. Diminishing returns above that for this corpus size.

**Q: How does the phone booking work?**
A: Pelayo uses ElevenLabs Conversational AI + Twilio. When a user asks to book, Pelayo searches Google Places for the restaurant, gets the phone number, and initiates an outbound call. He speaks to the restaurant staff in Spanish, makes the reservation, and confirms back to the user.

**Q: How do you handle the voice latency?**
A: ElevenLabs Conversational AI handles the real-time aspects. The bottleneck is actually the RAG retrieval + tool execution. I stream responses to minimize perceived latency.

**Q: What's the corpus size?**
A: ~37 PDFs, roughly 200k tokens of source material after chunking. Small but deep on one region.

**Q: Why €1.99/day instead of a subscription?**
A: Tourism is inherently transactional. Most visitors need a guide for a day trip, not a month. A day pass maps to the use case and keeps the impulse-buy friction low.

**Q: Cost to run?**
A: Supabase free tier, Vercel free tier, pay-as-you-go for Claude/Voyage/ElevenLabs/Twilio. Text chat costs are low. Voice + outbound calls are the main variable cost, but revenue from Voice Pass covers it at moderate usage.

---

## Timing

- Post between 9-11am ET on Tuesday-Thursday
- Avoid Mondays (crowded) and Fridays (low engagement)
- Be available to respond to comments for the first 2-3 hours
