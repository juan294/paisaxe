'use client';

import { LanguageProvider } from '@/lib/i18n';
import { AuthProvider } from '@/components/auth/auth-provider';
import { SkipLink } from '@/components/a11y/skip-link';
import { LangSync } from '@/components/a11y/lang-sync';
import { PostHogProviderWrapper } from '@/components/posthog-provider';
import { usePathname } from "next/navigation";

interface ProvidersProps {
  children: React.ReactNode;
}

const DEFERRED_AUTH_PATHS = new Set(["/immersive", "/pricing", "/favorites"]);

// Providers wraps only client-context concerns (PostHog, i18n, Auth).
// The <main id="main-content"> landmark lives in layout.tsx (server component)
// so that server-rendered children are NOT pulled into the client hydration boundary.
export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const deferInitialAuth = pathname ? DEFERRED_AUTH_PATHS.has(pathname) : false;

  return (
    <PostHogProviderWrapper>
      <LanguageProvider>
        <AuthProvider deferInitialAuth={deferInitialAuth}>
          <SkipLink />
          <LangSync />
          {children}
        </AuthProvider>
      </LanguageProvider>
    </PostHogProviderWrapper>
  );
}
