"use client";

import { PrivateQueryIdentityProvider } from "@/lib/client-query";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getSiteUrl, getSupabaseAnonKey } from "@/lib/env";
import { clientLogger } from "@/lib/client-logger";
import { isAuthSessionMissingError, type Session, type AuthChangeEvent, type SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseUser, type AuthUser, type AuthContextValue } from "@/types/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

// Network verification budget. It starts once the browser client is loaded.
const AUTH_VERIFY_TIMEOUT_MS = 1500;
// Budget for the first dynamic import only. A cold dev compile can take longer
// than the verification budget, so the two are not measured together.
const AUTH_CLIENT_LOAD_TIMEOUT_MS = 15000;

interface AuthProviderProps {
  children: ReactNode;
  deferInitialAuth?: boolean;
  initialUser?: AuthUser | null;
  initialAuthError?: boolean;
}

export function AuthProvider({ children, deferInitialAuth = false, initialUser = null, initialAuthError = false }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!deferInitialAuth);
  const [authError, setAuthError] = useState(initialAuthError);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const retryAuth = useCallback(() => setRetryGeneration(n => n + 1), []);

  const supabaseRef = useRef<SupabaseClient | null | undefined>(undefined);
  const getSupabaseClient = useCallback(async () => {
    if (supabaseRef.current !== undefined) return supabaseRef.current;

    const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
    const supabase = createSupabaseBrowserClient();
    supabaseRef.current = supabase;
    return supabase;
  }, []);

  useEffect(() => {
    if (deferInitialAuth && retryGeneration === 0) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    let revision = 0;
    let unsubscribe: (() => void) | undefined;
    let cancelVerification: (() => void) | undefined;

    const verify = (
      operation: (current: () => boolean, restartDeadline: (ms: number) => void) => Promise<void>,
      clearUser = false,
      initialBudgetMs = AUTH_VERIFY_TIMEOUT_MS,
    ) => {
      const ticket = ++revision;
      const current = () => !cancelled && revision === ticket;
      cancelVerification?.();
      setSession(null);
      if (clearUser) setUser(null);
      setIsLoading(true);
      setAuthError(false);

      let timer: ReturnType<typeof setTimeout> | undefined;
      let release!: () => void;
      const superseded = new Promise<void>(resolve => { release = resolve; });
      const cancel = () => { clearTimeout(timer); release(); };
      cancelVerification = cancel;
      let restartDeadline!: (ms: number) => void;
      const deadline = new Promise<never>((_, reject) => {
        restartDeadline = ms => {
          clearTimeout(timer);
          timer = setTimeout(() => reject(new Error("Auth verification timeout")), ms);
        };
      });
      restartDeadline(initialBudgetMs);

      // Never await SDK work inside its synchronous auth-event callback.
      void Promise.race([
        Promise.resolve().then(() => { if (current()) return operation(current, restartDeadline); }),
        deadline,
        superseded,
      ]).catch((error: unknown) => {
        if (!current()) return;
        revision++; // A timed-out verification must never publish its late result.
        setSession(null);
        setUser(null);
        setIsLoading(false);
        setAuthError(true);
        clientLogger.error("[AUTH_INIT_FAILURE]", {
          error: error instanceof Error ? error.message : String(error),
        });
      }).finally(() => {
        cancel();
        if (cancelVerification === cancel) cancelVerification = undefined;
        if (current()) setIsLoading(false);
      });
    };

    const verifySession = async (supabase: SupabaseClient, candidate: Session | null, current: () => boolean) => {
      if (candidate && (typeof candidate.access_token !== "string" || !candidate.access_token)) {
        throw new Error("Auth session token unavailable");
      }
      // An explicit token bypasses SDK storage recovery/refresh and verifies
      // precisely this event's credential. Stored session.user is never authority.
      const { data: { user: validatedUser }, error } = await supabase.auth.getUser(candidate?.access_token);
      if (!current()) return;
      if (error) {
        if (!isAuthSessionMissingError(error)) throw error;
        setSession(null);
        setUser(null);
        return;
      }
      const verifiedUser = mapSupabaseUser(validatedUser);
      setSession(verifiedUser && validatedUser && candidate ? { ...candidate, user: validatedUser } : null);
      setUser(verifiedUser);
    };

    verify(async (current, restartDeadline) => {
      const anonKey = getSupabaseAnonKey();
      if (!anonKey || !anonKey.startsWith("eyJ")) return;
      const supabase = await getSupabaseClient();
      if (!current()) return;
      if (!supabase) throw new Error("Auth client unavailable");
      restartDeadline(AUTH_VERIFY_TIMEOUT_MS);

      // Subscribe before bootstrap: a logout/login during getUser must win.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, newSession: Session | null) => {
          if (cancelled || event === "INITIAL_SESSION") return;
          if (event === "SIGNED_OUT" || !newSession) {
            revision++;
            cancelVerification?.();
            setSession(null);
            setUser(null);
            setIsLoading(false);
            setAuthError(false);
            return;
          }
          verify(nextCurrent => verifySession(supabase, newSession, nextCurrent), true);
        }
      );
      unsubscribe = () => subscription.unsubscribe();
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (!current()) return;
      if (error && !isAuthSessionMissingError(error)) throw error;
      await verifySession(supabase, error ? null : currentSession, current);
    }, false, AUTH_CLIENT_LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      cancelVerification?.();
      unsubscribe?.();
    };
  }, [deferInitialAuth, getSupabaseClient, retryGeneration]);

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
      clientLogger.error(
        "[AUTH_SIGNIN_NO_CLIENT] Supabase client unavailable — cannot sign in. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
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
      clientLogger.error("[AUTH_SIGNIN_FAILURE]", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [getSupabaseClient]);

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      clientLogger.error("[AUTH_SIGNOUT_NO_CLIENT] Supabase client unavailable — cannot sign out.");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      clientLogger.error("[AUTH_SIGNOUT_FAILURE]", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [getSupabaseClient]);

  // FE-M1: memoize the context value so that consumers only re-render when
  // user, session, isLoading, or the stable callbacks actually change.
  const value = useMemo<AuthContextValue>(
    () => ({ user, session, isLoading, authError, retryAuth, signInWithGoogle, signOut }),
    [user, session, isLoading, authError, retryAuth, signInWithGoogle, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      <PrivateQueryIdentityProvider userId={user?.id} token={session?.access_token} loading={isLoading}>{children}</PrivateQueryIdentityProvider>
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
