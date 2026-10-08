"use client";

import { readRetryAfter } from "@/lib/retry-after";

import { useState, useEffect, useCallback, useRef } from "react";
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
  retryAfter: number | null;
  retry: () => Promise<void>;
}

export function useFavorites(): UseFavoritesReturn {
  const { user, session, isLoading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const identity = JSON.stringify([user?.id ?? null, session?.access_token ?? null]);
  const activeIdentity = useRef<string | null>(identity);
  const [recovery, setRecovery] = useState<{ identity: string; retryAfter: number; storyId: string | null } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mutationRevision = useRef(0);
  const reconciliation = useRef({ identity, pending: 0, needsRead: false });
  const reconcile = useCallback((state: typeof reconciliation.current) => {
    if (state.needsRead && state.pending === 0 && activeIdentity.current === state.identity) {
      state.needsRead = false;
      setRefreshKey(value => value + 1);
    }
  }, []);
  const [isLoading, setIsLoading] = useState(true);

  // Pending actions and notices belong to the identity that made the request.
  useEffect(() => {
    activeIdentity.current = identity;
    reconciliation.current = { identity, pending: 0, needsRead: false };
    setRecovery(null);
    return () => { activeIdentity.current = null; };
  }, [identity]);

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
    let cancelled = false;
    const readRevision = mutationRevision.current;
    const state = reconciliation.current;
    const isStale = () => {
      if (cancelled || activeIdentity.current !== identity) return true;
      if (mutationRevision.current !== readRevision || state.pending > 0) {
        state.needsRead = true;
        reconcile(state);
        return true;
      }
      return false;
    };

    const syncFavorites = async () => {
      setIsLoading(true);
      try {
        // Fetch existing cloud favorites
        const response = await fetch("/api/favorites", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (isStale()) return;
        if (response.ok) {
          const cloudFavorites: string[] = await response.json();
          if (isStale()) return;
          setRecovery(current => current?.storyId ? current : null);
          setFavorites(cloudFavorites);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudFavorites));
        } else if (response.status === 429) {
          const retryAfter = readRetryAfter(response);
          setRecovery(current => current?.storyId ? current : { identity, retryAfter, storyId: null });
        }
      } catch (error) {
        clientLogger.error("Error syncing favorites", { error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (!cancelled && activeIdentity.current === identity) setIsLoading(false);
      }
    };

    syncFavorites();
    return () => { cancelled = true; };
  }, [user, session, refreshKey, identity, reconcile]);

  const isFavorite = useCallback(
    (storyId: string) => favorites.includes(storyId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (storyId: string) => {
      // Require auth to save favorites
      if (!user || !session || activeIdentity.current !== identity) {
        return;
      }

      // An older cloud read must not replace this optimistic mutation or its recovery state.
      mutationRevision.current++;
      const state = reconciliation.current;
      state.pending++;
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
          if (activeIdentity.current !== identity) return;
          if (response.status === 429) {
            setRecovery({ identity, retryAfter: readRetryAfter(response), storyId });
          }
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
          if (activeIdentity.current !== identity) return;
          if (response.status === 429) {
            setRecovery({ identity, retryAfter: readRetryAfter(response), storyId });
          }
          if (!response.ok) {
            throw new Error(`Failed to add favorite: ${response.status}`);
          }
        }
        if (activeIdentity.current !== identity) return;
        setRecovery(null);
      } catch (error) {
        if (activeIdentity.current !== identity) return;
        clientLogger.error("Error syncing favorite to cloud", { error: error instanceof Error ? error.message : String(error) });
        // Revert optimistic update on failure
        setFavorites(previousFavorites);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(previousFavorites));
      } finally {
        state.pending--;
        // Re-read only when a concurrent snapshot was discarded, after writes settle.
        reconcile(state);
      }
    },
    [favorites, user, session, identity, reconcile]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    requiresAuth: !user,
    retryAfter: recovery?.identity === identity ? recovery.retryAfter : null,
    retry: async () => {
      if (!recovery || recovery.identity !== identity || activeIdentity.current !== identity) return;
      if (recovery.storyId) await toggleFavorite(recovery.storyId);
      else setRefreshKey(value => value + 1);
    },
  };
}
