/**
 * SE-H2 (#842): the `stories` RLS policy must match the app-layer moderation
 * predicate used by every application read path — is_active = true AND
 * curation_status = 'approved' (see src/lib/stories-server.ts). Before
 * migration 102, the RLS policy from migration 003 only checked
 * `is_active = true`, so any client using the anon key could read
 * unapproved, AI-generated, human-unreviewed story content directly via
 * PostgREST, bypassing the moderation gate entirely.
 *
 * This suite exercises the REAL local Supabase stack over HTTP (not a mock)
 * so the RLS posture is actually verified, not assumed. It requires a local
 * Supabase Docker stack (`supabase start`) and is skipped automatically when
 * one isn't reachable — CI does not run a local Supabase stack for these
 * tests, consistent with the rest of the migration-safety workflow (see
 * .claude/rules/supabase.md), so this suite is a local/manual verification
 * gate, not a CI gate.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOCAL_ANON_KEY as ANON_KEY,
  LOCAL_REST_URL as REST_URL,
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const APPROVED_SLUG = "se-h2-test-approved-active";
const NEEDS_CURATION_SLUG = "se-h2-test-needs-curation-active";
const INACTIVE_APPROVED_SLUG = "se-h2-test-inactive-approved";

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("stories-rls.postgrest-rls.test.ts");
}

describe.skipIf(!dbReachable)("SE-H2: stories anon PostgREST access (live local Supabase)", () => {
  beforeAll(() => {
    // Seed three known rows as the postgres superuser so the assertions
    // below don't depend on whatever happens to already be seeded:
    // - approved + active: MUST be visible to anon (matches app predicate)
    // - needs_curation + active: MUST NOT be visible to anon (the bug this
    //   fixes — was previously visible because RLS only checked is_active)
    // - approved + inactive: MUST NOT be visible to anon
    psql(
      `INSERT INTO public.stories (slug, title, category, is_active, curation_status) VALUES ` +
        `('${APPROVED_SLUG}', 'SE-H2 approved active', 'nature', true, 'approved'), ` +
        `('${NEEDS_CURATION_SLUG}', 'SE-H2 needs curation active', 'nature', true, 'needs_curation'), ` +
        `('${INACTIVE_APPROVED_SLUG}', 'SE-H2 inactive approved', 'nature', false, 'approved') ` +
        `ON CONFLICT (slug) DO UPDATE SET is_active = excluded.is_active, curation_status = excluded.curation_status;`
    );
  });

  afterAll(() => {
    psql(
      `DELETE FROM public.stories WHERE slug IN ` +
        `('${APPROVED_SLUG}', '${NEEDS_CURATION_SLUG}', '${INACTIVE_APPROVED_SLUG}');`
    );
  });

  it("returns an approved + active story to anon", async () => {
    const res = await fetch(`${REST_URL}/stories?select=slug,is_active,curation_status&slug=eq.${APPROVED_SLUG}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].slug).toBe(APPROVED_SLUG);
  });

  it("does NOT return a needs_curation + active story to anon (the SE-H2 bug)", async () => {
    const res = await fetch(
      `${REST_URL}/stories?select=slug,is_active,curation_status&slug=eq.${NEEDS_CURATION_SLUG}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it("does NOT return an approved + inactive story to anon", async () => {
    const res = await fetch(
      `${REST_URL}/stories?select=slug,is_active,curation_status&slug=eq.${INACTIVE_APPROVED_SLUG}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
