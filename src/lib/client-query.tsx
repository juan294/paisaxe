"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientContext,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";

// Publish shared authorization changes in the current microtask, before another
// interaction can consume the previous observer snapshot.
notifyManager.setScheduler(queueMicrotask);

export function createClientQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}

// Never use this browser instance for an SSR request or write seeds during render.
const browserClient = createClientQueryClient();
export function getBrowserQueryClient() {
  return browserClient;
}
export function useClientQueryClient() {
  const parent = useContext(QueryClientContext);
  const [client] = useState(
    () =>
      parent ??
      (typeof window === "undefined"
        ? createClientQueryClient()
        : browserClient),
  );
  return parent ?? client;
}

export function ClientQueryProvider({ children }: { children: ReactNode }) {
  const client = useClientQueryClient();
  useEffect(() => {
    const focus = () => {
      if (document.visibilityState !== "hidden")
        void client.refetchQueries(
          { stale: true, type: "active" },
          { cancelRefetch: false },
        );
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const publicQueryKey = (domain: string) =>
  ["paisaxe", 1, "public", domain] as const;
export const privateQueryKey = (
  domain: string,
  identity: PrivateQueryIdentity | null,
) =>
  [
    "paisaxe",
    1,
    "private",
    identity?.userId ?? null,
    identity?.scope ?? null,
    domain,
  ] as const;
export const FAVORITES_STORAGE_PREFIX = "paisaxe_favorites:v1:";
export const favoritesStorageKey = (userId: string) =>
  `${FAVORITES_STORAGE_PREFIX}${encodeURIComponent(userId)}`;

export interface PrivateQueryIdentity {
  userId: string;
  scope: string;
}
export const PrivateQueryIdentityContext = createContext<
  PrivateQueryIdentity | null | undefined
>(undefined);

function useSessionIdentity(
  userId: string | undefined,
  token: string | undefined,
  loading: boolean,
) {
  return useMemo(
    () =>
      !loading && userId && token
        ? { userId, scope: crypto.randomUUID() }
        : null,
    [userId, token, loading],
  );
}

export function PrivateQueryIdentityProvider({
  userId,
  token,
  loading,
  children,
}: {
  userId?: string;
  token?: string;
  loading: boolean;
  children: ReactNode;
}) {
  const client = useClientQueryClient();
  const identity = useSessionIdentity(userId, token, loading);
  useEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[2] === "private" &&
        query.queryKey[4] !== identity?.scope,
    };
    void client.cancelQueries(obsolete);
    client.removeQueries(obsolete);
    const mutations = client.getMutationCache();
    for (const mutation of mutations.getAll()) {
      const key = mutation.options.mutationKey;
      if (key?.[2] === "private" && key[4] !== identity?.scope)
        mutations.remove(mutation);
    }
    try {
      localStorage.removeItem("paisaxe_favorites"); // No ownership proof: never read or upload it.
      if (!loading) {
        for (const key of Object.keys(localStorage)) {
          if (
            key.startsWith(FAVORITES_STORAGE_PREFIX) &&
            key !== (identity && favoritesStorageKey(identity.userId))
          )
            localStorage.removeItem(key);
        }
      }
    } catch {
      /* Storage is an optional cache. */
    }
  }, [client, identity, loading]);
  return (
    <PrivateQueryIdentityContext.Provider value={identity}>
      {children}
    </PrivateQueryIdentityContext.Provider>
  );
}

// Standalone hook consumers still use the same query engine, with a mount-local
// scope. Actual AuthProvider consumers always share its verified session scope.
export function usePrivateQueryIdentity(
  userId: string | undefined,
  token: string | undefined,
  loading: boolean,
) {
  const shared = useContext(PrivateQueryIdentityContext);
  const isolated = useSessionIdentity(userId, token, loading);
  const client = useClientQueryClient();
  const identity = shared === undefined ? isolated : shared;
  useEffect(() => {
    if (shared !== undefined || !identity) return;
    return () => {
      const obsolete = {
        predicate: (query: { queryKey: readonly unknown[] }) =>
          query.queryKey[2] === "private" &&
          query.queryKey[4] === identity.scope,
      };
      void client.cancelQueries(obsolete);
      client.removeQueries(obsolete);
    };
  }, [client, identity, shared]);
  return identity;
}
