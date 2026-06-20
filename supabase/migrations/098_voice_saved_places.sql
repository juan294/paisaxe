-- Voice-saved places (#34): lets Pelayo bookmark a place during a voice conversation.
--
-- The visitor voice agent has no authenticated web session, so bookmarks are keyed
-- by the ElevenLabs conversation id (passed by the save_favorite tool as a
-- system-provided variable). This is intentionally separate from user_favorites,
-- which is story-keyed and tied to web auth.

CREATE TABLE voice_saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,        -- ElevenLabs conversation/session id
  place_name TEXT NOT NULL,
  place_address TEXT,
  place_id TEXT,                        -- Google Places id, when available
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Look up a visitor's saved places for a conversation.
CREATE INDEX idx_voice_saved_places_conversation_id
  ON voice_saved_places(conversation_id);

-- Avoid duplicate saves of the same place in the same conversation.
CREATE UNIQUE INDEX idx_voice_saved_places_unique
  ON voice_saved_places(conversation_id, place_name);

-- RLS: only the service role (the MCP webhook backend) can access these rows.
ALTER TABLE voice_saved_places ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only the service role (using the service key) can access.
