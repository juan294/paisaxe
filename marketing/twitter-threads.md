# Twitter/X Content

## Launch Thread

**Tweet 1 (hook):**
I spent months building an AI travel guide for one tiny region of Spain.

Not a startup. Not trying to scale. Just obsessed with Asturias.

Here's what I learned building it: 🧵

---

**Tweet 2:**
The problem with travel planning in 2024:

• Generic "top 10" listicles
• ChatGPT hallucinating restaurant names
• 47 browser tabs open

I wanted something that actually knew a place deeply.

---

**Tweet 3:**
So I built Paisaxe—an AI you can chat with (or talk to by voice) that only knows Asturias, Spain.

Ask it anything:
• "Best 3-day hiking route in Picos de Europa"
• "Non-touristy sidrería in Oviedo"
• "What's the deal with pre-Romanesque churches"

paisaxe.com

---

**Tweet 4:**
The tech stack:
• 37 local PDFs → chunked and embedded
• Voyage AI for embeddings (512 dim Matryoshka)
• pgvector for hybrid search
• Two-stage retrieval: fetch 10 → rerank to top 3
• Claude for generation
• ElevenLabs for voice

---

**Tweet 5:**
Biggest lesson: retrieval quality matters more than model quality.

A mediocre LLM with great retrieval beats a great LLM with mediocre retrieval.

Two-stage reranking was the unlock.

---

**Tweet 6:**
Second lesson: voice changes how people ask questions.

Typed: "restaurants oviedo"
Spoken: "Hey, I'm looking for somewhere to eat dinner tonight in Oviedo, maybe something with local food but not too fancy?"

Different UX entirely.

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
Paisaxe is free. No ads. No login.

If you're planning a Spain trip or just curious about RAG implementations, check it out:

paisaxe.com

Happy to answer questions about the build.

---

## Standalone Tweets

**For #buildinpublic:**
```
Shipped a voice-powered travel guide for Asturias, Spain.

Stack: Next.js + Supabase + Claude + ElevenLabs

The retrieval pipeline took longer than the UI.

paisaxe.com
```

**For travel audience:**
```
Hot take: Asturias is the most underrated region in Europe for hiking.

Picos de Europa + zero crowds + cider culture + beach access

I built a free AI guide if you want to plan a trip: paisaxe.com
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
