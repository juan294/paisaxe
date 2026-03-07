import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // Don't auto-open browser
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk", "sharp"],
  experimental: {
    cacheComponents: true,
    // Tree-shake barrel exports — avoids bundling all 1,000+ lucide icons
    optimizePackageImports: ["lucide-react", "posthog-js"],
  },
  // Exclude heavy directories from serverless function tracing.
  // Routes using fs + process.cwd() (agents-summary, agents/run) cause
  // Next.js to trace the entire project root, pulling in content/images
  // and blowing past Vercel's 250MB unzipped function size limit.
  outputFileTracingExcludes: {
    "*": [
      "./content/**",
      "./coverage/**",
      "./public/**",
      "./docs/**",
      "./logs/**",
      "./scripts/**",
      "./supabase/**",
      "./e2e/**",
      "./marketing/**",
    ],
  },
  // Root redirect (/ → /immersive) is handled in proxy.ts, NOT here.
  // next.config.ts redirects run at CDN level before proxy.ts,
  // which would bypass canonical domain checks (paisaxe.com → paisaxe.es).
  // Reverse proxy for PostHog to avoid ad blockers
  rewrites: async () => [
    {
      source: "/a/static/:path*",
      destination: "https://eu-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/a/:path*",
      destination: "https://eu.i.posthog.com/:path*",
    },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        // HSTS only in production — sending it on localhost poisons Chrome's HSTS cache
        // and makes http://localhost:3000 unreachable (ERR_CONNECTION_REFUSED).
        ...(process.env.NODE_ENV === "production"
          ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
          : []),
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        // CSP is set dynamically per-request in proxy.ts with a nonce.
        // See buildCspHeader() in src/proxy.ts.
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
      ],
    },
  ],
  images: {
    // Prefer modern formats for better compression
    formats: ["image/avif", "image/webp"],
    // Optimize image quality (default is 75, lower = smaller files)
    // 80 is a good balance for photography
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    // Increase cache duration for images (default is 60 seconds)
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days for immutable images
  },
};

export default withBundleAnalyzer(nextConfig);
