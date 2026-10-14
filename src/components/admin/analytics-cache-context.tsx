"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import {
  createClientQueryClient,
  PrivateQueryIdentityContext,
  privateQueryKey,
  type PrivateQueryIdentity,
} from "@/lib/client-query";
import type { AdminApiResponse } from "@/types/admin";

const STALE_TIME = 2 * 60 * 1000;
const AnalyticsCacheContext = createContext<ReturnType<
  typeof createClientQueryClient
> | null>(null);

export function AnalyticsCacheProvider({ children }: { children: ReactNode }) {
  const parent = useContext(QueryClientContext);
  const [client] = useState(() => parent ?? createClientQueryClient());
  return (
    <AnalyticsCacheContext.Provider value={parent ?? client}>
      {children}
    </AnalyticsCacheContext.Provider>
  );
}

interface UseAnalyticsDataOptions {
  staleTime?: number;
  enabled?: boolean;
}

interface UseAnalyticsDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string;
  refresh: () => void;
}

export function useAnalyticsData<T>(
  tabKey: string,
  fetchFn: () => Promise<AdminApiResponse<T>>,
  params: string,
  options?: UseAnalyticsDataOptions,
): UseAnalyticsDataResult<T> {
  const client = useContext(AnalyticsCacheContext);
  if (!client)
    throw new Error(
      "useAnalyticsData must be used within an AnalyticsCacheProvider",
    );
  const sharedIdentity = useContext(PrivateQueryIdentityContext);
  const [isolatedIdentity] = useState<PrivateQueryIdentity>(() => ({
    userId: "isolated-analytics",
    scope: "isolated",
  }));
  const identity =
    sharedIdentity === undefined ? isolatedIdentity : sharedIdentity;
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;
  const enabled = (options?.enabled ?? true) && !!identity;
  const query = useQuery(
    {
      queryKey: [...privateQueryKey("analytics", identity), tabKey, params],
      enabled,
      staleTime: options?.staleTime ?? STALE_TIME,
      queryFn: async () => {
        const result = await fetchRef.current();
        if (result.error) throw new Error(result.error);
        return result.data ?? null;
      },
    },
    client,
  );
  return {
    data: identity ? (query.data ?? null) : null,
    isLoading: enabled && query.isPending,
    isRefreshing: query.isFetching && !query.isPending,
    error: query.error?.message ?? "",
    refresh: () => {
      if (enabled) void query.refetch();
    },
  };
}
