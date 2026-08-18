import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getStoriesFromDB, getStoryBySlugFromDB } from "@/lib/stories-data";
import { CATEGORY_LABELS } from "@/types/immersive";
import { getCategoryColor } from "@/lib/og-image-helpers";
import { StoryRedirectClient } from "./story-redirect-client";
import type { Metadata } from "next";

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Pre-render all active story pages at build time.
 * Falls back to on-demand rendering for new stories added after build.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const stories = await getStoriesFromDB();
  return stories.map((story) => ({
    slug: story.slug || story.id,
  }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  // getStoryBySlugFromDB is wrapped in React cache(), so this call and the
  // page body's call below dedupe to a single Supabase query per request
  // instead of two separate ones (FE-H2 follow-up, #760).
  const story = await getStoryBySlugFromDB(slug);

  if (!story) {
    return { title: "Paisaxe | Descubre Asturias" };
  }

  // rowToPublicStory coerces a null DB description to "" — treat that the
  // same as "no description" so the meta tag is omitted, not rendered empty.
  const description = story.description || undefined;

  return {
    title: `${story.title} | Paisaxe`,
    description,
    openGraph: {
      title: story.title,
      description,
      type: "article",
      siteName: "Paisaxe",
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description,
    },
  };
}

/**
 * Real, server-rendered SEO landing page for a single story (FE-H2 / #760).
 *
 * Previously this route was 308-redirected by the proxy (`handleStoryRewrite`)
 * before it could ever render, so `generateMetadata`/`generateStaticParams`
 * were unreachable and every shared link resolved to the generic
 * `/immersive` OG card. Now the page renders real per-story content (title,
 * description, hero image) so search engines and social crawlers see unique,
 * indexable pages — then `StoryRedirectClient` hands JS-capable visitors off
 * to the interactive immersive viewer, preserving the original share-link UX.
 */
export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await getStoryBySlugFromDB(slug);

  if (!story) {
    notFound();
    return null;
  }

  const categoryLabel = CATEGORY_LABELS[story.category] ?? story.category;
  // Reuse the same category → color mapping as opengraph-image.tsx so the
  // OG social card and this rendered page are visually consistent per category.
  const categoryColor = getCategoryColor(story.category);
  const immersiveUrl = `/immersive?story=${slug}`;

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <StoryRedirectClient href={immersiveUrl} />
      <div className="mx-auto max-w-3xl px-6 py-16">
        {story.image ? (
          <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-2xl">
            <Image
              src={story.image}
              alt={story.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        ) : null}
        <p
          className="mb-3 text-sm font-semibold uppercase tracking-wide"
          style={{ color: categoryColor }}
        >
          {categoryLabel}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">{story.title}</h1>
        {story.subtitle ? (
          <p className="mt-2 text-lg text-neutral-400">{story.subtitle}</p>
        ) : null}
        <p className="mt-6 leading-relaxed text-neutral-300">
          {story.description}
        </p>
        <Link
          href={immersiveUrl}
          className="mt-8 inline-flex items-center rounded-full px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: categoryColor }}
        >
          Ver experiencia interactiva
        </Link>
      </div>
    </main>
  );
}
