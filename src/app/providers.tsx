'use client';

import { LanguageProvider } from '@/lib/i18n';
import { AuthProvider } from '@/components/auth/auth-provider';
import { SkipLink } from '@/components/a11y/skip-link';
import { LangSync } from '@/components/a11y/lang-sync';
import { PostHogProviderWrapper } from '@/components/posthog-provider';
import { FeatureFlagsProvider } from '@/hooks/use-feature-flags';
import { usePathname } from "next/navigation";

interface ProvidersProps {
  children: React.ReactNode;
}

const DEFERRED_AUTH_PATHS = new Set(["/immersive", "/pricing", "/favorites"]);

// Static routes that never need auth context — skip AuthProvider entirely
// to avoid a Supabase getUser() round-trip on pages with no interactive auth.
const STATIC_PATHS = new Set(["/about", "/privacy", "/terms"]);

// Providers wraps only client-context concerns (PostHog, i18n, Auth).
// The <main id="main-content"> landmark lives in layout.tsx (server component)
// so that server-rendered children are NOT pulled into the client hydration boundary.
export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const isStaticPath = pathname ? STATIC_PATHS.has(pathname) : false;
  const deferInitialAuth = pathname ? DEFERRED_AUTH_PATHS.has(pathname) : false;

  return (
    <PostHogProviderWrapper>
      <LanguageProvider>
        <FeatureFlagsProvider>
          {isStaticPath ? (
            <>
              <SkipLink />
              <LangSync />
              {children}
            </>
          ) : (
            <AuthProvider deferInitialAuth={deferInitialAuth}>
              <SkipLink />
              <LangSync />
              {children}
            </AuthProvider>
          )}
        </FeatureFlagsProvider>
      </LanguageProvider>
    </PostHogProviderWrapper>
  );
}
