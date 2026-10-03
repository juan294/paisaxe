-- ============================================================================
-- Migration: 116_operator_access_and_fixture.sql
-- Purpose: Operator capability rows and the fictitious demo merchant
--          (PayPal hackathon plan, Phase 1).
--
-- operator_access: the operator link is derived, not stored:
-- HMAC(BOOKING_LINK_SECRET, 'operator:' || id || ':' || link_version),
-- valid until expires_at. One row is seeded for the fixture merchant.
--
-- Fixture: merchant 'demo-rutas-del-sella' (is_fixture = true) with three
-- experiences whose step_free facts are yes / no / unknown, so the
-- representative request has a suitable, a rejected and an honestly unknown
-- option (plan F07). Every statement is an idempotent upsert keyed by slug
-- (or fixed id), so production and local Docker get the same fixture and a
-- re-run changes nothing. The DDL is re-runnable too (IF NOT EXISTS / DROP IF
-- EXISTS), so the whole file can be replayed against a seeded database.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.operator_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  label text NOT NULL,
  link_version integer NOT NULL DEFAULT 1 CHECK (link_version > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_access_merchant_id ON public.operator_access(merchant_id);

DROP TRIGGER IF EXISTS operator_access_updated_at ON public.operator_access;
CREATE TRIGGER operator_access_updated_at BEFORE UPDATE ON public.operator_access
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();

ALTER TABLE public.operator_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operator_access FROM anon;
REVOKE ALL ON TABLE public.operator_access FROM authenticated;
GRANT ALL ON TABLE public.operator_access TO service_role;
DROP POLICY IF EXISTS "Service role can manage operator_access" ON public.operator_access;
CREATE POLICY "Service role can manage operator_access"
  ON public.operator_access FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Fixture merchant
-- ---------------------------------------------------------------------------
INSERT INTO public.merchants (slug, name, timezone, cancellation_window_hours, is_fixture)
VALUES ('demo-rutas-del-sella', 'Rutas del Sella (demo, ficticio)', 'Europe/Madrid', 24, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  cancellation_window_hours = EXCLUDED.cancellation_window_hours,
  is_fixture = EXCLUDED.is_fixture;

-- ---------------------------------------------------------------------------
-- Fixture experiences: capacity 12 per slot, every day, 10:00 and 16:00, EUR.
-- price_cents is the total for one party.
-- ---------------------------------------------------------------------------
INSERT INTO public.experiences (
  merchant_id, slug, title, description, price_cents, deposit_cents, max_party,
  capacity_per_slot, slot_rule, duration_minutes
)
SELECT m.id, x.slug, x.title, x.description, x.price_cents, x.deposit_cents, x.max_party,
       12, '{"weekdays": [1, 2, 3, 4, 5, 6, 7], "start_times": ["10:00", "16:00"]}'::jsonb,
       x.duration_minutes
FROM public.merchants m
CROSS JOIN (VALUES
  ('paseo-senda-costera', 'Paseo por la senda costera',
   'Paseo guiado y llano por la senda costera, con paradas en los miradores. Experiencia de demostración (ficticia).',
   12000, 3000, 6, 150),
  ('descenso-canoa', 'Descenso en canoa',
   'Descenso en canoa por un tramo tranquilo del río, con monitor. Experiencia de demostración (ficticia).',
   6000, 1500, 4, 120),
  ('ruta-miradores-4x4', 'Ruta de miradores en 4x4',
   'Ruta en 4x4 por pistas de montaña hasta varios miradores. Experiencia de demostración (ficticia).',
   20000, 5000, 6, 180)
) AS x(slug, title, description, price_cents, deposit_cents, max_party, duration_minutes)
WHERE m.slug = 'demo-rutas-del-sella'
ON CONFLICT (slug) DO UPDATE SET
  merchant_id = EXCLUDED.merchant_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  deposit_cents = EXCLUDED.deposit_cents,
  max_party = EXCLUDED.max_party,
  capacity_per_slot = EXCLUDED.capacity_per_slot,
  slot_rule = EXCLUDED.slot_rule,
  duration_minutes = EXCLUDED.duration_minutes,
  active = true;

-- ---------------------------------------------------------------------------
-- Fixture provider facts (F07). Unknown values are never marked confirmed.
-- ---------------------------------------------------------------------------
INSERT INTO public.experience_facts (
  experience_id, key, value, detail, data, confirmed_by_provider, confirmed_at
)
SELECT e.id, f.key, f.value, f.detail, f.data::jsonb, f.confirmed,
       CASE WHEN f.confirmed THEN '2026-10-03T00:00:00Z'::timestamptz END
FROM public.experiences e
JOIN (VALUES
  ('paseo-senda-costera', 'step_free', 'yes',
   'Sendero llano de tierra compactada, sin escalones en todo el recorrido', '{}', true),
  ('paseo-senda-costera', 'public_transport', 'yes',
   'Parada de autobús a 300 m del punto de encuentro', '{}', true),
  ('paseo-senda-costera', 'languages', 'yes', 'Español e inglés', '{"languages": ["es", "en"]}', true),
  ('paseo-senda-costera', 'min_age', 'yes', 'Sin edad mínima', '{"min_age": 0}', true),
  ('descenso-canoa', 'step_free', 'no', 'El embarcadero tiene escalones', '{}', true),
  ('descenso-canoa', 'equipment_included', 'yes', 'Canoa, remo, chaleco y bidón estanco incluidos', '{}', true),
  ('descenso-canoa', 'min_age', 'yes', 'Edad mínima 8 años', '{"min_age": 8}', true),
  ('ruta-miradores-4x4', 'step_free', 'unknown', 'El proveedor no ha confirmado la accesibilidad', '{}', false),
  ('ruta-miradores-4x4', 'public_transport', 'no', 'Sin transporte público al punto de salida', '{}', true),
  ('ruta-miradores-4x4', 'pets_allowed', 'unknown', 'El proveedor no ha confirmado si se admiten mascotas', '{}', false)
) AS f(slug, key, value, detail, data, confirmed) ON f.slug = e.slug
ON CONFLICT (experience_id, key) DO UPDATE SET
  value = EXCLUDED.value,
  detail = EXCLUDED.detail,
  data = EXCLUDED.data,
  confirmed_by_provider = EXCLUDED.confirmed_by_provider,
  confirmed_at = EXCLUDED.confirmed_at;

-- ---------------------------------------------------------------------------
-- Fixture operator access: one row with a fixed id, valid through the judging
-- period (ends 2026-12-15). The link needs BOOKING_LINK_SECRET; the row alone
-- grants nothing.
-- ---------------------------------------------------------------------------
INSERT INTO public.operator_access (id, merchant_id, label, expires_at)
SELECT 'a7e5c0de-0000-4000-8000-000000000001'::uuid, m.id,
       'Operador demo Rutas del Sella', '2027-01-31T23:59:59Z'::timestamptz
FROM public.merchants m
WHERE m.slug = 'demo-rutas-del-sella'
ON CONFLICT (id) DO NOTHING;
