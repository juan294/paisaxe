/**
 * Fail-closed guards for release-required probes.
 *
 * A required probe that silently skips when a prerequisite is missing reports a
 * pass it never earned — the vacuous-pass failure this wave exists to remove.
 * These guards throw instead, so an unconfigured run fails loudly.
 *
 * They live here rather than inline in the specs so they can be unit-tested
 * without booting a browser or a web server.
 */

const LOCAL_DATASTORE_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Deployed probes must name the origin they verify. Falling back to a default
 * would let a release "verify" localhost and call the deployment green.
 */
export function requireReleaseTarget(url: string | undefined): string {
  const target = url?.trim();
  if (!target) {
    throw new Error(
      "RELEASE_TARGET_URL is not set. Deployed release probes must name the " +
        "origin they are verifying — refusing to probe an implicit default."
    );
  }
  return target;
}

/**
 * Mutating probes are restricted to the local Docker stack. Preview and
 * Production share one Supabase project and live-mode Stripe keys, so a write
 * against either is a production write (plan D-B).
 */
export function assertLocalDatastore(url: string | undefined): void {
  const datastoreUrl = url?.trim();

  if (!datastoreUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. This probe writes to the datastore " +
        "and refuses to run without knowing which one it would write to."
    );
  }

  let host: string;
  try {
    host = new URL(datastoreUrl).hostname;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${datastoreUrl}`
    );
  }

  if (!LOCAL_DATASTORE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run a mutating probe against ${host}. This probe writes and ` +
        "deletes rows; Preview and Production share one Supabase project, so it " +
        "is restricted to the local Docker stack (npx supabase start)."
    );
  }
}
