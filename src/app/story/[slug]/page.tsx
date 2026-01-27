import { redirect } from "next/navigation";
import { getStoryBySlugFromDB } from "@/lib/stories-data";
import type { Metadata } from "next";

interface StoryPageProps {
  params: Promise<{ slug: string }>;
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
  const { slug } = await params;
  redirect(`/immersive?story=${slug}`);
}
