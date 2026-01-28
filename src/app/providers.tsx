'use client';

import { LanguageProvider } from '@/lib/i18n';
import { AuthProvider } from '@/components/auth/auth-provider';
import { SkipLink } from '@/components/a11y/skip-link';
import { LangSync } from '@/components/a11y/lang-sync';
import { PostHogProviderWrapper } from '@/components/posthog-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <PostHogProviderWrapper>
      <LanguageProvider>
        <AuthProvider>
          <SkipLink />
          <LangSync />
          <div id="main-content">
            {children}
          </div>
        </AuthProvider>
      </LanguageProvider>
    </PostHogProviderWrapper>
  );
}
