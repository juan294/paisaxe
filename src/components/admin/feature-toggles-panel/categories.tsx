import { Compass, Sparkles, Users, Mic, CalendarCheck, Cog } from "lucide-react";
import type { FeatureFlagKey } from "@/types/feature-flags";

// Feature flag categories
export type FlagCategory = "discovery" | "experience" | "social" | "voice" | "booking" | "system";

interface CategoryConfig {
  key: FlagCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    key: "discovery",
    label: "Discovery",
    icon: <Compass className="h-4 w-4" />,
    description: "Help visitors find and explore stories",
  },
  {
    key: "experience",
    label: "Experience",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Enhance the viewing experience",
  },
  {
    key: "social",
    label: "Social",
    icon: <Users className="h-4 w-4" />,
    description: "Community and sharing features",
  },
  {
    key: "voice",
    label: "Voice",
    icon: <Mic className="h-4 w-4" />,
    description: "Voice assistant features",
  },
  {
    key: "booking",
    label: "Booking",
    icon: <CalendarCheck className="h-4 w-4" />,
    description: "Bookings and deposits",
  },
  {
    key: "system",
    label: "System",
    icon: <Cog className="h-4 w-4" />,
    description: "System settings and maintenance",
  },
];

// Map each flag to its category. Exhaustive: a flag without a category is
// never shown in the panel, so a new FeatureFlagKey must be added here (#1036).
export const FLAG_CATEGORIES: Record<FeatureFlagKey, FlagCategory> = {
  // Discovery - help users find stories
  contextual_prompts: "discovery",
  related_stories: "discovery",
  randomized_order: "discovery",
  surprise_me: "discovery",
  seasonal_surfacing: "discovery",
  mood_discovery: "discovery",
  story_freshness: "discovery",
  // Experience - enhance viewing
  ambient_discovery: "experience",
  autoplay_button: "experience",
  asturianu_touches: "experience",
  fullscreen_button: "experience",
  // Social - community features
  story_sharing: "social",
  user_story_suggestions: "social",
  // Voice - AI assistant
  visitor_voice_agent: "voice",
  booking_system: "voice",
  sms_booking_confirmation: "voice",
  // Booking - voucher bookings with a PayPal deposit
  experience_booking: "booking",
  // System - settings and maintenance
  maintenance_mode: "system",
};

// Flags that have configurable settings
export const CONFIGURABLE_FLAGS = [
  "visitor_voice_agent",
  "maintenance_mode",
];

