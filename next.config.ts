import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // Don't auto-open browser
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk", "sharp"],
  experimental: {
    // Tree-shake barrel exports — avoids bundling all 1,000+ lucide icons
    optimizePackageImports: ["lucide-react"],
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
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        // TODO: Migrate to nonce-based CSP to eliminate 'unsafe-inline' from script-src.
        // Next.js 16 uses proxy.ts (not middleware.ts). To implement:
        // 1. Generate a nonce per request in proxy.ts: crypto.randomUUID()
        // 2. Inject it into the CSP header: script-src 'nonce-<value>' 'strict-dynamic'
        // 3. Pass the nonce to <Script> components via next/script nonce prop
        // 4. Remove 'unsafe-inline' from script-src once all inline scripts use nonces
        // Blocked by: Need to verify proxy.ts can set response headers that
        // next.config.ts CSP won't override (static headers vs per-request headers).
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' blob:",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://picsum.photos https://*.googleusercontent.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
            "media-src 'self' blob:",
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
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
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
    // Increase cache duration for images (default is 60 seconds)
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days for immutable images
  },
};

export default withBundleAnalyzer(nextConfig);
