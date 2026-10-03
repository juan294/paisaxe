/**
 * Identifiers of the fictitious demo merchant seeded by
 * supabase/migrations/116_operator_access_and_fixture.sql. Shared by the
 * booking service tests and later phases (E2E, evaluation, probes).
 */
export const FIXTURE_MERCHANT_SLUG = "demo-rutas-del-sella";

export const FIXTURE_EXPERIENCE_SLUGS = {
  /** 120 / 30 EUR, step_free yes (confirmed) */
  coastalWalk: "paseo-senda-costera",
  /** 60 / 15 EUR, step_free no (confirmed) */
  canoe: "descenso-canoa",
  /** 200 / 50 EUR, step_free unknown (not confirmed) */
  jeep: "ruta-miradores-4x4",
} as const;

/** The seeded operator_access row for the fixture merchant. */
export const FIXTURE_OPERATOR_ACCESS_ID = "a7e5c0de-0000-4000-8000-000000000001";
