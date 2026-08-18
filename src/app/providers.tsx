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

// Static routes that don't need an active auth session — defer the Supabase
// getUser() round-trip by passing deferInitialAuth=true, but still mount
// AuthProvider so the React tree shape is stable across navigations.
// FE-M4: AuthProvider must ALWAYS be rendered; conditional removal causes a full
// remount (and auth state reset) when the user navigates between pathnames.
const STATIC_PATHS = new Set(["/about", "/privacy", "/terms"]);

// Providers wraps only client-context concerns (PostHog, i18n, Auth).
// The #main-content skip target lives in layout.tsx; route pages own their
// <main> landmarks so public pages do not nest landmarks.
export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  // On static paths we defer auth init (no Supabase round-trip) but still
  // keep AuthProvider in the tree so the component identity never changes.
  const deferInitialAuth = pathname
    ? STATIC_PATHS.has(pathname) || DEFERRED_AUTH_PATHS.has(pathname)
    : false;
  const rootFeatureFlagsEnabled = pathname
    ? !pathname.startsWith("/immersive")
    : true;

  return (
    <PostHogProviderWrapper>
      <LanguageProvider>
        <FeatureFlagsProvider enabled={rootFeatureFlagsEnabled}>
          <AuthProvider deferInitialAuth={deferInitialAuth}>
            <SkipLink />
            <LangSync />
            {children}
          </AuthProvider>
        </FeatureFlagsProvider>
      </LanguageProvider>
    </PostHogProviderWrapper>
  );
}
