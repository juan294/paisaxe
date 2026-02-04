-- Add booking_system feature flag
-- This allows admins to enable/disable the booking functionality
-- independently from the main voice agent (Pelayo Guide).

INSERT INTO feature_flags (flag_key, enabled, label, description, config, environment)
VALUES
  ('booking_system', false, 'Booking System',
   'Allow Pelayo to make outbound calls to book reservations',
   '{}'::jsonb, 'development'),
  ('booking_system', false, 'Booking System',
   'Allow Pelayo to make outbound calls to book reservations',
   '{}'::jsonb, 'production')
ON CONFLICT (flag_key, environment) DO NOTHING;
