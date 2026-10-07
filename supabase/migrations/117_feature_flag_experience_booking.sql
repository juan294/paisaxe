-- Add the experience_booking feature flag (PayPal hackathon plan).
-- Gates starting a booking: /acceso, the booking chat, quote acceptance and
-- payment-order creation. On in development, off in production until the
-- release.

INSERT INTO feature_flags (flag_key, enabled, label, description, config, environment)
VALUES
  ('experience_booking', true, 'Experience Booking',
   'Allow voucher holders to book and pay a deposit for a local experience through the text chat',
   '{}'::jsonb, 'development'),
  ('experience_booking', false, 'Experience Booking',
   'Allow voucher holders to book and pay a deposit for a local experience through the text chat',
   '{}'::jsonb, 'production')
ON CONFLICT (flag_key, environment) DO NOTHING;
