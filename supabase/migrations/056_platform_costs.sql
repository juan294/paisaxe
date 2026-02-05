-- Migration: Platform Costs Table
-- Stores manual cost entries for services without billing APIs

-- Create the platform_costs table
CREATE TABLE IF NOT EXISTS public.platform_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL,
  service_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('ai', 'infrastructure', 'communications', 'analytics', 'payments')),
  cost_usd numeric(10, 2) NOT NULL CHECK (cost_usd >= 0),
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Prevent duplicate entries for same service/period
  UNIQUE(service_id, billing_period_start, billing_period_end)
);

-- Add comments for documentation
COMMENT ON TABLE public.platform_costs IS 'Manual cost entries for platform services that lack billing APIs';
COMMENT ON COLUMN public.platform_costs.service_id IS 'Unique identifier for the service (e.g., voyage, supabase)';
COMMENT ON COLUMN public.platform_costs.service_name IS 'Human-readable service name';
COMMENT ON COLUMN public.platform_costs.category IS 'Service category: ai, infrastructure, communications, analytics, payments';
COMMENT ON COLUMN public.platform_costs.cost_usd IS 'Cost in USD for the billing period';
COMMENT ON COLUMN public.platform_costs.billing_period_start IS 'Start of the billing period';
COMMENT ON COLUMN public.platform_costs.billing_period_end IS 'End of the billing period';
COMMENT ON COLUMN public.platform_costs.notes IS 'Optional notes about the cost entry';
COMMENT ON COLUMN public.platform_costs.created_by IS 'User who created the entry';

-- Create index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_platform_costs_billing_period
  ON public.platform_costs(billing_period_start, billing_period_end);

-- Create index for service lookups
CREATE INDEX IF NOT EXISTS idx_platform_costs_service_id
  ON public.platform_costs(service_id);

-- Enable RLS
ALTER TABLE public.platform_costs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read platform costs
CREATE POLICY "Admins can read platform_costs"
  ON public.platform_costs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Only admins can insert platform costs
CREATE POLICY "Admins can insert platform_costs"
  ON public.platform_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Only admins can update platform costs
CREATE POLICY "Admins can update platform_costs"
  ON public.platform_costs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Only admins can delete platform costs
CREATE POLICY "Admins can delete platform_costs"
  ON public.platform_costs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Grant service role full access for API operations
GRANT ALL ON public.platform_costs TO service_role;
