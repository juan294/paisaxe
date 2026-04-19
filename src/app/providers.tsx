'use client';

import { LanguageProvider } from '@/lib/i18n';
import { AuthProvider } from '@/components/auth/auth-provider';
import { SkipLink } from '@/components/a11y/skip-link';
import { LangSync } from '@/components/a11y/lang-sync';
import { PostHogProviderWrapper } from '@/components/posthog-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

// Providers wraps only client-context concerns (PostHog, i18n, Auth).
// The <main id="main-content"> landmark lives in layout.tsx (server component)
// so that server-rendered children are NOT pulled into the client hydration boundary.
export function Providers({ children }: ProvidersProps) {
  return (
    <PostHogProviderWrapper>
      <LanguageProvider>
        <AuthProvider>
          <SkipLink />
          <LangSync />
          {children}
        </AuthProvider>
      </LanguageProvider>
    </PostHogProviderWrapper>
  );
}
