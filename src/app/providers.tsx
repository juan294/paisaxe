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

// Static routes that don't need an active auth session — defer the Supabase
// getUser() round-trip by passing deferInitialAuth=true, but still mount
// AuthProvider so the React tree shape is stable across navigations.
// #496: AuthProvider must ALWAYS be rendered; conditional removal causes a full
// remount (and auth state reset) when the user navigates between pathnames.
//
// FE-B1 (#757): /immersive, /pricing, and /favorites must NEVER be added here.
// They are the authenticated revenue path — favorites, paid ElevenLabs voice
// access, and the in-chat purchase CTA all depend on getSession()/getUser()
// actually running on these routes. A prior "DEFERRED_AUTH_PATHS" set wrongly
// included them (originally meant for anonymous-first perf, see #338/#405),
// which silently disabled auth for every signed-in user on the main route.
const STATIC_PATHS = new Set(["/about", "/privacy", "/terms"]);

// PE-L3 (#817): the root FeatureFlagsProvider used to run (and fetch) on
// every route except /immersive, but the only root-level consumer outside
// /immersive is the /pricing family — useVoiceAccess -> useVisitorVoiceAccess
// -> useFeatureFlags() (see src/hooks/use-voice-access.ts). /immersive has
// its own nested FeatureFlagsProvider seeded by the server (see
// immersive-page-content.tsx) and is deliberately excluded here too, so it
// isn't double-fetched. Every other page (/about, /privacy, /terms,
// /favorites, /) reads no flag — verified by grepping every useFeatureFlags()
// call site — so an allowlist avoids a wasted fetch on them instead of an
// ever-growing denylist that silently misses a new flag consumer.
//
// Maintenance note: this list is manually curated, not derived — a new route
// that starts calling useFeatureFlags() (directly or via a hook built on it)
// outside /immersive must add its prefix here, or it silently gets no flags
// and no fetch (no type error, no test failure). Re-grep every
// useFeatureFlags() call site before adding a new consumer route.
const FLAG_CONSUMING_PATH_PREFIXES = ["/pricing"];

function pathConsumesFeatureFlags(pathname: string): boolean {
  return FLAG_CONSUMING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Providers wraps only client-context concerns (PostHog, i18n, Auth).
// The #main-content skip target lives in layout.tsx; route pages own their
// <main> landmarks so public pages do not nest landmarks.
export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  // On static paths we defer auth init (no Supabase round-trip) but still
  // keep AuthProvider in the tree so the component identity never changes.
  const deferInitialAuth = pathname ? STATIC_PATHS.has(pathname) : false;
  const rootFeatureFlagsEnabled = pathname ? pathConsumesFeatureFlags(pathname) : true;

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
