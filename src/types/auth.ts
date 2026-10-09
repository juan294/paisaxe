import type { User, Session } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  authError?: boolean;
  retryAuth?: () => void;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user || typeof user.id !== "string" || !user.id) return null;
  const text = (value: unknown): string | null => typeof value === "string" ? value : null;

  return {
    id: user.id,
    email: text(user.email),
    name: text(user.user_metadata?.full_name) ?? text(user.user_metadata?.name),
    avatarUrl: text(user.user_metadata?.avatar_url) ?? text(user.user_metadata?.picture),
  };
}
