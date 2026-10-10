"use client";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { publicQueryKey, useClientQueryClient } from "@/lib/client-query";
import { clientLogger } from "@/lib/client-logger";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
const EMPTY_FLAGS: FeatureFlag[] = [];
const CACHE_TTL = 60_000;
const key = publicQueryKey("feature-flags");
interface UseFeatureFlagsResult {
  flags: FeatureFlag[];
  error: Error | null;
  refresh: () => Promise<void>;
  isReady: boolean;
  isEnabled: (key: FeatureFlagKey) => boolean;
  isEnabledWithDefault: (
    key: FeatureFlagKey,
    defaultValue?: boolean,
  ) => boolean;
}

const FeatureFlagsContext = createContext<UseFeatureFlagsResult | null>(null);

function initialFlagsToArray(
  initial: Partial<Record<FeatureFlagKey, boolean>>,
): FeatureFlag[] {
  return Object.entries(initial).map(([key, enabled]) => ({
    id: `initial-${key}`,
    flagKey: key as FeatureFlagKey,
    enabled: enabled ?? false,
    label: key,
    description: null,
    config: {},
    environment: "development" as const,
    createdAt: "",
    updatedAt: "",
  }));
}

function useFeatureFlagsState(
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>,
  enabled = true,
  initialUpdatedAt?: number,
): UseFeatureFlagsResult {
  const client = useClientQueryClient();
  const [ready, setReady] = useState(false);
  const seed = useMemo(
    () =>
      initialFlags === undefined
        ? undefined
        : initialFlagsToArray(initialFlags),
    [initialFlags],
  );
  const dummy =
    process.env.NEXT_PUBLIC_SUPABASE_URL === "https://example.supabase.co";
  const query = useQuery(
    {
      queryKey: key,
      enabled: ready && enabled,
      staleTime: dummy ? 0 : CACHE_TTL,
      queryFn: async ({ signal }) => {
        try {
          const response = await fetch("/api/feature-flags", { signal });
          if (!response.ok) throw new Error("Failed to fetch flags");
          const payload: { data: FeatureFlag[] } = await response.json();
          signal.throwIfAborted();
          return payload.data;
        } catch (error) {
          if (!signal.aborted)
            clientLogger.warn(
              client.getQueryData(key)
                ? "Failed to refresh feature flags, using cached"
                : "Failed to fetch feature flags, defaulting all to false",
              { error: error instanceof Error ? error.message : String(error) },
            );
          throw error instanceof Error ? error : new Error(String(error));
        }
      },
    },
    client,
  );
  useEffect(() => {
    const cachedAt = client.getQueryState(key)?.dataUpdatedAt;
    if (
      seed &&
      (!client.getQueryData(key) ||
        (initialUpdatedAt !== undefined &&
          Number.isFinite(initialUpdatedAt) &&
          initialUpdatedAt > (cachedAt ?? 0)))
    ) {
      // A newer seed supersedes reads started against the previous snapshot.
      void client.cancelQueries({ queryKey: key, exact: true });
      client.setQueryData(
        key,
        seed,
        initialUpdatedAt === undefined
          ? undefined
          : { updatedAt: initialUpdatedAt },
      );
    }
    setReady(true);
  }, [client, seed, initialUpdatedAt]);
  useEffect(() => {
    if (!enabled || !seed || dummy) return;
    const timer = setTimeout(() => {
      const updatedAt = client.getQueryState(key)?.dataUpdatedAt;
      if (updatedAt !== undefined && Date.now() - updatedAt >= CACHE_TTL)
        void client.refetchQueries(
          { queryKey: key, exact: true, type: "active" },
          { cancelRefetch: false },
        );
    }, CACHE_TTL);
    return () => clearTimeout(timer);
  }, [client, enabled, seed, dummy]);
  const flags = (!ready && seed ? seed : (query.data ?? seed)) ?? EMPTY_FLAGS;
  const isReady = seed !== undefined || query.isSuccess || query.isError;
  const isEnabled = useCallback(
    (name: FeatureFlagKey) =>
      flags.find((flag) => flag.flagKey === name)?.enabled ?? false,
    [flags],
  );
  const isEnabledWithDefault = useCallback(
    (name: FeatureFlagKey, fallback = false) =>
      isReady ? isEnabled(name) : fallback,
    [isReady, isEnabled],
  );
  const refetch = query.refetch;
  const refresh = useCallback(async () => {
    if (enabled) await refetch();
  }, [enabled, refetch]);
  const error = enabled ? query.error : null;
  return useMemo(
    () => ({ flags, isReady, isEnabled, isEnabledWithDefault, error, refresh }),
    [flags, isReady, isEnabled, isEnabledWithDefault, error, refresh],
  );
}

interface FeatureFlagsProviderProps {
  children?: ReactNode;
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>;
  initialUpdatedAt?: number;
  enabled?: boolean;
}

export function FeatureFlagsProvider({
  children,
  initialFlags,
  initialUpdatedAt,
  enabled = true,
}: FeatureFlagsProviderProps) {
  const value = useFeatureFlagsState(initialFlags, enabled, initialUpdatedAt);

  return createElement(FeatureFlagsContext.Provider, { value }, children);
}

export function useFeatureFlags(): UseFeatureFlagsResult {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    );
  }
  return context;
}
