"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface UseAdminRoleResult {
  isAdmin: boolean;
  isLoading: boolean;
}

export function useAdminRole(): UseAdminRoleResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  // Track which user ID we've already checked to avoid redundant re-fetches
  // when Supabase fires auth events on tab visibility change
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      setIsAdmin(false);
      setIsRoleLoading(false);
      checkedUserIdRef.current = null;
      return;
    }

    // Skip re-checking if we already verified this user's role
    if (checkedUserIdRef.current === user.id) {
      return;
    }

    const checkRole = async () => {
      setIsRoleLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error || !data) {
          setIsAdmin(false);
        } else {
          setIsAdmin(data.role === "admin");
        }
        // Mark this user as checked
        checkedUserIdRef.current = user.id;
      } catch {
        setIsAdmin(false);
      } finally {
        setIsRoleLoading(false);
      }
    };

    checkRole();
  }, [user, isAuthLoading]);

  return {
    isAdmin,
    isLoading: isAuthLoading || isRoleLoading,
  };
}
