"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      setIsAdmin(false);
      setIsRoleLoading(false);
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
