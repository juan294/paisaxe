"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// Initialize PostHog on client side only, and only in production
// This prevents localhost/development data from contaminating production analytics
const isProduction = typeof window !== "undefined" &&
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("127.0.0.1");

if (isProduction && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/a",
    person_profiles: "never", // Cookieless mode - no user identification
    persistence: "memory", // No cookies or localStorage
    capture_pageview: false, // We handle this manually for Next.js routing
    capture_pageleave: true,
    autocapture: true,
  });
}

// Check if PostHog is actually initialized (not just imported)
function isPostHogInitialized(): boolean {
  try {
    // PostHog sets __loaded to true after init()
    return posthog.__loaded === true;
  } catch {
    return false;
  }
}

// Component that tracks page views on route changes
function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && isPostHogInitialized()) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + "?" + searchParams.toString();
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

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
  // Only wrap with provider if PostHog is actually initialized
  // (won't be initialized on localhost/development)
  if (typeof window === "undefined" || !isPostHogInitialized()) {
    return <>{children}</>;
  }

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
