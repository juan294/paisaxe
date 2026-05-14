import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStoryBySlugFromDB, getStoriesFromDB } from "@/lib/stories-data";
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
  const story = await getStoryBySlugFromDB(slug);

  if (!story) {
    return { title: "Paisaxe | Descubre Asturias" };
  }

  return {
    title: `${story.title} | Paisaxe`,
    description: story.description,
    openGraph: {
      title: story.title,
      description: story.description,
      type: "article",
      siteName: "Paisaxe",
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description: story.description,
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  await connection();
  const { slug } = await params;
  redirect(`/immersive?story=${slug}`);
}
