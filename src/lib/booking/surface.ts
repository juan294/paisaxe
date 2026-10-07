/**
 * Whether the booking surface exists at all: the experience_booking flag is
 * on and this is not a Preview deployment. A Preview reads production's flags
 * and data (src/lib/environment.ts), so nothing booking-related is reachable
 * on one. Kept free of auth and admin-client imports so proxy.ts can use it.
 */
import { getEnv } from "@/lib/env";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";

export function isPreviewDeployment(): boolean {
  return getEnv("VERCEL_ENV") === "preview";
}

export async function isBookingSurfaceOpen(): Promise<boolean> {
  return !isPreviewDeployment() && (await isFeatureFlagEnabled("experience_booking"));
}
