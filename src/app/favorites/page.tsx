"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFavorites } from "@/hooks/use-favorites";
import { FALLBACK_STORIES, getStoriesFromDB } from "@/lib/stories-data";
import { Heart, ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Story } from "@/types/immersive";

export default function FavoritesPage() {
  const { favorites, toggleFavorite, isLoading: favoritesLoading } = useFavorites();
  const [allStories, setAllStories] = useState<Story[]>(FALLBACK_STORIES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStories() {
      try {
        const dbStories = await getStoriesFromDB();
        setAllStories(dbStories);
      } catch (error) {
        console.warn("Failed to load stories from DB, using fallback:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStories();
  }, []);

  const favoriteStories = allStories.filter((story) =>
    favorites.includes(story.id)
  );

  if (isLoading || favoritesLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-lg">Cargando favoritos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/immersive"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            <h1 className="text-xl font-semibold text-white">Mis Favoritos</h1>
          </div>
          <span className="text-white/60 text-sm">
            {favoriteStories.length} {favoriteStories.length === 1 ? "historia" : "historias"}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {favoriteStories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="h-16 w-16 text-white/20 mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">
              No tienes favoritos todavia
            </h2>
            <p className="text-white/60 mb-6 max-w-sm">
              Explora las historias de Asturias y guarda las que mas te gusten para verlas despues.
            </p>
            <Link
              href="/immersive"
              className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all hover:scale-105"
            >
              Explorar historias
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoriteStories.map((story) => (
              <div
                key={story.id}
                className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 transition-all hover:border-white/20 hover:bg-white/10"
              >
                <Link href="/immersive" className="block">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={story.image}
                      alt={story.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">
                      {story.subtitle}
                    </p>
                    <h3 className="text-white font-semibold text-lg leading-tight">
                      {story.title}
                    </h3>
                  </div>
                </Link>
                <button
                  onClick={() => toggleFavorite(story.id)}
                  className={cn(
                    "absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur-sm transition-all",
                    "hover:bg-red-500/80 group/btn"
                  )}
                  aria-label="Quitar de favoritos"
                >
                  <Trash2 className="h-4 w-4 text-white/80 group-hover/btn:text-white transition-colors" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
