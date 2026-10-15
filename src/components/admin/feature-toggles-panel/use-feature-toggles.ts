"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/admin-api";
import type { FeatureFlag } from "@/types/feature-flags";
import { CATEGORIES, FLAG_CATEGORIES, CONFIGURABLE_FLAGS, type FlagCategory } from "./categories";

export function useFeatureToggles() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FlagCategory>("discovery");
  const [searchQuery, setSearchQuery] = useState("");
  // Track tunnel running state (always count as available in system category)
  const [tunnelRunning, setTunnelRunning] = useState(false);

  const loadFlags = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await fetchFeatureFlags();
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setFlags(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdatingKey(flag.flagKey);
    const result = await updateFeatureFlag(flag.flagKey, !flag.enabled);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setFlags((prev) =>
        prev.map((f) => (f.flagKey === flag.flagKey ? result.data! : f))
      );
    }
    setUpdatingKey(null);
  };

  const handleFlagUpdate = (updatedFlag: FeatureFlag) => {
    setFlags((prev) =>
      prev.map((f) => (f.flagKey === updatedFlag.flagKey ? updatedFlag : f))
    );
  };

  const toggleExpanded = (flagKey: string) => {
    setExpandedKey((prev) => (prev === flagKey ? null : flagKey));
  };

  const isConfigurable = (flagKey: string) => CONFIGURABLE_FLAGS.includes(flagKey);

  // Group flags by category
  const flagsByCategory = useMemo(() => {
    const grouped: Record<FlagCategory, FeatureFlag[]> = {
      discovery: [],
      experience: [],
      social: [],
      voice: [],
      booking: [],
      system: [],
    };

    flags.forEach((flag) => {
      const category = FLAG_CATEGORIES[flag.flagKey];
      if (category) {
        grouped[category].push(flag);
      }
    });

    return grouped;
  }, [flags]);

  // Count enabled flags per category (including tunnel in system)
  const enabledByCategory = useMemo(() => {
    const counts: Record<FlagCategory, { enabled: number; total: number }> & { all: { enabled: number; total: number } } = {
      all: { enabled: 0, total: 0 },
      discovery: { enabled: 0, total: 0 },
      experience: { enabled: 0, total: 0 },
      social: { enabled: 0, total: 0 },
      voice: { enabled: 0, total: 0 },
      booking: { enabled: 0, total: 0 },
      system: { enabled: 0, total: 0 },
    };

    flags.forEach((flag) => {
      const category = FLAG_CATEGORIES[flag.flagKey];
      if (category) {
        counts[category].total++;
        counts.all.total++;
        if (flag.enabled) {
          counts[category].enabled++;
          counts.all.enabled++;
        }
      }
    });

    // Always include tunnel in system category count (dev only, hides in production)
    counts.system.total++;
    counts.all.total++;
    if (tunnelRunning) {
      counts.system.enabled++;
      counts.all.enabled++;
    }

    return counts;
  }, [flags, tunnelRunning]);

  // Filter flags based on active category and search query
  const filteredFlags = useMemo(() => {
    let result = flagsByCategory[activeCategory];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((flag) => {
        const categoryLabel = CATEGORIES.find(
          (c) => c.key === FLAG_CATEGORIES[flag.flagKey]
        )?.label.toLowerCase();

        return (
          flag.label.toLowerCase().includes(query) ||
          (flag.description?.toLowerCase().includes(query) ?? false) ||
          (categoryLabel?.includes(query) ?? false)
        );
      });
    }

    return result;
  }, [flagsByCategory, activeCategory, searchQuery]);

  return {
    flags,
    isLoading,
    error,
    updatingKey,
    expandedKey,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    setTunnelRunning,
    loadFlags,
    handleToggle,
    handleFlagUpdate,
    toggleExpanded,
    isConfigurable,
    enabledByCategory,
    filteredFlags,
  };
}
