"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface StoryRedirectClientProps {
  /** Target URL to hand off to, e.g. `/immersive?story=<slug>`. */
  href: string;
}

/**
 * Hands off JS-capable visitors to the interactive immersive viewer
 * immediately after `/story/[slug]` has rendered its real, crawlable
 * content (per-story `generateMetadata` + `opengraph-image`, see #760 /
 * FE-H2).
 *
 * This is a client-side navigation, not an HTTP redirect: crawlers that
 * don't execute JavaScript (most OG/social scrapers, and many search bots)
 * never run this effect, so they see the per-story metadata and static
 * page content directly. An HTTP redirect here would send them to the
 * generic `/immersive` metadata instead, reproducing the original bug.
 */
export function StoryRedirectClient({ href }: StoryRedirectClientProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [router, href]);

  return null;
}
