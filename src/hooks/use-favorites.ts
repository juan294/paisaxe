"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";

const STORAGE_KEY = "paisaxe_favorites";

interface UseFavoritesReturn {
  favorites: string[];
  isFavorite: (storyId: string) => boolean;
  toggleFavorite: (storyId: string) => void;
  isLoading: boolean;
  /** True if user is not logged in and cannot save favorites */
  requiresAuth: boolean;
}

export function useFavorites(): UseFavoritesReturn {
  const { user, session, isLoading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Only load favorites from localStorage if user is logged in
  // Anonymous users should not have local favorites anymore
  useEffect(() => {
    if (authLoading) return;

    // Only load favorites for authenticated users
    if (user) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFavorites(Array.isArray(parsed) ? parsed : []);
        } catch {
          setFavorites([]);
        }
      }
    } else {
      // Clear favorites for anonymous users
      setFavorites([]);
    }
    setIsLoading(false);
  }, [user, authLoading]);

  // Sync authenticated favorites from the cloud. localStorage is only a cache of
  // the server state, not a second anonymous persistence model.
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
          setFavorites(cloudFavorites);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudFavorites));
        }
      } catch (error) {
        clientLogger.error("Error syncing favorites", { error: error instanceof Error ? error.message : String(error) });
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
      // Require auth to save favorites
      if (!user || !session) {
        return;
      }

      const isCurrentlyFavorite = favorites.includes(storyId);
      const previousFavorites = favorites;
      const newFavorites = isCurrentlyFavorite
        ? favorites.filter((id) => id !== storyId)
        : [...favorites, storyId];

      // Update local state immediately (optimistic)
      setFavorites(newFavorites);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));

      // Sync to cloud
      try {
        if (isCurrentlyFavorite) {
          const response = await fetch(`/api/favorites?storyId=${storyId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              ...csrfHeaders(),
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to remove favorite: ${response.status}`);
          }
        } else {
          const response = await fetch("/api/favorites", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              ...csrfHeaders(),
            },
            body: JSON.stringify({ storyIds: [storyId] }),
          });
          if (!response.ok) {
            throw new Error(`Failed to add favorite: ${response.status}`);
          }
        }
      } catch (error) {
        clientLogger.error("Error syncing favorite to cloud", { error: error instanceof Error ? error.message : String(error) });
        // Revert optimistic update on failure
        setFavorites(previousFavorites);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(previousFavorites));
      }
    },
    [favorites, user, session]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    requiresAuth: !user,
  };
}
