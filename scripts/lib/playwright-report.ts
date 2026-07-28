/**
 * Zero-test guard for Playwright runs.
 *
 * `playwright test` exits 0 when every selected test was skipped, so an
 * integration job can report success having verified nothing. Any run whose
 * result gates a merge or a release must assert that tests actually executed.
 */

export interface PlaywrightStats {
  expected?: number;
  unexpected?: number;
  flaky?: number;
  skipped?: number;
}

export interface PlaywrightJsonReport {
  stats?: PlaywrightStats;
}

/**
 * Throws unless at least one test actually ran to a non-skipped result.
 * Skipped tests are explicitly not evidence.
 */
export function assertTestsExecuted(
  report: PlaywrightJsonReport | undefined,
  context: string
): void {
  const stats = report?.stats;

  if (!stats) {
    throw new Error(
      `${context}: no Playwright JSON report was produced, so it is unknown whether any test ran.`
    );
  }

  const executed =
    (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0);

  if (executed === 0) {
    throw new Error(
      `${context}: zero tests executed (${stats.skipped ?? 0} skipped). ` +
        "A run that verifies nothing is not a pass."
    );
  }
}
