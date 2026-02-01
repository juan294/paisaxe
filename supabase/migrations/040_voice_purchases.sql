-- Migration: Voice purchases for monetization
-- Tracks voice access purchases via Lemon Squeezy

-- Create voice_purchases table
CREATE TABLE IF NOT EXISTS public.voice_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  purchase_type text NOT NULL CHECK (purchase_type IN ('day_pass')),
  lemon_squeezy_order_id text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_voice_purchases_user_id
  ON public.voice_purchases(user_id);

-- Index for expiry queries (cleanup jobs, access checks)
CREATE INDEX IF NOT EXISTS idx_voice_purchases_expires_at
  ON public.voice_purchases(expires_at)
  WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.voice_purchases ENABLE ROW LEVEL SECURITY;

-- Users can only view their own purchases
CREATE POLICY "Users can view own purchases"
  ON public.voice_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all purchases (for webhook inserts)
CREATE POLICY "Service role can manage all purchases"
  ON public.voice_purchases
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check if user has active voice access
CREATE OR REPLACE FUNCTION public.has_active_voice_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.voice_purchases
    WHERE user_id = p_user_id
      AND expires_at > now()
  );
$$;

-- Function to get user's active voice purchase (for showing expiry)
CREATE OR REPLACE FUNCTION public.get_active_voice_purchase(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  purchase_type text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    vp.id,
    vp.purchase_type,
    vp.expires_at,
    vp.created_at
  FROM public.voice_purchases vp
  WHERE vp.user_id = p_user_id
    AND vp.expires_at > now()
  ORDER BY vp.expires_at DESC
  LIMIT 1;
$$;
