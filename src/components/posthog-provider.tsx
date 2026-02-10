"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, createContext, useContext } from "react";
import type { PostHog } from "posthog-js";

// Context to share the lazily-loaded PostHog instance
const PostHogContext = createContext<PostHog | null>(null);

// Hook to access PostHog instance (may be null if not yet loaded)
function usePostHog(): PostHog | null {
  return useContext(PostHogContext);
}

// Check if we should initialize PostHog (production only)
function shouldInitializePostHog(): boolean {
  if (typeof window === "undefined") return false;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return false;

  const hostname = window.location.hostname;
  return !hostname.includes("localhost") && !hostname.includes("127.0.0.1");
}

// Component that tracks page views on route changes
function PostHogPageViewTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + "?" + searchParams.toString();
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

// Wrapped in Suspense because useSearchParams() needs it
export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewTracker />
    </Suspense>
  );
}

interface PostHogProviderWrapperProps {
  children: React.ReactNode;
}

export function PostHogProviderWrapper({ children }: PostHogProviderWrapperProps) {
  const [posthog, setPosthog] = useState<PostHog | null>(null);
  const [PostHogProvider, setPostHogProvider] = useState<React.ComponentType<{
    client: PostHog;
    children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    // Only load PostHog in production
    if (!shouldInitializePostHog()) return;

    // Lazy load PostHog after hydration.
    // IMPORTANT: After dynamic import, we use window.posthog (the global singleton)
    // instead of posthogModule.default. Turbopack may create separate module instances
    // for dynamic imports vs static bundles. Using window.posthog ensures we always
    // reference the single canonical instance that the posthog-js library registers
    // on the window object, avoiding silent event capture failures.
    Promise.all([
      import("posthog-js"),
      import("posthog-js/react"),
    ]).then(([posthogModule, reactModule]) => {
      // Prefer the global singleton; fall back to the module default
      const ph = (window as { posthog?: PostHog }).posthog ?? posthogModule.default;

      // Initialize if not already initialized
      if (!ph.__loaded) {
        ph.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/a",
          person_profiles: "never", // Cookieless mode - no user identification
          persistence: "memory", // No cookies or localStorage
          capture_pageview: false, // We handle this manually for Next.js routing
          capture_pageleave: true,
          autocapture: true,
          // Core Web Vitals (LCP, FID, CLS, FCP) are captured automatically
          // when enabled in the PostHog dashboard:
          //   Project Settings > Autocapture > Web vitals autocapture > Enable
          // The SDK reads this setting via remote config — no client-side
          // code change needed. Requires posthog-js >= 1.141.2 (we have 1.342.1).
          // Metrics appear under the $web_vitals event in PostHog.
        });
      }

      setPosthog(ph);
      setPostHogProvider(() => reactModule.PostHogProvider);
    });
  }, []);

  // Always render children immediately - PostHog loads in background
  if (!posthog || !PostHogProvider) {
    return (
      <PostHogContext.Provider value={null}>
        {children}
      </PostHogContext.Provider>
    );
  }

  return (
    <PostHogContext.Provider value={posthog}>
      <PostHogProvider client={posthog}>
        {children}
      </PostHogProvider>
    </PostHogContext.Provider>
  );
}
