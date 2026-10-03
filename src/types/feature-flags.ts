export type FeatureFlagKey =
  | "contextual_prompts"
  | "related_stories"
  | "randomized_order"
  | "surprise_me"
  | "story_sharing"
  | "seasonal_surfacing"
  | "mood_discovery"
  | "asturianu_touches"
  | "ambient_discovery"
  | "story_freshness"
  | "autoplay_button"
  | "visitor_voice_agent"
  | "booking_system"
  | "sms_booking_confirmation"
  | "maintenance_mode"
  | "user_story_suggestions"
  | "fullscreen_button"
  | "experience_booking";

export interface VisitorVoiceConfig {
  whitelisted_emails: string[];
  agent_id: string;
}

export interface MaintenanceConfig {
  title: string;
  message: string;
  show_tagline: boolean;
}

export type Environment = "development" | "production";

export interface FeatureFlag {
  id: string;
  flagKey: FeatureFlagKey;
  enabled: boolean;
  label: string;
  description: string | null;
  config: Record<string, unknown>;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagRow {
  id: string;
  flag_key: string;
  enabled: boolean;
  label: string;
  description: string | null;
  config: Record<string, unknown>;
  environment: Environment;
  created_at: string;
  updated_at: string;
}

export function rowToFeatureFlag(row: FeatureFlagRow): FeatureFlag {
  return {
    id: row.id,
    flagKey: row.flag_key as FeatureFlagKey,
    enabled: row.enabled,
    label: row.label,
    description: row.description,
    config: row.config || {},
    environment: row.environment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
