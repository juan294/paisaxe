import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Only enable replay in production to avoid noise
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.01,
  });
}
