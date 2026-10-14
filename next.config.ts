import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // Don't auto-open browser
});

/** Path prefixes whose URLs carry a booking or operator capability. */
const CAPABILITY_PATH_PREFIXES = ["/booking", "/operator", "/api/booking/bookings", "/api/operator"];

// Resolve at build time: production routes cannot import local process code.
const localOperationAliases = Object.fromEntries(
  ["agents", "tunnel"].map((name) => [
    `@/lib/local-operations/${name}`,
    "./src/lib/local-operations/unavailable.ts",
  ]),
);

/** Replace exact process imports before Next's TypeScript paths resolver runs. */
export const resolveLocalOperationModules: NonNullable<NextConfig["webpack"]> = (config, { dev, webpack }) => {
  if (!dev) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /^@\/lib\/local-operations\/(?:agents|tunnel)$/,
      path.resolve(process.cwd(), "src/lib/local-operations/unavailable.ts"),
    ));
  }
  return config;
};

const nextConfig: NextConfig = {
  webpack: resolveLocalOperationModules,
  transpilePackages: ["@supabase/ssr"],
  serverExternalPackages: ["@anthropic-ai/sdk", "sharp"],
  // Disable dev indicators (Dev Tools badge, ISR status, build activity) to prevent
  // the <nextjs-portal> overlay from intercepting pointer events in E2E tests.
  devIndicators: false,
  cacheComponents: true,
  experimental: {
    // Tree-shake barrel exports — avoids bundling all 1,000+ lucide icons
    optimizePackageImports: ["lucide-react", "posthog-js"],
  },
  // Exclude heavy directories from serverless function tracing.
  // Routes using fs + process.cwd() (agents-summary, agents/run) cause
  // Next.js to trace the entire project root, pulling in content/images
  // and blowing past Vercel's 250MB unzipped function size limit.
  // Note: ./docs/** was previously listed here but is no longer needed — the
  // agent-reports route now returns early in production, eliminating the
  // filesystem trace that pulled in docs/agents/ (#324).
  outputFileTracingExcludes: {
    "*": [
      "./content/**",
      "./coverage/**",
      "./public/**",
      "./logs/**",
      "./scripts/**",
      "./supabase/**",
      "./e2e/**",
      "./marketing/**",
    ],
  },
  outputFileTracingIncludes: {
    // Next 16.2.4's Vercel launcher loads this console extension at runtime.
    "/*": ["./node_modules/next/dist/server/dev/browser-logs/file-logger.js"],
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
        // CSP is set per-request by proxy.ts. See src/lib/proxy/csp.ts
        // for the `unsafe-inline` rationale (PPR compatibility).
      ],
    },
    // Capability URLs (/booking/<id>.<token>, /operator/<id>.<token>, and the
    // API routes that carry one in their path) must never leak through a
    // Referer header nor be indexed (PayPal hackathon plan, F05). For one path
    // the last matching entry wins, so these follow the site-wide one; a route
    // handler's own Referrer-Policy would lose to it. Cache-Control is set by
    // the API routes (private, no-store); the page shells hold no booking data.
    ...CAPABILITY_PATH_PREFIXES.map((prefix) => ({
      source: `${prefix}/:path*`,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex" },
      ],
    })),
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
        hostname: "lh3.googleusercontent.com",
      },
    ],
    // Increase cache duration for images (default is 60 seconds)
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days for immutable images
  },
};

// Only upload source maps to Sentry from the two long-lived branches that map
// to real environments (preview = develop, production = main). Feature branches,
// local builds, and ad-hoc preview deploys skip the upload entirely so we don't
// burn Sentry release quota or leak maps for throwaway builds. (#536)
const SENTRY_UPLOAD_BRANCHES = ["develop", "main"];
const sentryBranch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
const shouldUploadSourcemaps =
  process.env.VERCEL_ENV === "production" ||
  (sentryBranch !== undefined && SENTRY_UPLOAD_BRANCHES.includes(sentryBranch));

export default function configureNext(phase: string) {
  return withSentryConfig(withBundleAnalyzer({
    ...nextConfig,
    outputFileTracingExcludes: {
      ...nextConfig.outputFileTracingExcludes,
      // NFT independently resolves original entry imports without webpack's
      // module replacement. These two sources have no production runtime use.
      ...(phase === PHASE_DEVELOPMENT_SERVER ? {} : {
        "/api/admin/agents/run": ["./src/lib/local-operations/agents.ts"],
        "/api/admin/tunnel": ["./src/lib/local-operations/tunnel.ts"],
      }),
    },
    turbopack: {
      // The build phase is authoritative even if NODE_ENV was misconfigured.
      resolveAlias: phase === PHASE_DEVELOPMENT_SERVER ? {} : localOperationAliases,
    },
  }), {
  silent: true,
  sourcemaps: {
    // Gate the (slow, quota-consuming) upload to develop/main builds only.
    disable: !shouldUploadSourcemaps,
    // Delete the generated `.map` files from the build output after they are
    // uploaded to Sentry so client source maps are never served to end users.
    // (Replaces the removed `hideSourceMaps` option; defaults to true, set
    // explicitly to document the intent — #536.)
    deleteSourcemapsAfterUpload: true,
  },
});
}
