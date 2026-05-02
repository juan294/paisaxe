"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getSiteUrl, getSupabaseAnonKey } from "@/lib/env";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { mapSupabaseUser, type AuthUser, type AuthContextValue } from "@/types/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  deferInitialAuth?: boolean;
}

export function AuthProvider({ children, deferInitialAuth = false }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!deferInitialAuth);

  const [supabase] = useState(() => createSupabaseBrowserClient());
  const siteUrl = getSiteUrl();

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session using getUser() to validate with server
    // This ensures client and server auth state stay in sync
    const initializeAuth = async () => {
      // Skip auth with dummy credentials (CI/E2E) — real Supabase anon keys
      // are JWTs starting with 'eyJ'. Calling getUser() with dummy credentials
      // hangs on NXDOMAIN DNS resolution.
      const anonKey = getSupabaseAnonKey();
      if (!anonKey || !anonKey.startsWith("eyJ")) {
        setIsLoading(false);
        return;
      }

      try {
        // First get the session (needed for the session object)
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        // Then validate with server - this also refreshes expired tokens
        const { data: { user: validatedUser }, error } = await supabase.auth.getUser();

        if (error || !validatedUser) {
          // Session invalid or expired - clear state
          setSession(null);
          setUser(null);
        } else {
          setSession(currentSession);
          setUser(mapSupabaseUser(validatedUser));
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setUser(mapSupabaseUser(newSession?.user ?? null));
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async (redirectPath?: string) => {
    if (!supabase) {
      // #556: env vars may be missing client-side (e.g. NEXT_PUBLIC_SUPABASE_*
      // not inlined). Never throw inside a click handler — the user-visible
      // symptom would be a dead button with no feedback.
      console.error(
        "Supabase client unavailable — cannot sign in. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
      );
      return;
    }

    const baseRedirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : siteUrl
        ? `${siteUrl}/auth/callback`
        : "http://localhost:3000/auth/callback";

    const redirectTo = redirectPath
      ? `${baseRedirectTo}?next=${encodeURIComponent(redirectPath)}`
      : baseRedirectTo;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  }, [siteUrl, supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      console.error("Supabase client unavailable — cannot sign out.");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }, [supabase]);

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
