"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";

const STORAGE_KEY = "paisaxe_favorites";

interface UseFavoritesReturn {
  favorites: string[];
  isFavorite: (storyId: string) => boolean;
  toggleFavorite: (storyId: string) => void;
  isLoading: boolean;
  showSignInPrompt: boolean;
  dismissSignInPrompt: () => void;
}

export function useFavorites(): UseFavoritesReturn {
  const { user, session } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [hasShownPrompt, setHasShownPrompt] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      } catch {
        setFavorites([]);
      }
    }
    setIsLoading(false);
  }, []);

  // Sync with cloud when user logs in
  useEffect(() => {
    if (!user || !session) return;

    const syncFavorites = async () => {
      setIsLoading(true);
      try {
        // Fetch existing cloud favorites
        const response = await fetch("/api/favorites", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const cloudFavorites: string[] = await response.json();

          // Merge local and cloud favorites
          const localFavorites = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
          );
          const merged = [...new Set([...cloudFavorites, ...localFavorites])];

          // Upload any new local favorites to cloud
          const newFavorites = localFavorites.filter(
            (id: string) => !cloudFavorites.includes(id)
          );
          if (newFavorites.length > 0) {
            await fetch("/api/favorites", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ storyIds: newFavorites }),
            });
          }

          setFavorites(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      } catch (error) {
        console.error("Error syncing favorites:", error);
      } finally {
        setIsLoading(false);
      }
    };

    syncFavorites();
  }, [user, session]);

  const isFavorite = useCallback(
    (storyId: string) => favorites.includes(storyId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (storyId: string) => {
      const isCurrentlyFavorite = favorites.includes(storyId);
      const newFavorites = isCurrentlyFavorite
        ? favorites.filter((id) => id !== storyId)
        : [...favorites, storyId];

      // Update local state immediately
      setFavorites(newFavorites);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));

      // Show sign-in prompt after first favorite if not logged in
      if (!user && !isCurrentlyFavorite && !hasShownPrompt) {
        setShowSignInPrompt(true);
        setHasShownPrompt(true);
      }

      // Sync to cloud if logged in
      if (user && session) {
        try {
          if (isCurrentlyFavorite) {
            await fetch(`/api/favorites?storyId=${storyId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          } else {
            await fetch("/api/favorites", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ storyIds: [storyId] }),
            });
          }
        } catch (error) {
          console.error("Error syncing favorite to cloud:", error);
        }
      }
    },
    [favorites, user, session, hasShownPrompt]
  );

  const dismissSignInPrompt = useCallback(() => {
    setShowSignInPrompt(false);
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    showSignInPrompt,
    dismissSignInPrompt,
  };
}
