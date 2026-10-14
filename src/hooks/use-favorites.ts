"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MutationObserver,
  useQuery,
  type MutationObserverOptions,
} from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { csrfHeaders } from "@/lib/csrf-client";
import { readRetryAfter } from "@/lib/retry-after";
import { clientLogger } from "@/lib/client-logger";
import {
  favoritesStorageKey,
  privateQueryKey,
  useClientQueryClient,
  usePrivateQueryIdentity,
} from "@/lib/client-query";

interface Intent {
  id: string;
  target: boolean;
  settled: boolean;
}
interface FavoritesState {
  ids: string[];
  intents: Record<string, { base: boolean; changes: Intent[] }>;
  needsRead: boolean;
  revision: number;
  recovery: {
    storyId: string | null;
    target?: boolean;
    retryAfter: number | null;
    error: string;
  } | null;
}
const EMPTY_FAVORITES: string[] = [];
const emptyState = (): FavoritesState => ({
  ids: [],
  intents: {},
  needsRead: false,
  revision: 0,
  recovery: null,
});
const validIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string");
function persist(userId: string, ids: string[]) {
  try {
    localStorage.setItem(
      favoritesStorageKey(userId),
      JSON.stringify({ version: 1, userId, data: ids, timestamp: Date.now() }),
    );
  } catch {
    /* Optional cache, never block the request. */
  }
}
function restore(userId: string): string[] {
  try {
    localStorage.removeItem("paisaxe_favorites");
    const key = favoritesStorageKey(userId),
      raw = localStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (
      value.version === 1 &&
      value.userId === userId &&
      validIds(value.data) &&
      Number.isFinite(value.timestamp) &&
      value.timestamp <= Date.now() &&
      Date.now() - value.timestamp <= 86_400_000
    )
      return value.data;
    localStorage.removeItem(key);
  } catch {
    try {
      localStorage.removeItem(favoritesStorageKey(userId));
    } catch {
      /* Optional storage. */
    }
  }
  return [];
}
function membership(ids: string[], storyId: string, target: boolean) {
  return target
    ? ids.includes(storyId)
      ? ids
      : [...ids, storyId]
    : ids.filter((id) => id !== storyId);
}
class FavoriteRequestError extends Error {
  constructor(
    readonly retryAfter: number | null,
    status: number,
  ) {
    super(`Failed to sync favorite: ${status}`);
  }
}

interface UseFavoritesReturn {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isLoading: boolean;
  requiresAuth: boolean;
  retryAfter: number | null;
  retry: () => Promise<void>;
  error?: string | null;
}
export function useFavorites(): UseFavoritesReturn {
  const { user, session, isLoading: authLoading } = useAuth();
  const token = session?.access_token;
  const client = useClientQueryClient();
  const identity = usePrivateQueryIdentity(
    user?.id,
    session?.access_token,
    authLoading,
  );
  const key = useMemo(() => privateQueryKey("favorites", identity), [identity]);
  const [bootstrapped, setBootstrapped] = useState<string | null>(null);
  useEffect(() => {
    if (!identity) return;
    if (!client.getQueryData(key))
      client.setQueryData(
        key,
        { ...emptyState(), ids: restore(identity.userId) },
        { updatedAt: 0 },
      );
    setBootstrapped(identity.scope);
    // The key is completely determined by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, identity]);
  const query = useQuery(
    {
      queryKey: key,
      enabled: !!identity && bootstrapped === identity.scope,
      staleTime: 0,
      refetchOnMount: false,
      queryFn: async ({ signal }): Promise<FavoritesState> => {
        const revision =
          client.getQueryData<FavoritesState>(key)?.revision ?? 0;
        // Consume this automatic reconciliation once. A failed read stays visible
        // until an explicit retry or a later focus event.
        client.setQueryData<FavoritesState>(key, (current) =>
          current?.needsRead ? { ...current, needsRead: false } : current,
        );
        const response = await fetch("/api/favorites", {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        signal.throwIfAborted();
        const current =
          client.getQueryData<FavoritesState>(key) ?? emptyState();
        if (response.status === 429)
          return {
            ...current,
            recovery: current.recovery?.storyId
              ? current.recovery
              : {
                  storyId: null,
                  retryAfter: readRetryAfter(response),
                  error: "Favorites temporarily unavailable",
                },
          };
        if (!response.ok)
          throw new Error(`Failed to fetch favorites: ${response.status}`);
        const ids: unknown = await response.json();
        signal.throwIfAborted();
        if (!validIds(ids)) throw new Error("Invalid favorites response");
        const latest = client.getQueryData<FavoritesState>(key) ?? emptyState();
        if (
          latest.revision !== revision ||
          Object.keys(latest.intents).length > 0
        )
          return { ...latest, needsRead: true };
        persist(identity!.userId, ids);
        return {
          ...latest,
          ids,
          needsRead: false,
          recovery: latest.recovery?.storyId ? latest.recovery : null,
        };
      },
    },
    client,
  );
  type Variables = { storyId: string; target?: boolean; id: string };
  const mutationOptions = useMemo<
    MutationObserverOptions<void, Error, Variables, { desired: boolean }>
  >(
    () => ({
      mutationKey: [...key, "toggle"],
      onMutate: async ({
        storyId,
        target,
        id,
      }: {
        storyId: string;
        target?: boolean;
        id: string;
      }) => {
        const fetching = client.getQueryState(key)?.fetchStatus === "fetching";
        await client.cancelQueries({ queryKey: key, exact: true });
        // Logout removes this query. A cancelled mutation must not recreate it.
        if (!identity || !client.getQueryState(key))
          throw new Error("Favorite identity replaced");
        let desired = false;
        client.setQueryData<FavoritesState>(key, (current) => {
          const state = current ?? emptyState();
          desired = target ?? !state.ids.includes(storyId);
          const previous = state.intents[storyId] ?? {
            base: state.ids.includes(storyId),
            changes: [],
          };
          const next = {
            ...state,
            revision: state.revision + 1,
            ids: membership(state.ids, storyId, desired),
            needsRead: state.needsRead || fetching,
            intents: {
              ...state.intents,
              [storyId]: {
                ...previous,
                changes: [
                  ...previous.changes,
                  { id, target: desired, settled: false },
                ],
              },
            },
          };
          persist(identity.userId, next.ids);
          return next;
        });
        return { desired };
      },
      mutationFn: async (variables: {
        storyId: string;
        target?: boolean;
        id: string;
      }) => {
        const state = client.getQueryData<FavoritesState>(key);
        const intent = state?.intents[variables.storyId]?.changes.find(
          (change) => change.id === variables.id,
        );
        if (!identity || !intent) throw new Error("Favorite identity replaced");
        const response = await fetch(
          intent.target
            ? "/api/favorites"
            : `/api/favorites?storyId=${encodeURIComponent(variables.storyId)}`,
          {
            method: intent.target ? "POST" : "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              ...csrfHeaders(),
              ...(intent.target ? { "Content-Type": "application/json" } : {}),
            },
            ...(intent.target
              ? { body: JSON.stringify({ storyIds: [variables.storyId] }) }
              : {}),
          },
        );
        if (!response.ok)
          throw new FavoriteRequestError(
            response.status === 429 ? readRetryAfter(response) : null,
            response.status,
          );
      },
      onSettled: (_data, error, variables, context) => {
        if (!identity || !client.getQueryState(key)) return;
        client.setQueryData<FavoritesState>(key, (current) => {
          if (!current) return current;
          const row = current.intents[variables.storyId];
          if (!row) return current;
          const superseded =
            row.changes.findIndex((change) => change.id === variables.id) <
            row.changes.length - 1;
          let base = row.base;
          const changes = row.changes.flatMap((change) =>
            change.id !== variables.id
              ? [change]
              : error
                ? []
                : [{ ...change, settled: true }],
          );
          while (changes[0]?.settled) base = changes.shift()!.target;
          const intents = { ...current.intents };
          if (changes.length) intents[variables.storyId] = { base, changes };
          else delete intents[variables.storyId];
          const next = {
            ...current,
            revision: current.revision + 1,
            intents,
            ids: membership(
              current.ids,
              variables.storyId,
              changes.at(-1)?.target ?? base,
            ),
            recovery:
              error && !superseded
                ? {
                    storyId: variables.storyId,
                    target: context?.desired,
                    retryAfter:
                      error instanceof FavoriteRequestError
                        ? error.retryAfter
                        : null,
                    error:
                      error instanceof Error ? error.message : String(error),
                  }
                : current.recovery?.storyId === variables.storyId && !superseded
                  ? null
                  : current.recovery,
          };
          persist(identity.userId, next.ids);
          return next;
        });
        const state = client.getQueryData<FavoritesState>(key);
        if (state?.needsRead && Object.keys(state.intents).length === 0)
          void client.refetchQueries(
            { queryKey: key, exact: true },
            { cancelRefetch: false },
          );
        if (error)
          clientLogger.error("Error syncing favorite to cloud", {
            error: error instanceof Error ? error.message : String(error),
          });
      },
    }),
    [client, identity, key, token],
  );
  const execute = useCallback(
    async (variables: Variables) => {
      const observer = new MutationObserver(client, {
        ...mutationOptions,
        // The query engine serializes network writes for a story across consumers.
        // onMutate still records every optimistic intent before a queued write runs.
        scope: { id: JSON.stringify([...key, variables.storyId]) },
      });
      try {
        await observer.mutate(variables);
      } finally {
        observer.reset();
      }
    },
    [client, key, mutationOptions],
  );
  const toggleFavorite = useCallback(
    async (storyId: string) => {
      if (!identity || !client.getQueryState(key)) return;
      await execute({ storyId, id: crypto.randomUUID() }).catch(() => {});
    },
    [identity, client, execute, key],
  );
  useEffect(() => {
    if (
      identity &&
      query.data?.needsRead &&
      Object.keys(query.data.intents).length === 0 &&
      !query.isFetching
    )
      void client.refetchQueries(
        { queryKey: key, exact: true },
        { cancelRefetch: false },
      );
  }, [client, identity, key, query.data, query.isFetching]);
  const queryError = query.error;
  useEffect(() => {
    if (queryError)
      clientLogger.error("Error syncing favorites", {
        error:
          queryError instanceof Error ? queryError.message : String(queryError),
      });
  }, [queryError]);
  const state = identity ? query.data : undefined;
  const favorites = state?.ids ?? EMPTY_FAVORITES;
  const isFavorite = useCallback(
    (storyId: string) => favorites.includes(storyId),
    [favorites],
  );
  const recovery = state?.recovery;
  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading:
      authLoading ||
      (!!identity && (bootstrapped !== identity.scope || query.isFetching)),
    requiresAuth: !identity,
    retryAfter: recovery?.retryAfter ?? null,
    error: recovery?.error ?? query.error?.message ?? null,
    retry: async () => {
      if (
        !identity ||
        !client.getQueryState(key) ||
        (!recovery && !query.error)
      )
        return;
      if (recovery?.storyId)
        await execute({
          storyId: recovery.storyId,
          target: recovery.target,
          id: crypto.randomUUID(),
        }).catch(() => {});
      else await query.refetch();
    },
  };
}
