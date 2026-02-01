# LinkedIn Post

## Image Specifications
- **Standard post:** 1200 x 627px (1.91:1 aspect ratio)
- **Square option:** 1200 x 1200px (takes up more feed space on mobile)
- **Format:** JPG or PNG

## Image Prompt (for Midjourney/DALL-E)

For 1200x627 (landscape):
```
Split composition: left side shows misty green mountains of Asturias, Spain with traditional stone architecture and Atlantic coast visible; right side shows subtle, elegant digital interface elements suggesting AI chat. Soft morning light, cinematic photography blended with clean UI design. Professional, modern, trustworthy feeling. 1.91:1 aspect ratio.
```

For 1200x1200 (square):
```
Aerial view of Picos de Europa mountains meeting the green valleys of Asturias, Spain. Dramatic cliffs, winding roads through villages, Atlantic ocean in distance. Overlay of subtle glowing connection lines suggesting AI/digital mapping. Golden hour lighting. Modern travel photography. Square format.
```

---

## Post Version 1: Storytelling Angle

I spent months building an AI travel guide for a region most people have never heard of.

Not a startup play. Not trying to scale to every destination.

Just Asturias—a corner of northern Spain with mountains that rival the Alps, cider culture instead of wine, and UNESCO sites older than most countries.

Here's why I did it:

Generic AI travel advice is broken. Ask ChatGPT for restaurant recommendations and half of them don't exist. The "hidden gems" are hallucinated. The hiking routes are Frankenstein mashups of different trails.

Large language models know a little about everything. For travel to less-documented places, that's useless.

So I built the opposite: an AI that knows ONE place deeply.

→ 37 curated PDFs of local guides and documentation
→ Vector search + reranking to find relevant context
→ Voice agents you can actually talk to
→ Source citations so you know it's not making things up

The result is Paisaxe (paisaxe.com)—free to use, no login required.

Biggest lesson: Depth beats breadth. A specialist AI that knows everything about somewhere is more useful than a generalist that knows something about everywhere.

If you're building with RAG or interested in hyper-local AI applications, happy to share more about the technical approach.

---

## Post Version 2: Technical/Builder Angle

Shipped a side project: an AI travel guide you can talk to.

The stack:
• Next.js + Supabase (Postgres + pgvector)
• Voyage AI for embeddings (512-dim Matryoshka)
• Two-stage retrieval: vector search → rerank top 3
• Claude for generation
• ElevenLabs for voice agents

Key learnings:

1. Retrieval quality > model quality. A smaller model with great retrieval beats a bigger model with mediocre retrieval.

2. Two-stage reranking matters. Initial vector search gets you in the ballpark. Reranking with a cross-encoder gets you the answer.

3. Voice changes everything. When people type, they write search queries. When they talk, they ask human questions. Different UX entirely.

The project: Paisaxe (paisaxe.com)—a voice-powered guide for Asturias, Spain. Free, no login.

Built it because I was tired of AI travel advice that hallucinates restaurants and hiking trails. Trained on 37 verified local PDFs instead of the open internet.

Link in comments if you want to try it.

---

## Post Version 3: Short & Punchy

I built an AI that only knows one place.

Not everywhere. Just Asturias, Spain.

Why?

Because generic AI travel advice hallucinates. Restaurant closed in 2019. "Hidden gem" doesn't exist. Hiking route is a mashup of 3 different trails.

So I went deep instead of wide:
→ 37 local PDFs
→ Vector search + reranking
→ Source citations
→ Voice agents you can actually talk to

Paisaxe: paisaxe.com

Free. No login. No ads.

Sometimes the most useful AI is the one that knows less—but knows it well.

---

## Hashtags
#AI #MachineLearning #RAG #SideProject #Travel #BuildInPublic #SoftwareEngineering #TechForGood

(Use 3-5 max on LinkedIn—too many looks spammy)

---

## Posting Tips

1. **Don't include the link in the main post**—LinkedIn deprioritizes posts with external links. Say "Link in comments" and add it as the first comment.

2. **Post Tuesday-Thursday, 8-10am or 12pm** in your target audience's timezone.

3. **Engage with comments in the first hour**—this signals to the algorithm that it's a good post.

4. **Tag relevant people** (if you know anyone in AI/travel space) but don't over-tag.

5. **Reply to your own post** with additional context after a few hours to bump it.
