-- Add sms_booking_confirmation feature flag
-- This flag gates the SMS confirmation flow after booking agent calls complete.
-- When enabled, customers receive SMS updates about their reservation status.

INSERT INTO feature_flags (flag_key, enabled, label, description, config, environment)
VALUES
  ('sms_booking_confirmation', false, 'SMS Booking Confirmation',
   'Send SMS confirmation to customers after booking agent calls complete',
   '{}'::jsonb, 'development'),
  ('sms_booking_confirmation', false, 'SMS Booking Confirmation',
   'Send SMS confirmation to customers after booking agent calls complete',
   '{}'::jsonb, 'production')
ON CONFLICT (flag_key, environment) DO NOTHING;
