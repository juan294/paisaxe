import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/sentry-options";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init(sentryInitOptions(dsn));
}
