import type { MarketingPlatform } from "@/types/marketing";

// Platform letter badges for Swiss Minimal aesthetic
export const PLATFORM_BADGES: Record<MarketingPlatform, string> = {
  x: "X",
  instagram: "IG",
  pinterest: "Pi",
};

export const PLATFORM_NAMES: Record<MarketingPlatform, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  pinterest: "Pinterest",
};

// Credential fields for each platform
export const PLATFORM_CREDENTIALS: Record<
  MarketingPlatform,
  { key: string; label: string; placeholder: string; required: boolean }[]
> = {
  x: [
    { key: "apiKey", label: "Consumer Key", placeholder: "Your X Consumer Key", required: true },
    { key: "apiSecret", label: "Consumer Secret", placeholder: "Your X Consumer Secret", required: true },
    { key: "accessToken", label: "Access Token", placeholder: "Your Access Token", required: true },
    { key: "refreshToken", label: "Access Token Secret", placeholder: "Your Access Token Secret", required: true },
  ],
  instagram: [
    { key: "accessToken", label: "Long-Lived Access Token", placeholder: "Your Instagram access token", required: true },
    { key: "clientId", label: "App ID", placeholder: "Facebook App ID", required: false },
    { key: "clientSecret", label: "App Secret", placeholder: "Facebook App Secret", required: false },
  ],
  pinterest: [
    { key: "accessToken", label: "Access Token", placeholder: "Your Pinterest access token", required: true },
    { key: "refreshToken", label: "Refresh Token", placeholder: "Your refresh token", required: false },
    { key: "clientId", label: "App ID", placeholder: "Pinterest App ID", required: false },
    { key: "clientSecret", label: "App Secret", placeholder: "Pinterest App Secret", required: false },
  ],
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};
