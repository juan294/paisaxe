"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getSiteUrl, getSupabaseAnonKey } from "@/lib/env";
import type { Session, AuthChangeEvent, SupabaseClient } from "@supabase/supabase-js";
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

  const supabaseRef = useRef<SupabaseClient | null | undefined>(undefined);
  const getSupabaseClient = useCallback(async () => {
    if (supabaseRef.current !== undefined) return supabaseRef.current;

    const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
    const supabase = createSupabaseBrowserClient();
    supabaseRef.current = supabase;
    return supabase;
  }, []);

  useEffect(() => {
    if (deferInitialAuth) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const startAuth = async () => {
      // Skip auth with dummy credentials (CI/E2E) — real Supabase anon keys
      // are JWTs starting with 'eyJ'. Calling getUser() with dummy credentials
      // hangs on NXDOMAIN DNS resolution.
      const anonKey = getSupabaseAnonKey();
      if (!anonKey || !anonKey.startsWith("eyJ")) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const supabase = await getSupabaseClient().catch((error: unknown) => {
        console.error("Error initializing auth:", error);
        return null;
      });
      if (cancelled) return;
      if (!supabase) {
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
          if (!cancelled) {
            setSession(null);
            setUser(null);
          }
        } else {
          if (!cancelled) {
            setSession(currentSession);
            setUser(mapSupabaseUser(validatedUser));
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (!cancelled) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }

      if (cancelled) return;

      // Listen for auth changes after the validated bootstrap completes.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, newSession: Session | null) => {
          if (cancelled) return;
          setSession(newSession);
          setUser(mapSupabaseUser(newSession?.user ?? null));
          setIsLoading(false);
        }
      );
      unsubscribe = () => subscription.unsubscribe();
    };

    setIsLoading(true);
    void startAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [deferInitialAuth, getSupabaseClient]);

  const signInWithGoogle = useCallback(async (redirectPath?: string) => {
    const siteUrl = getSiteUrl();
    const baseRedirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : siteUrl
        ? `${siteUrl}/auth/callback`
        : "http://localhost:3000/auth/callback";

    const redirectTo = redirectPath
      ? `${baseRedirectTo}?next=${encodeURIComponent(redirectPath)}`
      : baseRedirectTo;

    const supabase = await getSupabaseClient();
    if (!supabase) {
      // #556: env vars may be missing client-side (e.g. NEXT_PUBLIC_SUPABASE_*
      // not inlined). Never throw inside a click handler — the user-visible
      // symptom would be a dead button with no feedback.
      console.error(
        "Supabase client unavailable — cannot sign in. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
      );
      return;
    }

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
  }, [getSupabaseClient]);

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.error("Supabase client unavailable — cannot sign out.");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }, [getSupabaseClient]);

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
