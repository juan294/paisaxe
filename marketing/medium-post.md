# Medium Blog Post

## Image Specifications
- **Dimensions:** 1400 x 787px (2:1 aspect ratio)
- **Format:** JPG or PNG
- **Max size:** Keep under 500KB for fast loading

## Image Prompt (for Midjourney/DALL-E)

```
Dramatic aerial view of Asturias, Spain: lush green mountains meeting rugged Atlantic coastline, morning mist in valleys, traditional stone village visible, Picos de Europa peaks in background. Cinematic lighting, golden hour. Subtle digital overlay suggesting AI/technology connection - thin glowing lines like a constellation connecting points of interest. Modern travel photography style, 2:1 aspect ratio, high resolution.
```

Alternative prompt (more minimal):
```
Minimalist illustration of northern Spain landscape: green rolling hills, dramatic cliff coastline, small traditional church, mountains in distance. Soft muted colors (sage green, ocean blue, warm stone). Clean modern style with subtle geometric patterns. 2:1 aspect ratio.
```

---

## Post Title Options

Pick one:
- "I Built an AI That Only Knows One Place—And That's the Point"
- "Why I Spent Months Building a Travel Guide for a Region Most People Have Never Heard Of"
- "The Case for Hyper-Local AI: Lessons from Building a Travel Guide for Asturias"

---

## Post Content

### Subtitle/Kicker
*A deep dive into building Paisaxe—a voice-powered travel guide for northern Spain*

---

The internet has a travel advice problem.

Ask Google about Barcelona, and you'll drown in content. Ask about Asturias—a mountainous region on Spain's northern coast with UNESCO sites, Europe's best cider culture, and hiking that rivals the Alps—and you'll get the same recycled "top 10" listicles that barely scratch the surface.

I wanted to fix that. Not for everywhere. Just for one place.

### The Problem with Generic AI Travel Advice

You've probably tried asking ChatGPT for travel recommendations. It's impressive until you actually try to use the advice. The restaurant it confidently recommended? Closed in 2019. The "hidden gem" beach? Doesn't exist. The hiking route? Hallucinated from fragments of different trails.

Large language models know a little about everything and a lot about nothing specific. They're trained on the entire internet, which means their knowledge is a mile wide and an inch deep.

For travel—especially to less-documented places—that's a problem. You don't need an AI that knows something about everywhere. You need one that knows *everything* about *somewhere*.

### Building a Specialist

I built [Paisaxe](https://paisaxe.com) (Asturian for "landscape") as an experiment in hyper-local AI. Instead of trying to answer questions about the whole world, it only answers questions about Asturias.

The technical approach:

**1. Curated sources, not the open internet**

I collected 37 PDFs—local hiking guides, cultural documentation, restaurant guides, Camino de Santiago planning resources, pre-Romanesque architecture references. Everything verified, nothing scraped from random websites.

**2. Retrieval-Augmented Generation (RAG)**

Rather than fine-tuning a model (expensive, brittle), I built a retrieval pipeline. When you ask a question, the system:
- Converts your question to a vector embedding
- Searches a database of chunked source material
- Retrieves the 10 most relevant passages
- Reranks them to find the top 3
- Sends those passages to Claude as context for generating an answer

The model doesn't need to "remember" anything about Asturias. It just needs to read the right context and synthesize a response.

**3. Source attribution**

Every answer cites where it came from. If the system doesn't have good information on something, it says so instead of making things up.

**4. Voice as a first-class interface**

This was the surprising part. I added voice agents (via ElevenLabs) almost as an afterthought, but they changed everything.

When people type, they write search queries: "restaurants oviedo."

When people talk, they ask human questions: "Hey, I'm looking for somewhere to have dinner tonight in Oviedo. We want local food but nothing too fancy—any ideas?"

The voice interface unlocked a more natural way of getting travel advice. Like calling a friend who lives there.

### What I Learned

**Retrieval quality > Model quality**

A smaller model with great retrieval beats a larger model with mediocre retrieval. Two-stage retrieval (initial search + reranking) was the unlock that made answers actually useful.

**Depth beats breadth**

37 PDFs about one region produce better answers than theoretically having access to "all the information on the internet." Constraints force quality.

**People want specificity**

No one asks "what should I do in Asturias?" They ask "what's a good 3-day hiking route in Picos de Europa for someone with moderate experience who doesn't want to carry a tent?"

Generic travel content can't answer that. A deep, specific knowledge base can.

### The Bigger Idea

I'm not suggesting everyone should build single-region travel guides. But I do think there's something to the pattern:

**Pick a narrow domain. Go deep. Let the AI be a specialist, not a generalist.**

We've spent years making AI systems that try to know everything. Maybe some of the most useful AI tools will be the ones that deliberately know less—but know it thoroughly.

---

Paisaxe is free to use at [paisaxe.com](https://paisaxe.com). No login, no ads. You can chat with it by text or talk to it by voice.

If you're interested in the technical implementation (Voyage AI embeddings, pgvector, reranking strategies), I'm happy to discuss in the comments.

And if you've never heard of Asturias—now you have. It's worth the visit.

---

## Tags to Use
- Artificial Intelligence
- Travel
- Software Development
- Machine Learning
- RAG

---

## Publication Suggestions
Consider submitting to:
- Towards Data Science
- The Startup
- Better Programming
- Geek Culture
- Personal Growth (if angling toward the "passion project" narrative)
