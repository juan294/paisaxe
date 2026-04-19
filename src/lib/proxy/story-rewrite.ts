import { NextRequest, NextResponse } from "next/server";

/**
 * Rewrite /story/:slug → /immersive?story=:slug.
 *
 * /story/[slug] exists for SEO-friendly sharing URLs, but the server-component
 * redirect() there triggers a React hydration error (#310) because
 * LanguageProvider's early return changes the hook count.
 *
 * By rewriting at the proxy level (before React renders), we avoid the
 * hydration mismatch entirely. Uses 308 (permanent redirect, preserves method).
 */
export function handleStoryRewrite(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/story\/([^/]+)$/);

  if (!match || !match[1]) return null;

  const slug = match[1];
  const url = request.nextUrl.clone();
  url.pathname = "/immersive";
  url.searchParams.set("story", slug);

  return NextResponse.redirect(url, 308);
}
