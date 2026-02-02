import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // Don't auto-open browser
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk", "sharp"],
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
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://picsum.photos https://*.googleusercontent.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io",
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
