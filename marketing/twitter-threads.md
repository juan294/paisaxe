# Twitter/X Content

## Launch Thread

**Tweet 1 (hook):**
I spent months building an AI travel guide for one tiny region of Spain.

Not a startup. Not trying to scale. Just obsessed with Asturias.

Here's what I learned building it: 🧵

---

**Tweet 2:**
The problem with travel planning in 2026:

• Generic "top 10" listicles
• ChatGPT hallucinating restaurant names
• 47 browser tabs open

I wanted something that actually knew a place deeply.

---

**Tweet 3:**
So I built Paisaxe—an AI guide that only knows Asturias, Spain.

Free text chat: ask anything.
€1.99/day Voice Pass: Pelayo checks live weather, finds restaurants, and calls to book your table.

Yes, a real phone call. On your behalf.

paisaxe.es

---

**Tweet 4:**
The tech stack:
• 37 local PDFs → chunked and embedded
• Voyage AI for embeddings (512 dim Matryoshka)
• pgvector for hybrid search
• Two-stage retrieval: fetch 10 → rerank to top 3
• Claude for text chat
• ElevenLabs + Twilio for voice agent with real-world actions

---

**Tweet 5:**
Biggest lesson: retrieval quality matters more than model quality.

A mediocre LLM with great retrieval beats a great LLM with mediocre retrieval.

Two-stage reranking was the unlock.

---

**Tweet 6:**
Second lesson: voice + tools = concierge.

Text chat: "restaurants oviedo" → get a list
Voice (Pelayo): "Find me somewhere for dinner tonight in Oviedo, local food, not too fancy" → finds a place, shows hours and ratings, calls to book a table

Not a different UX. A different product.

---

**Tweet 7:**
Why Asturias?

• Mountains meet ocean
• Spain's best cider culture
• Pre-Romanesque UNESCO sites
• Original Camino de Santiago route
• Zero crowds compared to Barcelona/Madrid

It deserves more attention.

---

**Tweet 8:**
Paisaxe: free text chat. No ads. No login.

€1.99/day unlocks Pelayo—live weather, restaurant search, phone bookings.

If you're planning a Spain trip or curious about building AI agents with real-world actions, check it out:

paisaxe.es

---

## Standalone Tweets

**For #buildinpublic:**
```
Shipped an AI travel guide for Asturias, Spain.

Free text chat + €1.99/day voice agent that checks weather, finds restaurants, and calls to book your table.

Stack: Next.js + Supabase + Claude + ElevenLabs + Twilio

paisaxe.es
```

**For travel audience:**
```
Hot take: Asturias is the most underrated region in Europe for hiking.

Picos de Europa + zero crowds + cider culture + beach access

I built an AI guide to help plan trips: paisaxe.es
Free to chat. €1.99/day for a voice guide who books restaurants for you.
```

**For AI/LLM audience:**
```
RAG tip that made a big difference:

Don't just do top-k vector search.

Retrieve 10 candidates, then rerank with a cross-encoder to get top 3.

The quality jump is significant for conversational AI.
```

---

## Hashtags to Use

General: #buildinpublic #indiehacker #solofounder
Tech: #RAG #LLM #AI #voiceAI
Travel: #spain #asturias #travel #hiking #picosdeeuropa

---

## Engagement Strategy

1. Post thread Tuesday-Thursday, 8-10am ET or 12-2pm ET
2. Reply to comments within first hour (algorithm boost)
3. Quote-tweet with additional context 24 hours later
4. Engage with travel/AI accounts before and after posting
5. Don't use all hashtags at once—looks spammy. Pick 2-3 per tweet.
