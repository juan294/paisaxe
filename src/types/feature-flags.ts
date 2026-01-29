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
  | "visitor_voice_agent";

export interface VisitorVoiceConfig {
  whitelisted_emails: string[];
  agent_id: string;
}

export interface FeatureFlag {
  id: string;
  flagKey: FeatureFlagKey;
  enabled: boolean;
  label: string;
  description: string | null;
  config: Record<string, unknown>;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
