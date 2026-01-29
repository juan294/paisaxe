-- Migration: Add visitor_voice_agent feature flag
-- This enables ElevenLabs conversational voice for whitelisted visitors

INSERT INTO public.feature_flags (id, flag_key, enabled, label, description, config)
VALUES (
  gen_random_uuid(),
  'visitor_voice_agent',
  false,
  'Visitor Voice Agent',
  'Enable ElevenLabs conversational voice for whitelisted visitors (requires sign-in)',
  '{"whitelisted_emails": [], "agent_id": ""}'::jsonb
)
ON CONFLICT (flag_key) DO NOTHING;
