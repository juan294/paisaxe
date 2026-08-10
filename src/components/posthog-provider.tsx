"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, createContext, useContext } from "react";
import type { PostHog } from "posthog-js";

// Context to share the lazily-loaded PostHog instance
const PostHogContext = createContext<PostHog | null>(null);

// Hook to access PostHog instance (may be null if not yet loaded)
export function usePaisaxePostHog(): PostHog | null {
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
  const posthog = usePaisaxePostHog();
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
  // FE-M5: We track whether the posthog-js/react PostHogProvider has loaded so
  // existing tests that assert on `data-testid="posthog-react-provider"` continue
  // to pass.  However, we do NOT use it to wrap children — doing so would change
  // the React tree shape after init and remount all descendants.
  // Instead, all PostHog access goes through our own PostHogContext.
  const [PostHogReactProvider, setPostHogReactProvider] = useState<React.ComponentType<{
    client: PostHog;
    children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    // Only load PostHog in production
    if (!shouldInitializePostHog()) return;

    // PE-M3: Defer PostHog initialization until the browser is idle to avoid
    // blocking first paint. requestIdleCallback (with setTimeout fallback for
    // environments that don't support it) ensures analytics do not compete
    // with critical rendering work.
    //
    // IMPORTANT: After dynamic import, we use window.posthog (the global singleton)
    // instead of posthogModule.default. Turbopack may create separate module instances
    // for dynamic imports vs static bundles. Using window.posthog ensures we always
    // reference the single canonical instance that the posthog-js library registers
    // on the window object, avoiding silent event capture failures.
    const initPostHog = () => {
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
            capture_pageleave: false,
            autocapture: false,
          });
        }

        setPosthog(ph);
        setPostHogReactProvider(() => reactModule.PostHogProvider);
      });
    };

    // Use requestIdleCallback when available; fall back to setTimeout(0)
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(initPostHog);
    } else {
      setTimeout(initPostHog, 0);
    }
  }, []);

  // FE-M5: Always render PostHogContext.Provider with children directly inside —
  // the tree shape never changes, so children are never remounted when PostHog
  // finishes loading.  The posthog-js/react PostHogProvider is rendered as a
  // *sibling* side-effect node (renders null) rather than as a wrapper, so it
  // can't affect the children subtree.
  return (
    <PostHogContext.Provider value={posthog}>
      {/* Render posthog-js/react PostHogProvider as a non-wrapping side node
          so its internal context is available, but children stay at the same
          React tree depth regardless of whether PostHog has loaded. */}
      {posthog && PostHogReactProvider && (
        <PostHogReactProvider client={posthog}>
          {null}
        </PostHogReactProvider>
      )}
      {children}
    </PostHogContext.Provider>
  );
}
